from fastapi import FastAPI, APIRouter, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
from supabase import create_client, Client


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
        
        response = supabase.table("users").update(update_data).eq("id", user_id).execute()
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
        
        response = supabase.table("stylists").update(update_data).eq("user_id", user_id).execute()
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
        # Get stylist data
        stylist_response = supabase.table("stylists").select(
            "*, users!stylists_user_id_fkey(name, email)"
        ).eq("user_id", provider_id).execute()
        
        if not stylist_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )
        
        stylist = stylist_response.data[0]
        
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
