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

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    phone_verified: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    auth_id: str
    name: str
    email: str
    phone: Optional[str]
    role: str
    phone_verified: Optional[bool] = False
    profile_completed: Optional[bool] = False

# Stylist Models
class StylistCreate(BaseModel):
    user_id: int  # Foreign key to users.id (also serves as primary key)
    hourly_rate: float
    is_verified: bool = False
    is_premium: bool = False
    bio: Optional[str] = None
    location: Optional[str] = None

class StylistUpdate(BaseModel):
    hourly_rate: Optional[float] = None
    is_verified: Optional[bool] = None
    is_premium: Optional[bool] = None
    bio: Optional[str] = None
    location: Optional[str] = None

class StylistResponse(BaseModel):
    user_id: int  # Primary key
    hourly_rate: float
    is_verified: bool
    is_premium: bool
    bio: Optional[str] = None
    location: Optional[str] = None
    rating: Optional[float] = 0.0
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


# Provider Services Models (for service toggle persistence)
class ProviderServiceCreate(BaseModel):
    provider_id: int  # user_id from stylists table
    service_id: str  # service identifier from constants
    service_name: str
    price: float = 0.0
    duration: int = 60  # in minutes
    enabled: bool = True
    consultation_required: bool = False

class ProviderServiceUpdate(BaseModel):
    price: Optional[float] = None
    duration: Optional[int] = None
    enabled: Optional[bool] = None
    consultation_required: Optional[bool] = None

class ProviderServiceResponse(BaseModel):
    id: int
    provider_id: int
    service_id: str
    service_name: str
    price: float
    duration: int
    enabled: bool
    consultation_required: bool


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

@api_router.post("/provider-services", response_model=ProviderServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_provider_service(service_data: ProviderServiceCreate):
    """Create a new provider service"""
    try:
        # Check if service already exists for this provider
        existing = supabase.table("provider_services").select("*").eq("provider_id", service_data.provider_id).eq("service_id", service_data.service_id).execute()
        if existing.data:
            # Update existing instead of creating new
            update_data = {
                "price": service_data.price,
                "duration": service_data.duration,
                "enabled": service_data.enabled,
                "consultation_required": service_data.consultation_required,
                "service_name": service_data.service_name
            }
            response = supabase.table("provider_services").update(update_data).eq("id", existing.data[0]["id"]).execute()
            return response.data[0]
        
        service_dict = {
            "provider_id": service_data.provider_id,
            "service_id": service_data.service_id,
            "service_name": service_data.service_name,
            "price": service_data.price,
            "duration": service_data.duration,
            "enabled": service_data.enabled,
            "consultation_required": service_data.consultation_required
        }
        
        response = supabase.table("provider_services").insert(service_dict).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create provider service: {str(e)}"
        )

@api_router.get("/provider-services/{provider_id}", response_model=List[ProviderServiceResponse])
async def get_provider_services(provider_id: int):
    """Get all services for a provider"""
    try:
        response = supabase.table("provider_services").select("*").eq("provider_id", provider_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch provider services: {str(e)}"
        )

@api_router.put("/provider-services/{service_id}", response_model=ProviderServiceResponse)
async def update_provider_service(service_id: int, service_update: ProviderServiceUpdate):
    """Update a provider service"""
    try:
        existing = supabase.table("provider_services").select("*").eq("id", service_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider service not found"
            )
        
        update_data = service_update.model_dump(exclude_unset=True)
        if not update_data:
            return existing.data[0]
        
        response = supabase.table("provider_services").update(update_data).eq("id", service_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update provider service: {str(e)}"
        )

@api_router.post("/provider-services/bulk/{provider_id}")
async def bulk_update_provider_services(provider_id: int, services: List[ProviderServiceCreate]):
    """Bulk update/create services for a provider"""
    try:
        results = []
        for service_data in services:
            # Check if service exists
            existing = supabase.table("provider_services").select("*").eq("provider_id", provider_id).eq("service_id", service_data.service_id).execute()
            
            if existing.data:
                # Update existing
                update_data = {
                    "price": service_data.price,
                    "duration": service_data.duration,
                    "enabled": service_data.enabled,
                    "consultation_required": service_data.consultation_required,
                    "service_name": service_data.service_name
                }
                response = supabase.table("provider_services").update(update_data).eq("id", existing.data[0]["id"]).execute()
                results.append(response.data[0])
            else:
                # Create new
                service_dict = {
                    "provider_id": provider_id,
                    "service_id": service_data.service_id,
                    "service_name": service_data.service_name,
                    "price": service_data.price,
                    "duration": service_data.duration,
                    "enabled": service_data.enabled,
                    "consultation_required": service_data.consultation_required
                }
                response = supabase.table("provider_services").insert(service_dict).execute()
                results.append(response.data[0])
        
        return {"message": f"Successfully updated {len(results)} services", "services": results}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update provider services: {str(e)}"
        )

@api_router.delete("/provider-services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_service(service_id: int):
    """Delete a provider service"""
    try:
        existing = supabase.table("provider_services").select("*").eq("id", service_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider service not found"
            )
        
        supabase.table("provider_services").delete().eq("id", service_id).execute()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete provider service: {str(e)}"
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
