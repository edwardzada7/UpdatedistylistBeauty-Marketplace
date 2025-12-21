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
import uuid


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase connection
supabase_url = os.environ['SUPABASE_URL']
supabase_key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
supabase: Client = create_client(supabase_url, supabase_key)

# Create the main app without a prefix
app = FastAPI(title="Supabase Integration API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ==================== MODELS ====================

class UserCreate(BaseModel):
    auth_id: str
    email: EmailStr
    name: str
    phone: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

class UserResponse(BaseModel):
    id: str
    auth_id: str
    email: str
    name: str
    phone: Optional[str]
    created_at: str

class StylistCreate(BaseModel):
    auth_id: str
    name: str
    specialty: str
    bio: Optional[str] = None
    hourly_rate: Optional[float] = None

class StylistUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None
    hourly_rate: Optional[float] = None

class StylistResponse(BaseModel):
    id: str
    auth_id: str
    name: str
    specialty: str
    bio: Optional[str]
    hourly_rate: Optional[float]
    created_at: str

class WalletCreate(BaseModel):
    auth_id: str
    balance: float = 0.0
    currency: str = "USD"

class WalletUpdate(BaseModel):
    balance: Optional[float] = None
    currency: Optional[str] = None

class WalletResponse(BaseModel):
    id: str
    auth_id: str
    balance: float
    currency: str
    created_at: str


# ==================== DATABASE CONNECTION TEST ====================

@api_router.get("/test-connection")
async def test_connection():
    """Test database connection to Supabase"""
    try:
        # Try to query the users table
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
            "id": str(uuid.uuid4()),
            "auth_id": user_data.auth_id,
            "email": user_data.email,
            "name": user_data.name,
            "phone": user_data.phone
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
async def get_user(user_id: str):
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

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_update: UserUpdate):
    """Update a user"""
    try:
        # Check if user exists
        existing = supabase.table("users").select("*").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update only provided fields
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
async def delete_user(user_id: str):
    """Delete a user"""
    try:
        # Check if user exists
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
    """Create a new stylist"""
    try:
        # Verify user exists
        user = supabase.table("users").select("*").eq("auth_id", stylist_data.auth_id).execute()
        if not user.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found with this auth_id"
            )
        
        # Check if stylist already exists for this auth_id
        existing = supabase.table("stylists").select("*").eq("auth_id", stylist_data.auth_id).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stylist profile already exists for this user"
            )
        
        stylist_dict = {
            "id": str(uuid.uuid4()),
            "auth_id": stylist_data.auth_id,
            "name": stylist_data.name,
            "specialty": stylist_data.specialty,
            "bio": stylist_data.bio,
            "hourly_rate": stylist_data.hourly_rate
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
async def get_all_stylists():
    """Get all stylists"""
    try:
        response = supabase.table("stylists").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stylists: {str(e)}"
        )

@api_router.get("/stylists/{stylist_id}", response_model=StylistResponse)
async def get_stylist(stylist_id: str):
    """Get a specific stylist by ID"""
    try:
        response = supabase.table("stylists").select("*").eq("id", stylist_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stylist not found"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stylist: {str(e)}"
        )

@api_router.put("/stylists/{stylist_id}", response_model=StylistResponse)
async def update_stylist(stylist_id: str, stylist_update: StylistUpdate):
    """Update a stylist"""
    try:
        existing = supabase.table("stylists").select("*").eq("id", stylist_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stylist not found"
            )
        
        update_data = stylist_update.model_dump(exclude_unset=True)
        if not update_data:
            return existing.data[0]
        
        response = supabase.table("stylists").update(update_data).eq("id", stylist_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update stylist: {str(e)}"
        )

@api_router.delete("/stylists/{stylist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stylist(stylist_id: str):
    """Delete a stylist"""
    try:
        existing = supabase.table("stylists").select("*").eq("id", stylist_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stylist not found"
            )
        
        supabase.table("stylists").delete().eq("id", stylist_id).execute()
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
        user = supabase.table("users").select("*").eq("auth_id", wallet_data.auth_id).execute()
        if not user.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found with this auth_id"
            )
        
        # Check if wallet already exists for this auth_id
        existing = supabase.table("wallets").select("*").eq("auth_id", wallet_data.auth_id).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wallet already exists for this user"
            )
        
        wallet_dict = {
            "id": str(uuid.uuid4()),
            "auth_id": wallet_data.auth_id,
            "balance": wallet_data.balance,
            "currency": wallet_data.currency,
            "created_at": datetime.utcnow().isoformat()
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
async def get_wallet(wallet_id: str):
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

@api_router.put("/wallets/{wallet_id}", response_model=WalletResponse)
async def update_wallet(wallet_id: str, wallet_update: WalletUpdate):
    """Update a wallet"""
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

@api_router.delete("/wallets/{wallet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wallet(wallet_id: str):
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


# ==================== ROOT ENDPOINT ====================

@api_router.get("/")
async def root():
    return {
        "message": "Supabase Integration API",
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
