from fastapi import FastAPI, APIRouter, HTTPException, status, Query, Request, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date, time, timedelta
from supabase import create_client, Client
import re
import requests
import hmac
import hashlib
import uuid


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase connection
supabase_url = os.environ['SUPABASE_URL']
supabase_key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
supabase: Client = create_client(supabase_url, supabase_key)

# Create the main app without a prefix
app = FastAPI(title="Beauty Stylist Marketplace API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ==================== MODELS ====================

# User Models
class UserCreate(BaseModel):
    auth_id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str = "customer"  # customer or stylist
    phone_verified: bool = False
    # Phase 1.9 - Privacy & Identity fields
    country: Optional[str] = None
    city: Optional[str] = None
    gender: Optional[str] = None  # male, female, other, prefer_not_to_say

class UserUpdate(BaseModel):
    name: Optional[str] = None
    # Note: email is NOT included - it's read-only from auth
    phone: Optional[str] = None
    phone_verified: Optional[bool] = None
    # Phase 1.9 - Privacy & Identity fields
    country: Optional[str] = None
    city: Optional[str] = None
    gender: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    auth_id: str
    name: str
    email: str
    phone: Optional[str]
    role: str
    phone_verified: Optional[bool] = False
    profile_completed: Optional[bool] = False
    # Phase 1.9 - Privacy & Identity fields
    country: Optional[str] = None
    city: Optional[str] = None
    gender: Optional[str] = None

# Stylist Models
class StylistCreate(BaseModel):
    user_id: int  # Foreign key to users.id (also serves as primary key)
    hourly_rate: float
    is_verified: bool = False
    is_premium: bool = False
    bio: Optional[str] = None
    location: Optional[str] = None
    # Phase 1.9 - Provider Type
    provider_type: Optional[str] = "individual"  # individual or business
    business_name: Optional[str] = None

class StylistUpdate(BaseModel):
    hourly_rate: Optional[float] = None
    is_verified: Optional[bool] = None
    is_premium: Optional[bool] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    # Phase 1.9 - Provider Type
    provider_type: Optional[str] = None
    business_name: Optional[str] = None

class StylistResponse(BaseModel):
    user_id: int  # Primary key
    hourly_rate: float
    is_verified: bool
    is_premium: bool
    bio: Optional[str] = None
    location: Optional[str] = None
    rating: Optional[float] = 0.0
    # Phase 1.9 - Provider Type
    provider_type: Optional[str] = "individual"
    business_name: Optional[str] = None
    # Populated from join with users table
    user_name: Optional[str] = None
    user_email: Optional[str] = None

# Wallet Models
class WalletCreate(BaseModel):
    user_auth_id: str  # Foreign key to users.auth_id
    balance: float = 0.0

class WalletUpdate(BaseModel):
    balance: Optional[float] = None

class WalletResponse(BaseModel):
    id: int
    user_auth_id: str
    balance: float


# Payment Models (Phase 2.2 - Paystack Integration)
class PaymentInitRequest(BaseModel):
    amount: float  # Amount in Naira
    email: EmailStr
    purpose: str  # "wallet_topup" or "booking_escrow"
    booking_id: Optional[int] = None

class PaymentVerifyResponse(BaseModel):
    status: str
    message: str
    reference: Optional[str] = None
    amount: Optional[float] = None


# Provider Services Models (Phase 1.3 - Enhanced)
class ProviderServiceCreate(BaseModel):
    provider_id: int  # user_id from stylists table
    sub_service_id: str  # Sub-service identifier (e.g., "haircut", "box-braids")
    sub_service_name: str  # Display name
    service_id: str  # Parent service ID (e.g., "barbers")
    category_id: str  # Category ID (e.g., "beauty-grooming")
    price: float = 0.0
    duration_minutes: int = 60
    description: Optional[str] = None
    in_store: bool = True
    home_service: bool = False
    travel_service: bool = False
    is_active: bool = True

class ProviderServiceUpdate(BaseModel):
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    in_store: Optional[bool] = None
    home_service: Optional[bool] = None
    travel_service: Optional[bool] = None
    is_active: Optional[bool] = None

class ProviderServiceResponse(BaseModel):
    id: int
    provider_id: int
    sub_service_id: str
    sub_service_name: str
    service_id: str
    category_id: str
    price: float
    duration_minutes: int
    description: Optional[str] = None
    in_store: bool
    home_service: bool
    travel_service: bool
    is_active: bool

# Bulk service toggle request
class ServiceToggleRequest(BaseModel):
    sub_service_id: str
    sub_service_name: str
    service_id: str
    category_id: str
    is_active: bool
    price: float = 0.0
    duration_minutes: int = 60
    description: Optional[str] = None
    in_store: bool = True
    home_service: bool = False
    travel_service: bool = False

class BulkServiceToggleRequest(BaseModel):
    services: List[ServiceToggleRequest]


# ==================== AVAILABILITY MODELS (Phase 2.0) ====================

class WeeklyAvailability(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Sunday, 6=Saturday")
    is_active: bool = True  # Column is named is_active in Supabase
    start_time: Optional[str] = None  # "HH:MM" format
    end_time: Optional[str] = None    # "HH:MM" format
    
    @validator('start_time', 'end_time', pre=True)
    def validate_time_format(cls, v):
        if v is None:
            return v
        if not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', v):
            raise ValueError('Time must be in HH:MM format')
        return v

class WeeklyAvailabilityRequest(BaseModel):
    weekly: List[WeeklyAvailability]

class AvailabilityException(BaseModel):
    date: str  # "YYYY-MM-DD" format
    is_unavailable: bool = True  # If true, whole day off; if false, custom hours
    start_time: Optional[str] = None  # Override start time
    end_time: Optional[str] = None    # Override end time
    note: Optional[str] = None
    
    @validator('date', pre=True)
    def validate_date_format(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')
        return v
    
    @validator('start_time', 'end_time', pre=True)
    def validate_time_format(cls, v):
        if v is None:
            return v
        if not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', v):
            raise ValueError('Time must be in HH:MM format')
        return v

class ExceptionsRequest(BaseModel):
    exceptions: List[AvailabilityException]

class BookingRules(BaseModel):
    max_sessions_per_day: int = Field(default=6, ge=1, le=20)
    min_notice_minutes: int = Field(default=0, ge=0)
    slot_step_minutes: int = Field(default=30)
    
    @validator('slot_step_minutes')
    def validate_slot_step(cls, v):
        if v not in [10, 15, 20, 30, 60]:
            raise ValueError('slot_step_minutes must be one of: 10, 15, 20, 30, 60')
        return v

class AvailabilityResponse(BaseModel):
    weekly: List[Dict[str, Any]]
    exceptions: List[Dict[str, Any]]
    rules: Dict[str, Any]

class AvailableSlotsResponse(BaseModel):
    date: str
    slots: List[str]
    timezone: str = "UTC"


# ==================== DATABASE CONNECTION TEST ====================

@api_router.get("/test-connection")
async def test_connection():
    """Test database connection to Supabase"""
    try:
        response = supabase.table("users").select("count", count="exact").limit(0).execute()
        return {
            "status": "connected",
            "message": "Successfully connected to Supabase",
            "database": "PostgreSQL",
            "url": supabase_url
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection failed: {str(e)}"
        )


@api_router.post("/init-provider-services-table")
async def init_provider_services_table():
    """Initialize provider_services table if it doesn't exist"""
    import requests
    
    # SQL to create the provider_services table
    sql = """
    CREATE TABLE IF NOT EXISTS provider_services (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER NOT NULL,
        service_id VARCHAR(100) NOT NULL,
        service_name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) DEFAULT 0.00,
        duration INTEGER DEFAULT 60,
        enabled BOOLEAN DEFAULT true,
        consultation_required BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(provider_id, service_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id ON provider_services(provider_id);
    CREATE INDEX IF NOT EXISTS idx_provider_services_enabled ON provider_services(enabled);
    """
    
    try:
        # Use Supabase SQL API
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        # Execute SQL via Supabase REST API
        response = requests.post(
            f"{supabase_url}/rest/v1/rpc/exec_sql",
            headers=headers,
            json={"query": sql}
        )
        
        if response.status_code == 404:
            # RPC function doesn't exist, try direct table check
            return {
                "status": "manual_required",
                "message": "Please run the SQL script manually in Supabase SQL Editor",
                "sql": sql
            }
        
        return {
            "status": "success",
            "message": "Provider services table initialized"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "sql": sql
        }


# ==================== USERS ENDPOINTS ====================

@api_router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreate):
    """Create a new user"""
    try:
        # Check if user with auth_id already exists
        existing = supabase.table("users").select("*").eq("auth_id", user_data.auth_id).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this auth_id already exists"
            )
        
        # Create user
        user_dict = {
            "auth_id": user_data.auth_id,
            "name": user_data.name,
            "email": user_data.email,
            "phone": user_data.phone,
            "role": user_data.role
        }
        
        response = supabase.table("users").insert(user_dict).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@api_router.get("/users", response_model=List[UserResponse])
async def get_all_users():
    """Get all users"""
    try:
        response = supabase.table("users").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users: {str(e)}"
        )

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int):
    """Get a specific user by ID"""
    try:
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user: {str(e)}"
        )

@api_router.get("/users/by-auth/{auth_id}", response_model=UserResponse)
async def get_user_by_auth_id(auth_id: str):
    """Get a user by auth_id"""
    try:
        response = supabase.table("users").select("*").eq("auth_id", auth_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user: {str(e)}"
        )

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, user_update: UserUpdate):
    """Update a user"""
    try:
        existing = supabase.table("users").select("*").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        update_data = user_update.model_dump(exclude_unset=True)
        if not update_data:
            return existing.data[0]
        
        # Phase 1.9: Filter out fields that might not exist in DB yet
        # This provides graceful fallback if migration hasn't been run
        existing_fields = set(existing.data[0].keys())
        safe_update_data = {k: v for k, v in update_data.items() if k in existing_fields or k in ['name', 'phone', 'phone_verified']}
        
        # Log if we're skipping any fields
        skipped_fields = set(update_data.keys()) - set(safe_update_data.keys())
        if skipped_fields:
            logging.warning(f"Skipping fields not in DB: {skipped_fields}")
        
        if not safe_update_data:
            return existing.data[0]
        
        response = supabase.table("users").update(safe_update_data).eq("id", user_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}"
        )

@api_router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int):
    """Delete a user"""
    try:
        existing = supabase.table("users").select("*").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        supabase.table("users").delete().eq("id", user_id).execute()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )


# ==================== STYLISTS ENDPOINTS ====================

@api_router.post("/stylists", response_model=StylistResponse, status_code=status.HTTP_201_CREATED)
async def create_stylist(stylist_data: StylistCreate):
    """Create a new stylist profile"""
    try:
        # Verify user exists
        user = supabase.table("users").select("*").eq("id", stylist_data.user_id).execute()
        if not user.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found with this user_id"
            )
        
        # Check if stylist already exists for this user
        existing = supabase.table("stylists").select("*").eq("user_id", stylist_data.user_id).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stylist profile already exists for this user"
            )
        
        stylist_dict = {
            "user_id": stylist_data.user_id,
            "hourly_rate": stylist_data.hourly_rate,
            "is_verified": stylist_data.is_verified,
            "is_premium": stylist_data.is_premium
        }
        
        response = supabase.table("stylists").insert(stylist_dict).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create stylist: {str(e)}"
        )

@api_router.get("/stylists", response_model=List[StylistResponse])
async def get_all_stylists(
    verified_only: bool = False,
    premium_only: bool = False,
    sort_by: str = "hourly_rate"  # hourly_rate, verified, premium
):
    """Get all stylists with optional filtering and sorting"""
    try:
        # Build query - use specific relationship name to avoid ambiguity
        query = supabase.table("stylists").select("*, users!stylists_user_id_fkey(name, email)")
        
        if verified_only:
            query = query.eq("is_verified", True)
        if premium_only:
            query = query.eq("is_premium", True)
        
        # Execute query
        response = query.execute()
        
        # Format response to include user data
        stylists = []
        for item in response.data:
            stylist = {
                "user_id": item["user_id"],
                "hourly_rate": item["hourly_rate"],
                "is_verified": item["is_verified"],
                "is_premium": item["is_premium"],
                "bio": item.get("bio"),
                "location": item.get("location"),
                "rating": item.get("rating", 0.0),
                # Phase 1.9 - Provider Type
                "provider_type": item.get("provider_type", "individual"),
                "business_name": item.get("business_name"),
                "user_name": item["users"]["name"] if item.get("users") else None,
                "user_email": item["users"]["email"] if item.get("users") else None
            }
            stylists.append(stylist)
        
        # Sort results
        if sort_by == "hourly_rate":
            stylists.sort(key=lambda x: x["hourly_rate"])
        elif sort_by == "verified":
            stylists.sort(key=lambda x: (not x["is_verified"], x["hourly_rate"]))
        elif sort_by == "premium":
            stylists.sort(key=lambda x: (not x["is_premium"], not x["is_verified"], x["hourly_rate"]))
        
        return stylists
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stylists: {str(e)}"
        )

@api_router.get("/stylists/{user_id}", response_model=StylistResponse)
async def get_stylist(user_id: int):
    """Get a specific stylist by user_id"""
    try:
        response = supabase.table("stylists").select("*, users!stylists_user_id_fkey(name, email)").eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stylist not found"
            )
        
        item = response.data[0]
        return {
            "user_id": item["user_id"],
            "hourly_rate": item["hourly_rate"],
            "is_verified": item["is_verified"],
            "is_premium": item["is_premium"],
            "bio": item.get("bio"),
            "location": item.get("location"),
            "rating": item.get("rating", 0.0),
            # Phase 1.9 - Provider Type
            "provider_type": item.get("provider_type", "individual"),
            "business_name": item.get("business_name"),
            "user_name": item["users"]["name"] if item.get("users") else None,
            "user_email": item["users"]["email"] if item.get("users") else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stylist: {str(e)}"
        )

@api_router.get("/stylists/by-user/{user_id}", response_model=StylistResponse)
async def get_stylist_by_user_id(user_id: int):
    """Get stylist profile by user_id (alias for consistency)"""
    return await get_stylist(user_id)

@api_router.put("/stylists/{user_id}", response_model=StylistResponse)
async def update_stylist(user_id: int, stylist_update: StylistUpdate):
    """Update a stylist profile"""
    try:
        existing = supabase.table("stylists").select("*").eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stylist not found"
            )
        
        update_data = stylist_update.model_dump(exclude_unset=True)
        if not update_data:
            return existing.data[0]
        
        # Phase 1.9: Filter out fields that might not exist in DB yet
        # This provides graceful fallback if migration hasn't been run
        existing_fields = set(existing.data[0].keys())
        safe_update_data = {k: v for k, v in update_data.items() if k in existing_fields or k in ['hourly_rate', 'is_verified', 'is_premium', 'bio', 'location']}
        
        # Log if we're skipping any fields
        skipped_fields = set(update_data.keys()) - set(safe_update_data.keys())
        if skipped_fields:
            logging.warning(f"Skipping fields not in DB: {skipped_fields}")
        
        if not safe_update_data:
            return existing.data[0]
        
        response = supabase.table("stylists").update(safe_update_data).eq("user_id", user_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update stylist: {str(e)}"
        )

@api_router.delete("/stylists/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stylist(user_id: int):
    """Delete a stylist profile"""
    try:
        existing = supabase.table("stylists").select("*").eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stylist not found"
            )
        
        supabase.table("stylists").delete().eq("user_id", user_id).execute()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete stylist: {str(e)}"
        )


# ==================== WALLETS ENDPOINTS ====================

@api_router.post("/wallets", response_model=WalletResponse, status_code=status.HTTP_201_CREATED)
async def create_wallet(wallet_data: WalletCreate):
    """Create a new wallet"""
    try:
        # Verify user exists
        user = supabase.table("users").select("*").eq("auth_id", wallet_data.user_auth_id).execute()
        if not user.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found with this auth_id"
            )
        
        # Check if wallet already exists
        existing = supabase.table("wallets").select("*").eq("user_auth_id", wallet_data.user_auth_id).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wallet already exists for this user"
            )
        
        wallet_dict = {
            "user_auth_id": wallet_data.user_auth_id,
            "balance": wallet_data.balance
        }
        
        response = supabase.table("wallets").insert(wallet_dict).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create wallet: {str(e)}"
        )

@api_router.get("/wallets", response_model=List[WalletResponse])
async def get_all_wallets():
    """Get all wallets"""
    try:
        response = supabase.table("wallets").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch wallets: {str(e)}"
        )

@api_router.get("/wallets/{wallet_id}", response_model=WalletResponse)
async def get_wallet(wallet_id: int):
    """Get a specific wallet by ID"""
    try:
        response = supabase.table("wallets").select("*").eq("id", wallet_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch wallet: {str(e)}"
        )

@api_router.get("/wallets/by-auth/{auth_id}", response_model=WalletResponse)
async def get_wallet_by_auth_id(auth_id: str):
    """Get wallet by user auth_id"""
    try:
        response = supabase.table("wallets").select("*").eq("user_auth_id", auth_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found for this user"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch wallet: {str(e)}"
        )

@api_router.put("/wallets/{wallet_id}", response_model=WalletResponse)
async def update_wallet(wallet_id: int, wallet_update: WalletUpdate):
    """Update a wallet (e.g., top-up balance)"""
    try:
        existing = supabase.table("wallets").select("*").eq("id", wallet_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found"
            )
        
        update_data = wallet_update.model_dump(exclude_unset=True)
        if not update_data:
            return existing.data[0]
        
        response = supabase.table("wallets").update(update_data).eq("id", wallet_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update wallet: {str(e)}"
        )

@api_router.post("/wallets/{wallet_id}/topup")
async def topup_wallet(wallet_id: int, amount: float):
    """Top-up wallet balance (simulation for Phase 1)"""
    try:
        if amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Top-up amount must be greater than 0"
            )
        
        existing = supabase.table("wallets").select("*").eq("id", wallet_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found"
            )
        
        current_balance = existing.data[0]["balance"]
        new_balance = current_balance + amount
        
        response = supabase.table("wallets").update({"balance": new_balance}).eq("id", wallet_id).execute()
        return {
            "message": "Top-up successful",
            "previous_balance": current_balance,
            "amount_added": amount,
            "new_balance": new_balance
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to top-up wallet: {str(e)}"
        )

@api_router.delete("/wallets/{wallet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wallet(wallet_id: int):
    """Delete a wallet"""
    try:
        existing = supabase.table("wallets").select("*").eq("id", wallet_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found"
            )
        
        supabase.table("wallets").delete().eq("id", wallet_id).execute()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete wallet: {str(e)}"
        )


# ==================== PAYSTACK PAYMENT ENDPOINTS (Phase 2.2) ====================

def get_paystack_headers():
    """Get Paystack API headers with secret key"""
    secret_key = os.environ.get('PAYSTACK_SECRET_KEY')
    if not secret_key:
        return None
    return {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }


@api_router.post("/payments/paystack/initialize")
async def initialize_paystack_payment(request: PaymentInitRequest):
    """Initialize a Paystack transaction for wallet top-up ONLY"""
    try:
        # ONLY allow wallet_topup - bookings must use wallet payment
        if request.purpose != "wallet_topup":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paystack is only available for wallet top-ups. Use /api/bookings/{id}/pay-with-wallet for booking payments."
            )
        
        headers = get_paystack_headers()
        if not headers:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment gateway not configured. PAYSTACK_SECRET_KEY is missing."
            )
        
        # Validate amount
        if request.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount must be greater than 0"
            )
        
        # Generate unique reference
        reference = f"istylist_{request.purpose}_{uuid.uuid4().hex[:12]}"
        
        # Convert amount to kobo (Paystack uses smallest currency unit)
        amount_kobo = int(request.amount * 100)
        
        # Prepare Paystack payload
        callback_url = os.environ.get('PAYSTACK_CALLBACK_URL', '')
        payload = {
            "email": request.email,
            "amount": amount_kobo,
            "reference": reference,
            "metadata": {
                "purpose": request.purpose,
                "custom_fields": [
                    {"display_name": "Purpose", "variable_name": "purpose", "value": request.purpose}
                ]
            }
        }
        if callback_url:
            payload["callback_url"] = callback_url
        
        # Call Paystack API
        response = requests.post(
            "https://api.paystack.co/transaction/initialize",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        if response.status_code != 200:
            logging.error(f"Paystack initialize failed: {response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to initialize payment with Paystack"
            )
        
        paystack_data = response.json()
        
        if not paystack_data.get("status"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=paystack_data.get("message", "Paystack initialization failed")
            )
        
        # Save payment record
        payment_record = {
            "reference": reference,
            "email": request.email,
            "amount": request.amount,
            "purpose": request.purpose,
            "payment_provider": "paystack",
            "status": "pending",
            "paystack_access_code": paystack_data["data"].get("access_code"),
            "created_at": datetime.utcnow().isoformat()
        }
        
        if check_table_exists("payments"):
            supabase.table("payments").insert(payment_record).execute()
        
        return {
            "status": True,
            "message": "Authorization URL created",
            "authorization_url": paystack_data["data"]["authorization_url"],
            "access_code": paystack_data["data"]["access_code"],
            "reference": reference
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Payment initialization error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize payment: {str(e)}"
        )


@api_router.get("/payments/paystack/verify")
async def verify_paystack_payment(reference: str = Query(..., description="Payment reference")):
    """Verify a Paystack transaction and process wallet/escrow credit"""
    try:
        headers = get_paystack_headers()
        if not headers:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment gateway not configured"
            )
        
        # Check if already processed (idempotent)
        if check_table_exists("payments"):
            existing = supabase.table("payments").select("*").eq("reference", reference).execute()
            if existing.data:
                payment = existing.data[0]
                if payment.get("status") == "success" and payment.get("processed"):
                    return {
                        "status": "success",
                        "message": "Payment already verified and processed",
                        "reference": reference,
                        "amount": payment.get("amount")
                    }
        
        # Verify with Paystack
        response = requests.get(
            f"https://api.paystack.co/transaction/verify/{reference}",
            headers=headers,
            timeout=30
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to verify payment with Paystack"
            )
        
        paystack_data = response.json()
        
        if not paystack_data.get("status"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment verification failed"
            )
        
        transaction = paystack_data["data"]
        tx_status = transaction.get("status")
        
        # Update payment status
        if check_table_exists("payments"):
            supabase.table("payments").update({
                "status": tx_status,
                "paystack_response": transaction,
                "verified_at": datetime.utcnow().isoformat()
            }).eq("reference", reference).execute()
        
        # If successful, process the payment
        if tx_status == "success":
            metadata = transaction.get("metadata", {})
            purpose = metadata.get("purpose", "wallet_topup")
            booking_id = metadata.get("booking_id")
            email = transaction.get("customer", {}).get("email")
            amount_naira = transaction.get("amount", 0) / 100  # Convert from kobo
            
            # Get user by email
            user_response = supabase.table("users").select("auth_id").eq("email", email).execute()
            if not user_response.data:
                logging.warning(f"User not found for email: {email}")
                return {
                    "status": "success",
                    "message": "Payment verified but user not found for wallet credit",
                    "reference": reference,
                    "amount": amount_naira
                }
            
            user_auth_id = user_response.data[0]["auth_id"]
            
            if purpose == "wallet_topup":
                # Credit wallet available_balance
                await _credit_wallet(user_auth_id, amount_naira, "TOPUP", reference)
            elif purpose == "booking_escrow" and booking_id:
                # Move to escrow_balance
                await _credit_escrow(user_auth_id, amount_naira, booking_id, reference)
                # Update booking status from pending_payment to pending
                if check_table_exists("bookings"):
                    supabase.table("bookings").update({
                        "status": "pending",
                        "payment_reference": reference,
                        "payment_status": "paid"
                    }).eq("id", booking_id).execute()
            
            # Mark as processed
            if check_table_exists("payments"):
                supabase.table("payments").update({
                    "processed": True,
                    "processed_at": datetime.utcnow().isoformat()
                }).eq("reference", reference).execute()
        
        return {
            "status": tx_status,
            "message": f"Payment {tx_status}",
            "reference": reference,
            "amount": transaction.get("amount", 0) / 100
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Payment verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify payment: {str(e)}"
        )


async def _credit_wallet(user_auth_id: str, amount: float, tx_type: str, reference: str):
    """Credit user's available wallet balance with proper transaction logging"""
    try:
        # Idempotency check - don't credit twice for same reference
        if check_table_exists("payments"):
            existing = supabase.table("payments").select("id, processed").eq("reference", reference).execute()
            if existing.data and existing.data[0].get("processed"):
                logging.info(f"Reference {reference} already processed, skipping wallet credit")
                return
        
        # Also check wallet_transactions for this reference
        if check_table_exists("wallet_transactions"):
            existing_tx = supabase.table("wallet_transactions").select("id").eq("reference", reference).execute()
            if existing_tx.data:
                logging.info(f"Transaction already exists for reference {reference}, skipping")
                return
        
        # Get or create wallet
        wallet_response = supabase.table("wallets").select("*").eq("user_auth_id", user_auth_id).execute()
        
        if wallet_response.data:
            wallet = wallet_response.data[0]
            new_balance = (wallet.get("balance") or 0) + amount
            supabase.table("wallets").update({"balance": new_balance}).eq("id", wallet["id"]).execute()
        else:
            # Create wallet with balance
            supabase.table("wallets").insert({
                "user_auth_id": user_auth_id,
                "balance": amount
            }).execute()
        
        # Record transaction with proper field values matching DB constraints
        # type: 'credit' or 'debit', direction: 'credit' or 'debit', status: 'pending'|'completed'|'failed'
        if check_table_exists("wallet_transactions"):
            supabase.table("wallet_transactions").insert({
                "user_auth_id": user_auth_id,
                "auth_id": user_auth_id,  # Ensure auth_id is always set
                "type": "credit",  # DB constraint: 'credit' or 'debit'
                "direction": "credit",  # lowercase
                "amount": amount,
                "reference": reference,
                "description": f"Wallet top-up: {CURRENCY}{amount:,.2f}",
                "status": "completed",
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        
        logging.info(f"Wallet credited: {amount} for user {user_auth_id}, ref {reference}")
    except Exception as e:
        logging.error(f"Failed to credit wallet: {str(e)}")


async def _credit_escrow(user_auth_id: str, amount: float, booking_id: int, reference: str):
    """Hold funds in escrow for a booking with proper transaction logging"""
    try:
        # Idempotency check - don't credit escrow twice for same booking+reference
        if check_table_exists("wallet_transactions"):
            existing_tx = supabase.table("wallet_transactions").select("id").eq(
                "reference", reference
            ).execute()
            if existing_tx.data:
                logging.info(f"Escrow transaction already exists for reference {reference}, skipping")
                return
        
        # Get or create wallet
        wallet_response = supabase.table("wallets").select("*").eq("user_auth_id", user_auth_id).execute()
        
        if wallet_response.data:
            wallet = wallet_response.data[0]
            new_escrow = (wallet.get("escrow_balance") or 0) + amount
            supabase.table("wallets").update({"escrow_balance": new_escrow}).eq("id", wallet["id"]).execute()
        else:
            supabase.table("wallets").insert({
                "user_auth_id": user_auth_id,
                "balance": 0,
                "escrow_balance": amount
            }).execute()
        
        # Record transaction with proper field values matching DB constraints
        if check_table_exists("wallet_transactions"):
            supabase.table("wallet_transactions").insert({
                "user_auth_id": user_auth_id,
                "auth_id": user_auth_id,  # Ensure auth_id is always set
                "type": "credit",  # DB constraint: 'credit' or 'debit'
                "direction": "credit",  # lowercase - escrow hold is a credit to escrow
                "amount": amount,
                "reference": reference,
                "booking_id": booking_id,
                "description": f"Escrow hold for booking #{booking_id}",
                "status": "completed",
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        
        logging.info(f"Escrow credited: {amount} for user {user_auth_id}, booking {booking_id}")
    except Exception as e:
        logging.error(f"Failed to credit escrow: {str(e)}")


async def _release_escrow_to_provider(booking_id: int, provider_auth_id: str, customer_auth_id: str):
    """Release escrow funds to provider when booking is completed"""
    try:
        # Check for idempotency using payments table - don't release twice
        release_ref = f"escrow_release_{booking_id}"
        if check_table_exists("payments"):
            existing_release = supabase.table("payments").select("id").eq(
                "reference", release_ref
            ).eq("status", "success").execute()
            if existing_release.data:
                logging.info(f"Escrow already released for booking {booking_id}")
                return
        
        # Also check wallet_transactions as backup
        if check_table_exists("wallet_transactions"):
            existing_tx = supabase.table("wallet_transactions").select("id").eq(
                "booking_id", booking_id
            ).eq("description", f"Escrow released for booking #{booking_id}").execute()
            if existing_tx.data:
                logging.info(f"Escrow release transaction exists for booking {booking_id}")
                return
        
        # Get the booking to find the amount
        booking_response = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not booking_response.data:
            logging.warning(f"Booking {booking_id} not found for escrow release")
            return
        
        booking = booking_response.data[0]
        
        # Calculate total amount from booking_services if available
        amount = 0
        if check_table_exists("booking_services"):
            services_response = supabase.table("booking_services").select("price").eq("booking_id", booking_id).execute()
            if services_response.data:
                amount = sum(float(svc.get("price", 0) or 0) for svc in services_response.data)
        
        # Fallback to payment record
        if amount == 0 and check_table_exists("payments"):
            payment_response = supabase.table("payments").select("amount").eq("booking_id", booking_id).eq("status", "success").execute()
            if payment_response.data:
                amount = float(payment_response.data[0].get("amount", 0))
        
        if amount <= 0:
            logging.warning(f"No amount found for booking {booking_id}")
            return
        
        # Deduct from customer's escrow balance
        customer_wallet = supabase.table("wallets").select("*").eq("user_auth_id", customer_auth_id).execute()
        if customer_wallet.data:
            wallet = customer_wallet.data[0]
            new_escrow = max(0, (wallet.get("escrow_balance") or 0) - amount)
            supabase.table("wallets").update({"escrow_balance": new_escrow}).eq("id", wallet["id"]).execute()
        
        # Credit to provider's available balance
        provider_wallet = supabase.table("wallets").select("*").eq("user_auth_id", provider_auth_id).execute()
        if provider_wallet.data:
            wallet = provider_wallet.data[0]
            new_balance = (wallet.get("balance") or 0) + amount
            supabase.table("wallets").update({"balance": new_balance}).eq("id", wallet["id"]).execute()
        else:
            supabase.table("wallets").insert({
                "user_auth_id": provider_auth_id,
                "balance": amount,
                "escrow_balance": 0
            }).execute()
        
        # Record payment for idempotency tracking
        if check_table_exists("payments"):
            supabase.table("payments").insert({
                "reference": release_ref,
                "amount": amount,
                "purpose": "escrow_release",
                "payment_provider": "internal",
                "booking_id": booking_id,
                "status": "success",
                "processed": True,
                "created_at": datetime.utcnow().isoformat(),
                "processed_at": datetime.utcnow().isoformat()
            }).execute()
        
        # Record transactions with proper field values
        if check_table_exists("wallet_transactions"):
            # Customer debit from escrow
            supabase.table("wallet_transactions").insert({
                "user_auth_id": customer_auth_id,
                "auth_id": customer_auth_id,
                "type": "debit",  # DB constraint: 'credit' or 'debit'
                "direction": "debit",  # lowercase
                "amount": amount,
                "reference": release_ref,
                "booking_id": booking_id,
                "description": f"Escrow released for booking #{booking_id}",
                "status": "completed",
                "created_at": datetime.utcnow().isoformat()
            }).execute()
            
            # Provider credit (earnings)
            supabase.table("wallet_transactions").insert({
                "user_auth_id": provider_auth_id,
                "auth_id": provider_auth_id,
                "type": "credit",  # DB constraint: 'credit' or 'debit'
                "direction": "credit",  # lowercase
                "amount": amount,
                "reference": release_ref,
                "booking_id": booking_id,
                "description": f"Earnings from booking #{booking_id}",
                "status": "completed",
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        
        logging.info(f"Escrow released: {amount} from customer {customer_auth_id} to provider {provider_auth_id} for booking #{booking_id}")
    except Exception as e:
        logging.error(f"Failed to release escrow: {str(e)}")


async def _refund_escrow_to_customer(booking_id: int, customer_auth_id: str):
    """Refund escrow funds to customer when booking is canceled"""
    try:
        # Check for idempotency - don't refund twice
        if check_table_exists("wallet_transactions"):
            existing_refund = supabase.table("wallet_transactions").select("id").eq(
                "booking_id", booking_id
            ).eq("type", "ESCROW_REFUND").execute()
            
            if existing_refund.data:
                logging.info(f"Escrow already refunded for booking {booking_id}")
                return
        
        # Get the booking to find the amount
        booking_response = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not booking_response.data:
            logging.warning(f"Booking {booking_id} not found for escrow refund")
            return
        
        booking = booking_response.data[0]
        
        # Calculate total amount from booking_services if available
        amount = 0
        if check_table_exists("booking_services"):
            services_response = supabase.table("booking_services").select("price").eq("booking_id", booking_id).execute()
            if services_response.data:
                amount = sum(float(svc.get("price", 0)) for svc in services_response.data)
        
        # Fallback to payment record
        if amount == 0 and check_table_exists("payments"):
            payment_response = supabase.table("payments").select("amount").eq("booking_id", booking_id).eq("status", "success").execute()
            if payment_response.data:
                amount = float(payment_response.data[0].get("amount", 0))
        
        if amount <= 0:
            logging.warning(f"No amount found for booking {booking_id} refund")
            return
        
        # Move from escrow to available balance for customer
        refund_ref = f"escrow_refund_{booking_id}_{uuid.uuid4().hex[:8]}"
        customer_wallet = supabase.table("wallets").select("*").eq("user_auth_id", customer_auth_id).execute()
        if customer_wallet.data:
            wallet = customer_wallet.data[0]
            new_escrow = max(0, (wallet.get("escrow_balance") or 0) - amount)
            new_balance = (wallet.get("balance") or 0) + amount
            supabase.table("wallets").update({
                "escrow_balance": new_escrow,
                "balance": new_balance
            }).eq("id", wallet["id"]).execute()
        
        # Record transaction
        if check_table_exists("wallet_transactions"):
            supabase.table("wallet_transactions").insert({
                "user_auth_id": customer_auth_id,
                "type": "ESCROW_REFUND",
                "direction": "CREDIT",
                "amount": amount,
                "reference": refund_ref,
                "booking_id": booking_id,
                "description": f"Refund for canceled booking #{booking_id}",
                "status": "completed",
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        
        logging.info(f"Escrow refunded: {amount} to customer {customer_auth_id} for booking #{booking_id}")
    except Exception as e:
        logging.error(f"Failed to refund escrow: {str(e)}")


@api_router.post("/webhooks/paystack")
async def paystack_webhook(request: Request, x_paystack_signature: str = Header(None)):
    """Handle Paystack webhook events"""
    try:
        # Verify signature
        secret_key = os.environ.get('PAYSTACK_SECRET_KEY')
        if not secret_key:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        
        body = await request.body()
        
        if x_paystack_signature:
            expected_signature = hmac.new(
                secret_key.encode(),
                body,
                hashlib.sha512
            ).hexdigest()
            
            if x_paystack_signature != expected_signature:
                logging.warning("Invalid Paystack webhook signature")
                raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Parse event
        try:
            event_data = await request.json()
        except:
            raise HTTPException(status_code=400, detail="Invalid JSON")
        
        event = event_data.get("event")
        data = event_data.get("data", {})
        
        logging.info(f"Paystack webhook: {event}")
        
        # Handle charge.success
        if event == "charge.success":
            reference = data.get("reference")
            if reference:
                # Reuse verification logic
                await verify_paystack_payment(reference)
        
        # Log webhook for audit
        if check_table_exists("webhook_logs"):
            supabase.table("webhook_logs").insert({
                "provider": "paystack",
                "event": event,
                "data": data,
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
        return {"status": "ok"}  # Always return 200 to Paystack


# =============================================================================
# WALLET-BASED BOOKING PAYMENT (POST /api/bookings/{booking_id}/pay-with-wallet)
# =============================================================================

class WalletPaymentResponse(BaseModel):
    status: str
    message: str
    booking_id: int
    amount_paid: float
    new_wallet_balance: float
    new_escrow_balance: float


@api_router.post("/bookings/{booking_id}/pay-with-wallet")
async def pay_booking_with_wallet(
    booking_id: int,
    auth_id: str = Query(..., description="Customer's auth_id for authentication")
):
    """
    Pay for a booking using wallet balance (escrow flow).
    - Validates booking belongs to user and status is pending_payment
    - Checks sufficient wallet balance
    - Deducts from available_balance, adds to escrow_balance
    - Creates wallet_transactions records
    - Updates booking status to 'pending' (awaiting provider confirmation)
    - Idempotent: if already paid, returns success without double-charging
    """
    try:
        # 1. Validate booking exists
        if not check_table_exists("bookings"):
            raise HTTPException(status_code=404, detail="Bookings table not found")
        
        booking_response = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        
        if not booking_response.data:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        booking = booking_response.data[0]
        
        # 2. Validate booking belongs to user
        if booking.get("customer_auth_id") != auth_id:
            raise HTTPException(status_code=403, detail="You can only pay for your own bookings")
        
        # 3. Check if already paid (idempotency)
        current_status = booking.get("status", "")
        payment_status = booking.get("payment_status", "")
        
        # If status is 'pending' (not 'pending_payment'), check if already paid
        # This handles the case where payment_status column doesn't exist
        if current_status == "pending":
            # Check if there's already a payment record for this booking
            if check_table_exists("payments"):
                existing_payment = supabase.table("payments").select("id").eq(
                    "booking_id", booking_id
                ).eq("status", "success").execute()
                if existing_payment.data:
                    # Already paid - return success for idempotency
                    wallet_response = supabase.table("wallets").select("*").eq("user_auth_id", auth_id).execute()
                    wallet = wallet_response.data[0] if wallet_response.data else {"balance": 0, "escrow_balance": 0}
                    return WalletPaymentResponse(
                        status="success",
                        message="Booking already paid",
                        booking_id=booking_id,
                        amount_paid=0,
                        new_wallet_balance=float(wallet.get("balance", 0) or 0),
                        new_escrow_balance=float(wallet.get("escrow_balance", 0) or 0)
                    )
        
        if current_status not in ["pending_payment", "pending"] or payment_status == "paid":
            # Already paid or in invalid state - return success for idempotency
            wallet_response = supabase.table("wallets").select("*").eq("user_auth_id", auth_id).execute()
            wallet = wallet_response.data[0] if wallet_response.data else {"balance": 0, "escrow_balance": 0}
            
            return WalletPaymentResponse(
                status="success",
                message="Booking already paid" if payment_status == "paid" else f"Booking status is {current_status}",
                booking_id=booking_id,
                amount_paid=0,
                new_wallet_balance=float(wallet.get("balance", 0) or 0),
                new_escrow_balance=float(wallet.get("escrow_balance", 0) or 0)
            )
        
        # 4. Calculate total booking amount from booking_services
        total_amount = 0
        if check_table_exists("booking_services"):
            services_response = supabase.table("booking_services").select("price").eq("booking_id", booking_id).execute()
            if services_response.data:
                total_amount = sum(float(svc.get("price", 0) or 0) for svc in services_response.data)
        
        # Fallback to booking total if no services found
        if total_amount == 0:
            total_amount = float(booking.get("total_amount", 0) or 0)
        
        if total_amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid booking amount")
        
        # 5. Get customer wallet
        wallet_response = supabase.table("wallets").select("*").eq("user_auth_id", auth_id).execute()
        
        if not wallet_response.data:
            # No wallet - insufficient funds
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "Insufficient wallet balance",
                    "needed": total_amount,
                    "available": 0,
                    "shortfall": total_amount
                }
            )
        
        wallet = wallet_response.data[0]
        available_balance = float(wallet.get("balance", 0) or 0)
        
        # 6. Check sufficient balance
        if available_balance < total_amount:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "Insufficient wallet balance",
                    "needed": total_amount,
                    "available": available_balance,
                    "shortfall": total_amount - available_balance
                }
            )
        
        # 7. Process payment - deduct from available, add to escrow
        reference = f"wallet_booking_{booking_id}_{uuid.uuid4().hex[:8]}"
        new_available = available_balance - total_amount
        current_escrow = float(wallet.get("escrow_balance", 0) or 0)
        new_escrow = current_escrow + total_amount
        
        # Update wallet balances
        supabase.table("wallets").update({
            "balance": new_available,
            "escrow_balance": new_escrow
        }).eq("id", wallet["id"]).execute()
        
        # 8. Create wallet_transactions records (non-blocking - don't fail payment if logging fails)
        try:
            if check_table_exists("wallet_transactions"):
                # Debit transaction (from available)
                supabase.table("wallet_transactions").insert({
                    "user_auth_id": auth_id,
                    "type": "BOOKING_PAYMENT",
                    "direction": "DEBIT",
                    "amount": total_amount,
                    "reference": reference,
                    "booking_id": booking_id,
                    "description": f"Payment for booking #{booking_id}",
                    "status": "completed",
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
                
                # Escrow hold transaction
                supabase.table("wallet_transactions").insert({
                    "user_auth_id": auth_id,
                    "type": "ESCROW_HOLD",
                    "direction": "CREDIT",
                    "amount": total_amount,
                    "reference": reference,
                    "booking_id": booking_id,
                    "description": f"Escrow hold for booking #{booking_id}",
                    "status": "completed",
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
        except Exception as tx_error:
            # Log but don't fail the payment - wallet was already updated
            logging.warning(f"Failed to log wallet transactions for booking {booking_id}: {str(tx_error)}")
        
        # 9. Update booking status to 'pending' (awaiting provider confirmation)
        # Handle missing columns gracefully
        try:
            supabase.table("bookings").update({
                "status": "pending",
                "payment_status": "paid",
                "payment_reference": reference
            }).eq("id", booking_id).execute()
        except Exception as booking_update_error:
            error_str = str(booking_update_error)
            if "payment_reference" in error_str or "payment_status" in error_str:
                # Columns don't exist, try minimal update
                logging.warning(f"Some payment columns missing, updating status only: {error_str}")
                try:
                    supabase.table("bookings").update({
                        "status": "pending"
                    }).eq("id", booking_id).execute()
                except Exception as minimal_error:
                    logging.error(f"Failed to update booking status: {minimal_error}")
                    raise
            else:
                raise
        
        # 10. Create payment record
        if check_table_exists("payments"):
            supabase.table("payments").insert({
                "reference": reference,
                "email": booking.get("customer_email", ""),
                "amount": total_amount,
                "purpose": "booking_payment",
                "payment_provider": "wallet",
                "booking_id": booking_id,
                "status": "success",
                "processed": True,
                "created_at": datetime.utcnow().isoformat(),
                "processed_at": datetime.utcnow().isoformat()
            }).execute()
        
        logging.info(f"Wallet payment successful: booking {booking_id}, amount {total_amount}, ref {reference}")
        
        return WalletPaymentResponse(
            status="success",
            message="Payment successful. Booking confirmed.",
            booking_id=booking_id,
            amount_paid=total_amount,
            new_wallet_balance=new_available,
            new_escrow_balance=new_escrow
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Wallet payment error for booking {booking_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment processing failed: {str(e)}"
        )


@api_router.get("/wallet/me")
async def get_my_wallet(auth_id: str = Query(..., description="User's auth_id")):
    """Get current user's wallet with balances"""
    try:
        wallet_response = supabase.table("wallets").select("*").eq("user_auth_id", auth_id).execute()
        
        if wallet_response.data:
            wallet = wallet_response.data[0]
            return {
                "available_balance": wallet.get("balance", 0),
                "escrow_balance": wallet.get("escrow_balance", 0),
                "total_balance": (wallet.get("balance", 0) or 0) + (wallet.get("escrow_balance", 0) or 0)
            }
        else:
            return {
                "available_balance": 0,
                "escrow_balance": 0,
                "total_balance": 0
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch wallet: {str(e)}"
        )


@api_router.get("/wallet/transactions")
async def get_wallet_transactions(
    auth_id: str = Query(..., description="User's auth_id"),
    limit: int = Query(50, ge=1, le=100)
):
    """Get user's wallet transaction history"""
    try:
        if not check_table_exists("wallet_transactions"):
            return []
        
        # Try to query with user_auth_id column, fallback gracefully if column doesn't exist
        try:
            response = supabase.table("wallet_transactions").select("*").eq(
                "user_auth_id", auth_id
            ).order("created_at", desc=True).limit(limit).execute()
            return response.data or []
        except Exception as col_error:
            # If column doesn't exist, return empty list with warning
            if "user_auth_id" in str(col_error):
                logging.warning("wallet_transactions table missing user_auth_id column. Run migration.")
                return []
            raise
    except Exception as e:
        logging.error(f"Failed to fetch transactions: {str(e)}")
        # Return empty list instead of error for better UX
        return []


# ==================== PROVIDER SERVICES ENDPOINTS ====================
# Using the existing 'services' table in Supabase with enhanced schema
# Table mapping: stylist_id -> provider_id, category -> sub_service_id (composite), name -> sub_service_name

def parse_category_field(category_str):
    """Parse the category field which stores: category_id|service_id|sub_service_id"""
    if not category_str:
        return {"category_id": "", "service_id": "", "sub_service_id": ""}
    parts = category_str.split("|")
    return {
        "category_id": parts[0] if len(parts) > 0 else "",
        "service_id": parts[1] if len(parts) > 1 else "",
        "sub_service_id": parts[2] if len(parts) > 2 else parts[0]
    }

def build_category_field(category_id, service_id, sub_service_id):
    """Build the composite category field"""
    return f"{category_id}|{service_id}|{sub_service_id}"

def parse_service_record(item):
    """Parse a services table record into ProviderServiceResponse format"""
    parsed = parse_category_field(item.get("category"))
    name_parts = (item.get("name") or "").split("||")
    sub_service_name = name_parts[0].replace(" (disabled)", "")
    description = name_parts[1] if len(name_parts) > 1 else None
    
    # Parse service modes from name suffix
    in_store = True
    home_service = False
    travel_service = False
    if "||modes:" in (item.get("name") or ""):
        modes_part = item.get("name").split("||modes:")[-1].split("||")[0] if "||modes:" in item.get("name") else ""
        in_store = "in_store" in modes_part
        home_service = "home" in modes_part
        travel_service = "travel" in modes_part
    
    return {
        "id": item["id"],
        "provider_id": item.get("stylist_id") or 0,
        "sub_service_id": parsed["sub_service_id"],
        "sub_service_name": sub_service_name,
        "service_id": parsed["service_id"],
        "category_id": parsed["category_id"],
        "price": float(item.get("price") or 0),
        "duration_minutes": item.get("duration") or 60,
        "description": description,
        "in_store": in_store,
        "home_service": home_service,
        "travel_service": travel_service,
        "is_active": "(disabled)" not in (item.get("name") or "")
    }

def build_service_name(sub_service_name, description, in_store, home_service, travel_service, is_active):
    """Build the service name field with metadata"""
    name = sub_service_name if is_active else f"{sub_service_name} (disabled)"
    if description:
        name += f"||{description}"
    modes = []
    if in_store:
        modes.append("in_store")
    if home_service:
        modes.append("home")
    if travel_service:
        modes.append("travel")
    if modes:
        name += f"||modes:{','.join(modes)}"
    return name

@api_router.post("/provider-services", response_model=ProviderServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_provider_service(service_data: ProviderServiceCreate):
    """Create or update a provider service"""
    try:
        category_field = build_category_field(
            service_data.category_id, 
            service_data.service_id, 
            service_data.sub_service_id
        )
        
        # Check if service already exists
        existing = supabase.table("services").select("*").eq(
            "stylist_id", service_data.provider_id
        ).eq("category", category_field).execute()
        
        service_name = build_service_name(
            service_data.sub_service_name,
            service_data.description,
            service_data.in_store,
            service_data.home_service,
            service_data.travel_service,
            service_data.is_active
        )
        
        if existing.data:
            # Update existing
            update_data = {
                "name": service_name,
                "price": service_data.price,
                "duration": service_data.duration_minutes
            }
            response = supabase.table("services").update(update_data).eq("id", existing.data[0]["id"]).execute()
            return parse_service_record(response.data[0])
        
        # Create new
        service_dict = {
            "stylist_id": service_data.provider_id,
            "category": category_field,
            "name": service_name,
            "price": service_data.price,
            "duration": service_data.duration_minutes
        }
        
        response = supabase.table("services").insert(service_dict).execute()
        return parse_service_record(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create provider service: {str(e)}"
        )

@api_router.get("/provider-services/{provider_id}")
async def get_provider_services(provider_id: int, active_only: bool = False):
    """Get all services for a provider"""
    try:
        response = supabase.table("services").select("*").eq("stylist_id", provider_id).execute()
        
        services = [parse_service_record(item) for item in response.data]
        
        if active_only:
            services = [s for s in services if s["is_active"]]
        
        return services
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch provider services: {str(e)}"
        )

@api_router.put("/provider-services/{service_id}", response_model=ProviderServiceResponse)
async def update_provider_service(service_id: int, service_update: ProviderServiceUpdate):
    """Update a provider service"""
    try:
        existing = supabase.table("services").select("*").eq("id", service_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider service not found"
            )
        
        current = existing.data[0]
        current_parsed = parse_service_record(current)
        
        # Build updated values
        is_active = service_update.is_active if service_update.is_active is not None else current_parsed["is_active"]
        in_store = service_update.in_store if service_update.in_store is not None else current_parsed["in_store"]
        home_service = service_update.home_service if service_update.home_service is not None else current_parsed["home_service"]
        travel_service = service_update.travel_service if service_update.travel_service is not None else current_parsed["travel_service"]
        description = service_update.description if service_update.description is not None else current_parsed["description"]
        
        update_data = {}
        if service_update.price is not None:
            update_data["price"] = service_update.price
        if service_update.duration_minutes is not None:
            update_data["duration"] = service_update.duration_minutes
        
        # Always update name if any mode or status changed
        update_data["name"] = build_service_name(
            current_parsed["sub_service_name"],
            description,
            in_store,
            home_service,
            travel_service,
            is_active
        )
        
        response = supabase.table("services").update(update_data).eq("id", service_id).execute()
        return parse_service_record(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update provider service: {str(e)}"
        )

@api_router.post("/provider-services/toggle/{provider_id}")
async def toggle_provider_services(provider_id: int, request: BulkServiceToggleRequest):
    """Bulk toggle services for a provider - upsert behavior"""
    try:
        results = []
        for svc in request.services:
            category_field = build_category_field(svc.category_id, svc.service_id, svc.sub_service_id)
            
            # Check if service exists
            existing = supabase.table("services").select("*").eq(
                "stylist_id", provider_id
            ).eq("category", category_field).execute()
            
            service_name = build_service_name(
                svc.sub_service_name,
                svc.description,
                svc.in_store,
                svc.home_service,
                svc.travel_service,
                svc.is_active
            )
            
            if existing.data:
                # Update existing
                update_data = {
                    "name": service_name,
                    "price": svc.price,
                    "duration": svc.duration_minutes
                }
                response = supabase.table("services").update(update_data).eq("id", existing.data[0]["id"]).execute()
                results.append(parse_service_record(response.data[0]))
            else:
                # Create new only if is_active is True
                if svc.is_active:
                    service_dict = {
                        "stylist_id": provider_id,
                        "category": category_field,
                        "name": service_name,
                        "price": svc.price,
                        "duration": svc.duration_minutes
                    }
                    response = supabase.table("services").insert(service_dict).execute()
                    results.append(parse_service_record(response.data[0]))
        
        return {
            "message": f"Successfully updated {len(results)} services",
            "services": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle provider services: {str(e)}"
        )

@api_router.delete("/provider-services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_service(service_id: int):
    """Delete a provider service"""
    try:
        existing = supabase.table("services").select("*").eq("id", service_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider service not found"
            )
        
        supabase.table("services").delete().eq("id", service_id).execute()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete provider service: {str(e)}"
        )


# ==================== SERVICE CATALOG ENDPOINTS ====================

@api_router.get("/catalog/categories")
async def get_service_categories():
    """Get all service categories"""
    from service_catalog import get_all_categories
    return get_all_categories()

@api_router.get("/catalog/categories/{category_id}")
async def get_category(category_id: str):
    """Get a specific category with its services"""
    from service_catalog import get_category
    category = get_category(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    return category

@api_router.get("/catalog/services")
async def get_all_services():
    """Get all services (parent-level)"""
    from service_catalog import get_all_services
    return get_all_services()

@api_router.get("/catalog/services/{service_id}")
async def get_service(service_id: str):
    """Get a specific service with its sub-services"""
    from service_catalog import get_service
    service = get_service(service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    return service

@api_router.get("/catalog/sub-services")
async def get_all_sub_services():
    """Get all sub-services (flat list)"""
    from service_catalog import get_all_sub_services
    return get_all_sub_services()

@api_router.get("/catalog/sub-services/{service_id}")
async def get_sub_services_by_service(service_id: str):
    """Get all sub-services for a specific service"""
    from service_catalog import get_sub_services_by_service
    return get_sub_services_by_service(service_id)


# ==================== PROVIDER LISTING ENDPOINTS (Phase 1.4) ====================

@api_router.get("/providers/with-services")
async def get_providers_with_services(
    category_id: Optional[str] = None,
    service_id: Optional[str] = None,
    city: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None
):
    """Get providers who have at least one active service"""
    try:
        # Get all stylists with their user data
        stylists_response = supabase.table("stylists").select(
            "*, users!stylists_user_id_fkey(name, email)"
        ).execute()
        
        providers_with_services = []
        
        for stylist in stylists_response.data:
            provider_id = stylist["user_id"]
            
            # Get active services for this provider
            services_response = supabase.table("services").select("*").eq(
                "stylist_id", provider_id
            ).execute()
            
            active_services = []
            for svc in services_response.data:
                parsed = parse_service_record(svc)
                if parsed["is_active"]:
                    # Apply filters
                    if category_id and parsed["category_id"] != category_id:
                        continue
                    if service_id and parsed["service_id"] != service_id:
                        continue
                    if min_price and parsed["price"] < min_price:
                        continue
                    if max_price and parsed["price"] > max_price:
                        continue
                    active_services.append(parsed)
            
            # Only include providers with at least 1 active service
            if active_services:
                # Apply location filter
                if city and stylist.get("location") and city.lower() not in stylist.get("location", "").lower():
                    continue
                
                # Calculate min price
                min_service_price = min(s["price"] for s in active_services) if active_services else 0
                
                # Get primary service (first active service by category)
                primary_service = active_services[0] if active_services else None
                
                providers_with_services.append({
                    "provider_id": provider_id,
                    "name": stylist["users"]["name"] if stylist.get("users") else "Provider",
                    # Phase 1.9 - Show business_name if business type
                    "display_name": stylist.get("business_name") if stylist.get("provider_type") == "business" and stylist.get("business_name") else (stylist["users"]["name"] if stylist.get("users") else "Provider"),
                    "bio": stylist.get("bio"),
                    "location": stylist.get("location"),
                    # Phase 1.9 - Provider type info
                    "provider_type": stylist.get("provider_type", "individual"),
                    "business_name": stylist.get("business_name"),
                    "rating": stylist.get("rating", 0),
                    "is_verified": stylist.get("is_verified", False),
                    "is_premium": stylist.get("is_premium", False),
                    "starting_price": min_service_price,
                    "primary_service": primary_service["sub_service_name"] if primary_service else None,
                    "primary_category": primary_service["category_id"] if primary_service else None,
                    "active_service_count": len(active_services),
                    "services": active_services[:5]  # Return first 5 services for preview
                    # Note: Email is NOT included for privacy
                })
        
        # Sort by rating, then by premium status
        providers_with_services.sort(
            key=lambda x: (-x["is_premium"], -x["is_verified"], -x["rating"], x["starting_price"])
        )
        
        return providers_with_services
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch providers: {str(e)}"
        )

@api_router.get("/providers/{provider_id}/full-profile")
async def get_provider_full_profile(provider_id: int):
    """Get full provider profile with all services for booking"""
    try:
        # Get stylist data with user info (only request columns that exist)
        # Note: gender, city, country require Phase 1.9 DB migration
        stylist_response = supabase.table("stylists").select(
            "*, users!stylists_user_id_fkey(name, email)"
        ).eq("user_id", provider_id).execute()
        
        if not stylist_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )
        
        stylist = stylist_response.data[0]
        
        # Try to fetch user's additional fields (gender, city, country) if they exist
        user_extra = {}
        try:
            user_response = supabase.table("users").select("*").eq(
                "id", stylist.get("user_id")
            ).execute()
            if user_response.data:
                user_data = user_response.data[0]
                user_extra = {
                    "gender": user_data.get("gender"),
                    "city": user_data.get("city"),
                    "country": user_data.get("country")
                }
        except Exception:
            # If columns don't exist, just continue without them
            pass
        
        # Get all services
        services_response = supabase.table("services").select("*").eq(
            "stylist_id", provider_id
        ).execute()
        
        services = [parse_service_record(svc) for svc in services_response.data]
        active_services = [s for s in services if s["is_active"]]
        
        # Group services by category
        services_by_category = {}
        for svc in active_services:
            cat_id = svc["category_id"]
            if cat_id not in services_by_category:
                services_by_category[cat_id] = []
            services_by_category[cat_id].append(svc)
        
        return {
            "provider_id": provider_id,
            "name": stylist["users"]["name"] if stylist.get("users") else "Provider",
            # Phase 1.9 - Show business_name if business type
            "display_name": stylist.get("business_name") if stylist.get("provider_type") == "business" and stylist.get("business_name") else (stylist["users"]["name"] if stylist.get("users") else "Provider"),
            "bio": stylist.get("bio"),
            "location": stylist.get("location"),
            # Phase 1.9 - Provider type info
            "provider_type": stylist.get("provider_type", "individual"),
            "business_name": stylist.get("business_name"),
            # Phase 1.9 - Gender (public metadata, if column exists)
            "gender": user_extra.get("gender"),
            "rating": stylist.get("rating", 0),
            "is_verified": stylist.get("is_verified", False),
            "is_premium": stylist.get("is_premium", False),
            "travel_available": stylist.get("travel_available", False),
            "travel_fee_per_km": stylist.get("travel_fee_per_km", 0),
            "total_services": len(active_services),
            "services": active_services,
            "services_by_category": services_by_category
            # Note: Email is NOT included for privacy
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch provider profile: {str(e)}"
        )


# ==================== AUTO PROVIDER REGISTRATION ====================

@api_router.post("/providers/register")
async def register_provider(user_id: int, hourly_rate: float = 0.0, bio: str = None, location: str = None):
    """Register a user as a provider (creates stylist profile and updates user role)"""
    try:
        # Check if user exists
        user = supabase.table("users").select("*").eq("id", user_id).execute()
        if not user.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if already a provider
        existing_stylist = supabase.table("stylists").select("*").eq("user_id", user_id).execute()
        if existing_stylist.data:
            return {"message": "User is already registered as a provider", "provider": existing_stylist.data[0]}
        
        # Create stylist profile
        stylist_dict = {
            "user_id": user_id,
            "hourly_rate": hourly_rate,
            "is_verified": False,
            "is_premium": False,
            "bio": bio,
            "location": location
        }
        
        stylist_response = supabase.table("stylists").insert(stylist_dict).execute()
        
        # Update user role to stylist
        supabase.table("users").update({"role": "stylist"}).eq("id", user_id).execute()
        
        return {
            "message": "Successfully registered as provider",
            "provider": stylist_response.data[0]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register provider: {str(e)}"
        )


# ==================== PROVIDER AVAILABILITY ENDPOINTS (Phase 2.0) ====================

def validate_time_range(start_time: str, end_time: str) -> bool:
    """Validate that start_time < end_time"""
    if not start_time or not end_time:
        return False
    start = datetime.strptime(start_time, '%H:%M')
    end = datetime.strptime(end_time, '%H:%M')
    return start < end

def time_to_minutes(time_str: str) -> int:
    """Convert HH:MM or HH:MM:SS to minutes since midnight"""
    parts = time_str.split(':')
    h = int(parts[0])
    m = int(parts[1]) if len(parts) > 1 else 0
    return h * 60 + m

def minutes_to_time(minutes: int) -> str:
    """Convert minutes since midnight to HH:MM"""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def check_table_exists(table_name: str) -> bool:
    """Check if a Supabase table exists by attempting a query"""
    try:
        supabase.table(table_name).select("*").limit(1).execute()
        return True
    except Exception as e:
        if "does not exist" in str(e).lower() or "42P01" in str(e):
            return False
        # Table exists but might have other issues
        return True

async def get_provider_auth_id(user_id: int) -> Optional[str]:
    """Get the auth_id (UUID) for a provider from their user_id (integer)"""
    try:
        response = supabase.table("users").select("auth_id").eq("id", user_id).execute()
        if response.data:
            return response.data[0].get("auth_id")
        return None
    except Exception:
        return None


@api_router.get("/providers/{provider_id}/availability", response_model=AvailabilityResponse)
async def get_provider_availability(provider_id: int):
    """Get provider's weekly availability, exceptions, and booking rules"""
    try:
        # Get the provider's auth_id (UUID) from their user_id (integer)
        provider_uuid = await get_provider_auth_id(provider_id)
        if not provider_uuid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )
        
        # Check if tables exist
        if not check_table_exists("provider_availability"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="provider_availability table does not exist. Please run migrations."
            )
        
        # Get weekly availability using UUID
        weekly_response = supabase.table("provider_availability").select("*").eq(
            "provider_id", provider_uuid
        ).order("day_of_week").execute()
        weekly = weekly_response.data or []
        
        # Get exceptions
        exceptions = []
        if check_table_exists("provider_availability_exceptions"):
            exc_response = supabase.table("provider_availability_exceptions").select("*").eq(
                "provider_id", provider_uuid
            ).order("date").execute()
            exceptions = exc_response.data or []
        
        # Get booking rules
        rules = {
            "max_sessions_per_day": 6,
            "min_notice_minutes": 0,
            "slot_step_minutes": 30
        }
        if check_table_exists("provider_booking_rules"):
            rules_response = supabase.table("provider_booking_rules").select("*").eq(
                "provider_id", provider_uuid
            ).execute()
            if rules_response.data:
                rules = rules_response.data[0]
        
        return {
            "weekly": weekly,
            "exceptions": exceptions,
            "rules": rules
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch availability: {str(e)}"
        )


@api_router.post("/providers/{provider_id}/availability")
async def set_provider_availability(provider_id: int, request: WeeklyAvailabilityRequest):
    """Set provider's weekly availability (upsert)"""
    try:
        # Get the provider's auth_id (UUID)
        provider_uuid = await get_provider_auth_id(provider_id)
        if not provider_uuid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )
        
        if not check_table_exists("provider_availability"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="provider_availability table does not exist. Please run migrations."
            )
        
        # Validate time ranges for active days
        for avail in request.weekly:
            if avail.is_active:
                if not avail.start_time or not avail.end_time:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Day {avail.day_of_week}: start_time and end_time required when is_active=true"
                    )
                if not validate_time_range(avail.start_time, avail.end_time):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Day {avail.day_of_week}: start_time must be before end_time"
                    )
        
        # Delete existing availability for this provider
        supabase.table("provider_availability").delete().eq("provider_id", provider_uuid).execute()
        
        # Insert new availability rows (only for active days with times)
        rows_to_insert = []
        for avail in request.weekly:
            if avail.is_active and avail.start_time and avail.end_time:
                rows_to_insert.append({
                    "provider_id": provider_uuid,
                    "day_of_week": avail.day_of_week,
                    "start_time": avail.start_time,
                    "end_time": avail.end_time,
                    "is_active": True
                })
        
        if rows_to_insert:
            supabase.table("provider_availability").insert(rows_to_insert).execute()
        
        return {"message": "Availability updated successfully", "count": len(rows_to_insert)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update availability: {str(e)}"
        )


@api_router.post("/providers/{provider_id}/exceptions")
async def set_provider_exceptions(provider_id: int, request: ExceptionsRequest):
    """Set provider's availability exceptions (upsert by date)"""
    try:
        # Get the provider's auth_id (UUID)
        provider_uuid = await get_provider_auth_id(provider_id)
        if not provider_uuid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )
        
        if not check_table_exists("provider_availability_exceptions"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="provider_availability_exceptions table does not exist. Please run migrations."
            )
        
        # Validate time ranges when not marking full day unavailable
        for exc in request.exceptions:
            if not exc.is_unavailable:
                if exc.start_time and exc.end_time:
                    if not validate_time_range(exc.start_time, exc.end_time):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Date {exc.date}: start_time must be before end_time"
                        )
        
        # Process each exception (upsert by provider_id + date)
        for exc in request.exceptions:
            # Try to find existing exception
            existing = supabase.table("provider_availability_exceptions").select("id").eq(
                "provider_id", provider_uuid
            ).eq("date", exc.date).execute()
            
            row_data = {
                "provider_id": provider_uuid,
                "date": exc.date,
                "is_unavailable": exc.is_unavailable,
                "start_time": exc.start_time if not exc.is_unavailable else None,
                "end_time": exc.end_time if not exc.is_unavailable else None,
                "note": exc.note
            }
            
            if existing.data:
                # Update existing
                supabase.table("provider_availability_exceptions").update(row_data).eq(
                    "id", existing.data[0]["id"]
                ).execute()
            else:
                # Insert new
                supabase.table("provider_availability_exceptions").insert(row_data).execute()
        
        return {"message": "Exceptions updated successfully", "count": len(request.exceptions)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update exceptions: {str(e)}"
        )


@api_router.post("/providers/{provider_id}/rules")
async def set_provider_rules(provider_id: int, request: BookingRules):
    """Set provider's booking rules (upsert)"""
    try:
        # Get the provider's auth_id (UUID)
        provider_uuid = await get_provider_auth_id(provider_id)
        if not provider_uuid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )
        
        if not check_table_exists("provider_booking_rules"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="provider_booking_rules table does not exist. Please run migrations."
            )
        
        row_data = {
            "provider_id": provider_uuid,
            "max_sessions_per_day": request.max_sessions_per_day,
            "min_notice_minutes": request.min_notice_minutes,
            "slot_step_minutes": request.slot_step_minutes
        }
        
        # Check if rules exist for this provider (select provider_id since table may not have id column)
        existing = supabase.table("provider_booking_rules").select("provider_id").eq(
            "provider_id", provider_uuid
        ).execute()
        
        if existing.data:
            # Update existing - use upsert to handle update gracefully
            supabase.table("provider_booking_rules").upsert(
                row_data, on_conflict="provider_id"
            ).execute()
        else:
            # Insert new
            supabase.table("provider_booking_rules").insert(row_data).execute()
        
        return {"message": "Booking rules updated successfully", "rules": row_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update booking rules: {str(e)}"
        )


async def _get_available_slots_internal(
    provider_id: int,
    requested_date: str,
    service_duration: int
) -> dict:
    """Internal function to get available booking slots - no FastAPI dependencies"""
    # Get the provider's auth_id (UUID)
    provider_uuid = await get_provider_auth_id(provider_id)
    if not provider_uuid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    
    # Validate date format
    try:
        target_date = datetime.strptime(requested_date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date must be in YYYY-MM-DD format"
        )
    
    # Get day of week (0=Monday in Python, but we use 0=Sunday)
    # Python: Monday=0, Sunday=6; We need: Sunday=0, Saturday=6
    python_dow = target_date.weekday()  # Monday=0
    day_of_week = (python_dow + 1) % 7  # Convert to Sunday=0
    
    # Initialize default working window
    working_start = None
    working_end = None
    is_available = False
    
    # Check if availability table exists
    if not check_table_exists("provider_availability"):
        # No availability table - return empty (or could return all day available)
        return {"date": requested_date, "slots": [], "timezone": "UTC"}
    
    # Get weekly availability for this day using UUID
    weekly_response = supabase.table("provider_availability").select("*").eq(
        "provider_id", provider_uuid
    ).eq("day_of_week", day_of_week).execute()
    
    if weekly_response.data:
        weekly = weekly_response.data[0]
        is_available = weekly.get("is_active", False)
        working_start = weekly.get("start_time")
        working_end = weekly.get("end_time")
        # Handle time format from DB (might be HH:MM:SS)
        if working_start and len(working_start) > 5:
            working_start = working_start[:5]
        if working_end and len(working_end) > 5:
            working_end = working_end[:5]
    
    if not is_available:
        return {"date": requested_date, "slots": [], "timezone": "UTC"}
    
    # Check for exception on this date
    if check_table_exists("provider_availability_exceptions"):
        exc_response = supabase.table("provider_availability_exceptions").select("*").eq(
            "provider_id", provider_uuid
        ).eq("date", requested_date).execute()
        
        if exc_response.data:
            exception = exc_response.data[0]
            if exception.get("is_unavailable", False):
                # Full day off
                return {"date": requested_date, "slots": [], "timezone": "UTC"}
            # Override working window if custom hours provided
            if exception.get("start_time"):
                working_start = exception["start_time"]
            if exception.get("end_time"):
                working_end = exception["end_time"]
    
    if not working_start or not working_end:
        return {"date": requested_date, "slots": [], "timezone": "UTC"}
    
    # Get booking rules
    slot_step = 30
    min_notice = 0
    max_sessions = 6
    
    if check_table_exists("provider_booking_rules"):
        rules_response = supabase.table("provider_booking_rules").select("*").eq(
            "provider_id", provider_uuid
        ).execute()
        if rules_response.data:
            rules = rules_response.data[0]
            slot_step = rules.get("slot_step_minutes", 30)
            min_notice = rules.get("min_notice_minutes", 0)
            max_sessions = rules.get("max_sessions_per_day", 6)
    
    # Get existing bookings for this provider and date
    existing_bookings = []
    if check_table_exists("bookings"):
        # Bookings table uses UUID for provider_id
        bookings_response = supabase.table("bookings").select("*").eq(
            "provider_id", provider_uuid
        ).eq("booking_date", requested_date).in_(
            "status", ["pending", "confirmed"]
        ).execute()
        existing_bookings = bookings_response.data or []
    
    # Check max sessions limit
    if len(existing_bookings) >= max_sessions:
        return {"date": requested_date, "slots": [], "timezone": "UTC"}
    
    # Build list of booked time ranges
    booked_ranges = []
    for booking in existing_bookings:
        booking_time = booking.get("booking_time")
        if booking_time:
            # Get duration from booking or use the requested service_duration as fallback
            duration = booking.get("service_duration_minutes") or booking.get("duration_minutes") or service_duration
            start_mins = time_to_minutes(booking_time)
            end_mins = start_mins + duration
            booked_ranges.append((start_mins, end_mins))
    
    # Generate slots
    now = datetime.utcnow()
    today = now.date()
    current_time_mins = now.hour * 60 + now.minute
    
    window_start = time_to_minutes(working_start)
    window_end = time_to_minutes(working_end)
    
    slots = []
    slot_time = window_start
    
    while slot_time + service_duration <= window_end:
        slot_end = slot_time + service_duration
        
        # Check min notice (only for today)
        if target_date == today:
            earliest_allowed = current_time_mins + min_notice
            if slot_time < earliest_allowed:
                slot_time += slot_step
                continue
        elif target_date < today:
            # Date is in the past
            return {"date": requested_date, "slots": [], "timezone": "UTC"}
        
        # Check for overlap with existing bookings
        has_conflict = False
        for booked_start, booked_end in booked_ranges:
            # Overlap if: slot_start < booked_end AND slot_end > booked_start
            if slot_time < booked_end and slot_end > booked_start:
                has_conflict = True
                break
        
        if not has_conflict:
            slots.append(minutes_to_time(slot_time))
        
        slot_time += slot_step
    
    return {"date": requested_date, "slots": slots, "timezone": "UTC"}


@api_router.get("/providers/{provider_id}/available-slots")
async def get_available_slots(
    provider_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    service_duration: int = Query(..., ge=10, description="Service duration in minutes")
):
    """Get available booking slots for a provider on a specific date"""
    try:
        return await _get_available_slots_internal(provider_id, date, service_duration)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get available slots: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get available slots: {str(e)}"
        )


# ==================== BOOKING VALIDATION ENDPOINT ====================

class BookingCreate(BaseModel):
    provider_id: int
    customer_id: Optional[int] = None  # Legacy - now optional
    customer_auth_id: Optional[str] = None  # New - customer's auth UUID
    service_ids: List[int] = Field(default_factory=list)
    booking_date: Optional[str] = None  # YYYY-MM-DD
    booking_time: Optional[str] = None  # HH:MM
    service_duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    status: str = "pending"

@api_router.post("/bookings", status_code=status.HTTP_201_CREATED)
async def create_booking(booking: BookingCreate):
    """Create a new booking with optional slot validation"""
    try:
        # Get the provider's auth_id (UUID) for the bookings table
        provider_uuid = await get_provider_auth_id(booking.provider_id)
        if not provider_uuid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )
        
        # Determine customer_auth_id - prefer direct UUID, fallback to lookup
        customer_auth_id = booking.customer_auth_id
        if not customer_auth_id and booking.customer_id:
            # Lookup auth_id from user's integer ID
            user_response = supabase.table("users").select("auth_id").eq("id", booking.customer_id).execute()
            if user_response.data:
                customer_auth_id = user_response.data[0].get("auth_id")
        
        # If booking_date and booking_time are provided, validate availability
        if booking.booking_date and booking.booking_time:
            # Validate time format
            if not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', booking.booking_time):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="booking_time must be in HH:MM format"
                )
            
            # Get service duration (from request or calculate from services)
            # Note: service_ids are actually services.id values (the services table used by providers)
            service_duration = booking.service_duration_minutes
            if not service_duration and booking.service_ids:
                # Calculate total duration from selected services
                services_response = supabase.table("services").select("duration").in_(
                    "id", booking.service_ids
                ).execute()
                if services_response.data:
                    service_duration = sum(s.get("duration", 60) or 60 for s in services_response.data)
            
            service_duration = service_duration or 60  # Default to 60 minutes
            
            # Check if the slot is available
            slots_response = await _get_available_slots_internal(
                provider_id=booking.provider_id,
                requested_date=booking.booking_date,
                service_duration=service_duration
            )
            
            if booking.booking_time not in slots_response["slots"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Selected time is no longer available. Please choose another slot."
                )
        
        # Check if bookings table exists
        if not check_table_exists("bookings"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="bookings table does not exist. Please run migrations."
            )
        
        # Build booking data - use UUIDs for both provider and customer
        booking_data = {
            "provider_id": provider_uuid,
            "status": booking.status
        }
        
        # Set customer_auth_id (UUID) - primary identifier
        if customer_auth_id:
            booking_data["customer_auth_id"] = customer_auth_id
        
        # Also set customer_id (integer) for backward compatibility
        if booking.customer_id:
            booking_data["customer_id"] = booking.customer_id
        
        if booking.notes:
            booking_data["notes"] = booking.notes
        if booking.booking_date:
            booking_data["booking_date"] = booking.booking_date
        if booking.booking_time:
            booking_data["booking_time"] = booking.booking_time
        
        # Insert booking
        result = supabase.table("bookings").insert(booking_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create booking"
            )
        
        # Link services to booking if service_ids provided
        # Note: service_ids from frontend are services.id values from the 'services' table
        if booking.service_ids and check_table_exists("booking_services"):
            booking_id = result.data[0]["id"]
            
            # Fetch the services to validate and get price/duration
            services_response = supabase.table("services").select(
                "id, price, duration"
            ).in_("id", booking.service_ids).execute()
            
            if not services_response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected services not found"
                )
            
            # Create a lookup map for validation
            service_lookup = {s["id"]: s for s in services_response.data}
            
            # Check if provider_services table exists and has a FK constraint
            # If provider_services table exists, try to look up matching provider_service_ids
            provider_service_lookup = {}
            if check_table_exists("provider_services"):
                # Try to find matching entries in provider_services
                # provider_services may have provider_id (int or uuid) and service_id (varchar or int)
                try:
                    ps_response = supabase.table("provider_services").select(
                        "id, provider_id, service_id"
                    ).execute()
                    
                    # Build lookup by provider_id + service_id combo
                    for ps in ps_response.data or []:
                        # Create keys for both string and int service_id matching
                        key1 = f"{ps.get('provider_id')}:{ps.get('service_id')}"
                        provider_service_lookup[key1] = ps["id"]
                except Exception as e:
                    logging.warning(f"Could not query provider_services: {e}")
            
            # Validate all selected services exist
            service_links = []
            for sid in booking.service_ids:
                service = service_lookup.get(sid)
                if not service:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Service with id {sid} not found for this provider"
                    )
                
                # Build booking_services row
                service_link = {
                    "booking_id": booking_id,
                    "service_id": sid,  # This is the services.id
                    "price": service.get("price"),
                    "duration_minutes": service.get("duration")
                }
                
                # Try to find matching provider_service_id if available
                # Check multiple key formats for compatibility
                ps_id = None
                key_candidates = [
                    f"{booking.provider_id}:{sid}",  # provider_id:service_id (int:int)
                    f"{provider_uuid}:{sid}",  # provider_uuid:service_id (uuid:int)
                    f"{booking.provider_id}:{str(sid)}",  # int:string
                    f"{provider_uuid}:{str(sid)}",  # uuid:string
                ]
                for key in key_candidates:
                    if key in provider_service_lookup:
                        ps_id = provider_service_lookup[key]
                        break
                
                if ps_id:
                    service_link["provider_service_id"] = ps_id
                
                service_links.append(service_link)
            
            try:
                supabase.table("booking_services").insert(service_links).execute()
            except Exception as insert_error:
                error_str = str(insert_error)
                # If FK constraint fails, try without provider_service_id
                if "foreign key constraint" in error_str.lower() and "provider_service_id" in error_str.lower():
                    logging.warning("FK constraint on provider_service_id failed, retrying without it")
                    # Remove provider_service_id and retry
                    for link in service_links:
                        link.pop("provider_service_id", None)
                    supabase.table("booking_services").insert(service_links).execute()
                else:
                    raise
        
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e)
        # Check for unique constraint violation (double booking)
        if "uniq_bookings_provider_date_time" in error_str or "duplicate key" in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Selected time is no longer available. Please choose another slot."
            )
        # Check for foreign key violation - provide helpful message
        if "foreign key constraint" in error_str.lower() and "provider_id" in error_str.lower():
            logging.error(f"Foreign key error in bookings: {error_str}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database schema error: bookings.provider_id foreign key constraint failed. "
                       "Please ensure the bookings table correctly references the users table."
            )
        logging.error(f"Failed to create booking: {error_str}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create booking: {error_str}"
        )


# ==================== PROVIDER METRICS ENDPOINT ====================

@api_router.get("/providers/metrics")
async def get_provider_metrics(auth_id: str = Query(..., description="Provider's auth_id (UUID)")):
    """Get booking metrics for a provider dashboard"""
    try:
        if not check_table_exists("bookings"):
            return {
                "pending_count": 0,
                "confirmed_count": 0,
                "completed_count": 0,
                "canceled_count": 0,
                "total_count": 0
            }
        
        # Get all bookings for this provider
        result = supabase.table("bookings").select("status").eq("provider_id", auth_id).execute()
        bookings = result.data or []
        
        # Count by status
        pending_count = sum(1 for b in bookings if b.get("status") == "pending")
        confirmed_count = sum(1 for b in bookings if b.get("status") == "confirmed")
        completed_count = sum(1 for b in bookings if b.get("status") == "completed")
        canceled_count = sum(1 for b in bookings if b.get("status") in ["canceled", "declined"])
        
        return {
            "pending_count": pending_count,
            "confirmed_count": confirmed_count,
            "completed_count": completed_count,
            "canceled_count": canceled_count,
            "total_count": len(bookings)
        }
    except Exception as e:
        logging.error(f"Failed to fetch provider metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch metrics: {str(e)}"
        )


@api_router.get("/bookings")
async def get_bookings(
    role: Optional[str] = Query(None, description="Filter role: customer or provider"),
    auth_id: Optional[str] = Query(None, description="User's auth_id (UUID)"),
    provider_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    booking_status: Optional[str] = Query(None, alias="status"),
    booking_date: Optional[str] = Query(None, alias="date"),
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)")
):
    """Get bookings with optional filters and computed fields"""
    try:
        if not check_table_exists("bookings"):
            return []
        
        query = supabase.table("bookings").select("*")
        
        # Role-based filtering using auth_id (UUID)
        if role and auth_id:
            if role == "provider":
                # For provider role, match provider_id (UUID) directly
                query = query.eq("provider_id", auth_id)
            elif role == "customer":
                # For customer role, match customer_auth_id (UUID) directly
                # This avoids the integer ID lookup and works with UUID auth
                query = query.eq("customer_auth_id", auth_id)
        
        # Legacy filters (for backward compatibility)
        if provider_id:
            provider_uuid = await get_provider_auth_id(provider_id)
            if provider_uuid:
                query = query.eq("provider_id", provider_uuid)
        if customer_id:
            # Legacy: look up by integer customer_id
            query = query.eq("customer_id", customer_id)
        if booking_status:
            query = query.eq("status", booking_status)
        if booking_date:
            query = query.eq("booking_date", booking_date)
        if date_from:
            query = query.gte("booking_date", date_from)
        if date_to:
            query = query.lte("booking_date", date_to)
        
        result = query.order("booking_date", desc=True).order("booking_time", desc=True).execute()
        bookings = result.data or []
        
        # Enrich bookings with computed fields
        enriched_bookings = []
        for booking in bookings:
            enriched = await _enrich_booking(booking, role)
            enriched_bookings.append(enriched)
        
        return enriched_bookings
    except Exception as e:
        logging.error(f"Failed to fetch bookings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch bookings: {str(e)}"
        )


async def _enrich_booking(booking: dict, role: Optional[str] = None) -> dict:
    """Enrich a booking with computed fields: services, totals, display names"""
    enriched = {**booking}
    
    # Get booking services
    services = []
    total_amount = 0
    total_duration = 0
    
    if check_table_exists("booking_services"):
        try:
            bs_response = supabase.table("booking_services").select("*").eq(
                "booking_id", booking["id"]
            ).execute()
            
            for bs in bs_response.data or []:
                service_name = "Service"
                # Get service name from services table using service_id
                if bs.get("service_id"):
                    try:
                        svc_response = supabase.table("services").select("*").eq(
                            "id", bs["service_id"]
                        ).execute()
                        if svc_response.data:
                            # Parse service name using the full record
                            parsed = parse_service_record(svc_response.data[0])
                            service_name = parsed.get("sub_service_name") or parsed.get("name") or svc_response.data[0].get("name", "Service")
                    except:
                        pass
                
                price = bs.get("price") or 0
                duration = bs.get("duration_minutes") or 0
                services.append({
                    "service_id": bs.get("service_id"),
                    "service_name": service_name,
                    "price": price,
                    "duration_minutes": duration
                })
                total_amount += price
                total_duration += duration
        except Exception as e:
            logging.warning(f"Could not fetch booking_services: {e}")
    
    enriched["services"] = services
    enriched["total_amount"] = total_amount
    enriched["total_duration"] = total_duration
    
    # Get provider display name (hide email for customers)
    provider_display_name = "Provider"
    if booking.get("provider_id"):
        try:
            # provider_id is UUID (auth_id)
            user_response = supabase.table("users").select("id, name, auth_id").eq(
                "auth_id", booking["provider_id"]
            ).execute()
            if user_response.data:
                user = user_response.data[0]
                provider_display_name = user.get("name") or "Provider"
                
                # Try to get business name from stylists
                stylist_response = supabase.table("stylists").select("business_name").eq(
                    "user_id", user["id"]
                ).execute()
                if stylist_response.data and stylist_response.data[0].get("business_name"):
                    provider_display_name = stylist_response.data[0]["business_name"]
        except:
            pass
    enriched["provider_display_name"] = provider_display_name
    
    # Get customer display name
    customer_display_name = "Customer"
    if booking.get("customer_id"):
        try:
            user_response = supabase.table("users").select("name").eq(
                "id", booking["customer_id"]
            ).execute()
            if user_response.data:
                customer_display_name = user_response.data[0].get("name") or "Customer"
        except:
            pass
    enriched["customer_display_name"] = customer_display_name
    
    return enriched


@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: int, role: Optional[str] = Query(None)):
    """Get a specific booking by ID with full details"""
    try:
        if not check_table_exists("bookings"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="bookings table does not exist"
            )
        
        result = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = result.data[0]
        enriched = await _enrich_booking(booking, role)
        return enriched
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch booking: {str(e)}"
        )


class BookingStatusUpdate(BaseModel):
    status: str
    role: str  # "customer" or "provider"
    auth_id: str  # To verify the requester


@api_router.put("/bookings/{booking_id}")
async def update_booking(
    booking_id: int, 
    new_status: str = Query(..., alias="status"),
    role: Optional[str] = Query(None),
    auth_id: Optional[str] = Query(None)
):
    """Update booking status with validation rules"""
    try:
        valid_statuses = ["pending_payment", "pending", "confirmed", "completed", "canceled", "declined"]
        # Support both 'cancelled' and 'canceled' spellings
        if new_status == "cancelled":
            new_status = "canceled"
        
        if new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        # Get current booking
        current = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not current.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = current.data[0]
        current_status = booking.get("status", "pending")
        
        # Validate transition based on role
        if role and auth_id:
            is_provider = (role == "provider" and booking.get("provider_id") == auth_id)
            is_customer = (role == "customer" and booking.get("customer_auth_id") == auth_id)
            
            # Fallback: check by customer_id (integer) for legacy bookings
            if role == "customer" and not is_customer:
                user_response = supabase.table("users").select("id").eq("auth_id", auth_id).execute()
                if user_response.data:
                    is_customer = (booking.get("customer_id") == user_response.data[0]["id"])
            
            # Provider transition rules
            if is_provider:
                allowed_transitions = {
                    "pending": ["confirmed", "declined", "canceled"],
                    "confirmed": ["completed", "canceled"],
                    "completed": [],
                    "canceled": [],
                    "declined": []
                }
                if new_status not in allowed_transitions.get(current_status, []):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Provider cannot change status from '{current_status}' to '{new_status}'"
                    )
            
            # Customer transition rules
            elif is_customer:
                allowed_transitions = {
                    "pending": ["canceled"],
                    "confirmed": ["canceled"],  # Allow cancel if confirmed (simplified rule)
                    "completed": [],
                    "canceled": [],
                    "declined": []
                }
                if new_status not in allowed_transitions.get(current_status, []):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Customer cannot change status from '{current_status}' to '{new_status}'"
                    )
            else:
                # Not authorized for this booking
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this booking"
                )
        
        # Update the booking
        result = supabase.table("bookings").update({"status": new_status}).eq("id", booking_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Handle escrow release/refund based on status change
        if new_status == "completed" and current_status in ["pending", "confirmed"]:
            # Release escrow to provider
            provider_id = booking.get("provider_id")
            customer_auth_id = booking.get("customer_auth_id")
            if provider_id and customer_auth_id:
                await _release_escrow_to_provider(booking_id, provider_id, customer_auth_id)
        
        elif new_status == "canceled" and current_status in ["pending", "confirmed", "pending_payment"]:
            # Refund escrow to customer (only if payment was made)
            customer_auth_id = booking.get("customer_auth_id")
            payment_status = booking.get("payment_status")
            if customer_auth_id and payment_status == "paid":
                await _refund_escrow_to_customer(booking_id, customer_auth_id)
        
        # Return enriched booking
        enriched = await _enrich_booking(result.data[0], role)
        return enriched
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update booking: {str(e)}"
        )


# ==================== ROOT ENDPOINT ====================

@api_router.get("/")
async def root():
    return {
        "message": "Beauty Stylist Marketplace API",
        "version": "1.0.0",
        "database": "Supabase PostgreSQL",
        "endpoints": {
            "users": "/api/users",
            "stylists": "/api/stylists",
            "wallets": "/api/wallets",
            "test_connection": "/api/test-connection"
        }
    }


@api_router.post("/migrate/backfill-customer-auth-ids")
async def backfill_customer_auth_ids():
    """Backfill customer_auth_id for existing bookings that only have customer_id (integer)"""
    try:
        if not check_table_exists("bookings"):
            return {"message": "No bookings table", "updated": 0}
        
        # Get all bookings without customer_auth_id but with customer_id
        bookings_response = supabase.table("bookings").select("id, customer_id").is_("customer_auth_id", "null").execute()
        bookings = bookings_response.data or []
        
        updated_count = 0
        for booking in bookings:
            customer_id = booking.get("customer_id")
            if customer_id:
                # Look up auth_id from users table
                user_response = supabase.table("users").select("auth_id").eq("id", customer_id).execute()
                if user_response.data and user_response.data[0].get("auth_id"):
                    auth_id = user_response.data[0]["auth_id"]
                    # Update the booking
                    supabase.table("bookings").update({"customer_auth_id": auth_id}).eq("id", booking["id"]).execute()
                    updated_count += 1
        
        return {"message": f"Backfill complete", "updated": updated_count, "total_checked": len(bookings)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to backfill: {str(e)}"
        )


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
