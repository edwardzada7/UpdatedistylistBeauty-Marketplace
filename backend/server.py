from fastapi import FastAPI, APIRouter, HTTPException, status, Query, Request, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional, Dict, Any
import json
from datetime import datetime, date, time, timedelta, timezone
from supabase import create_client, Client
import re
import requests
import hmac
import hashlib
import uuid

# Wallet helpers - additive, safe; never mutates DB on its own
from wallet_helpers import (
    categorize_transaction,
    normalize_transaction,
    compute_wallet_balance_from_tx,
    compute_provider_earnings,
    CATEGORY_ESCROW_RELEASE,
    CATEGORY_TOPUP,
    CATEGORY_REFUND,
    CATEGORY_WITHDRAWAL,
    CATEGORY_ESCROW_HOLD,
)

# Booking reminders - lightweight in-app reminder scheduler
from booking_reminders import scan_and_create_reminders

# No-show automation helpers
from no_show_helpers import (
    finalize_expired_no_shows,
    grace_period_minutes,
    compute_deadline,
    STATUS_NO_SHOW_PENDING,
    STATUS_USER_NO_SHOW,
    STATUS_PROVIDER_NO_SHOW,
    STATUS_DISPUTED,
    ELIGIBLE_REPORT_STATUSES,
    ROLE_CUSTOMER,
    ROLE_PROVIDER,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Currency symbol for Nigeria
CURRENCY = "₦"

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
    # Phase 5 - Account type (individual or business)
    account_type: Optional[str] = "individual"

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
    # Phase 5 - Account type
    account_type: Optional[str] = "individual"

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
    # Phase 6 - exposed for KYC-based "Verified Individual / Business" badge
    auth_id: Optional[str] = None
    account_type: Optional[str] = None
    kyc_status: Optional[str] = None

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


# ==================== WITHDRAWAL REQUEST MODELS (Phase A) ====================

class WithdrawalRequestCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Amount to withdraw (must be positive)")
    bank_name: str = Field(..., min_length=2, description="Bank name")
    account_name: str = Field(..., min_length=2, description="Account holder name")
    account_number: str = Field(..., min_length=10, max_length=10, description="10-digit account number")
    note: Optional[str] = None

class WithdrawalRequestResponse(BaseModel):
    id: int
    provider_auth_id: str
    amount: float
    currency: str = "NGN"
    bank_name: str
    account_name: str
    account_number: str
    status: str
    note: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

class AdminWithdrawalAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$", description="Action: 'approve' or 'reject'")
    note: Optional[str] = None


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
            "role": user_data.role,
            # Phase 5 - persist account_type (column added by phase5 migration)
            "account_type": user_data.account_type or "individual",
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
    logging.info("[route-entered] GET /api/users/by-auth/{auth_id} auth_id=%s", auth_id)
    try:
        response = supabase.table("users").select("*").eq("auth_id", auth_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        user_row = response.data[0]
        # Phase 6 - reject soft-deleted accounts with HTTP 410 Gone so the
        # frontend AuthContext can force sign-out cleanly.
        if user_row.get("is_deleted") is True:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Account has been deleted."
            )
        return user_row
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


# ==================== PHASE 6 - ACCOUNT DELETION ==========================

class DeleteAccountRequest(BaseModel):
    auth_id: str
    confirmation_phrase: str

DELETE_ACCOUNT_PHRASE = "DELETE MY ACCOUNT"


@api_router.post("/users/delete-account")
async def delete_my_account(payload: DeleteAccountRequest):
    """
    Phase 6 - Soft-delete the calling user's account.

    Requirements (frontend MUST satisfy before calling this):
      - User has re-authenticated with their password (Supabase signInWithPassword)
      - User typed the exact phrase 'DELETE MY ACCOUNT'

    Effect:
      - users.is_deleted = TRUE, users.deleted_at = now()
      - If user is a provider, stylists.is_verified is left untouched but the
        is_deleted flag on users will hide them from /api/stylists.
      - Bookings, wallet, withdrawals, and audit history are PRESERVED.
    """
    # 1) Validate confirmation phrase (case-sensitive)
    if (payload.confirmation_phrase or "").strip() != DELETE_ACCOUNT_PHRASE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Confirmation phrase must exactly match: '{DELETE_ACCOUNT_PHRASE}'"
        )

    # 2) Locate user
    res = supabase.table("users").select("*").eq("auth_id", payload.auth_id).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    user_row = res.data[0]
    if user_row.get("is_deleted") is True:
        return {
            "ok": True,
            "already_deleted": True,
            "deleted_at": user_row.get("deleted_at"),
        }

    # 3) Soft-delete: try the full payload first; fall back if migration
    # hasn't been applied so the endpoint still returns a sane error.
    update_payload = {
        "is_deleted": True,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase.table("users").update(update_payload).eq("auth_id", payload.auth_id).execute()
    except Exception as e:
        msg = str(e).lower()
        if "is_deleted" in msg or "deleted_at" in msg or "column" in msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Account deletion not provisioned. Apply phase6_account_deletion.sql migration."
            )
        logging.error(f"[delete-account] update failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete account: {e}"
        )

    logging.info(f"[delete-account] soft-deleted user auth_id={payload.auth_id}")
    return {
        "ok": True,
        "auth_id": payload.auth_id,
        "deleted_at": update_payload["deleted_at"],
        "message": "Account deleted successfully.",
    }


@api_router.get("/admin/users/deleted")
async def admin_list_deleted_users(
    limit: int = 100,
    offset: int = 0,
    x_admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY"),
):
    """Phase 6 - Admin-only list of soft-deleted users."""
    admin_dash_key = os.environ.get("ADMIN_DASH_KEY", "")
    if not x_admin_key or x_admin_key != admin_dash_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
    try:
        q = supabase.table("users").select(
            "id, auth_id, name, email, role, account_type, is_deleted, deleted_at, created_at",
            count="exact",
        ).eq("is_deleted", True).order("deleted_at", desc=True).range(offset, offset + limit - 1)
        res = q.execute()
        return {
            "users": res.data or [],
            "total": res.count or 0,
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        msg = str(e).lower()
        # Phase 6 hotfix - only treat as a phase6 provisioning problem when the
        # actual phase6 columns are missing. A generic "column X does not exist"
        # for unrelated columns (e.g., users.created_at) should NOT be blamed
        # on phase6 — surface the real error instead so we can fix it cleanly.
        if "is_deleted" in msg or "deleted_at" in msg:
            raise HTTPException(
                status_code=503,
                detail="Soft-delete column not provisioned. Apply phase6_account_deletion.sql migration."
            )
        logging.error(f"[admin/users/deleted] failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    logging.info("[route-entered] GET /api/stylists verified_only=%s premium_only=%s sort_by=%s", verified_only, premium_only, sort_by)
    try:
        # Build query - use specific relationship name to avoid ambiguity.
        # Phase 6: include auth_id + account_type + is_deleted so we can
        # filter soft-deleted accounts and surface the KYC-verified badge.
        query = supabase.table("stylists").select(
            "*, users!stylists_user_id_fkey(auth_id, name, email, account_type, is_deleted)"
        )
        
        if verified_only:
            query = query.eq("is_verified", True)
        if premium_only:
            query = query.eq("is_premium", True)
        
        # Execute query
        response = query.execute()
        
        # Phase 6 - bulk-fetch KYC statuses keyed by auth_id (graceful fallback)
        provider_auth_ids = [
            it.get("users", {}).get("auth_id")
            for it in (response.data or [])
            if it.get("users") and it["users"].get("auth_id")
        ]
        kyc_status_by_auth: Dict[str, str] = {}
        if provider_auth_ids:
            try:
                kyc_res = supabase.table("kyc_submissions").select("user_auth_id,status").in_(
                    "user_auth_id", provider_auth_ids
                ).execute()
                for row in (kyc_res.data or []):
                    kyc_status_by_auth[row["user_auth_id"]] = row.get("status") or "not_submitted"
            except Exception as kyc_err:
                logging.warning(f"[stylists] kyc bulk fetch failed (non-fatal): {kyc_err}")
        
        # Format response to include user data
        stylists = []
        for item in response.data:
            user_join = item.get("users") or {}
            # Phase 6 - skip soft-deleted users from public marketplace
            if user_join.get("is_deleted") is True:
                continue
            auth_id = user_join.get("auth_id")
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
                "user_name": user_join.get("name"),
                "user_email": user_join.get("email"),
                # Phase 6 - account type + KYC for badges
                "auth_id": auth_id,
                "account_type": user_join.get("account_type"),
                "kyc_status": kyc_status_by_auth.get(auth_id, "not_submitted"),
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
        response = supabase.table("stylists").select(
            "*, users!stylists_user_id_fkey(auth_id, name, email, account_type, is_deleted)"
        ).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stylist not found"
            )
        
        item = response.data[0]
        user_join = item.get("users") or {}
        # Phase 6 - hide soft-deleted providers from marketplace
        if user_join.get("is_deleted") is True:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stylist not found"
            )
        auth_id = user_join.get("auth_id")
        # Phase 6 - look up KYC status for badge rendering (graceful fallback)
        kyc_status = "not_submitted"
        if auth_id:
            try:
                kyc_res = supabase.table("kyc_submissions").select("status").eq(
                    "user_auth_id", auth_id
                ).limit(1).execute()
                if kyc_res.data:
                    kyc_status = kyc_res.data[0].get("status") or "not_submitted"
            except Exception as kyc_err:
                logging.warning(f"[stylist] kyc lookup failed (non-fatal): {kyc_err}")
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
            "user_name": user_join.get("name"),
            "user_email": user_join.get("email"),
            # Phase 6 - badge inputs
            "auth_id": auth_id,
            "account_type": user_join.get("account_type"),
            "kyc_status": kyc_status,
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
            
            # Create notification for wallet topup success
            if purpose == "wallet_topup":
                await create_notification(
                    recipient_auth_id=user_auth_id,
                    notification_type="wallet_topup_success",
                    title="Wallet Top-Up Successful",
                    message=f"Your wallet has been credited with {CURRENCY}{amount_naira:,.2f}",
                    metadata={
                        "amount": amount_naira,
                        "reference": reference
                    }
                )
        
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
        
        # Fallback to booking.total_amount
        if amount == 0:
            amount = float(booking.get("total_amount", 0) or 0)
        
        # Fallback to booking.service_price (legacy)
        if amount == 0:
            amount = float(booking.get("service_price", 0) or 0)
        
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
    """Refund escrow funds to customer when booking is canceled or declined"""
    try:
        # Check for idempotency using payments table - don't refund twice
        refund_ref = f"escrow_refund_{booking_id}"
        if check_table_exists("payments"):
            existing_refund = supabase.table("payments").select("id").eq(
                "reference", refund_ref
            ).eq("status", "success").execute()
            if existing_refund.data:
                logging.info(f"Escrow already refunded for booking {booking_id}")
                return
        
        # Also check wallet_transactions as backup
        if check_table_exists("wallet_transactions"):
            existing_tx = supabase.table("wallet_transactions").select("id").eq(
                "booking_id", booking_id
            ).eq("description", f"Refund for booking #{booking_id}").execute()
            if existing_tx.data:
                logging.info(f"Refund transaction exists for booking {booking_id}")
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
                amount = sum(float(svc.get("price", 0) or 0) for svc in services_response.data)
        
        # Fallback to booking.total_amount
        if amount == 0:
            amount = float(booking.get("total_amount", 0) or 0)
        
        # Fallback to booking.service_price (legacy)
        if amount == 0:
            amount = float(booking.get("service_price", 0) or 0)
        
        # Fallback to payment record
        if amount == 0 and check_table_exists("payments"):
            payment_response = supabase.table("payments").select("amount").eq("booking_id", booking_id).eq("status", "success").execute()
            if payment_response.data:
                amount = float(payment_response.data[0].get("amount", 0))
        
        if amount <= 0:
            logging.warning(f"No amount found for booking {booking_id} refund")
            return
        
        # Move from escrow to available balance for customer
        customer_wallet = supabase.table("wallets").select("*").eq("user_auth_id", customer_auth_id).execute()
        if customer_wallet.data:
            wallet = customer_wallet.data[0]
            new_escrow = max(0, (wallet.get("escrow_balance") or 0) - amount)
            new_balance = (wallet.get("balance") or 0) + amount
            supabase.table("wallets").update({
                "escrow_balance": new_escrow,
                "balance": new_balance
            }).eq("id", wallet["id"]).execute()
        else:
            logging.warning(f"Customer wallet not found for {customer_auth_id}")
            return
        
        # Record payment for idempotency tracking
        if check_table_exists("payments"):
            supabase.table("payments").insert({
                "reference": refund_ref,
                "amount": amount,
                "purpose": "escrow_refund",
                "payment_provider": "internal",
                "booking_id": booking_id,
                "status": "success",
                "processed": True,
                "created_at": datetime.utcnow().isoformat(),
                "processed_at": datetime.utcnow().isoformat()
            }).execute()
        
        # Record transaction with proper field values
        if check_table_exists("wallet_transactions"):
            supabase.table("wallet_transactions").insert({
                "user_auth_id": customer_auth_id,
                "auth_id": customer_auth_id,
                "type": "credit",  # DB constraint: 'credit' or 'debit'
                "direction": "credit",  # lowercase - refund is credit to available
                "amount": amount,
                "reference": refund_ref,
                "booking_id": booking_id,
                "description": f"Refund for booking #{booking_id}",
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



# ===========================================================================
# FLUTTERWAVE PAYMENT ENDPOINTS (Phase 4.x - replaces Paystack as default)
# ---------------------------------------------------------------------------
# Purpose: wallet top-up via Flutterwave v3 hosted checkout.
# Booking payments STILL go through the wallet (`/bookings/{id}/pay-with-wallet`).
# Paystack endpoints above remain dormant so we can roll back instantly by
# repointing the frontend `paymentsAPI` if needed.
# ===========================================================================

FLUTTERWAVE_BASE = "https://api.flutterwave.com/v3"


class FlutterwaveInitRequest(BaseModel):
    amount: float  # major units (Naira), NOT kobo
    email: EmailStr
    purpose: str  # "wallet_topup" (only mode supported for now)
    booking_id: Optional[int] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    redirect_url: Optional[str] = None  # client-supplied; backend appends nothing


def get_flw_headers():
    """Build Flutterwave Authorization headers. Returns None if no secret configured."""
    secret_key = os.environ.get("FLW_SECRET_KEY")
    if not secret_key:
        return None
    return {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }


def _generate_flw_tx_ref(purpose: str) -> str:
    """Unique tx_ref. Prefix matches existing Paystack scheme so dashboard/admin
    tooling can still filter by `istylist_*`."""
    return f"istylist_{purpose}_flw_{uuid.uuid4().hex[:12]}"


@api_router.post("/payments/flutterwave/initialize")
async def initialize_flutterwave_payment(request: FlutterwaveInitRequest):
    """Initialize a Flutterwave hosted-checkout transaction for wallet top-up.

    Returns the same shape the frontend currently expects from the legacy
    Paystack initializer (`status`, `authorization_url`, `reference`), so the
    `paymentsAPI.initialize()` call site doesn't need restructuring.
    """
    try:
        # Only wallet_topup is supported - bookings go through wallet payment
        if request.purpose != "wallet_topup":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Flutterwave checkout is only available for wallet top-ups. "
                       "Use /api/bookings/{id}/pay-with-wallet for booking payments."
            )

        headers = get_flw_headers()
        if not headers:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment gateway not configured. FLW_SECRET_KEY is missing."
            )

        if request.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount must be greater than 0"
            )

        tx_ref = _generate_flw_tx_ref(request.purpose)

        # Resolve redirect_url - if frontend didn't supply, leave it empty
        # (Flutterwave will then show a generic completion page).
        redirect_url = (request.redirect_url or "").strip()

        payload = {
            "tx_ref": tx_ref,
            "amount": f"{float(request.amount):.2f}",   # Flutterwave: major units, string OK
            "currency": "NGN",
            "payment_options": "card,banktransfer,ussd,account,mobilemoneyghana,mpesa",
            "customer": {
                "email": request.email,
                "name": request.name or request.email.split("@")[0],
                "phonenumber": request.phone or "",
            },
            "meta": {
                "purpose": request.purpose,
                "booking_id": request.booking_id,
                "user_email": request.email,
            },
            "customizations": {
                "title": "iStylist Wallet Top-Up",
                "description": f"Top up your iStylist wallet ({CURRENCY}{request.amount:,.2f})",
            },
        }
        if redirect_url:
            payload["redirect_url"] = redirect_url

        try:
            flw_resp = requests.post(
                f"{FLUTTERWAVE_BASE}/payments",
                json=payload,
                headers=headers,
                timeout=30,
            )
        except Exception as net_ex:
            logging.error(f"Flutterwave network error: {net_ex}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not reach payment gateway. Please try again."
            )

        if flw_resp.status_code not in (200, 201):
            logging.error(f"Flutterwave init non-2xx: {flw_resp.status_code} {flw_resp.text[:500]}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to initialize payment with Flutterwave"
            )

        flw_data = flw_resp.json()
        if (flw_data.get("status") or "").lower() != "success" or not (flw_data.get("data") or {}).get("link"):
            logging.error(f"Flutterwave init unexpected payload: {flw_data}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=flw_data.get("message") or "Flutterwave initialization failed"
            )

        link = flw_data["data"]["link"]

        # Save pending payment record (reuses existing payments table)
        payment_record = {
            "reference": tx_ref,
            "email": request.email,
            "amount": request.amount,
            "purpose": request.purpose,
            "payment_provider": "flutterwave",
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
        }
        try:
            if check_table_exists("payments"):
                supabase.table("payments").insert(payment_record).execute()
        except Exception as db_ex:
            logging.warning(f"Could not insert payment row (continuing): {db_ex}")

        # Backward-compatible response shape
        return {
            "status": True,
            "message": "Authorization URL created",
            "authorization_url": link,
            "reference": tx_ref,
            "provider": "flutterwave",
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"initialize_flutterwave_payment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize payment: {e}"
        )


async def _flutterwave_verify_and_settle(tx_ref: Optional[str], transaction_id: Optional[str] = None):
    """Verify a Flutterwave transaction (by tx_ref preferred, else id) and apply
    the wallet/escrow credit. Idempotent. Returns a dict matching the legacy
    Paystack verify endpoint response so the frontend stays unchanged."""
    headers = get_flw_headers()
    if not headers:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway not configured"
        )

    if not tx_ref and not transaction_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either tx_ref or transaction_id is required"
        )

    # Idempotency check on our own payments table
    if tx_ref and check_table_exists("payments"):
        try:
            existing = supabase.table("payments").select("*").eq("reference", tx_ref).execute()
            if existing.data:
                payment = existing.data[0]
                if payment.get("status") == "success" and payment.get("processed"):
                    return {
                        "status": "success",
                        "message": "Payment already verified and processed",
                        "reference": tx_ref,
                        "amount": payment.get("amount"),
                        "provider": "flutterwave",
                    }
        except Exception as ex:
            logging.warning(f"flw verify idempotency lookup failed: {ex}")

    # Call Flutterwave verify
    try:
        if tx_ref:
            verify_resp = requests.get(
                f"{FLUTTERWAVE_BASE}/transactions/verify_by_reference",
                headers=headers,
                params={"tx_ref": tx_ref},
                timeout=30,
            )
        else:
            verify_resp = requests.get(
                f"{FLUTTERWAVE_BASE}/transactions/{transaction_id}/verify",
                headers=headers,
                timeout=30,
            )
    except Exception as net_ex:
        logging.error(f"flw verify network error: {net_ex}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach payment gateway"
        )

    if verify_resp.status_code != 200:
        logging.error(f"flw verify non-2xx: {verify_resp.status_code} {verify_resp.text[:500]}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to verify payment with Flutterwave"
        )

    flw_data = verify_resp.json()
    if (flw_data.get("status") or "").lower() != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=flw_data.get("message") or "Payment verification failed"
        )

    transaction = flw_data.get("data") or {}
    raw_status = (transaction.get("status") or "").lower()
    # Normalize to legacy contract: Paystack used "success", Flutterwave uses "successful"
    normalized_status = "success" if raw_status == "successful" else raw_status

    actual_tx_ref = transaction.get("tx_ref") or tx_ref
    amount_naira = float(transaction.get("amount") or 0)         # already major units
    charged_currency = (transaction.get("currency") or "NGN").upper()
    meta = transaction.get("meta") or {}
    purpose = meta.get("purpose") or "wallet_topup"
    booking_id = meta.get("booking_id")
    customer = transaction.get("customer") or {}
    email = customer.get("email") or meta.get("user_email")

    # Update payments row with raw payload + verified_at
    try:
        if check_table_exists("payments") and actual_tx_ref:
            supabase.table("payments").update({
                "status": normalized_status,
                "paystack_response": transaction,  # reuse existing JSON column for raw payload
                "verified_at": datetime.utcnow().isoformat(),
            }).eq("reference", actual_tx_ref).execute()
    except Exception as ex:
        logging.warning(f"flw verify: could not update payments row: {ex}")

    if normalized_status != "success":
        return {
            "status": normalized_status,
            "message": f"Payment {normalized_status}",
            "reference": actual_tx_ref,
            "amount": amount_naira,
            "provider": "flutterwave",
        }

    # Currency/amount sanity check
    if charged_currency != "NGN":
        logging.warning(f"flw verify: unexpected currency {charged_currency} on {actual_tx_ref}")

    expected_amount = None
    if check_table_exists("payments") and actual_tx_ref:
        try:
            row = supabase.table("payments").select("amount").eq("reference", actual_tx_ref).execute()
            if row.data:
                expected_amount = float(row.data[0].get("amount") or 0)
        except Exception:
            pass
    if expected_amount is not None and abs(amount_naira - expected_amount) > 0.01:
        logging.error(
            f"flw verify amount mismatch for {actual_tx_ref}: charged={amount_naira} expected={expected_amount}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount mismatch"
        )

    # Find user & credit wallet/escrow
    user_auth_id = None
    if email:
        try:
            ures = supabase.table("users").select("auth_id").eq("email", email).execute()
            if ures.data:
                user_auth_id = ures.data[0]["auth_id"]
        except Exception as ex:
            logging.warning(f"flw verify: user lookup failed for {email}: {ex}")

    if not user_auth_id:
        logging.warning(f"flw verify: no user for email {email} (tx_ref={actual_tx_ref})")
        return {
            "status": "success",
            "message": "Payment verified but user not found for wallet credit",
            "reference": actual_tx_ref,
            "amount": amount_naira,
            "provider": "flutterwave",
        }

    try:
        if purpose == "wallet_topup":
            await _credit_wallet(user_auth_id, amount_naira, "TOPUP", actual_tx_ref)
        elif purpose == "booking_escrow" and booking_id:
            await _credit_escrow(user_auth_id, amount_naira, int(booking_id), actual_tx_ref)
            if check_table_exists("bookings"):
                supabase.table("bookings").update({
                    "status": "pending",
                    "payment_reference": actual_tx_ref,
                    "payment_status": "paid",
                }).eq("id", int(booking_id)).execute()
    except Exception as credit_ex:
        logging.error(f"flw verify: wallet/escrow credit failed for {actual_tx_ref}: {credit_ex}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment succeeded but wallet credit failed. Please contact support."
        )

    # Mark as processed (final idempotency gate)
    try:
        if check_table_exists("payments") and actual_tx_ref:
            supabase.table("payments").update({
                "processed": True,
                "processed_at": datetime.utcnow().isoformat(),
            }).eq("reference", actual_tx_ref).execute()
    except Exception:
        pass

    # Notify user
    if purpose == "wallet_topup":
        try:
            await create_notification(
                recipient_auth_id=user_auth_id,
                notification_type="wallet_topup_success",
                title="Wallet Top-Up Successful",
                message=f"Your wallet has been credited with {CURRENCY}{amount_naira:,.2f}",
                metadata={"amount": amount_naira, "reference": actual_tx_ref, "provider": "flutterwave"},
            )
        except Exception as ex:
            logging.warning(f"flw verify: notification failed: {ex}")

    return {
        "status": "success",
        "message": "Payment successful",
        "reference": actual_tx_ref,
        "amount": amount_naira,
        "provider": "flutterwave",
    }


@api_router.get("/payments/flutterwave/verify")
async def verify_flutterwave_payment(
    reference: Optional[str] = Query(None, description="Our tx_ref (preferred)"),
    tx_ref: Optional[str] = Query(None, description="Alias of `reference`"),
    transaction_id: Optional[str] = Query(None, description="Flutterwave numeric transaction_id (from redirect)"),
):
    """Verify a Flutterwave transaction by `tx_ref` (preferred) or
    `transaction_id` (also returned in the redirect). Idempotent."""
    try:
        ref = reference or tx_ref
        return await _flutterwave_verify_and_settle(ref, transaction_id)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"verify_flutterwave_payment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify payment: {e}"
        )


@api_router.post("/webhooks/flutterwave")
async def flutterwave_webhook(
    request: Request,
    verif_hash: Optional[str] = Header(None, alias="verif-hash"),
):
    """Handle Flutterwave webhook events. Verifies the `verif-hash` header
    against `FLW_WEBHOOK_SECRET` (must match the Secret Hash set in the
    Flutterwave dashboard - Settings - Webhooks)."""
    try:
        webhook_secret = os.environ.get("FLW_WEBHOOK_SECRET")
        if not webhook_secret:
            logging.error("FLW_WEBHOOK_SECRET not configured")
            return {"status": "ignored", "reason": "webhook not configured"}

        # Constant-time comparison
        if not verif_hash or not hmac.compare_digest(verif_hash, webhook_secret):
            logging.warning("Invalid Flutterwave webhook signature")
            raise HTTPException(status_code=401, detail="Invalid signature")

        try:
            event_data = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON")

        event = event_data.get("event") or event_data.get("event.type")
        data = event_data.get("data") or {}

        logging.info(f"Flutterwave webhook received: event={event} tx_ref={data.get('tx_ref')}")

        # Log webhook for audit (best-effort)
        try:
            if check_table_exists("webhook_logs"):
                supabase.table("webhook_logs").insert({
                    "provider": "flutterwave",
                    "event": event,
                    "data": data,
                    "created_at": datetime.utcnow().isoformat(),
                }).execute()
        except Exception:
            pass

        # Process charge.completed (Flutterwave's success event)
        if event == "charge.completed":
            tx_ref = data.get("tx_ref")
            flw_id = data.get("id")
            tx_status = (data.get("status") or "").lower()
            if tx_status == "successful" and tx_ref:
                # Re-verify with Flutterwave (don't trust webhook payload alone)
                try:
                    await _flutterwave_verify_and_settle(tx_ref, str(flw_id) if flw_id else None)
                except HTTPException as he:
                    logging.error(f"Webhook settle failed for {tx_ref}: {he.detail}")
                except Exception as ex:
                    logging.error(f"Webhook settle exception for {tx_ref}: {ex}")

        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Flutterwave webhook error: {e}")
        # Always return 200 so Flutterwave doesn't retry on transient errors
        return {"status": "ok"}


# =========================== END FLUTTERWAVE BLOCK ===========================



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
        
        # 7. Check idempotency - prevent double payment for same booking
        payment_ref = f"wallet_booking_{booking_id}"
        if check_table_exists("payments"):
            existing_payment = supabase.table("payments").select("id, reference").eq(
                "booking_id", booking_id
            ).eq("status", "success").eq("payment_provider", "wallet").execute()
            if existing_payment.data:
                logging.info(f"Booking {booking_id} already paid via wallet, returning success")
                return WalletPaymentResponse(
                    status="success",
                    message="Booking already paid",
                    booking_id=booking_id,
                    amount_paid=0,
                    new_wallet_balance=available_balance,
                    new_escrow_balance=float(wallet.get("escrow_balance", 0) or 0)
                )
        
        # 8. Process payment - deduct from available, add to escrow
        reference = f"{payment_ref}_{uuid.uuid4().hex[:8]}"
        new_available = available_balance - total_amount
        current_escrow = float(wallet.get("escrow_balance", 0) or 0)
        new_escrow = current_escrow + total_amount
        
        # Update wallet balances
        supabase.table("wallets").update({
            "balance": new_available,
            "escrow_balance": new_escrow
        }).eq("id", wallet["id"]).execute()
        
        # 9. Create wallet_transactions records with proper DB constraint values
        try:
            if check_table_exists("wallet_transactions"):
                # Single transaction for booking payment (debit from available to escrow)
                supabase.table("wallet_transactions").insert({
                    "user_auth_id": auth_id,
                    "auth_id": auth_id,  # Ensure auth_id is always set
                    "type": "debit",  # DB constraint: 'credit' or 'debit'
                    "direction": "debit",  # lowercase
                    "amount": total_amount,
                    "reference": reference,
                    "booking_id": booking_id,
                    "description": f"Booking payment #{booking_id}",
                    "status": "completed",
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
        except Exception as tx_error:
            # Log but don't fail the payment - wallet was already updated
            logging.warning(f"Failed to log wallet transactions for booking {booking_id}: {str(tx_error)}")
        
        # 10. Update booking status to 'pending' (awaiting provider confirmation)
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
        
        # 11. Create payment record for idempotency tracking
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
    auth_id: str = Query(..., description="User's auth_id (UUID) - the wallet owner"),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = Query(None, description="Optional filter by category: TOPUP, ESCROW_HOLD, ESCROW_RELEASE, REFUND, WITHDRAWAL, PAYOUT")
):
    """
    Get user's wallet transaction history (normalized, newest first).

    Same endpoint for both customers and providers. Returns normalized fields:
    id, type, direction (UPPER), amount, description, created_at, booking_id,
    reference, status, raw_type.
    """
    try:
        if not check_table_exists("wallet_transactions"):
            logging.info("wallet_transactions table does not exist")
            return []

        # Query by auth_id - the wallet owner field.
        # We fetch a bit more than `limit` in case the auth_id column is sparse
        # and we need to fall back to user_auth_id.
        raw_rows = []
        try:
            response = supabase.table("wallet_transactions").select("*").eq(
                "auth_id", auth_id
            ).order("created_at", desc=True).limit(limit).execute()
            raw_rows = response.data or []
            logging.info(f"Found {len(raw_rows)} transactions for auth_id: {auth_id}")
        except Exception as e:
            logging.warning(f"auth_id query failed, trying user_auth_id: {e}")

        if not raw_rows:
            try:
                response = supabase.table("wallet_transactions").select("*").eq(
                    "user_auth_id", auth_id
                ).order("created_at", desc=True).limit(limit).execute()
                raw_rows = response.data or []
            except Exception as e2:
                logging.error(f"Both auth_id and user_auth_id queries failed: {e2}")
                return []

        # Normalize each row to a stable response shape
        normalized = [normalize_transaction(r) for r in raw_rows]

        # Optional category filter
        if category:
            cat_upper = category.upper()
            normalized = [t for t in normalized if t.get("type") == cat_upper]

        # Ensure sort newest-first (defensive; DB already orders)
        normalized.sort(key=lambda t: t.get("created_at") or "", reverse=True)
        return normalized

    except Exception as e:
        logging.error(f"Failed to fetch transactions: {str(e)}")
        return []


@api_router.get("/wallet/me/computed")
async def get_my_wallet_computed(auth_id: str = Query(..., description="User's auth_id (UUID)")):
    """
    Diagnostic endpoint: returns wallet balance computed from wallet_transactions.
    Does NOT modify any stored balance.

    Useful for verifying that stored balances match transaction history.
    Returns both the stored values and the computed values for comparison.
    """
    try:
        # Stored values
        stored = {"available_balance": 0.0, "escrow_balance": 0.0}
        try:
            wallet_response = supabase.table("wallets").select("*").eq(
                "user_auth_id", auth_id
            ).execute()
            if wallet_response.data:
                w = wallet_response.data[0]
                stored["available_balance"] = float(
                    w.get("available_balance") if w.get("available_balance") is not None else (w.get("balance") or 0)
                )
                stored["escrow_balance"] = float(w.get("escrow_balance") or 0)
        except Exception as e:
            logging.warning(f"Failed to fetch stored wallet for {auth_id}: {e}")

        # Compute from transactions
        computed = {"available_balance": 0.0, "escrow_balance": 0.0, "total_credits": 0.0, "total_debits": 0.0}
        if check_table_exists("wallet_transactions"):
            rows = []
            try:
                resp = supabase.table("wallet_transactions").select("*").eq(
                    "auth_id", auth_id
                ).execute()
                rows = resp.data or []
            except Exception:
                pass
            if not rows:
                try:
                    resp = supabase.table("wallet_transactions").select("*").eq(
                        "user_auth_id", auth_id
                    ).execute()
                    rows = resp.data or []
                except Exception:
                    pass

            computed = compute_wallet_balance_from_tx(rows)

        delta_available = round(stored["available_balance"] - computed["available_balance"], 2)
        delta_escrow = round(stored["escrow_balance"] - computed["escrow_balance"], 2)

        return {
            "auth_id": auth_id,
            "stored": {
                "available_balance": round(stored["available_balance"], 2),
                "escrow_balance": round(stored["escrow_balance"], 2),
                "total_balance": round(stored["available_balance"] + stored["escrow_balance"], 2),
            },
            "computed": computed,
            "delta": {
                "available_balance": delta_available,
                "escrow_balance": delta_escrow,
                "in_sync": delta_available == 0 and delta_escrow == 0,
            }
        }
    except Exception as e:
        logging.error(f"Wallet computed check failed for {auth_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute wallet: {str(e)}"
        )


@api_router.post("/admin/wallet/recalculate")
async def admin_recalculate_wallet(
    auth_id: str = Query(..., description="User's auth_id (UUID) to recalc"),
    apply: bool = Query(False, description="Set true to apply changes; false = dry-run"),
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY")
):
    """
    Admin tool: recompute wallet balance from wallet_transactions and (optionally)
    update the stored wallet row. Protected by X-ADMIN-KEY.

    - apply=false (default): dry-run, returns proposed values, no DB writes.
    - apply=true: updates wallets row to match computed values.

    Safety:
      * Only touches the single wallet identified by auth_id.
      * Never deletes transactions.
      * Logs an ADJUSTMENT wallet_transactions row when applying changes,
        so the audit trail stays intact.
    """
    try:
        admin_key = os.environ.get("ADMIN_DASH_KEY")
        if not admin_key:
            raise HTTPException(status_code=503, detail="ADMIN_DASH_KEY not configured")
        if not x_admin_key or x_admin_key != admin_key:
            raise HTTPException(status_code=401, detail="Invalid or missing admin key")

        # Load stored wallet
        wallet_response = supabase.table("wallets").select("*").eq(
            "user_auth_id", auth_id
        ).execute()
        if not wallet_response.data:
            raise HTTPException(status_code=404, detail="Wallet not found")
        wallet = wallet_response.data[0]

        stored_available = float(
            wallet.get("available_balance") if wallet.get("available_balance") is not None else (wallet.get("balance") or 0)
        )
        stored_escrow = float(wallet.get("escrow_balance") or 0)

        # Compute from transactions
        if not check_table_exists("wallet_transactions"):
            raise HTTPException(status_code=503, detail="wallet_transactions table not found")

        rows = []
        try:
            resp = supabase.table("wallet_transactions").select("*").eq(
                "auth_id", auth_id
            ).execute()
            rows = resp.data or []
        except Exception:
            pass
        if not rows:
            try:
                resp = supabase.table("wallet_transactions").select("*").eq(
                    "user_auth_id", auth_id
                ).execute()
                rows = resp.data or []
            except Exception:
                pass

        computed = compute_wallet_balance_from_tx(rows)
        new_available = computed["available_balance"]
        new_escrow = computed["escrow_balance"]

        delta_available = round(new_available - stored_available, 2)
        delta_escrow = round(new_escrow - stored_escrow, 2)

        result = {
            "auth_id": auth_id,
            "stored": {
                "available_balance": round(stored_available, 2),
                "escrow_balance": round(stored_escrow, 2),
            },
            "computed": computed,
            "delta": {
                "available_balance": delta_available,
                "escrow_balance": delta_escrow,
            },
            "applied": False,
        }

        if not apply:
            return result

        if delta_available == 0 and delta_escrow == 0:
            result["applied"] = True
            result["message"] = "Already in sync; no changes applied"
            return result

        # Apply changes - update wallet row
        update_data = {}
        if wallet.get("available_balance") is not None:
            update_data["available_balance"] = new_available
        # Always update legacy `balance` column too if it exists
        if "balance" in wallet:
            update_data["balance"] = new_available
        if wallet.get("escrow_balance") is not None or new_escrow > 0:
            update_data["escrow_balance"] = new_escrow

        supabase.table("wallets").update(update_data).eq("id", wallet["id"]).execute()

        # Audit trail: insert an ADJUSTMENT transaction if there was a delta
        try:
            if delta_available != 0:
                supabase.table("wallet_transactions").insert({
                    "user_auth_id": auth_id,
                    "auth_id": auth_id,
                    "type": "credit" if delta_available > 0 else "debit",
                    "direction": "credit" if delta_available > 0 else "debit",
                    "amount": abs(delta_available),
                    "reference": f"adjust_{uuid.uuid4().hex[:12]}",
                    "description": f"Admin wallet recalc adjustment (available): {CURRENCY}{delta_available:+,.2f}",
                    "status": "completed",
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": {"category": "ADJUSTMENT", "reason": "admin_recalculate"}
                }).execute()
        except Exception as audit_err:
            logging.warning(f"Failed to log adjustment transaction: {audit_err}")

        result["applied"] = True
        result["message"] = f"Wallet recalculated. Available {stored_available:.2f} -> {new_available:.2f}, Escrow {stored_escrow:.2f} -> {new_escrow:.2f}"
        return result

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Admin wallet recalculate failed: {e}")
        raise HTTPException(status_code=500, detail=f"Recalc failed: {str(e)}")




@api_router.post("/wallet/transactions/backfill")
async def backfill_transaction_auth_ids():
    """
    Safe backfill: Set auth_id for transactions where it's NULL.
    Does NOT change any balances - only fills missing auth_id for history display.
    
    Logic:
    - Provider credits (earnings): auth_id = provider_auth_id from booking
    - Customer debits: auth_id = customer_auth_id from booking
    - Customer credits (refunds): auth_id = customer_auth_id from booking
    """
    try:
        if not check_table_exists("wallet_transactions"):
            return {"status": "error", "message": "wallet_transactions table not found"}
        
        stats = {
            "before": {"null_auth_id": 0, "has_auth_id": 0},
            "after": {"null_auth_id": 0, "has_auth_id": 0},
            "updated": 0,
            "errors": []
        }
        
        # Count before
        all_txs = supabase.table("wallet_transactions").select("id, auth_id, user_auth_id, booking_id, direction, description").execute()
        for tx in all_txs.data or []:
            if tx.get("auth_id"):
                stats["before"]["has_auth_id"] += 1
            else:
                stats["before"]["null_auth_id"] += 1
        
        # Find transactions with NULL auth_id but have booking_id
        null_auth_txs = [tx for tx in (all_txs.data or []) if not tx.get("auth_id") and tx.get("booking_id")]
        
        for tx in null_auth_txs:
            booking_id = tx.get("booking_id")
            try:
                # Get booking to find provider_id and customer_auth_id
                booking = supabase.table("bookings").select("provider_id, customer_auth_id").eq("id", booking_id).execute()
                if not booking.data:
                    continue
                
                booking_data = booking.data[0]
                provider_id = booking_data.get("provider_id")
                customer_auth_id = booking_data.get("customer_auth_id")
                
                # Determine the correct auth_id based on transaction type
                new_auth_id = None
                description = (tx.get("description") or "").lower()
                direction = tx.get("direction", "").lower()
                
                # Provider earnings: direction=credit and description contains "earnings"
                if direction == "credit" and "earnings" in description:
                    new_auth_id = provider_id
                # Customer transactions (debits, escrow holds, refunds)
                elif customer_auth_id:
                    new_auth_id = customer_auth_id
                # Fallback: use user_auth_id if available
                elif tx.get("user_auth_id"):
                    new_auth_id = tx.get("user_auth_id")
                
                if new_auth_id:
                    supabase.table("wallet_transactions").update({
                        "auth_id": new_auth_id
                    }).eq("id", tx["id"]).execute()
                    stats["updated"] += 1
                    
            except Exception as e:
                stats["errors"].append(f"tx {tx.get('id')}: {str(e)}")
        
        # Also backfill from user_auth_id where auth_id is NULL
        for tx in (all_txs.data or []):
            if not tx.get("auth_id") and tx.get("user_auth_id"):
                try:
                    supabase.table("wallet_transactions").update({
                        "auth_id": tx["user_auth_id"]
                    }).eq("id", tx["id"]).execute()
                    stats["updated"] += 1
                except Exception as e:
                    stats["errors"].append(f"tx {tx.get('id')}: {str(e)}")
        
        # Count after
        all_txs_after = supabase.table("wallet_transactions").select("id, auth_id").execute()
        for tx in all_txs_after.data or []:
            if tx.get("auth_id"):
                stats["after"]["has_auth_id"] += 1
            else:
                stats["after"]["null_auth_id"] += 1
        
        return {
            "status": "success",
            "message": f"Backfill complete. Updated {stats['updated']} rows.",
            "stats": stats
        }
        
    except Exception as e:
        logging.error(f"Backfill failed: {str(e)}")
        return {"status": "error", "message": str(e)}


# ==================== WITHDRAWAL REQUEST ENDPOINTS (Phase A) ====================

# ==================== PHASE 7 - WITHDRAWAL FEE SETTINGS ==================

DEFAULT_WITHDRAWAL_FEE_SETTINGS = {
    "enabled": True,
    "fee_percentage": 0.0,
    "min_withdrawal": 0.0,
    "max_withdrawal": None,
    "currency": "NGN",
}


def _load_withdrawal_fee_settings() -> dict:
    """
    Read the 'withdrawal_fee' row from app_settings. Falls back to safe
    defaults (zero fee, no min/max) if the table or row is missing — so
    the existing withdrawal flow never breaks on un-migrated environments.
    """
    try:
        res = supabase.table("app_settings").select("value").eq("key", "withdrawal_fee").limit(1).execute()
        if res.data and isinstance(res.data[0].get("value"), dict):
            merged = dict(DEFAULT_WITHDRAWAL_FEE_SETTINGS)
            merged.update(res.data[0]["value"])
            return merged
    except Exception as e:
        logging.warning(f"[settings] withdrawal_fee load failed (using defaults): {e}")
    return dict(DEFAULT_WITHDRAWAL_FEE_SETTINGS)


class FinancialSettingsUpdate(BaseModel):
    fee_percentage: Optional[float] = None
    min_withdrawal: Optional[float] = None
    max_withdrawal: Optional[float] = None  # use 0/null to disable
    enabled: Optional[bool] = None


@api_router.get("/settings/withdrawal-fee")
async def get_withdrawal_fee_public():
    """
    Public, read-only fee config for the provider withdrawal screen so it
    can render a live fee preview. Returns only display-safe fields.
    """
    s = _load_withdrawal_fee_settings()
    return {
        "fee_percentage": float(s.get("fee_percentage") or 0),
        "min_withdrawal": float(s.get("min_withdrawal") or 0),
        "max_withdrawal": (
            float(s["max_withdrawal"]) if s.get("max_withdrawal") not in (None, "", "null") else None
        ),
        "currency": s.get("currency") or "NGN",
    }


@api_router.get("/admin/settings/financial")
async def admin_get_financial_settings(
    x_admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY"),
):
    """Admin view of financial settings (currently: withdrawal fee config)."""
    admin_dash_key = os.environ.get("ADMIN_DASH_KEY", "")
    if not x_admin_key or x_admin_key != admin_dash_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
    return {"withdrawal_fee": _load_withdrawal_fee_settings()}


@api_router.put("/admin/settings/financial")
async def admin_update_financial_settings(
    payload: FinancialSettingsUpdate,
    x_admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY"),
):
    """Update withdrawal fee + min/max settings. Validates inputs."""
    admin_dash_key = os.environ.get("ADMIN_DASH_KEY", "")
    if not x_admin_key or x_admin_key != admin_dash_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    current = _load_withdrawal_fee_settings()
    updated = dict(current)

    if payload.fee_percentage is not None:
        if payload.fee_percentage < 0 or payload.fee_percentage > 100:
            raise HTTPException(status_code=400, detail="fee_percentage must be between 0 and 100")
        updated["fee_percentage"] = float(payload.fee_percentage)
    if payload.min_withdrawal is not None:
        if payload.min_withdrawal < 0:
            raise HTTPException(status_code=400, detail="min_withdrawal must be >= 0")
        updated["min_withdrawal"] = float(payload.min_withdrawal)
    if payload.max_withdrawal is not None:
        # 0 means "no maximum"
        if payload.max_withdrawal < 0:
            raise HTTPException(status_code=400, detail="max_withdrawal must be >= 0")
        updated["max_withdrawal"] = float(payload.max_withdrawal) if payload.max_withdrawal > 0 else None
    if payload.enabled is not None:
        updated["enabled"] = bool(payload.enabled)

    # Cross-field validation
    if (updated.get("max_withdrawal") is not None
            and updated["max_withdrawal"] > 0
            and updated["max_withdrawal"] < (updated.get("min_withdrawal") or 0)):
        raise HTTPException(
            status_code=400,
            detail="max_withdrawal cannot be less than min_withdrawal",
        )

    try:
        # Upsert into app_settings
        existing = supabase.table("app_settings").select("key").eq("key", "withdrawal_fee").limit(1).execute()
        row = {
            "key": "withdrawal_fee",
            "value": updated,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing.data:
            supabase.table("app_settings").update(row).eq("key", "withdrawal_fee").execute()
        else:
            supabase.table("app_settings").insert(row).execute()
    except Exception as e:
        msg = str(e).lower()
        if "app_settings" in msg or "does not exist" in msg:
            raise HTTPException(
                status_code=503,
                detail="app_settings table missing. Apply phase7_withdrawal_fees.sql migration.",
            )
        logging.error(f"[settings] update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {"ok": True, "withdrawal_fee": updated}


@api_router.post("/withdrawals/request")
async def request_withdrawal(
    request_data: WithdrawalRequestCreate,
    auth_id: str = Query(..., description="Provider's auth_id (UUID)")
):
    """
    Provider requests a withdrawal from their available balance.
    - Creates withdrawal_request row with status='pending'
    - Logs a wallet_transaction (NO balance deduction yet)
    - Admin will approve/reject later
    """
    try:
        # 1. Validate the withdrawal_requests table exists
        if not check_table_exists("withdrawal_requests"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Withdrawal service not available. Please contact support."
            )
        
        # Phase 6 - KYC enforcement gate. Reject any withdrawal request from
        # a provider whose KYC is not VERIFIED. We DO NOT touch the rest of
        # the withdrawal flow (balance math, ledger entries, approval flow).
        try:
            kyc_check = supabase.table("kyc_submissions").select("status").eq(
                "user_auth_id", auth_id
            ).limit(1).execute()
            kyc_status_value = (kyc_check.data[0]["status"] if kyc_check.data else None)
        except Exception as kyc_err:
            # If the table doesn't exist (migration not run), treat as not verified.
            logging.warning(f"[withdrawal] kyc check failed (treating as not_verified): {kyc_err}")
            kyc_status_value = None
        if kyc_status_value != "verified":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "kyc_required",
                    "kyc_status": kyc_status_value or "not_submitted",
                    "message": "Complete KYC verification before requesting payouts.",
                }
            )

        # 2. Get provider's wallet
        wallet_response = supabase.table("wallets").select("*").eq("user_auth_id", auth_id).execute()
        
        if not wallet_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found. Please ensure you have a wallet set up."
            )
        
        wallet = wallet_response.data[0]
        # Use available_balance if exists, fallback to balance
        available_balance = float(wallet.get("available_balance") or wallet.get("balance") or 0)
        
        # 3. Validate amount
        if request_data.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Withdrawal amount must be greater than 0"
            )

        # Phase 7 - load admin-configured fee settings & enforce min/max + compute
        # gross/fee/net SERVER-SIDE. Frontend values are display-only; the
        # database is the source of truth. We DO NOT change the wallet ledger:
        # the existing 'amount' field still represents the GROSS amount that
        # will be debited from the wallet on approval.
        fee_settings = _load_withdrawal_fee_settings()
        fee_percentage = float(fee_settings.get("fee_percentage") or 0)
        min_withdrawal = float(fee_settings.get("min_withdrawal") or 0)
        max_withdrawal_raw = fee_settings.get("max_withdrawal")
        max_withdrawal = float(max_withdrawal_raw) if max_withdrawal_raw not in (None, "", "null") else None

        if min_withdrawal > 0 and request_data.amount < min_withdrawal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "below_minimum",
                    "min_withdrawal": min_withdrawal,
                    "requested": request_data.amount,
                    "message": f"Minimum withdrawal amount is {CURRENCY}{min_withdrawal:,.2f}",
                }
            )
        if max_withdrawal is not None and max_withdrawal > 0 and request_data.amount > max_withdrawal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "above_maximum",
                    "max_withdrawal": max_withdrawal,
                    "requested": request_data.amount,
                    "message": f"Maximum withdrawal amount is {CURRENCY}{max_withdrawal:,.2f}",
                }
            )

        gross_amount = round(float(request_data.amount), 2)
        fee_amount = round(gross_amount * (fee_percentage / 100.0), 2)
        net_amount = round(gross_amount - fee_amount, 2)
        if net_amount < 0:
            net_amount = 0.0
        
        if available_balance < request_data.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Insufficient balance",
                    "available": available_balance,
                    "requested": request_data.amount,
                    "shortfall": request_data.amount - available_balance
                }
            )
        
        # 4. Validate account number (10 digits for Nigerian banks)
        if not request_data.account_number.isdigit() or len(request_data.account_number) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account number must be exactly 10 digits"
            )
        
        # 5. Create withdrawal request (Phase 7 - persist gross/fee/net)
        withdrawal_ref = f"withdraw_req_{uuid.uuid4().hex[:12]}"
        withdrawal_data = {
            "provider_auth_id": auth_id,
            "amount": gross_amount,            # existing column = GROSS (wallet debit on approval)
            "gross_amount": gross_amount,      # Phase 7 explicit gross
            "fee_amount": fee_amount,          # Phase 7 platform fee
            "net_amount": net_amount,          # Phase 7 amount provider receives
            "currency": "NGN",
            "bank_name": request_data.bank_name.strip(),
            "account_name": request_data.account_name.strip(),
            "account_number": request_data.account_number,
            "status": "pending",
            "note": request_data.note
        }
        
        # Try with new columns; fall back to legacy schema if migration not applied.
        try:
            withdrawal_result = supabase.table("withdrawal_requests").insert(withdrawal_data).execute()
        except Exception as insert_err:
            msg = str(insert_err).lower()
            if "gross_amount" in msg or "fee_amount" in msg or "net_amount" in msg or "column" in msg:
                logging.warning("[withdrawal] fee columns missing; inserting legacy payload (apply phase7 migration)")
                legacy_payload = {k: v for k, v in withdrawal_data.items()
                                  if k not in ("gross_amount", "fee_amount", "net_amount")}
                withdrawal_result = supabase.table("withdrawal_requests").insert(legacy_payload).execute()
            else:
                raise
        
        if not withdrawal_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create withdrawal request"
            )
        
        withdrawal_record = withdrawal_result.data[0]
        
        # 6. Log transaction (NO balance change - just for history)
        if check_table_exists("wallet_transactions"):
            try:
                supabase.table("wallet_transactions").insert({
                    "user_auth_id": auth_id,
                    "auth_id": auth_id,
                    "type": "debit",  # Will be a debit when approved
                    "direction": "debit",
                    "amount": request_data.amount,
                    "reference": withdrawal_ref,
                    "description": f"Withdrawal request submitted - {CURRENCY}{request_data.amount:,.2f}",
                    "status": "pending",
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": {
                        "withdrawal_request_id": withdrawal_record["id"],
                        "bank_name": request_data.bank_name,
                        "account_number_last4": request_data.account_number[-4:]
                    }
                }).execute()
            except Exception as tx_error:
                logging.warning(f"Failed to log withdrawal request transaction: {tx_error}")
        
        logging.info(f"Withdrawal request created: {withdrawal_record['id']} for provider {auth_id}, amount {request_data.amount}")
        
        # Create notification for provider confirming withdrawal request
        await create_notification(
            recipient_auth_id=auth_id,
            notification_type="withdrawal_requested",
            title="Withdrawal Request Submitted",
            message=f"Your withdrawal request for {CURRENCY}{request_data.amount:,.2f} has been submitted and is pending admin review",
            metadata={
                "withdrawal_id": withdrawal_record["id"],
                "amount": request_data.amount
            }
        )
        
        return {
            "ok": True,
            "withdrawal_request_id": withdrawal_record["id"],
            "status": "pending",
            "gross_amount": gross_amount,
            "fee_amount": fee_amount,
            "net_amount": net_amount,
            "message": "Withdrawal request submitted successfully. Admin will review shortly."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Withdrawal request failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create withdrawal request: {str(e)}"
        )


@api_router.get("/withdrawals/me")
async def get_my_withdrawal_requests(
    auth_id: str = Query(..., description="Provider's auth_id (UUID)"),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get provider's withdrawal requests history.
    Returns requests ordered by created_at desc.
    """
    try:
        if not check_table_exists("withdrawal_requests"):
            return []
        
        response = supabase.table("withdrawal_requests").select("*").eq(
            "provider_auth_id", auth_id
        ).order("created_at", desc=True).limit(limit).execute()
        
        return response.data or []
        
    except Exception as e:
        logging.error(f"Failed to fetch withdrawal requests: {str(e)}")
        return []


@api_router.get("/admin/withdrawals")
async def admin_list_withdrawals(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: pending, approved, rejected"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    Admin endpoint to list all withdrawal requests.
    Protected by X-ADMIN-KEY header.
    """
    try:
        # 1. Security: Check admin key
        admin_key = os.environ.get("ADMIN_DASH_KEY")
        if not admin_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Admin service not configured. ADMIN_DASH_KEY is missing."
            )
        
        if not x_admin_key or x_admin_key != admin_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing admin key"
            )
        
        # 2. Check table exists
        if not check_table_exists("withdrawal_requests"):
            return {"withdrawals": [], "total": 0}
        
        # 3. Build query
        query = supabase.table("withdrawal_requests").select("*", count="exact")
        
        # Apply status filter if provided
        if status_filter and status_filter in ["pending", "approved", "rejected"]:
            query = query.eq("status", status_filter)
        
        # Order and paginate
        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return {
            "withdrawals": response.data or [],
            "total": response.count or len(response.data or []),
            "limit": limit,
            "offset": offset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Admin list withdrawals failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch withdrawals: {str(e)}"
        )


@api_router.put("/admin/withdrawals/{withdrawal_id}")
async def admin_process_withdrawal(
    withdrawal_id: int,
    action_data: AdminWithdrawalAction,
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY")
):
    """
    Admin endpoint to approve or reject withdrawal requests.
    Protected by X-ADMIN-KEY header.
    
    - approve: Deducts from provider wallet and marks as approved
    - reject: Marks as rejected (no balance change)
    """
    try:
        # 1. Security: Check admin key
        admin_key = os.environ.get("ADMIN_DASH_KEY")
        if not admin_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Admin service not configured. ADMIN_DASH_KEY is missing."
            )
        
        if not x_admin_key or x_admin_key != admin_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing admin key"
            )
        
        # 2. Get withdrawal request
        if not check_table_exists("withdrawal_requests"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Withdrawal service not available"
            )
        
        withdrawal_response = supabase.table("withdrawal_requests").select("*").eq(
            "id", withdrawal_id
        ).execute()
        
        if not withdrawal_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Withdrawal request not found"
            )
        
        withdrawal = withdrawal_response.data[0]
        
        # 3. Validate status is pending
        if withdrawal.get("status") != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Withdrawal request is already {withdrawal.get('status')}. Cannot process again."
            )
        
        provider_auth_id = withdrawal.get("provider_auth_id")
        amount = float(withdrawal.get("amount", 0))
        
        if action_data.action == "approve":
            # 4a. APPROVE: Deduct from provider wallet
            
            # Get provider wallet
            wallet_response = supabase.table("wallets").select("*").eq(
                "user_auth_id", provider_auth_id
            ).execute()
            
            if not wallet_response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Provider wallet not found"
                )
            
            wallet = wallet_response.data[0]
            # Read from canonical `balance` column FIRST. All escrow-release and
            # wallet-update paths in this codebase write to `balance` (see line ~1311,
            # ~2221). `available_balance` is a sparsely-populated legacy mirror column
            # that may be stale. Reading it first caused a wrong starting balance
            # (e.g. stale 4000 → withdraw 2000 → result 2000 instead of 32000).
            balance_val = wallet.get("balance")
            if balance_val is None:
                balance_val = wallet.get("available_balance")
            available_balance = float(balance_val or 0)
            
            # Re-check balance
            if available_balance < amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient balance. Available: {available_balance}, Requested: {amount}"
                )
            
            # Deduct from wallet
            new_balance = available_balance - amount
            
            # Update wallet - handle both column names
            update_data = {"available_balance": new_balance}
            if wallet.get("balance") is not None:
                # Also update legacy balance column for consistency
                update_data["balance"] = new_balance
            
            supabase.table("wallets").update(update_data).eq("id", wallet["id"]).execute()
            
            # Update withdrawal request status
            supabase.table("withdrawal_requests").update({
                "status": "approved",
                "note": action_data.note or withdrawal.get("note"),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", withdrawal_id).execute()
            
            # Log transaction
            withdrawal_paid_ref = f"withdraw_paid_{uuid.uuid4().hex[:12]}"
            if check_table_exists("wallet_transactions"):
                supabase.table("wallet_transactions").insert({
                    "user_auth_id": provider_auth_id,
                    "auth_id": provider_auth_id,
                    "type": "debit",
                    "direction": "debit",
                    "amount": amount,
                    "reference": withdrawal_paid_ref,
                    "description": f"Withdrawal approved - {CURRENCY}{amount:,.2f} paid",
                    "status": "completed",
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": {
                        "withdrawal_request_id": withdrawal_id,
                        "bank_name": withdrawal.get("bank_name"),
                        "account_number_last4": withdrawal.get("account_number", "")[-4:]
                    }
                }).execute()
            
            logging.info(f"Withdrawal {withdrawal_id} APPROVED. Amount: {amount}, Provider: {provider_auth_id}")
            
            # Create notification for provider about approval
            await create_notification(
                recipient_auth_id=provider_auth_id,
                notification_type="withdrawal_approved",
                title="Withdrawal Approved",
                message=f"Your withdrawal request for {CURRENCY}{amount:,.2f} has been approved. The funds will be transferred to your bank account shortly.",
                metadata={
                    "withdrawal_id": withdrawal_id,
                    "amount": amount
                }
            )
            
            return {
                "ok": True,
                "status": "approved",
                "message": f"Withdrawal approved. {CURRENCY}{amount:,.2f} deducted from provider wallet.",
                "withdrawal_id": withdrawal_id
            }
            
        elif action_data.action == "reject":
            # 4b. REJECT: Just update status (no balance change)
            
            supabase.table("withdrawal_requests").update({
                "status": "rejected",
                "note": action_data.note or withdrawal.get("note"),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", withdrawal_id).execute()
            
            # Log transaction as failed
            if check_table_exists("wallet_transactions"):
                supabase.table("wallet_transactions").insert({
                    "user_auth_id": provider_auth_id,
                    "auth_id": provider_auth_id,
                    "type": "debit",
                    "direction": "debit",
                    "amount": amount,
                    "reference": f"withdraw_rejected_{withdrawal_id}",
                    "description": f"Withdrawal rejected - {action_data.note or 'No reason provided'}",
                    "status": "failed",
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": {
                        "withdrawal_request_id": withdrawal_id,
                        "admin_note": action_data.note
                    }
                }).execute()
            
            logging.info(f"Withdrawal {withdrawal_id} REJECTED. Amount: {amount}, Provider: {provider_auth_id}")
            
            # Create notification for provider about rejection
            await create_notification(
                recipient_auth_id=provider_auth_id,
                notification_type="withdrawal_rejected",
                title="Withdrawal Rejected",
                message=f"Your withdrawal request for {CURRENCY}{amount:,.2f} has been rejected. Reason: {action_data.note or 'No reason provided'}",
                metadata={
                    "withdrawal_id": withdrawal_id,
                    "amount": amount,
                    "reason": action_data.note
                }
            )
            
            return {
                "ok": True,
                "status": "rejected",
                "message": "Withdrawal request rejected.",
                "withdrawal_id": withdrawal_id
            }
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid action. Use 'approve' or 'reject'."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Admin withdrawal processing failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process withdrawal: {str(e)}"
        )


# ==================== PROVIDER DASHBOARD METRICS ENDPOINT ====================

@api_router.get("/providers/dashboard-metrics")
async def get_provider_dashboard_metrics(
    auth_id: str = Query(..., description="Provider's auth_id (UUID)")
):
    """
    Lightweight endpoint for provider dashboard metrics.
    Returns wallet balances, earnings summaries, pending withdrawals, and recent transactions.
    Optimized for speed with minimal queries.
    """
    try:
        result = {
            "available_balance": 0,
            "escrow_balance": 0,
            "total_balance": 0,
            "total_earnings": 0,
            "pending_withdrawals_total": 0,
            "last_7_days_earnings": 0,
            "last_30_days_earnings": 0,
            "recent_transactions": []
        }
        
        # 1. Get wallet balances
        try:
            wallet_response = supabase.table("wallets").select(
                "available_balance, escrow_balance, balance"
            ).eq("user_auth_id", auth_id).execute()
            
            if wallet_response.data:
                w = wallet_response.data[0]
                # Read with fallback: 'balance' is the canonical column written
                # by all wallet update paths; 'available_balance' is an optional
                # mirror column some schemas have. Same pattern as
                # /api/wallet/me/computed (see line ~2313).
                avail_raw = w.get("available_balance")
                if avail_raw is None:
                    avail_raw = w.get("balance")
                result["available_balance"] = float(avail_raw or 0)
                result["escrow_balance"] = float(w.get("escrow_balance") or 0)
                # total_balance = available + escrow
                result["total_balance"] = result["available_balance"] + result["escrow_balance"]
        except Exception as e:
            logging.warning(f"Failed to fetch wallet for {auth_id}: {e}")
        
        # 2. Get pending withdrawals total
        if check_table_exists("withdrawal_requests"):
            try:
                withdrawals_response = supabase.table("withdrawal_requests").select(
                    "amount"
                ).eq("provider_auth_id", auth_id).eq("status", "pending").execute()
                
                if withdrawals_response.data:
                    result["pending_withdrawals_total"] = sum(
                        float(w.get("amount") or 0) for w in withdrawals_response.data
                    )
            except Exception as e:
                logging.warning(f"Failed to fetch pending withdrawals for {auth_id}: {e}")
        
        # 3. Get transactions and calculate earnings
        if check_table_exists("wallet_transactions"):
            try:
                # Fetch ALL transactions for this provider (we filter in Python).
                # Try auth_id first; fall back to user_auth_id if empty.
                all_tx_rows = []
                try:
                    tx_response = supabase.table("wallet_transactions").select(
                        "id, type, direction, amount, status, description, reference, booking_id, metadata, created_at"
                    ).eq("auth_id", auth_id).order("created_at", desc=True).execute()
                    all_tx_rows = tx_response.data or []
                except Exception:
                    pass

                if not all_tx_rows:
                    try:
                        tx_response = supabase.table("wallet_transactions").select(
                            "id, type, direction, amount, status, description, reference, booking_id, metadata, created_at"
                        ).eq("user_auth_id", auth_id).order("created_at", desc=True).execute()
                        all_tx_rows = tx_response.data or []
                    except Exception:
                        pass

                # Recent transactions: top 10, normalized for UI
                result["recent_transactions"] = [
                    normalize_transaction(r) for r in all_tx_rows[:10]
                ]

                # ========================================================
                # EARNINGS = SUM(ESCROW_RELEASE credit, status=completed)
                # This is the single source of truth for provider earnings.
                # Prevents double counting from TOPUPs, refunds, adjustments.
                # ========================================================
                now = datetime.utcnow()
                seven_days_ago = now - timedelta(days=7)
                thirty_days_ago = now - timedelta(days=30)

                total = 0.0
                last_7 = 0.0
                last_30 = 0.0

                for tx in all_tx_rows:
                    # Only count completed escrow release credits
                    if (tx.get("status") or "completed").lower() != "completed":
                        continue
                    if (tx.get("direction") or "").lower() != "credit":
                        continue
                    if categorize_transaction(tx) != CATEGORY_ESCROW_RELEASE:
                        continue

                    try:
                        amount = float(tx.get("amount") or 0)
                    except (TypeError, ValueError):
                        continue
                    if amount <= 0:
                        continue

                    total += amount

                    created_str = tx.get("created_at")
                    if created_str:
                        try:
                            created_at = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                            created_at = created_at.replace(tzinfo=None)
                            if created_at >= seven_days_ago:
                                last_7 += amount
                            if created_at >= thirty_days_ago:
                                last_30 += amount
                        except Exception as parse_err:
                            logging.debug(f"Date parse error: {parse_err}")
                            # If we can't parse the date, fall back to including it in 30d window
                            last_30 += amount

                result["total_earnings"] = round(total, 2)
                result["last_7_days_earnings"] = round(last_7, 2)
                result["last_30_days_earnings"] = round(last_30, 2)

            except Exception as e:
                logging.warning(f"Failed to fetch transactions for {auth_id}: {e}")
        
        return result
        
    except Exception as e:
        logging.error(f"Provider dashboard metrics failed for {auth_id}: {str(e)}")
        # Return empty metrics instead of 500 error
        return {
            "available_balance": 0,
            "escrow_balance": 0,
            "total_balance": 0,
            "total_earnings": 0,
            "pending_withdrawals_total": 0,
            "last_7_days_earnings": 0,
            "last_30_days_earnings": 0,
            "recent_transactions": []
        }


# ==================== NOTIFICATIONS SYSTEM (Phase 2B) ====================

async def create_notification(
    recipient_auth_id: str,
    notification_type: str,
    title: str,
    message: str,
    actor_auth_id: Optional[str] = None,
    metadata: Optional[dict] = None
) -> bool:
    """
    Create a notification for a user.
    Returns True if successful, False otherwise.
    Fails gracefully without raising exceptions.
    Uses auth_id column (uuid) for recipient identification.

    Persists optional `actor_auth_id` and `metadata` (JSONB) when columns exist.
    """
    try:
        if not recipient_auth_id:
            logging.warning("Cannot create notification: recipient_auth_id is None")
            return False
        
        if not check_table_exists("notifications"):
            logging.warning("Notifications table does not exist")
            return False
        
        # Build notification data - full payload first
        notification_data = {
            "auth_id": recipient_auth_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "read": False,
            # Explicit UTC-aware ISO timestamp (with +00:00 suffix) so the
            # frontend's `new Date(...)` parses unambiguously. Without this,
            # Postgres' DEFAULT NOW() returned a naive string that JS
            # interpreted as LOCAL time, producing "1h ago" for new notifications
            # in WAT (UTC+1) browsers.
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if actor_auth_id:
            notification_data["actor_auth_id"] = actor_auth_id
        if metadata is not None:
            # metadata column should be JSONB; supabase client serializes dict
            notification_data["metadata"] = metadata

        try:
            result = supabase.table("notifications").insert(notification_data).execute()
            if result.data:
                logging.info(
                    f"Notification created: type={notification_type}, "
                    f"recipient={recipient_auth_id[:8]}..., has_meta={metadata is not None}"
                )
                return True
        except Exception as insert_error:
            logging.warning(f"Notification insert with full payload failed: {insert_error}")

            # Progressive fallback 1: drop metadata if column missing
            try:
                fb1 = dict(notification_data)
                fb1.pop("metadata", None)
                result = supabase.table("notifications").insert(fb1).execute()
                if result.data:
                    logging.info(f"Notification created (no metadata): type={notification_type}")
                    return True
            except Exception as e1:
                logging.warning(f"Fallback (no metadata) failed: {e1}")

            # Progressive fallback 2: drop actor_auth_id
            try:
                fb2 = dict(notification_data)
                fb2.pop("metadata", None)
                fb2.pop("actor_auth_id", None)
                result = supabase.table("notifications").insert(fb2).execute()
                if result.data:
                    logging.info(f"Notification created (no actor/meta): type={notification_type}")
                    return True
            except Exception as e2:
                logging.warning(f"Fallback (no actor/meta) failed: {e2}")

            # Progressive fallback 3: drop title (older schema)
            try:
                fb3 = {
                    "auth_id": recipient_auth_id,
                    "type": notification_type,
                    "message": f"{title}: {message}",
                    "read": False,
                }
                result = supabase.table("notifications").insert(fb3).execute()
                if result.data:
                    logging.info(f"Notification created (minimal): type={notification_type}")
                    return True
            except Exception as e3:
                logging.warning(f"Minimal fallback failed: {e3}")
        
        return False
        
    except Exception as e:
        logging.error(f"Failed to create notification: {str(e)}")
        return False


@api_router.get("/notifications/me")
async def get_my_notifications(
    auth_id: str = Query(..., description="User's auth_id (UUID)"),
    unread_only: bool = Query(False, description="Filter to unread only"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Get notifications for a user, ordered newest first.
    Uses auth_id (uuid) column to filter.
    """
    try:
        if not check_table_exists("notifications"):
            logging.warning("Notifications table does not exist")
            return []
        
        # Debug logging
        logging.info(f"Fetching notifications for auth_id={auth_id}, unread_only={unread_only}, limit={limit}, offset={offset}")
        
        # Query using auth_id column (the actual column name in DB)
        query = supabase.table("notifications").select("*").eq("auth_id", auth_id)
        
        if unread_only:
            query = query.eq("read", False)
        
        response = query.order("created_at", desc=True).range(
            offset, offset + limit - 1
        ).execute()
        
        result = response.data or []
        
        # Debug: log count for this auth_id
        if not result:
            try:
                count_resp = supabase.table("notifications").select("id", count="exact").eq("auth_id", auth_id).execute()
                logging.info(f"Notifications for auth_id={auth_id}: found {count_resp.count} total in DB but returned {len(result)}")
            except Exception as count_err:
                logging.warning(f"Count check failed: {count_err}")
        else:
            logging.info(f"Returning {len(result)} notifications for auth_id={auth_id}")
        
        return result
        
    except Exception as e:
        logging.error(f"Failed to fetch notifications for auth_id={auth_id}: {str(e)}")
        return []


@api_router.get("/notifications/unread-count")
async def get_unread_count(
    auth_id: str = Query(..., description="User's auth_id (UUID)")
):
    """
    Get count of unread notifications for a user.
    """
    try:
        if not check_table_exists("notifications"):
            return {"count": 0, "unread": 0}
        
        response = supabase.table("notifications").select(
            "id", count="exact"
        ).eq("auth_id", auth_id).eq("read", False).execute()
        
        count = response.count or 0
        logging.info(f"Unread count for auth_id={auth_id}: {count}")
        
        return {"count": count, "unread": count}
        
    except Exception as e:
        logging.error(f"Failed to get unread count for auth_id={auth_id}: {str(e)}")
        return {"count": 0, "unread": 0}


class MarkReadRequest(BaseModel):
    auth_id: str
    ids: Optional[List[int]] = None
    notification_ids: Optional[List[int]] = None  # Alternative field name
    mark_all: bool = False


@api_router.post("/notifications/mark-read")
async def mark_notifications_read(request: MarkReadRequest):
    """
    Mark notifications as read.
    Either provide specific IDs or set mark_all=true.
    """
    try:
        if not check_table_exists("notifications"):
            return {"success": False, "message": "Notifications not available"}
        
        now = datetime.utcnow().isoformat()
        
        # Support both 'ids' and 'notification_ids' field names
        notification_ids = request.ids or request.notification_ids or []
        
        if request.mark_all:
            # Mark all unread notifications as read
            try:
                supabase.table("notifications").update({
                    "read": True
                }).eq("auth_id", request.auth_id).eq("read", False).execute()
            except Exception as e:
                logging.warning(f"Mark all read failed: {e}")
            
            return {"success": True, "message": "All notifications marked as read"}
        
        elif notification_ids and len(notification_ids) > 0:
            # Mark specific notifications as read
            for notification_id in notification_ids:
                try:
                    supabase.table("notifications").update({
                        "read": True
                    }).eq("id", notification_id).eq("auth_id", request.auth_id).execute()
                except Exception as e:
                    logging.warning(f"Failed to mark notification {notification_id} as read: {e}")
            
            return {"success": True, "message": f"Marked {len(notification_ids)} notifications as read"}
        
        else:
            return {"success": False, "message": "Provide either 'ids', 'notification_ids', or 'mark_all'"}
        
    except Exception as e:
        logging.error(f"Failed to mark notifications as read: {str(e)}")
        return {"success": False, "message": str(e)}


# ==================== BOOKING CHAT ENDPOINTS (Phase 2C) ====================

def get_booking_provider_uuid(booking: dict) -> Optional[str]:
    """Get provider UUID from booking, handling both provider_id and stylist_auth_id fields."""
    return booking.get("provider_id") or booking.get("stylist_auth_id")


def is_chat_participant(booking: dict, auth_id: str) -> bool:
    """Check if auth_id is a participant in the booking chat."""
    customer_auth_id = booking.get("customer_auth_id")
    provider_uuid = get_booking_provider_uuid(booking)
    return auth_id == customer_auth_id or auth_id == provider_uuid


@api_router.get("/bookings/{booking_id}/chat")
async def get_booking_chat(
    booking_id: int,
    auth_id: str = Query(..., description="User's auth_id (UUID)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    Get chat messages for a booking.
    Only participants (customer or provider) can access.
    """
    try:
        # 1. Get booking
        booking_response = supabase.table("bookings").select(
            "id, customer_auth_id, provider_id, stylist_auth_id, status"
        ).eq("id", booking_id).execute()
        
        if not booking_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = booking_response.data[0]
        
        # 2. Validate participant
        if not is_chat_participant(booking, auth_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this booking"
            )
        
        # 3. Get provider UUID
        provider_uuid = get_booking_provider_uuid(booking)
        customer_auth_id = booking.get("customer_auth_id")
        
        # 4. Fetch chat messages (ordered ASC for chronological display)
        if not check_table_exists("chats"):
            return {
                "messages": [],
                "participants": {
                    "customer_auth_id": customer_auth_id,
                    "provider_auth_id": provider_uuid
                }
            }
        
        chat_response = supabase.table("chats").select("*").eq(
            "booking_id", booking_id
        ).order("created_at", desc=False).range(offset, offset + limit - 1).execute()
        
        return {
            "messages": chat_response.data or [],
            "participants": {
                "customer_auth_id": customer_auth_id,
                "provider_auth_id": provider_uuid
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get booking chat: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load chat: {str(e)}"
        )


class SendChatMessageRequest(BaseModel):
    auth_id: str
    message: str = Field(..., min_length=1, max_length=2000)


@api_router.post("/bookings/{booking_id}/chat")
async def send_chat_message(
    booking_id: int,
    request: SendChatMessageRequest
):
    """
    Send a chat message for a booking.
    Only participants (customer or provider) can send.
    """
    try:
        # 1. Get booking
        booking_response = supabase.table("bookings").select(
            "id, customer_auth_id, provider_id, stylist_auth_id, status"
        ).eq("id", booking_id).execute()
        
        if not booking_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = booking_response.data[0]
        
        # 2. Validate participant
        if not is_chat_participant(booking, request.auth_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this booking"
            )
        
        # 3. Determine sender and receiver
        customer_auth_id = booking.get("customer_auth_id")
        provider_uuid = get_booking_provider_uuid(booking)
        
        sender_auth_id = request.auth_id
        receiver_auth_id = provider_uuid if request.auth_id == customer_auth_id else customer_auth_id
        
        # 4. Insert chat message
        if not check_table_exists("chats"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Chat service not available"
            )
        
        chat_data = {
            "booking_id": booking_id,
            "sender_auth_id": sender_auth_id,
            "receiver_auth_id": receiver_auth_id,
            "message": request.message.strip(),
            "read": False
        }
        
        result = supabase.table("chats").insert(chat_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send message"
            )
        
        inserted_message = result.data[0]
        
        # 5. Create notification for receiver (graceful - don't fail if notifications unavailable)
        try:
            # Get sender name
            sender_name = "Someone"
            sender_response = supabase.table("users").select("name").eq("auth_id", sender_auth_id).execute()
            if sender_response.data:
                sender_name = sender_response.data[0].get("name") or "Someone"
            
            await create_notification(
                recipient_auth_id=receiver_auth_id,
                notification_type="chat_message",
                title="New Message",
                message=f"{sender_name} sent you a message about your booking",
                actor_auth_id=sender_auth_id,
                metadata={"booking_id": booking_id, "chat_id": inserted_message["id"]}
            )
        except Exception as notif_error:
            logging.warning(f"Failed to create chat notification: {notif_error}")
        
        logging.info(f"Chat message sent: booking={booking_id}, sender={sender_auth_id[:8]}...")
        
        return inserted_message
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to send chat message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}"
        )


class MarkChatReadRequest(BaseModel):
    auth_id: str


@api_router.post("/bookings/{booking_id}/chat/mark-read")
async def mark_chat_read(
    booking_id: int,
    request: MarkChatReadRequest
):
    """
    Mark all chat messages as read for a participant.
    Only marks messages where receiver_auth_id matches the auth_id.
    """
    try:
        # 1. Get booking
        booking_response = supabase.table("bookings").select(
            "id, customer_auth_id, provider_id, stylist_auth_id"
        ).eq("id", booking_id).execute()
        
        if not booking_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = booking_response.data[0]
        
        # 2. Validate participant
        if not is_chat_participant(booking, request.auth_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this booking"
            )
        
        # 3. Mark messages as read
        if not check_table_exists("chats"):
            return {"success": True, "updated_count": 0}
        
        now = datetime.utcnow().isoformat()
        
        # Get count of unread messages first
        count_response = supabase.table("chats").select("id", count="exact").eq(
            "booking_id", booking_id
        ).eq("receiver_auth_id", request.auth_id).eq("read", False).execute()
        
        unread_count = count_response.count or 0
        
        if unread_count > 0:
            # Update to read
            try:
                supabase.table("chats").update({
                    "read": True,
                    "read_at": now
                }).eq("booking_id", booking_id).eq(
                    "receiver_auth_id", request.auth_id
                ).eq("read", False).execute()
            except Exception:
                # Try without read_at if column doesn't exist
                supabase.table("chats").update({
                    "read": True
                }).eq("booking_id", booking_id).eq(
                    "receiver_auth_id", request.auth_id
                ).eq("read", False).execute()
        
        return {"success": True, "updated_count": unread_count}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to mark chat as read: {str(e)}")
        return {"success": False, "updated_count": 0, "error": str(e)}


@api_router.get("/chat/unread-count")
async def get_chat_unread_count(
    auth_id: str = Query(..., description="User's auth_id (UUID)")
):
    """
    Get total unread chat message count across all bookings.
    """
    try:
        if not check_table_exists("chats"):
            return {"unread_count": 0}
        
        response = supabase.table("chats").select("id", count="exact").eq(
            "receiver_auth_id", auth_id
        ).eq("read", False).execute()
        
        return {"unread_count": response.count or 0}
        
    except Exception as e:
        logging.error(f"Failed to get chat unread count: {str(e)}")
        return {"unread_count": 0}


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


def parse_product_record(item):
    """Parse a products table record into a normalized product dict."""
    # image_urls may be stored as JSON string or array
    imgs = item.get("image_urls") or item.get("image_url") or []
    if isinstance(imgs, str):
        try:
            imgs = json.loads(imgs)
        except Exception:
            # fallback: comma-separated
            imgs = [s.strip() for s in imgs.split(",") if s.strip()]
    # seller may be referenced by seller_id or provider_id
    seller_id = item.get("seller_id") or item.get("provider_id") or item.get("user_id")
    approved = bool(item.get("approved") if item.get("approved") is not None else False)
    return {
        "id": item.get("id"),
        "name": item.get("name") or item.get("title") or "",
        "description": item.get("description") or None,
        "price": float(item.get("price") or 0),
        "stock": int(item.get("stock") or item.get("quantity") or 0),
        "image_urls": imgs or [],
        "is_active": approved,
        "approved": approved,
        "seller_id": seller_id,
        "seller_auth_id": item.get("seller_auth_id") or item.get("provider_auth_id") or None,
        "raw": item,
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
        es = str(e).lower()
        if "does not exist" in es or "42p01" in es or "pgrst205" in es or "could not find the table" in es:
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
    service_duration: int,
    staff_id: Optional[int] = None
) -> dict:
    """Internal function to get available booking slots - no FastAPI dependencies.

    Phase 4 - Multi-staff:
      When ``staff_id`` is provided, slots/conflicts/max-sessions are computed
      against THAT staff member only, using the staff's own weekly availability
      (falling back to provider availability if no staff schedule is set).
      When ``staff_id`` is None, behavior is unchanged from before.
    """
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

    # Phase 4 - Multi-staff: if a staff_id is supplied AND staff has its own
    # weekly availability row for this day, that overrides the provider's window.
    if staff_id and check_table_exists("staff_availability"):
        try:
            sa_resp = supabase.table("staff_availability").select("*").eq(
                "staff_id", staff_id
            ).eq("day_of_week", day_of_week).execute()
            if sa_resp.data:
                sa = sa_resp.data[0]
                is_available = bool(sa.get("is_available", False))
                if sa.get("start_time"):
                    s = sa["start_time"]
                    working_start = s[:5] if len(s) > 5 else s
                if sa.get("end_time"):
                    e = sa["end_time"]
                    working_end = e[:5] if len(e) > 5 else e
        except Exception as ex:
            logging.warning(f"staff_availability lookup failed: {ex}")
    
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
        bq = supabase.table("bookings").select("*").eq(
            "provider_id", provider_uuid
        ).eq("booking_date", requested_date).in_(
            "status", ["pending", "confirmed"]
        )
        # Phase 4: if staff_id provided, only count conflicts for that staff member.
        # Bookings with NULL staff_id under a business with multiple staff are
        # treated as provider-wide and DO conflict with any staff slot.
        if staff_id:
            try:
                bq = bq.or_(f"staff_id.eq.{staff_id},staff_id.is.null")
            except Exception:
                pass
        bookings_response = bq.execute()
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
    service_duration: int = Query(..., ge=10, description="Service duration in minutes"),
    staff_id: Optional[int] = Query(None, description="Optional staff member id (Phase 4)")
):
    """Get available booking slots for a provider on a specific date.

    If ``staff_id`` is given, slots are computed for that staff member only.
    """
    try:
        return await _get_available_slots_internal(provider_id, date, service_duration, staff_id)
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
    # Phase 4 - Multi-staff: which staff member is assigned (business providers only).
    # Optional & nullable - existing single-provider bookings continue to work unchanged.
    staff_id: Optional[int] = None

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

        # Phase 4 - Multi-staff: validate staff_id belongs to this provider and is active
        if booking.staff_id is not None:
            if not check_table_exists("staff"):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="staff table does not exist. Please run the multi-staff migration."
                )
            staff_check = supabase.table("staff").select("id, business_auth_id, is_active").eq(
                "id", booking.staff_id
            ).execute()
            if not staff_check.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Staff member {booking.staff_id} not found"
                )
            srow = staff_check.data[0]
            if srow.get("business_auth_id") != provider_uuid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Staff member does not belong to this provider"
                )
            if not srow.get("is_active", True):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected staff member is not available"
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

            # Check if the slot is available (staff-scoped if staff_id supplied)
            slots_response = await _get_available_slots_internal(
                provider_id=booking.provider_id,
                requested_date=booking.booking_date,
                service_duration=service_duration,
                staff_id=booking.staff_id
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
        # Phase 4 - Multi-staff: persist staff_id when provided
        if booking.staff_id is not None:
            booking_data["staff_id"] = booking.staff_id
        
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
        
        # Create notification for provider about new booking
        created_booking = result.data[0]
        booking_id = created_booking.get("id")
        booking_date = booking.booking_date or "TBD"
        booking_time = booking.booking_time or "TBD"
        
        # Get customer name for notification
        customer_name = "A customer"
        if customer_auth_id:
            try:
                customer_response = supabase.table("users").select("name").eq("auth_id", customer_auth_id).execute()
                if customer_response.data:
                    customer_name = customer_response.data[0].get("name") or "A customer"
            except Exception:
                pass
        
        await create_notification(
            recipient_auth_id=provider_uuid,
            notification_type="booking_created",
            title="New Booking Request",
            message=f"{customer_name} has requested a booking for {booking_date} at {booking_time}",
            actor_auth_id=customer_auth_id,
            metadata={"booking_id": booking_id}
        )
        
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
    """Get bookings with optional filters and computed fields (optimized)"""
    try:
        if not check_table_exists("bookings"):
            return []
        
        query = supabase.table("bookings").select("*")
        
        # Role-based filtering using auth_id (UUID)
        if role and auth_id:
            if role == "provider":
                query = query.eq("provider_id", auth_id)
            elif role == "customer":
                query = query.eq("customer_auth_id", auth_id)
        
        # Legacy filters (for backward compatibility)
        if provider_id:
            provider_uuid = await get_provider_auth_id(provider_id)
            if provider_uuid:
                query = query.eq("provider_id", provider_uuid)
        if customer_id:
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
        
        if not bookings:
            return []
        
        # Batch fetch all related data to avoid N+1 queries
        booking_ids = [b["id"] for b in bookings]
        provider_ids = list(set(b.get("provider_id") for b in bookings if b.get("provider_id")))
        customer_ids = list(set(b.get("customer_id") for b in bookings if b.get("customer_id")))
        
        # Batch fetch booking_services
        booking_services_map = {}
        if check_table_exists("booking_services") and booking_ids:
            bs_response = supabase.table("booking_services").select("*").in_("booking_id", booking_ids).execute()
            for bs in bs_response.data or []:
                bid = bs.get("booking_id")
                if bid not in booking_services_map:
                    booking_services_map[bid] = []
                booking_services_map[bid].append(bs)
        
        # Batch fetch service details
        service_ids = list(set(
            bs.get("service_id") 
            for bss in booking_services_map.values() 
            for bs in bss 
            if bs.get("service_id")
        ))
        services_map = {}
        if check_table_exists("services") and service_ids:
            svc_response = supabase.table("services").select("*").in_("id", service_ids).execute()
            for svc in svc_response.data or []:
                services_map[svc["id"]] = svc
        
        # Batch fetch provider names
        provider_names_map = {}
        if provider_ids:
            users_response = supabase.table("users").select("id, name, auth_id").in_("auth_id", provider_ids).execute()
            user_id_to_auth = {}
            for u in users_response.data or []:
                provider_names_map[u.get("auth_id")] = u.get("name") or "Provider"
                user_id_to_auth[u["id"]] = u.get("auth_id")
            
            # Try to get business names from stylists
            if user_id_to_auth:
                stylist_response = supabase.table("stylists").select("user_id, business_name").in_("user_id", list(user_id_to_auth.keys())).execute()
                for s in stylist_response.data or []:
                    if s.get("business_name") and s.get("user_id") in user_id_to_auth:
                        auth_id_for_user = user_id_to_auth[s["user_id"]]
                        provider_names_map[auth_id_for_user] = s["business_name"]
        
        # Batch fetch customer names
        customer_names_map = {}
        if customer_ids:
            cust_response = supabase.table("users").select("id, name").in_("id", customer_ids).execute()
            for c in cust_response.data or []:
                customer_names_map[c["id"]] = c.get("name") or "Customer"
        
        # Enrich bookings using pre-fetched data
        enriched_bookings = []
        for booking in bookings:
            enriched = {**booking}
            
            # Add services
            services = []
            total_amount = 0
            total_duration = 0
            for bs in booking_services_map.get(booking["id"], []):
                service_name = "Service"
                if bs.get("service_id") and bs["service_id"] in services_map:
                    svc = services_map[bs["service_id"]]
                    parsed = parse_service_record(svc)
                    service_name = parsed.get("sub_service_name") or parsed.get("name") or svc.get("name", "Service")
                
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
            
            enriched["services"] = services
            enriched["total_amount"] = total_amount
            enriched["total_duration"] = total_duration
            enriched["provider_display_name"] = provider_names_map.get(booking.get("provider_id"), "Provider")
            enriched["customer_display_name"] = customer_names_map.get(booking.get("customer_id"), "Customer")
            
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

    # Phase 4 - Multi-staff: attach staff info if booking has a staff_id
    enriched["staff_id"] = booking.get("staff_id")
    enriched["staff"] = None
    if booking.get("staff_id") and check_table_exists("staff"):
        try:
            st = supabase.table("staff").select(
                "id, name, role, photo_url, is_active"
            ).eq("id", booking["staff_id"]).execute()
            if st.data:
                enriched["staff"] = st.data[0]
        except Exception as e:
            logging.warning(f"Could not load staff for booking {booking.get('id')}: {e}")

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
        
        elif new_status in ["canceled", "declined"] and current_status in ["pending", "confirmed", "pending_payment"]:
            # Refund escrow to customer
            customer_auth_id = booking.get("customer_auth_id")
            if customer_auth_id:
                # Check if there's escrow to refund by:
                # 1. payment_status == "paid" OR
                # 2. There's a payment record for this booking OR
                # 3. Customer has escrow balance (fallback)
                should_refund = False
                payment_status = booking.get("payment_status")
                
                if payment_status == "paid":
                    should_refund = True
                elif check_table_exists("payments"):
                    # Check for successful payment record for this booking
                    payment_check = supabase.table("payments").select("id").eq(
                        "booking_id", booking_id
                    ).eq("status", "success").execute()
                    if payment_check.data:
                        should_refund = True
                
                # Final fallback: check if customer actually has escrow balance
                if not should_refund:
                    try:
                        wallet_check = supabase.table("wallets").select("escrow_balance").eq(
                            "user_auth_id", customer_auth_id
                        ).execute()
                        if wallet_check.data and float(wallet_check.data[0].get("escrow_balance", 0) or 0) > 0:
                            should_refund = True
                            logging.info(f"Booking {booking_id}: Refunding based on escrow balance presence")
                    except Exception as e:
                        logging.warning(f"Could not check escrow balance: {e}")
                
                if should_refund:
                    await _refund_escrow_to_customer(booking_id, customer_auth_id)
                else:
                    logging.info(f"Booking {booking_id}: No escrow to refund (no payment record found)")
        
        # Create notifications based on status change
        provider_id = booking.get("provider_id")
        customer_auth_id = booking.get("customer_auth_id")
        booking_date = booking.get("booking_date", "")
        booking_time = booking.get("booking_time", "")
        
        # Get names for notifications
        provider_name = "The stylist"
        customer_name = "The customer"
        try:
            if provider_id:
                provider_resp = supabase.table("users").select("name").eq("auth_id", provider_id).execute()
                if provider_resp.data:
                    provider_name = provider_resp.data[0].get("name") or "The stylist"
            if customer_auth_id:
                customer_resp = supabase.table("users").select("name").eq("auth_id", customer_auth_id).execute()
                if customer_resp.data:
                    customer_name = customer_resp.data[0].get("name") or "The customer"
        except Exception:
            pass
        
        # Send appropriate notification based on new status
        if new_status == "confirmed" and customer_auth_id:
            await create_notification(
                recipient_auth_id=customer_auth_id,
                notification_type="booking_confirmed",
                title="Booking Confirmed",
                message=f"{provider_name} has confirmed your booking for {booking_date} at {booking_time}",
                actor_auth_id=provider_id,
                metadata={"booking_id": booking_id}
            )
        elif new_status == "declined" and customer_auth_id:
            await create_notification(
                recipient_auth_id=customer_auth_id,
                notification_type="booking_declined",
                title="Booking Declined",
                message=f"{provider_name} has declined your booking request",
                actor_auth_id=provider_id,
                metadata={"booking_id": booking_id}
            )
        elif new_status == "canceled":
            # Determine who canceled and notify the other party
            if role == "customer" and provider_id:
                await create_notification(
                    recipient_auth_id=provider_id,
                    notification_type="booking_canceled",
                    title="Booking Canceled",
                    message=f"{customer_name} has canceled the booking for {booking_date}",
                    actor_auth_id=customer_auth_id,
                    metadata={"booking_id": booking_id}
                )
            elif role == "provider" and customer_auth_id:
                await create_notification(
                    recipient_auth_id=customer_auth_id,
                    notification_type="booking_canceled",
                    title="Booking Canceled",
                    message=f"{provider_name} has canceled your booking for {booking_date}",
                    actor_auth_id=provider_id,
                    metadata={"booking_id": booking_id}
                )
        elif new_status == "completed" and customer_auth_id:
            await create_notification(
                recipient_auth_id=customer_auth_id,
                notification_type="booking_completed",
                title="Service Completed",
                message=f"Your appointment with {provider_name} has been marked as completed",
                actor_auth_id=provider_id,
                metadata={"booking_id": booking_id}
            )
        
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


# ====================================================================
# NO-SHOW HYBRID FLOW
# - Additive endpoints, no existing routes modified.
# - Uses existing escrow helpers; never touches wallet logic directly.
# ====================================================================

class NoShowReportBody(BaseModel):
    auth_id: str
    reason: Optional[str] = None


class NoShowResponseBody(BaseModel):
    auth_id: str
    reason: Optional[str] = None


def _booking_role_of(booking: Dict[str, Any], auth_id: str) -> Optional[str]:
    """Return 'customer' / 'provider' / None based on the auth_id's role on this booking."""
    if not auth_id:
        return None
    if booking.get("provider_id") == auth_id:
        return ROLE_PROVIDER
    if booking.get("customer_auth_id") == auth_id:
        return ROLE_CUSTOMER
    return None


@api_router.post("/bookings/{booking_id}/no-show/report")
async def report_no_show(booking_id: int, body: NoShowReportBody):
    """
    Either party reports the other party as a no-show.
    Booking moves to status='no_show_pending' with a grace deadline.
    Opposite party is notified.
    """
    try:
        resp = supabase.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Booking not found")
        booking = resp.data[0]

        reporter_role = _booking_role_of(booking, body.auth_id)
        if reporter_role not in (ROLE_CUSTOMER, ROLE_PROVIDER):
            raise HTTPException(status_code=403, detail="You are not a participant in this booking")

        current_status = (booking.get("status") or "").lower()
        if current_status not in ELIGIBLE_REPORT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot report no-show for a booking with status '{current_status}'"
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        deadline_iso = compute_deadline().isoformat()

        update_data = {
            "status": STATUS_NO_SHOW_PENDING,
            "no_show_reported_by": body.auth_id,
            "no_show_reporter_role": reporter_role,
            "no_show_reported_at": now_iso,
            "no_show_reason": (body.reason or "")[:500] or None,
            "no_show_deadline": deadline_iso,
            "dispute_opened": False,
        }

        try:
            upd = (
                supabase.table("bookings")
                .update(update_data)
                .eq("id", booking_id)
                .in_("status", list(ELIGIBLE_REPORT_STATUSES))
                .execute()
            )
        except Exception as schema_err:
            logging.warning(f"[no_show] update failed (schema?): {schema_err}")
            raise HTTPException(
                status_code=503,
                detail="No-show columns missing on bookings table. Apply phase_no_show.sql migration."
            )

        if not upd.data:
            raise HTTPException(
                status_code=409,
                detail="Booking status changed; please refresh and try again"
            )

        provider_auth_id = booking.get("provider_id")
        customer_auth_id = booking.get("customer_auth_id")
        opposite_auth_id = provider_auth_id if reporter_role == ROLE_CUSTOMER else customer_auth_id

        grace = grace_period_minutes()
        meta = {
            "booking_id": booking_id,
            "reporter_role": reporter_role,
            "deadline": deadline_iso,
            "grace_minutes": grace,
        }

        if opposite_auth_id:
            if reporter_role == ROLE_PROVIDER:
                await create_notification(
                    recipient_auth_id=opposite_auth_id,
                    notification_type="no_show_reported",
                    title="Provider reported you as no-show",
                    message=(
                        f"Your provider reports that you did not show up. "
                        f"You have {grace} minutes to confirm or dispute, otherwise "
                        f"the booking will be finalized as a no-show."
                    ),
                    actor_auth_id=body.auth_id,
                    metadata={**meta, "role": "customer"},
                )
            else:
                await create_notification(
                    recipient_auth_id=opposite_auth_id,
                    notification_type="no_show_reported",
                    title="Customer reported you as no-show",
                    message=(
                        f"Your customer reports that you did not show up. "
                        f"You have {grace} minutes to confirm or dispute, otherwise "
                        f"the booking will be finalized as a no-show."
                    ),
                    actor_auth_id=body.auth_id,
                    metadata={**meta, "role": "provider"},
                )

        await create_notification(
            recipient_auth_id=body.auth_id,
            notification_type="no_show_reported",
            title="No-show report submitted",
            message=(
                f"We've notified the other party. If they don't respond within "
                f"{grace} minutes, the booking will be finalized automatically."
            ),
            metadata={**meta, "role": reporter_role, "self_report": True},
        )

        return {
            "success": True,
            "booking_id": booking_id,
            "status": STATUS_NO_SHOW_PENDING,
            "no_show_deadline": deadline_iso,
            "grace_minutes": grace,
            "reporter_role": reporter_role,
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[no_show] report failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to report no-show: {str(e)}")


@api_router.post("/bookings/{booking_id}/no-show/confirm")
async def confirm_no_show(booking_id: int, body: NoShowResponseBody):
    """Opposite party confirms the no-show. Booking is finalized immediately."""
    try:
        resp = supabase.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Booking not found")
        booking = resp.data[0]

        if (booking.get("status") or "").lower() != STATUS_NO_SHOW_PENDING:
            raise HTTPException(status_code=400, detail="Booking is not awaiting a no-show response")

        actor_role = _booking_role_of(booking, body.auth_id)
        if actor_role not in (ROLE_CUSTOMER, ROLE_PROVIDER):
            raise HTTPException(status_code=403, detail="You are not a participant in this booking")

        reporter_role = (booking.get("no_show_reporter_role") or "").lower()
        if actor_role == reporter_role:
            raise HTTPException(status_code=403, detail="Only the opposite party can confirm or dispute")

        if reporter_role == ROLE_PROVIDER:
            final_status = STATUS_USER_NO_SHOW
            escrow = "release_to_provider"
        else:
            final_status = STATUS_PROVIDER_NO_SHOW
            escrow = "refund_to_customer"

        upd = (
            supabase.table("bookings")
            .update({"status": final_status})
            .eq("id", booking_id)
            .eq("status", STATUS_NO_SHOW_PENDING)
            .execute()
        )
        if not upd.data:
            raise HTTPException(status_code=409, detail="Booking already finalized")

        provider_auth_id = booking.get("provider_id")
        customer_auth_id = booking.get("customer_auth_id")

        try:
            if escrow == "release_to_provider" and provider_auth_id and customer_auth_id:
                await _release_escrow_to_provider(booking_id, provider_auth_id, customer_auth_id)
            elif escrow == "refund_to_customer" and customer_auth_id:
                await _refund_escrow_to_customer(booking_id, customer_auth_id)
        except Exception as e:
            logging.warning(f"[no_show] confirm: escrow action failed for booking {booking_id}: {e}")

        meta = {"booking_id": booking_id, "outcome": final_status}
        if customer_auth_id:
            msg_cust = (
                "You were confirmed as a no-show. The booking is now closed."
                if final_status == STATUS_USER_NO_SHOW
                else "Your provider's no-show has been confirmed. Refund processed."
            )
            await create_notification(
                recipient_auth_id=customer_auth_id,
                notification_type="no_show_finalized",
                title="Booking closed",
                message=msg_cust,
                metadata={**meta, "role": "customer"},
            )
        if provider_auth_id:
            msg_prov = (
                "Your customer's no-show was confirmed. Payment released."
                if final_status == STATUS_USER_NO_SHOW
                else "Your no-show has been confirmed. Booking is now closed."
            )
            await create_notification(
                recipient_auth_id=provider_auth_id,
                notification_type="no_show_finalized",
                title="Booking closed",
                message=msg_prov,
                metadata={**meta, "role": "provider"},
            )

        return {"success": True, "booking_id": booking_id, "status": final_status}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[no_show] confirm failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to confirm no-show: {str(e)}")


@api_router.post("/bookings/{booking_id}/no-show/dispute")
async def dispute_no_show(booking_id: int, body: NoShowResponseBody):
    """Opposite party disputes the no-show. Auto-finalization stops; admin review required."""
    try:
        resp = supabase.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Booking not found")
        booking = resp.data[0]

        if (booking.get("status") or "").lower() != STATUS_NO_SHOW_PENDING:
            raise HTTPException(status_code=400, detail="Booking is not awaiting a no-show response")

        actor_role = _booking_role_of(booking, body.auth_id)
        if actor_role not in (ROLE_CUSTOMER, ROLE_PROVIDER):
            raise HTTPException(status_code=403, detail="You are not a participant in this booking")

        reporter_role = (booking.get("no_show_reporter_role") or "").lower()
        if actor_role == reporter_role:
            raise HTTPException(status_code=403, detail="Only the opposite party can dispute")

        upd = (
            supabase.table("bookings")
            .update({
                "status": STATUS_DISPUTED,
                "dispute_opened": True,
                "dispute_reason": (body.reason or "")[:500] or None,
                "dispute_opened_at": datetime.now(timezone.utc).isoformat(),
                "dispute_opened_by": body.auth_id,
            })
            .eq("id", booking_id)
            .eq("status", STATUS_NO_SHOW_PENDING)
            .execute()
        )
        if not upd.data:
            raise HTTPException(status_code=409, detail="Booking already finalized or updated")

        reporter_auth_id = booking.get("no_show_reported_by")
        meta = {"booking_id": booking_id, "actor_role": actor_role}

        if reporter_auth_id:
            await create_notification(
                recipient_auth_id=reporter_auth_id,
                notification_type="dispute_opened",
                title="Your no-show report was disputed",
                message=(
                    "The other party disputes your no-show report. "
                    "Our team will review the case shortly. No automatic action will be taken."
                ),
                actor_auth_id=body.auth_id,
                metadata=meta,
            )

        await create_notification(
            recipient_auth_id=body.auth_id,
            notification_type="dispute_opened",
            title="Dispute submitted",
            message="Your dispute has been recorded. Our team will review the case shortly.",
            metadata={**meta, "self_dispute": True},
        )

        return {"success": True, "booking_id": booking_id, "status": STATUS_DISPUTED}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[no_show] dispute failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to dispute no-show: {str(e)}")


@api_router.get("/admin/no-show/cases")
async def admin_list_no_show_cases(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    include_resolved: bool = Query(False, description="Include user_no_show / provider_no_show too"),
):
    """Admin tool to list pending no-show / disputed bookings. Protected by X-ADMIN-KEY."""
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key:
        raise HTTPException(status_code=503, detail="ADMIN_DASH_KEY not configured")
    if not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    statuses = [STATUS_NO_SHOW_PENDING, STATUS_DISPUTED]
    if include_resolved:
        statuses = statuses + [STATUS_USER_NO_SHOW, STATUS_PROVIDER_NO_SHOW]

    try:
        resp = (
            supabase.table("bookings")
            .select("*")
            .in_("status", statuses)
            .order("no_show_reported_at", desc=True)
            .limit(200)
            .execute()
        )
        rows = resp.data or []
        return {"count": len(rows), "cases": rows}
    except Exception as e:
        logging.error(f"[no_show] admin list failed: {e}")
        try:
            resp = supabase.table("bookings").select("*").in_("status", statuses).limit(200).execute()
            return {"count": len(resp.data or []), "cases": resp.data or []}
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Failed to list cases: {str(e2)}")


@api_router.post("/admin/no-show/run")
async def admin_run_no_show_finalization(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY")
):
    """Manually trigger the no-show finalization scan. Protected by X-ADMIN-KEY."""
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key:
        raise HTTPException(status_code=503, detail="ADMIN_DASH_KEY not configured")
    if not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    stats = await finalize_expired_no_shows(
        supabase,
        _release_escrow_to_provider,
        _refund_escrow_to_customer,
        create_notification,
    )
    return {"success": True, "stats": stats}




# ==================== REVIEWS MODELS (Phase 3) ====================

class ReviewCreate(BaseModel):
    booking_id: int
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = None

class ReviewReply(BaseModel):
    provider_reply: str = Field(..., min_length=1, description="Provider's reply to the review")

class ReviewResponse(BaseModel):
    id: int
    booking_id: int
    reviewer_auth_id: str
    provider_auth_id: str
    rating: int
    comment: Optional[str] = None
    provider_reply: Optional[str] = None
    created_at: str
    replied_at: Optional[str] = None
    reviewer_name: Optional[str] = None


# ==================== REVIEWS ENDPOINTS (Phase 3) ====================

def _get_provider_uuid_from_booking(booking: dict) -> Optional[str]:
    """Get provider UUID from booking, handling both provider_id and stylist_auth_id fields."""
    return booking.get("provider_id") or booking.get("stylist_auth_id")


@api_router.post("/reviews", status_code=status.HTTP_201_CREATED)
async def create_review(
    review: ReviewCreate,
    auth_id: str = Query(..., description="Reviewer's auth_id (UUID)")
):
    """Create a review for a completed booking (customer only)"""
    try:
        if not check_table_exists("reviews"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Reviews table not available"
            )
        
        # Validate booking exists
        booking_response = supabase.table("bookings").select("*").eq("id", review.booking_id).execute()
        if not booking_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = booking_response.data[0]
        
        # Validate reviewer is the customer of this booking
        if booking.get("customer_auth_id") != auth_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only review your own bookings"
            )
        
        # Validate booking is completed
        if booking.get("status") != "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only review completed bookings"
            )
        
        # Get provider_auth_id from booking
        provider_auth_id = _get_provider_uuid_from_booking(booking)
        if not provider_auth_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not determine provider for this booking"
            )
        
        # Create review
        review_data = {
            "booking_id": review.booking_id,
            "reviewer_auth_id": auth_id,
            "provider_auth_id": provider_auth_id,
            "rating": review.rating,
            "comment": review.comment,
            "created_at": datetime.utcnow().isoformat()
        }
        
        try:
            result = supabase.table("reviews").insert(review_data).execute()
        except Exception as e:
            error_str = str(e).lower()
            # Handle unique constraint violation
            if "unique" in error_str or "duplicate" in error_str or "23505" in error_str:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="You have already reviewed this booking"
                )
            raise
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create review"
            )
        
        # Create notification for provider about new review
        try:
            # Get reviewer name
            reviewer_response = supabase.table("users").select("name").eq("auth_id", auth_id).execute()
            reviewer_name = "A customer"
            if reviewer_response.data:
                reviewer_name = reviewer_response.data[0].get("name") or "A customer"
            
            notification_data = {
                "recipient_auth_id": provider_auth_id,
                "actor_auth_id": auth_id,
                "type": "new_review",
                "title": "New Review Received",
                "message": f"{reviewer_name} left a {review.rating}-star review for booking #{review.booking_id}",
                "metadata": {
                    "booking_id": review.booking_id,
                    "review_id": result.data[0]["id"],
                    "rating": review.rating
                },
                "read": False,
                "created_at": datetime.utcnow().isoformat()
            }
            supabase.table("notifications").insert(notification_data).execute()
        except Exception as notif_err:
            logging.warning(f"Failed to create review notification: {notif_err}")
        
        return result.data[0]
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to create review: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create review: {str(e)}"
        )


@api_router.get("/providers/{provider_auth_id}/reviews")
async def get_provider_reviews(
    provider_auth_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get reviews for a provider with aggregate stats"""
    try:
        if not check_table_exists("reviews"):
            return {
                "reviews": [],
                "avg_rating": 0,
                "total_reviews": 0
            }
        
        # Get reviews with pagination
        reviews_response = supabase.table("reviews").select("*").eq(
            "provider_auth_id", provider_auth_id
        ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        reviews = reviews_response.data or []
        
        # Get aggregate stats (total count and average)
        all_reviews_response = supabase.table("reviews").select("rating").eq(
            "provider_auth_id", provider_auth_id
        ).execute()
        all_ratings = [r["rating"] for r in (all_reviews_response.data or [])]
        total_reviews = len(all_ratings)
        avg_rating = round(sum(all_ratings) / total_reviews, 1) if total_reviews > 0 else 0
        
        # Batch fetch reviewer names to avoid N+1
        reviewer_ids = list(set(r.get("reviewer_auth_id") for r in reviews if r.get("reviewer_auth_id")))
        reviewer_names_map = {}
        if reviewer_ids:
            users_response = supabase.table("users").select("auth_id, name").in_("auth_id", reviewer_ids).execute()
            for u in users_response.data or []:
                reviewer_names_map[u.get("auth_id")] = u.get("name") or "Anonymous"
        
        # Enrich reviews with reviewer names
        enriched_reviews = []
        for review in reviews:
            enriched = {**review}
            enriched["reviewer_name"] = reviewer_names_map.get(review.get("reviewer_auth_id"), "Anonymous")
            enriched_reviews.append(enriched)
        
        return {
            "reviews": enriched_reviews,
            "avg_rating": avg_rating,
            "total_reviews": total_reviews
        }
    
    except Exception as e:
        logging.error(f"Failed to fetch provider reviews: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch reviews: {str(e)}"
        )


@api_router.get("/reviews/me")
async def get_my_reviews(
    auth_id: str = Query(..., description="User's auth_id (UUID)"),
    role: str = Query(..., description="Role: 'customer' or 'provider'"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get reviews for the current user (as customer or provider)"""
    try:
        if not check_table_exists("reviews"):
            return []
        
        if role == "customer":
            # Reviews the user has written
            reviews_response = supabase.table("reviews").select("*").eq(
                "reviewer_auth_id", auth_id
            ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        elif role == "provider":
            # Reviews the user has received
            reviews_response = supabase.table("reviews").select("*").eq(
                "provider_auth_id", auth_id
            ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be 'customer' or 'provider'"
            )
        
        reviews = reviews_response.data or []
        
        # Batch fetch names for context
        reviewer_ids = list(set(r.get("reviewer_auth_id") for r in reviews if r.get("reviewer_auth_id")))
        provider_ids = list(set(r.get("provider_auth_id") for r in reviews if r.get("provider_auth_id")))
        all_auth_ids = list(set(reviewer_ids + provider_ids))
        
        names_map = {}
        if all_auth_ids:
            users_response = supabase.table("users").select("auth_id, name").in_("auth_id", all_auth_ids).execute()
            for u in users_response.data or []:
                names_map[u.get("auth_id")] = u.get("name") or "User"
        
        # Enrich reviews
        enriched_reviews = []
        for review in reviews:
            enriched = {**review}
            enriched["reviewer_name"] = names_map.get(review.get("reviewer_auth_id"), "Anonymous")
            enriched["provider_name"] = names_map.get(review.get("provider_auth_id"), "Provider")
            enriched_reviews.append(enriched)
        
        return enriched_reviews
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to fetch my reviews: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch reviews: {str(e)}"
        )


@api_router.get("/reviews/by-booking/{booking_id}")
async def get_review_by_booking(
    booking_id: int,
    auth_id: str = Query(..., description="User's auth_id to verify access")
):
    """Get review for a specific booking (if exists)"""
    try:
        if not check_table_exists("reviews"):
            return None
        
        # Verify user has access to this booking
        booking_response = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not booking_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        booking = booking_response.data[0]
        provider_uuid = _get_provider_uuid_from_booking(booking)
        
        # Only customer or provider of the booking can see the review
        if booking.get("customer_auth_id") != auth_id and provider_uuid != auth_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this review"
            )
        
        # Get review
        review_response = supabase.table("reviews").select("*").eq("booking_id", booking_id).execute()
        
        if not review_response.data:
            return None
        
        review = review_response.data[0]
        
        # Get reviewer name
        reviewer_name = "Anonymous"
        if review.get("reviewer_auth_id"):
            user_response = supabase.table("users").select("name").eq("auth_id", review["reviewer_auth_id"]).execute()
            if user_response.data:
                reviewer_name = user_response.data[0].get("name") or "Anonymous"
        
        review["reviewer_name"] = reviewer_name
        return review
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to fetch review for booking: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch review: {str(e)}"
        )


@api_router.post("/reviews/{review_id}/reply")
async def reply_to_review(
    review_id: int,
    reply: ReviewReply,
    auth_id: str = Query(..., description="Provider's auth_id (UUID)")
):
    """Provider replies to a review"""
    try:
        if not check_table_exists("reviews"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Reviews table not available"
            )
        
        # Get the review
        review_response = supabase.table("reviews").select("*").eq("id", review_id).execute()
        if not review_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        review = review_response.data[0]
        
        # Verify the provider owns this review
        if review.get("provider_auth_id") != auth_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the provider can reply to this review"
            )
        
        # Update with reply (allow overwrite for edits)
        update_data = {
            "provider_reply": reply.provider_reply,
            "replied_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("reviews").update(update_data).eq("id", review_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save reply"
            )
        
        # Create notification for reviewer about the reply
        try:
            # Get provider name
            provider_response = supabase.table("users").select("name").eq("auth_id", auth_id).execute()
            provider_name = "The provider"
            if provider_response.data:
                provider_name = provider_response.data[0].get("name") or "The provider"
            
            notification_data = {
                "recipient_auth_id": review.get("reviewer_auth_id"),
                "actor_auth_id": auth_id,
                "type": "review_reply",
                "title": "Provider Replied to Your Review",
                "message": f"{provider_name} replied to your review for booking #{review.get('booking_id')}",
                "metadata": {
                    "booking_id": review.get("booking_id"),
                    "review_id": review_id
                },
                "read": False,
                "created_at": datetime.utcnow().isoformat()
            }
            supabase.table("notifications").insert(notification_data).execute()
        except Exception as notif_err:
            logging.warning(f"Failed to create reply notification: {notif_err}")
        
        return result.data[0]
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to reply to review: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save reply: {str(e)}"
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


# ====================================================================
# BOOKING REMINDERS - manual trigger (admin-protected)
# ====================================================================

@api_router.post("/admin/booking-reminders/run")
async def admin_run_booking_reminders(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY")
):
    """
    Manually trigger the booking-reminder scan. Useful for testing and ops.

    Protected by X-ADMIN-KEY (uses ADMIN_DASH_KEY env var).
    """
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key:
        raise HTTPException(status_code=503, detail="ADMIN_DASH_KEY not configured")
    if not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    stats = await scan_and_create_reminders(supabase, create_notification)
    return {"success": True, "stats": stats}


# ====================================================================
# PHASE 4 - MULTI-STAFF (Salons / Business Providers)
# --------------------------------------------------------------------
# Fully additive. Staff entries are profile-only records owned by an
# existing provider's Supabase Auth account (business_auth_id). No new
# authentication is introduced.
# Requires migration: /app/backend/migrations/phase4_multi_staff.sql
# ====================================================================

class StaffCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    role: Optional[str] = Field(None, max_length=100)
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    service_ids: Optional[List[int]] = None  # services from the business catalog

class StaffUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    role: Optional[str] = Field(None, max_length=100)
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None

class StaffServicesUpdate(BaseModel):
    service_ids: List[int] = Field(default_factory=list)

class StaffWeeklyDay(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    is_available: bool = False
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    @validator('start_time', 'end_time', pre=True)
    def _val_time(cls, v):
        if v is None or v == "":
            return None
        if not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', v):
            raise ValueError('Time must be in HH:MM format')
        return v

class StaffAvailabilityUpdate(BaseModel):
    weekly: List[StaffWeeklyDay]


def _require_staff_table():
    if not check_table_exists("staff"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Multi-staff is not enabled. Run migration phase4_multi_staff.sql in Supabase."
        )


def _load_staff_or_404(staff_id: int) -> dict:
    _require_staff_table()
    res = supabase.table("staff").select("*").eq("id", staff_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return res.data[0]


def _assert_staff_owner(staff_row: dict, auth_id: str):
    if not auth_id:
        raise HTTPException(status_code=401, detail="auth_id required")
    if staff_row.get("business_auth_id") != auth_id:
        raise HTTPException(status_code=403, detail="You do not own this staff member")


def _get_staff_service_ids(staff_id: int) -> List[int]:
    if not check_table_exists("staff_services"):
        return []
    try:
        res = supabase.table("staff_services").select("service_id").eq("staff_id", staff_id).execute()
        return [row["service_id"] for row in (res.data or [])]
    except Exception:
        return []


def _get_staff_weekly(staff_id: int) -> List[dict]:
    if not check_table_exists("staff_availability"):
        return []
    try:
        res = supabase.table("staff_availability").select("*").eq("staff_id", staff_id).execute()
        return res.data or []
    except Exception:
        return []


@api_router.post("/staff", status_code=status.HTTP_201_CREATED)
async def create_staff(payload: StaffCreate, auth_id: str = Query(..., description="Business owner's auth_id (UUID)")):
    """Create a staff member under the requester's business account."""
    _require_staff_table()
    try:
        row = {
            "business_auth_id": auth_id,
            "name": payload.name,
            "role": payload.role,
            "photo_url": payload.photo_url,
            "bio": payload.bio,
            "is_active": payload.is_active,
            "display_order": payload.display_order,
        }
        res = supabase.table("staff").insert(row).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create staff")
        created = res.data[0]
        staff_id = created["id"]

        # Optionally link services
        if payload.service_ids:
            links = [{"staff_id": staff_id, "service_id": sid} for sid in payload.service_ids]
            try:
                supabase.table("staff_services").insert(links).execute()
            except Exception as ex:
                logging.warning(f"Failed to link services to staff {staff_id}: {ex}")

        created["service_ids"] = _get_staff_service_ids(staff_id)
        created["weekly"] = []
        return created
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"create_staff failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create staff: {e}")


@api_router.get("/staff/me")
async def list_my_staff(
    auth_id: str = Query(..., description="Business owner's auth_id (UUID)"),
    include_inactive: bool = Query(True)
):
    """List all staff under the requester's business account."""
    _require_staff_table()
    try:
        q = supabase.table("staff").select("*").eq("business_auth_id", auth_id)
        if not include_inactive:
            q = q.eq("is_active", True)
        q = q.order("display_order", desc=False).order("id", desc=False)
        res = q.execute()
        staff_list = res.data or []
        # Attach service_ids per staff member (small N expected per business)
        for s in staff_list:
            s["service_ids"] = _get_staff_service_ids(s["id"])
        return {"staff": staff_list, "total": len(staff_list)}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"list_my_staff failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list staff: {e}")


@api_router.get("/staff/{staff_id}")
async def get_staff_detail(staff_id: int):
    """Get full detail for a single staff member (public-safe fields)."""
    row = _load_staff_or_404(staff_id)
    row["service_ids"] = _get_staff_service_ids(staff_id)
    row["weekly"] = _get_staff_weekly(staff_id)
    return row


@api_router.put("/staff/{staff_id}")
async def update_staff(
    staff_id: int,
    payload: StaffUpdate,
    auth_id: str = Query(..., description="Business owner's auth_id (UUID)")
):
    """Update a staff member's profile (owner only)."""
    row = _load_staff_or_404(staff_id)
    _assert_staff_owner(row, auth_id)
    try:
        update_data = {k: v for k, v in payload.dict(exclude_unset=True).items()}
        if not update_data:
            return row
        res = supabase.table("staff").update(update_data).eq("id", staff_id).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to update staff")
        out = res.data[0]
        out["service_ids"] = _get_staff_service_ids(staff_id)
        out["weekly"] = _get_staff_weekly(staff_id)
        return out
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"update_staff failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update staff: {e}")


@api_router.delete("/staff/{staff_id}", status_code=status.HTTP_200_OK)
async def delete_staff(
    staff_id: int,
    auth_id: str = Query(..., description="Business owner's auth_id (UUID)"),
    hard: bool = Query(False, description="If true, hard-delete (will fail if bookings reference this staff)")
):
    """Soft-delete (set is_active=False) by default. Pass hard=true to delete row."""
    row = _load_staff_or_404(staff_id)
    _assert_staff_owner(row, auth_id)
    try:
        if hard:
            supabase.table("staff").delete().eq("id", staff_id).execute()
            return {"success": True, "hard_deleted": True}
        supabase.table("staff").update({"is_active": False}).eq("id", staff_id).execute()
        return {"success": True, "hard_deleted": False}
    except Exception as e:
        logging.error(f"delete_staff failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete staff: {e}")


@api_router.put("/staff/{staff_id}/services")
async def set_staff_services(
    staff_id: int,
    payload: StaffServicesUpdate,
    auth_id: str = Query(..., description="Business owner's auth_id (UUID)")
):
    """Replace the set of services a staff member offers."""
    row = _load_staff_or_404(staff_id)
    _assert_staff_owner(row, auth_id)
    if not check_table_exists("staff_services"):
        raise HTTPException(status_code=503, detail="staff_services table missing - run migration.")
    try:
        # Replace strategy: delete all then insert new
        supabase.table("staff_services").delete().eq("staff_id", staff_id).execute()
        if payload.service_ids:
            # Deduplicate
            unique = list({int(s) for s in payload.service_ids})
            rows = [{"staff_id": staff_id, "service_id": sid} for sid in unique]
            supabase.table("staff_services").insert(rows).execute()
        return {"staff_id": staff_id, "service_ids": _get_staff_service_ids(staff_id)}
    except Exception as e:
        logging.error(f"set_staff_services failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set staff services: {e}")


@api_router.put("/staff/{staff_id}/availability")
async def set_staff_availability(
    staff_id: int,
    payload: StaffAvailabilityUpdate,
    auth_id: str = Query(..., description="Business owner's auth_id (UUID)")
):
    """Set weekly availability for a staff member (replaces all 7 days)."""
    row = _load_staff_or_404(staff_id)
    _assert_staff_owner(row, auth_id)
    if not check_table_exists("staff_availability"):
        raise HTTPException(status_code=503, detail="staff_availability table missing - run migration.")
    try:
        # Validate time pairs
        for d in payload.weekly:
            if d.is_available:
                if not d.start_time or not d.end_time:
                    raise HTTPException(
                        status_code=400,
                        detail=f"day_of_week={d.day_of_week}: start_time and end_time required when is_available=true"
                    )
                if not validate_time_range(d.start_time, d.end_time):
                    raise HTTPException(
                        status_code=400,
                        detail=f"day_of_week={d.day_of_week}: start_time must be before end_time"
                    )

        # Replace all 7 days
        supabase.table("staff_availability").delete().eq("staff_id", staff_id).execute()
        rows = []
        for d in payload.weekly:
            rows.append({
                "staff_id": staff_id,
                "day_of_week": d.day_of_week,
                "is_available": d.is_available,
                "start_time": d.start_time,
                "end_time": d.end_time,
            })
        if rows:
            supabase.table("staff_availability").insert(rows).execute()

        return {"staff_id": staff_id, "weekly": _get_staff_weekly(staff_id)}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"set_staff_availability failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set availability: {e}")


@api_router.get("/providers/{provider_id}/staff")
async def list_provider_staff_public(provider_id: int, active_only: bool = Query(True)):
    """Public list of staff for a provider (for customer booking picker).

    ``provider_id`` is the legacy integer user id (consistent with other public provider endpoints).
    """
    if not check_table_exists("staff"):
        return {"staff": [], "total": 0}
    provider_uuid = await get_provider_auth_id(provider_id)
    if not provider_uuid:
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        q = supabase.table("staff").select(
            "id, name, role, photo_url, bio, is_active, display_order"
        ).eq("business_auth_id", provider_uuid)
        if active_only:
            q = q.eq("is_active", True)
        q = q.order("display_order", desc=False).order("id", desc=False)
        res = q.execute()
        staff_list = res.data or []
        for s in staff_list:
            s["service_ids"] = _get_staff_service_ids(s["id"])
        return {"staff": staff_list, "total": len(staff_list)}
    except Exception as e:
        logging.error(f"list_provider_staff_public failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list staff: {e}")


@api_router.get("/staff/{staff_id}/available-slots")
async def get_staff_available_slots(
    staff_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    service_duration: int = Query(..., ge=10, description="Service duration in minutes")
):
    """Get available booking slots for a specific staff member."""
    row = _load_staff_or_404(staff_id)
    # Find the staff owner's integer provider_id
    business_auth_id = row.get("business_auth_id")
    user_res = supabase.table("users").select("id").eq("auth_id", business_auth_id).execute()
    if not user_res.data:
        raise HTTPException(status_code=404, detail="Owner user not found")
    provider_int_id = user_res.data[0]["id"]
    try:
        return await _get_available_slots_internal(
            provider_id=provider_int_id,
            requested_date=date,
            service_duration=service_duration,
            staff_id=staff_id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get staff slots: {e}")


# ====================================================================
# END PHASE 4 - MULTI-STAFF
# ====================================================================


# ====================================================================
# PHASE 4 - SOCIAL FEED LITE
# ====================================================================
# Requires migration: /app/backend/migrations/phase4_social_feed.sql
# Tables: provider_posts, provider_post_likes
# All endpoints fail gracefully with 503 if tables are missing.
# ====================================================================

class ReportAdminUpdate(BaseModel):
    status: Optional[str] = None     # 'pending' | 'under_review' | 'resolved' | 'dismissed'
    admin_notes: Optional[str] = None
    resolved_by_auth_id: Optional[str] = None


class ShopServiceAdminUpdate(BaseModel):
    is_active: Optional[bool] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    action: Optional[str] = None  # 'approve' | 'unapprove' | 'hide' | 'restore'
    stock: Optional[int] = None

# Models
class FeedPostCreate(BaseModel):
    image_url: str = Field(..., min_length=1)
    caption: Optional[str] = Field(None, max_length=2000)

    @validator("image_url")
    def _val_image_url(cls, v):
        if not v:
            raise ValueError("image_url is required")
        # Accept http(s) URLs or data URLs (base64 inline images). Reject anything else
        # to avoid accidentally storing JS / other schemes.
        v = v.strip()
        if v.startswith("http://") or v.startswith("https://") or v.startswith("data:image/"):
            # Soft size cap on data URLs to keep DB sane (~ 6 MB raw → ~8MB base64).
            if v.startswith("data:image/") and len(v) > 9_000_000:
                raise ValueError("image too large (data URL > ~6MB)")
            return v
        raise ValueError("image_url must be http(s) or a data:image URL")


class FeedPostUpdate(BaseModel):
    caption: Optional[str] = Field(None, max_length=2000)
    is_active: Optional[bool] = None


def _require_feed_tables():
    """Fail gracefully (503) if the social-feed tables are missing."""
    if not check_table_exists("provider_posts"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Social feed not enabled. Run migration phase4_social_feed.sql in Supabase."
        )


async def _get_user_by_auth_id(auth_id: str) -> Optional[dict]:
    """Helper to load a users row by auth_id (UUID). Returns None on failure."""
    try:
        res = supabase.table("users").select("id, auth_id, name, role").eq("auth_id", auth_id).limit(1).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass
    return None


def _enrich_post(post: dict, viewer_auth_id: Optional[str] = None) -> dict:
    """Attach provider info + viewer-specific liked flag to a post row."""
    enriched = dict(post)
    provider_id = post.get("provider_id")
    provider_auth_id = post.get("provider_auth_id")

    # Provider name / photo from users + stylists tables (best-effort)
    provider_name = None
    provider_photo = None
    provider_business_name = None
    provider_type = None
    provider_city = None
    try:
        if provider_auth_id:
            u_res = supabase.table("users").select(
                "id, name, city, country"
            ).eq("auth_id", provider_auth_id).limit(1).execute()
            if u_res.data:
                provider_name = u_res.data[0].get("name")
                provider_city = u_res.data[0].get("city")
                # capture int id for stylists lookup if we don't have it
                if not provider_id:
                    provider_id = u_res.data[0].get("id")
        if provider_id:
            s_res = supabase.table("stylists").select(
                "user_id, business_name, provider_type, photo_url"
            ).eq("user_id", provider_id).limit(1).execute()
            if s_res.data:
                provider_business_name = s_res.data[0].get("business_name")
                provider_type = s_res.data[0].get("provider_type")
                provider_photo = s_res.data[0].get("photo_url")
    except Exception as ex:
        logging.warning(f"_enrich_post lookup failed for post {post.get('id')}: {ex}")

    display_name = provider_business_name if (provider_type == "business" and provider_business_name) else provider_name
    enriched["provider"] = {
        "id": provider_id,
        "auth_id": provider_auth_id,
        "name": provider_name,
        "business_name": provider_business_name,
        "provider_type": provider_type,
        "photo_url": provider_photo,
        "city": provider_city,
        "display_name": display_name or "Provider",
    }

    # Has the viewer liked this post?
    enriched["liked_by_me"] = False
    if viewer_auth_id and check_table_exists("provider_post_likes"):
        try:
            like_res = supabase.table("provider_post_likes").select("id").eq(
                "post_id", post["id"]
            ).eq("user_auth_id", viewer_auth_id).limit(1).execute()
            enriched["liked_by_me"] = bool(like_res.data)
        except Exception:
            pass

    return enriched


@api_router.post("/feed/posts", status_code=status.HTTP_201_CREATED)
async def create_feed_post(
    payload: FeedPostCreate,
    auth_id: str = Query(..., description="Provider auth_id (UUID)")
):
    """Create a feed post. Only providers (role='stylist') may post."""
    _require_feed_tables()
    user = await _get_user_by_auth_id(auth_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found for auth_id")
    if user.get("role") != "stylist":
        raise HTTPException(status_code=403, detail="Only providers can create feed posts")

    try:
        row = {
            "provider_id": user["id"],
            "provider_auth_id": auth_id,
            "caption": (payload.caption or "").strip() or None,
            "image_url": payload.image_url,
            "likes_count": 0,
            "comments_count": 0,
            "is_active": True,
        }
        res = supabase.table("provider_posts").insert(row).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create post")
        return _enrich_post(res.data[0], viewer_auth_id=auth_id)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"create_feed_post failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create post: {e}")


@api_router.get("/feed/posts")
async def list_feed_posts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    auth_id: Optional[str] = Query(None, description="Viewer auth_id (used to compute liked_by_me)"),
    provider_id: Optional[int] = Query(None, description="Filter to a single provider"),
):
    """Public feed listing, newest first. Inactive posts excluded."""
    logging.info("[route-entered] GET /api/feed/posts limit=%s offset=%s provider_id=%s", limit, offset, provider_id)
    _require_feed_tables()
    try:
        q = supabase.table("provider_posts").select("*", count="exact").eq("is_active", True)
        if provider_id is not None:
            q = q.eq("provider_id", provider_id)
        q = q.order("created_at", desc=True).range(offset, offset + limit - 1)
        res = q.execute()
        posts = res.data or []
        enriched = [_enrich_post(p, viewer_auth_id=auth_id) for p in posts]
        return {
            "posts": enriched,
            "total": res.count if res.count is not None else len(enriched),
            "limit": limit,
            "offset": offset,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"list_feed_posts failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list posts: {e}")


@api_router.get("/feed/posts/by-provider/{provider_id}")
async def list_feed_posts_by_provider(
    provider_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    auth_id: Optional[str] = Query(None),
):
    """Posts for a single provider (for the portfolio section on profile)."""
    _require_feed_tables()
    try:
        res = supabase.table("provider_posts").select("*", count="exact").eq(
            "provider_id", provider_id
        ).eq("is_active", True).order("created_at", desc=True).range(
            offset, offset + limit - 1
        ).execute()
        posts = res.data or []
        enriched = [_enrich_post(p, viewer_auth_id=auth_id) for p in posts]
        return {
            "posts": enriched,
            "total": res.count if res.count is not None else len(enriched),
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logging.error(f"list_feed_posts_by_provider failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list posts: {e}")


@api_router.get("/feed/posts/{post_id}")
async def get_feed_post(
    post_id: int,
    auth_id: Optional[str] = Query(None)
):
    _require_feed_tables()
    try:
        res = supabase.table("provider_posts").select("*").eq("id", post_id).limit(1).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Post not found")
        post = res.data[0]
        if not post.get("is_active", True):
            raise HTTPException(status_code=404, detail="Post not found")
        return _enrich_post(post, viewer_auth_id=auth_id)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"get_feed_post failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get post: {e}")


@api_router.put("/feed/posts/{post_id}")
async def update_feed_post(
    post_id: int,
    payload: FeedPostUpdate,
    auth_id: str = Query(..., description="Owner auth_id (UUID)")
):
    """Update caption / soft-delete (is_active=False). Owner only."""
    _require_feed_tables()
    res = supabase.table("provider_posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if post.get("provider_auth_id") != auth_id:
        raise HTTPException(status_code=403, detail="You do not own this post")
    try:
        update_data = {k: v for k, v in payload.dict(exclude_unset=True).items()}
        if not update_data:
            return _enrich_post(post, viewer_auth_id=auth_id)
        upd = supabase.table("provider_posts").update(update_data).eq("id", post_id).execute()
        if not upd.data:
            raise HTTPException(status_code=500, detail="Failed to update post")
        return _enrich_post(upd.data[0], viewer_auth_id=auth_id)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"update_feed_post failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update post: {e}")


@api_router.delete("/feed/posts/{post_id}")
async def delete_feed_post(
    post_id: int,
    auth_id: str = Query(..., description="Owner auth_id (UUID)"),
    hard: bool = Query(False)
):
    """Soft-delete by default (is_active=False). Pass hard=true to fully delete."""
    _require_feed_tables()
    res = supabase.table("provider_posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if post.get("provider_auth_id") != auth_id:
        raise HTTPException(status_code=403, detail="You do not own this post")
    try:
        if hard:
            # Cleanup likes first (no FK constraint, but keeps things tidy)
            try:
                supabase.table("provider_post_likes").delete().eq("post_id", post_id).execute()
            except Exception:
                pass
            supabase.table("provider_posts").delete().eq("id", post_id).execute()
            return {"success": True, "hard_deleted": True}
        supabase.table("provider_posts").update({"is_active": False}).eq("id", post_id).execute()
        return {"success": True, "hard_deleted": False}
    except Exception as e:
        logging.error(f"delete_feed_post failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete post: {e}")


@api_router.post("/feed/posts/{post_id}/like")
async def like_feed_post(
    post_id: int,
    auth_id: str = Query(..., description="Liker auth_id (UUID)")
):
    """Like a post. Idempotent — repeated calls keep state at 'liked' without
    inflating the count."""
    _require_feed_tables()
    if not check_table_exists("provider_post_likes"):
        raise HTTPException(status_code=503, detail="provider_post_likes table missing - run migration.")

    # Validate post exists & active
    post_res = supabase.table("provider_posts").select("id, likes_count, is_active").eq("id", post_id).limit(1).execute()
    if not post_res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = post_res.data[0]
    if not post.get("is_active", True):
        raise HTTPException(status_code=404, detail="Post not found")

    try:
        # Idempotency check
        existing = supabase.table("provider_post_likes").select("id").eq(
            "post_id", post_id
        ).eq("user_auth_id", auth_id).limit(1).execute()
        if existing.data:
            return {
                "liked": True,
                "post_id": post_id,
                "likes_count": post.get("likes_count", 0),
                "already": True,
            }

        # Insert like (unique index will prevent dupes under race)
        try:
            supabase.table("provider_post_likes").insert({
                "post_id": post_id,
                "user_auth_id": auth_id,
            }).execute()
        except Exception as ex:
            # Duplicate (unique violation) → treat as already liked
            if "duplicate" in str(ex).lower() or "unique" in str(ex).lower() or "23505" in str(ex):
                return {
                    "liked": True,
                    "post_id": post_id,
                    "likes_count": post.get("likes_count", 0),
                    "already": True,
                }
            raise

        # Increment counter (best-effort)
        new_count = (post.get("likes_count") or 0) + 1
        try:
            supabase.table("provider_posts").update({"likes_count": new_count}).eq("id", post_id).execute()
        except Exception as ex:
            logging.warning(f"likes_count update failed for post {post_id}: {ex}")
        return {"liked": True, "post_id": post_id, "likes_count": new_count, "already": False}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"like_feed_post failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to like post: {e}")


@api_router.delete("/feed/posts/{post_id}/like")
async def unlike_feed_post(
    post_id: int,
    auth_id: str = Query(..., description="Liker auth_id (UUID)")
):
    """Remove a like. Idempotent — returns liked=False whether or not a like existed."""
    _require_feed_tables()
    if not check_table_exists("provider_post_likes"):
        raise HTTPException(status_code=503, detail="provider_post_likes table missing - run migration.")

    try:
        existing = supabase.table("provider_post_likes").select("id").eq(
            "post_id", post_id
        ).eq("user_auth_id", auth_id).limit(1).execute()
        if not existing.data:
            # Already not liked
            post_res = supabase.table("provider_posts").select("likes_count").eq("id", post_id).limit(1).execute()
            cnt = (post_res.data or [{}])[0].get("likes_count", 0) if post_res.data else 0
            return {"liked": False, "post_id": post_id, "likes_count": cnt, "already": True}

        supabase.table("provider_post_likes").delete().eq(
            "post_id", post_id
        ).eq("user_auth_id", auth_id).execute()

        # Decrement counter (best-effort, never below 0)
        post_res = supabase.table("provider_posts").select("likes_count").eq("id", post_id).limit(1).execute()
        if post_res.data:
            cnt = max(0, (post_res.data[0].get("likes_count") or 0) - 1)
            try:
                supabase.table("provider_posts").update({"likes_count": cnt}).eq("id", post_id).execute()
            except Exception:
                pass
        else:
            cnt = 0
        return {"liked": False, "post_id": post_id, "likes_count": cnt, "already": False}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"unlike_feed_post failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to unlike post: {e}")


# ====================================================================
# END PHASE 4 - SOCIAL FEED LITE
# ====================================================================


# ====================================================================
# PHASE 4 - ADMIN DASHBOARD FOUNDATION
# ====================================================================
# Lightweight operational admin endpoints. Protected by X-ADMIN-KEY header
# (same as existing admin/withdrawals endpoints). All endpoints degrade
# gracefully if optional tables are missing.
# ====================================================================

def _require_admin_key(x_admin_key: Optional[str]):
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin service not configured. ADMIN_DASH_KEY is missing."
        )
    if not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin key"
        )


def _safe_count(table: str, filters: Optional[List[tuple]] = None) -> int:
    """Return COUNT of rows in `table`. Returns 0 if table missing or any error."""
    try:
        if not check_table_exists(table):
            return 0
        q = supabase.table(table).select("id", count="exact").limit(1)
        if filters:
            for col, val in filters:
                q = q.eq(col, val)
        res = q.execute()
        return res.count or 0
    except Exception as ex:
        logging.warning(f"_safe_count({table}) failed: {ex}")
        return 0


def _safe_sum_amount(table: str, column: str, filters: Optional[List[tuple]] = None) -> float:
    """Sum a numeric column with eq filters. 0.0 on any error."""
    try:
        if not check_table_exists(table):
            return 0.0
        q = supabase.table(table).select(column)
        if filters:
            for col, val in filters:
                q = q.eq(col, val)
        res = q.execute()
        total = 0.0
        for row in (res.data or []):
            v = row.get(column)
            if v is None:
                continue
            try:
                total += float(v)
            except Exception:
                continue
        return round(total, 2)
    except Exception as ex:
        logging.warning(f"_safe_sum_amount({table}.{column}) failed: {ex}")
        return 0.0


@api_router.get("/admin/stats")
async def admin_stats(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY")
):
    """High-level platform stats for the admin dashboard."""
    _require_admin_key(x_admin_key)

    total_users = _safe_count("users")
    total_providers = _safe_count("users", filters=[("role", "stylist")])
    total_bookings = _safe_count("bookings")
    completed_bookings = _safe_count("bookings", filters=[("status", "completed")])
    pending_bookings = _safe_count("bookings", filters=[("status", "pending")])
    confirmed_bookings = _safe_count("bookings", filters=[("status", "confirmed")])
    canceled_bookings = _safe_count("bookings", filters=[("status", "canceled")])
    pending_withdrawals = _safe_count("withdrawal_requests", filters=[("status", "pending")])

    # Total escrow held = sum of wallets.escrow_balance (provider side)
    total_escrow = _safe_sum_amount("wallets", "escrow_balance")
    total_available = _safe_sum_amount("wallets", "available_balance")

    # Pending withdrawal amount (best-effort, treats missing column as 0)
    pending_withdrawal_amount = _safe_sum_amount(
        "withdrawal_requests", "amount", filters=[("status", "pending")]
    )

    # Feed metrics (lite, only if migration applied)
    total_posts = _safe_count("provider_posts", filters=[("is_active", True)])

    # Reviews (only if Phase 3 migration applied)
    total_reviews = _safe_count("reviews")

    return {
        "users": {
            "total": total_users,
            "providers": total_providers,
            "customers": max(0, total_users - total_providers),
        },
        "bookings": {
            "total": total_bookings,
            "pending": pending_bookings,
            "confirmed": confirmed_bookings,
            "completed": completed_bookings,
            "canceled": canceled_bookings,
        },
        "wallets": {
            "total_escrow": total_escrow,
            "total_available": total_available,
        },
        "withdrawals": {
            "pending_count": pending_withdrawals,
            "pending_amount": pending_withdrawal_amount,
        },
        "feed": {
            "total_active_posts": total_posts,
        },
        "reviews": {
            "total": total_reviews,
        },
    }


@api_router.get("/admin/recent-bookings")
async def admin_recent_bookings(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """Most recent bookings with light enrichment (provider+customer display names)."""
    _require_admin_key(x_admin_key)
    if not check_table_exists("bookings"):
        return {"bookings": [], "total": 0}

    try:
        q = supabase.table("bookings").select("*", count="exact")
        if status_filter:
            q = q.eq("status", status_filter)
        res = q.order("created_at", desc=True).limit(limit).execute()
        items = res.data or []

        # Light enrichment: fetch user names by auth_id in bulk
        auth_ids = set()
        for b in items:
            if b.get("provider_auth_id"):
                auth_ids.add(b["provider_auth_id"])
            if b.get("customer_auth_id"):
                auth_ids.add(b["customer_auth_id"])
        name_map = {}
        if auth_ids:
            try:
                u_res = supabase.table("users").select("auth_id, name").in_(
                    "auth_id", list(auth_ids)
                ).execute()
                for u in (u_res.data or []):
                    name_map[u["auth_id"]] = u.get("name")
            except Exception:
                pass

        out = []
        for b in items:
            out.append({
                **b,
                "provider_name": name_map.get(b.get("provider_auth_id")),
                "customer_name": name_map.get(b.get("customer_auth_id")),
            })
        return {"bookings": out, "total": res.count or len(out)}
    except Exception as e:
        logging.error(f"admin_recent_bookings failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed: {e}")


@api_router.get("/admin/recent-payments")
async def admin_recent_payments(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    limit: int = Query(20, ge=1, le=100),
):
    """Most recent payments (wallet top-ups + booking payments)."""
    _require_admin_key(x_admin_key)
    if not check_table_exists("payments"):
        return {"payments": [], "total": 0, "note": "payments table not present"}
    try:
        res = supabase.table("payments").select("*", count="exact").order(
            "created_at", desc=True
        ).limit(limit).execute()
        return {"payments": res.data or [], "total": res.count or len(res.data or [])}
    except Exception as e:
        logging.error(f"admin_recent_payments failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed: {e}")


@api_router.get("/admin/feed-posts")
async def admin_list_feed_posts(
    status_filter: Optional[str] = Query("all", alias="status_filter", description="Filter by active/inactive/all"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
):
    """Admin: list social feed posts for moderation."""
    _require_admin_key(x_admin_key)
    _require_feed_tables()
    if status_filter not in {"all", "active", "inactive"}:
        raise HTTPException(status_code=400, detail="status_filter must be one of ['all', 'active', 'inactive']")
    try:
        q = supabase.table("provider_posts").select("*", count="exact").order("created_at", desc=True).range(offset, offset + limit - 1)
        if status_filter == "active":
            q = q.eq("is_active", True)
        elif status_filter == "inactive":
            q = q.eq("is_active", False)
        res = q.execute()
        posts = res.data or []
        enriched = [_enrich_post(p) for p in posts]
        return {"posts": enriched, "total": res.count or len(enriched), "limit": limit, "offset": offset}
    except Exception as e:
        logging.error(f"admin_feed_posts failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list feed posts: {e}")


@api_router.put("/admin/feed-posts/{post_id}")
async def admin_update_feed_post(
    post_id: int,
    body: FeedPostUpdate,
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
):
    """Admin: update feed post moderation fields."""
    _require_admin_key(x_admin_key)
    _require_feed_tables()
    res = supabase.table("provider_posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Feed post not found")
    update_data = {k: v for k, v in body.dict(exclude_unset=True).items()}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    try:
        updated = supabase.table("provider_posts").update(update_data).eq("id", post_id).execute()
        if not updated.data:
            raise HTTPException(status_code=500, detail="Failed to update feed post")
        return _enrich_post(updated.data[0])
    except Exception as e:
        logging.error(f"admin_update_feed_post failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update feed post: {e}")


@api_router.get("/admin/shop-services")
async def admin_list_shop_services(
    status_filter: Optional[str] = Query("all", alias="status_filter", description="Filter by active/inactive/all"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
):
    """Admin: list marketplace products for shop moderation (reads from `products`)."""
    _require_admin_key(x_admin_key)
    if not check_table_exists("products"):
        raise HTTPException(status_code=503, detail="Products table not provisioned.")
    if status_filter not in {"all", "active", "inactive"}:
        raise HTTPException(status_code=400, detail="status_filter must be one of ['all', 'active', 'inactive']")
    try:
        res = supabase.table("products").select("*", count="exact").order("id", desc=True).range(offset, offset + limit - 1).execute()
        products = [parse_product_record(item) for item in (res.data or [])]
        if status_filter == "active":
            products = [p for p in products if p["is_active"]]
        elif status_filter == "inactive":
            products = [p for p in products if not p["is_active"]]

        seller_ids = [p["seller_id"] for p in products if p.get("seller_id")]
        seller_names = {}
        if seller_ids:
            try:
                users_res = supabase.table("users").select("id,name").in_("id", seller_ids).execute()
                for u in (users_res.data or []):
                    seller_names[u["id"]] = u.get("name")
            except Exception:
                pass

        enriched = [
            {
                **p,
                "seller_name": seller_names.get(p.get("seller_id")) or None,
            }
            for p in products
        ]
        return {"services": enriched, "total": res.count or len(enriched), "limit": limit, "offset": offset}
    except Exception as e:
        logging.error(f"admin_shop_services failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list shop services: {e}")


@api_router.put("/admin/shop-services/{service_id}")
async def admin_update_shop_service(
    service_id: int,
    body: ShopServiceAdminUpdate,
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
):
    """Admin: update marketplace product metadata or perform moderation actions (approve/hide/etc)."""
    _require_admin_key(x_admin_key)
    if not check_table_exists("products"):
        raise HTTPException(status_code=503, detail="Products table not provisioned.")
    existing = supabase.table("products").select("*").eq("id", service_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Product not found")
    current = parse_product_record(existing.data[0])
    update_data = {}

    # Administrative action shortcuts
    if body.action:
        act = body.action.lower()
        if act == "approve":
            update_data["approved"] = True
        elif act == "unapprove":
            update_data["approved"] = False
        elif act == "hide":
            update_data["approved"] = False
        elif act == "restore":
            update_data["approved"] = True
        else:
            raise HTTPException(status_code=400, detail="Unknown action")

    # Field updates
    if body.price is not None:
        update_data["price"] = body.price
    if body.description is not None:
        update_data["description"] = body.description
    if body.stock is not None:
        update_data["stock"] = body.stock
    if body.is_active is not None:
        update_data["approved"] = body.is_active

    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")

    try:
        updated = supabase.table("products").update(update_data).eq("id", service_id).execute()
        if not updated.data:
            raise HTTPException(status_code=500, detail="Failed to update product")
        return parse_product_record(updated.data[0])
    except Exception as e:
        logging.error(f"admin_update_shop_service failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update shop service: {e}")


@api_router.get("/admin/reported-no-shows")
async def admin_reported_no_shows(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    limit: int = Query(20, ge=1, le=100),
):
    """No-show disputes / reports. Reuses bookings table with no-show statuses."""
    _require_admin_key(x_admin_key)
    if not check_table_exists("bookings"):
        return {"items": [], "total": 0}
    no_show_statuses = [
        STATUS_NO_SHOW_PENDING,
        STATUS_USER_NO_SHOW,
        STATUS_PROVIDER_NO_SHOW,
        STATUS_DISPUTED,
    ]
    try:
        # Filter to any no-show-related status, newest first
        res = supabase.table("bookings").select("*", count="exact").in_(
            "status", no_show_statuses
        ).order("created_at", desc=True).limit(limit).execute()
        items = res.data or []

        # Light enrichment - names
        auth_ids = set()
        for b in items:
            if b.get("provider_auth_id"):
                auth_ids.add(b["provider_auth_id"])
            if b.get("customer_auth_id"):
                auth_ids.add(b["customer_auth_id"])
        name_map = {}
        if auth_ids:
            try:
                u_res = supabase.table("users").select("auth_id, name").in_(
                    "auth_id", list(auth_ids)
                ).execute()
                for u in (u_res.data or []):
                    name_map[u["auth_id"]] = u.get("name")
            except Exception:
                pass
        out = []
        for b in items:
            out.append({
                **b,
                "provider_name": name_map.get(b.get("provider_auth_id")),
                "customer_name": name_map.get(b.get("customer_auth_id")),
            })
        return {"items": out, "total": res.count or len(out)}
    except Exception as e:
        logging.error(f"admin_reported_no_shows failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed: {e}")


@api_router.get("/admin/providers")
async def admin_list_providers(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Name fragment"),
):
    """Paginated list of providers with stylists join (best-effort)."""
    _require_admin_key(x_admin_key)
    if not check_table_exists("users"):
        return {"providers": [], "total": 0}
    try:
        q = supabase.table("users").select("*", count="exact").eq("role", "stylist")
        if search:
            q = q.ilike("name", f"%{search}%")
        q = q.order("id", desc=True).range(offset, offset + limit - 1)
        res = q.execute()
        users = res.data or []

        # Attach stylists data
        user_ids = [u["id"] for u in users]
        stylists_map = {}
        if user_ids and check_table_exists("stylists"):
            try:
                s_res = supabase.table("stylists").select("*").in_("user_id", user_ids).execute()
                for s in (s_res.data or []):
                    stylists_map[s["user_id"]] = s
            except Exception:
                pass

        out = []
        for u in users:
            s = stylists_map.get(u["id"], {})
            out.append({
                "id": u.get("id"),
                "auth_id": u.get("auth_id"),
                "name": u.get("name"),
                "email": u.get("email"),
                "phone": u.get("phone"),
                "city": u.get("city"),
                "country": u.get("country"),
                "created_at": u.get("created_at"),
                "is_verified": s.get("is_verified"),
                "is_premium": s.get("is_premium"),
                "provider_type": s.get("provider_type"),
                "business_name": s.get("business_name"),
                "hourly_rate": s.get("hourly_rate"),
                "rating": s.get("rating"),
            })
        return {
            "providers": out,
            "total": res.count or len(out),
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logging.error(f"admin_list_providers failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed: {e}")


# ====================================================================
# END PHASE 4 - ADMIN DASHBOARD FOUNDATION
# ====================================================================




# ==================== PHASE 8 LEAN - TRUST, SAFETY, REPORTS, SUPPORT =====

class ReportCreate(BaseModel):
    reporter_auth_id: str
    target_type: str       # 'provider' | 'customer' | 'post' | 'review' | 'chat'
    target_id: str
    reason: str            # one of REPORT_REASONS
    description: Optional[str] = None


class SupportTicketCreate(BaseModel):
    user_auth_id: Optional[str] = None  # may be null for guest submissions
    name: str
    email: EmailStr
    category: str
    subject: str
    message: str


REPORT_REASONS = {
    "spam", "scam_fraud", "harassment", "impersonation", "hate_speech",
    "inappropriate_content", "copyright_violation", "fake_profile", "other",
}
REPORT_TARGET_TYPES = {"provider", "customer", "post", "review", "chat"}
REPORT_STATUSES = {"pending", "under_review", "resolved", "dismissed"}
SUPPORT_CATEGORIES = {
    "account", "booking", "payment", "provider", "technical_issue",
    "abuse_report", "other",
}


# ----- Legal pages (public) ----------------------------------------------

@api_router.get("/legal/{slug}")
async def get_legal_page(slug: str):
    """Public: fetch a legal page by slug. Guests can read."""
    try:
        res = supabase.table("legal_pages").select("*").eq("slug", slug).limit(1).execute()
    except Exception as e:
        msg = str(e).lower()
        if "legal_pages" in msg or "does not exist" in msg or "could not find the table" in msg:
            raise HTTPException(
                status_code=503,
                detail="Legal pages not provisioned. Apply phase8_lean_trust_safety.sql migration.",
            )
        logging.error(f"[legal] fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    if not res.data:
        raise HTTPException(status_code=404, detail=f"Legal page '{slug}' not found")
    return res.data[0]


@api_router.get("/legal")
async def list_legal_pages():
    """Public: list available legal page slugs + titles."""
    try:
        res = supabase.table("legal_pages").select("slug,title,updated_at").order("slug").execute()
        return {"pages": res.data or []}
    except Exception as e:
        msg = str(e).lower()
        if "legal_pages" in msg:
            return {"pages": []}
        raise HTTPException(status_code=500, detail=str(e))


# ----- Reports -----------------------------------------------------------

@api_router.post("/reports", status_code=status.HTTP_201_CREATED)
async def create_report(body: ReportCreate):
    """Authenticated users submit a report on a provider/customer/post/review/chat."""
    if body.target_type not in REPORT_TARGET_TYPES:
        raise HTTPException(status_code=400, detail=f"target_type must be one of {sorted(REPORT_TARGET_TYPES)}")
    if body.reason not in REPORT_REASONS:
        raise HTTPException(status_code=400, detail=f"reason must be one of {sorted(REPORT_REASONS)}")
    if not body.target_id or not str(body.target_id).strip():
        raise HTTPException(status_code=400, detail="target_id is required")
    if not body.reporter_auth_id or not body.reporter_auth_id.strip():
        raise HTTPException(status_code=400, detail="reporter_auth_id is required (login required)")

    payload = {
        "reporter_auth_id": body.reporter_auth_id,
        "target_type": body.target_type,
        "target_id": str(body.target_id),
        "reason": body.reason,
        "description": (body.description or "").strip() or None,
        "status": "pending",
    }
    try:
        res = supabase.table("reports").insert(payload).execute()
    except Exception as e:
        msg = str(e).lower()
        if "reports" in msg and ("does not exist" in msg or "could not find the table" in msg):
            raise HTTPException(
                status_code=503,
                detail="Reports table not provisioned. Apply phase8_lean_trust_safety.sql migration.",
            )
        logging.error(f"[reports] insert failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "report_id": res.data[0]["id"] if res.data else None}


@api_router.get("/admin/reports")
async def admin_list_reports(
    status_filter: Optional[str] = None,
    target_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    x_admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY"),
):
    """Admin: list reports with status/target filters."""
    admin_dash_key = os.environ.get("ADMIN_DASH_KEY", "")
    if not x_admin_key or x_admin_key != admin_dash_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
    try:
        q = supabase.table("reports").select("*", count="exact")
        if status_filter:
            if status_filter not in REPORT_STATUSES:
                raise HTTPException(status_code=400, detail=f"status_filter must be one of {sorted(REPORT_STATUSES)}")
            q = q.eq("status", status_filter)
        if target_type:
            if target_type not in REPORT_TARGET_TYPES:
                raise HTTPException(status_code=400, detail=f"target_type must be one of {sorted(REPORT_TARGET_TYPES)}")
            q = q.eq("target_type", target_type)
        q = q.order("created_at", desc=True).range(offset, offset + limit - 1)
        res = q.execute()
        return {"reports": res.data or [], "total": res.count or 0, "limit": limit, "offset": offset}
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        if "reports" in msg and ("does not exist" in msg or "could not find the table" in msg):
            raise HTTPException(
                status_code=503,
                detail="Reports table not provisioned. Apply phase8_lean_trust_safety.sql migration.",
            )
        logging.error(f"[admin/reports] failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/admin/reports/{report_id}")
async def admin_update_report(
    report_id: int,
    body: ReportAdminUpdate,
    x_admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY"),
):
    """Admin: update report status / notes."""
    admin_dash_key = os.environ.get("ADMIN_DASH_KEY", "")
    if not x_admin_key or x_admin_key != admin_dash_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
    update: dict = {}
    if body.status is not None:
        if body.status not in REPORT_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {sorted(REPORT_STATUSES)}")
        update["status"] = body.status
        if body.status in ("resolved", "dismissed"):
            update["resolved_at"] = datetime.now(timezone.utc).isoformat()
            if body.resolved_by_auth_id:
                update["resolved_by"] = body.resolved_by_auth_id
    if body.admin_notes is not None:
        update["admin_notes"] = body.admin_notes.strip() or None
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    try:
        res = supabase.table("reports").update(update).eq("id", report_id).execute()
    except Exception as e:
        logging.error(f"[admin/reports] update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True, "report": res.data[0]}


# ----- Support tickets ---------------------------------------------------

@api_router.post("/support/tickets", status_code=status.HTTP_201_CREATED)
async def create_support_ticket(body: SupportTicketCreate):
    """Submit a support ticket. user_auth_id is optional (guests allowed)."""
    if body.category not in SUPPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {sorted(SUPPORT_CATEGORIES)}")
    for field, val in (("name", body.name), ("subject", body.subject), ("message", body.message)):
        if not val or not str(val).strip():
            raise HTTPException(status_code=400, detail=f"{field} is required")
    payload = {
        "user_auth_id": body.user_auth_id,
        "name": body.name.strip(),
        "email": str(body.email),
        "category": body.category,
        "subject": body.subject.strip(),
        "message": body.message.strip(),
        "status": "open",
    }
    try:
        res = supabase.table("support_tickets").insert(payload).execute()
    except Exception as e:
        msg = str(e).lower()
        if "support_tickets" in msg and ("does not exist" in msg or "could not find the table" in msg):
            raise HTTPException(
                status_code=503,
                detail="Support tickets table not provisioned. Apply phase8_lean_trust_safety.sql migration.",
            )
        logging.error(f"[support] insert failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "ticket_id": res.data[0]["id"] if res.data else None}


# ============================================================================
# PHASE 9 - PRE-LAUNCH COMPLETION
# ============================================================================

# ==================== MODELS - Phase 9 ====================

class NoShowDisputeResolution(BaseModel):
    """Admin resolution for disputed no-show"""
    booking_id: int
    resolution: str  # "favor_customer", "favor_provider", "split", "dismiss"
    admin_notes: Optional[str] = None

class PlatformEarningsResponse(BaseModel):
    """Platform revenue metrics"""
    total_revenue: float
    revenue_today: float
    revenue_this_month: float
    booking_fees_earned: float
    withdrawal_fees_earned: float
    pending_payouts: float
    completed_payouts: float

class SupportTicketUpdate(BaseModel):
    """Admin update for support ticket"""
    status: Optional[str] = None  # open, pending, resolved, closed
    admin_notes: Optional[str] = None
    admin_reply: Optional[str] = None

class CopyrightComplaintCreate(BaseModel):
    """Copyright complaint submission"""
    complainant_name: str
    complainant_email: EmailStr
    complaint_type: str  # content, profile_photo, post, service_image
    target_type: str     # post, user, service, review
    target_id: str
    target_url: Optional[str] = None
    original_work_description: str
    proof_of_ownership: Optional[str] = None
    infringing_content_description: str
    good_faith_statement: str
    accuracy_statement: str
    electronic_signature: str

class CopyrightComplaintUpdate(BaseModel):
    """Admin update for copyright complaint"""
    status: Optional[str] = None  # pending, under_review, action_taken, dismissed, escalated
    admin_notes: Optional[str] = None
    action_taken: Optional[str] = None

class LegalPageUpdate(BaseModel):
    """Admin update for legal page content"""
    content: str


# ==================== TASK 1: NO-SHOW DISPUTE RESOLUTION ====================

@api_router.post("/admin/no-show/resolve")
async def admin_resolve_no_show_dispute(
    body: NoShowDisputeResolution,
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
):
    """
    Admin manually resolves a disputed no-show.
    Protected by X-ADMIN-KEY.
    """
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key or not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    # Fetch booking
    try:
        booking_resp = supabase.table("bookings").select("*").eq("id", body.booking_id).single().execute()
        booking = booking_resp.data
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
    except Exception as e:
        logging.error(f"[admin] dispute resolve fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch booking")

    # Must be disputed or no_show_pending
    if booking.get("status") not in [STATUS_DISPUTED, STATUS_NO_SHOW_PENDING]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resolve booking with status '{booking.get('status')}'"
        )

    # Determine new status and escrow action
    resolution = body.resolution
    new_status = None
    escrow_action = None
    
    if resolution == "favor_customer":
        new_status = STATUS_USER_NO_SHOW  # Provider no-showed
        escrow_action = "refund"
    elif resolution == "favor_provider":
        new_status = STATUS_PROVIDER_NO_SHOW  # Customer no-showed
        escrow_action = "release"
    elif resolution == "split":
        # Split: refund half to customer, release half to provider
        # For now, we'll release to provider (can be enhanced later)
        new_status = "resolved_split"
        escrow_action = "split"
    elif resolution == "dismiss":
        # Dismiss dispute, restore to confirmed
        new_status = "confirmed"
        escrow_action = None
    else:
        raise HTTPException(status_code=400, detail="Invalid resolution type")

    # Update booking
    try:
        update_data = {
            "status": new_status,
            "dispute_opened": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if body.admin_notes:
            update_data["admin_notes"] = body.admin_notes[:1000]

        supabase.table("bookings").update(update_data).eq("id", body.booking_id).execute()
    except Exception as e:
        logging.error(f"[admin] dispute resolution update failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update booking")

    # Handle escrow
    if escrow_action == "refund":
        # Refund to customer
        try:
            await _refund_escrow_to_customer(booking)
        except Exception as e:
            logging.error(f"[admin] refund failed: {e}")
    elif escrow_action == "release":
        # Release to provider
        try:
            await _release_escrow_to_provider(booking)
        except Exception as e:
            logging.error(f"[admin] release failed: {e}")
    elif escrow_action == "split":
        # TODO: Implement split logic (50/50)
        logging.info(f"[admin] split resolution for booking {body.booking_id} - not implemented yet")

    # Create notifications
    try:
        create_notification(
            user_auth_id=booking.get("customer_auth_id"),
            notification_type="dispute_resolved",
            title="Dispute Resolved",
            message=f"Admin has resolved the dispute for booking #{body.booking_id}. Resolution: {resolution}.",
            metadata={"booking_id": body.booking_id, "resolution": resolution}
        )
        create_notification(
            user_auth_id=booking.get("provider_id"),
            notification_type="dispute_resolved",
            title="Dispute Resolved",
            message=f"Admin has resolved the dispute for booking #{body.booking_id}. Resolution: {resolution}.",
            metadata={"booking_id": body.booking_id, "resolution": resolution}
        )
    except Exception as e:
        logging.warning(f"[admin] notification failed: {e}")

    return {
        "success": True,
        "booking_id": body.booking_id,
        "new_status": new_status,
        "resolution": resolution
    }


# ==================== TASK 2: PLATFORM EARNINGS DASHBOARD ====================

@api_router.get("/admin/platform-earnings")
async def admin_platform_earnings(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
):
    """
    Admin dashboard for platform revenue metrics.
    Protected by X-ADMIN-KEY.
    """
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key or not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        # Fetch all withdrawal requests for fee calculation
        withdrawals_resp = supabase.table("withdrawal_requests").select(
            "gross_amount, fee_amount, net_amount, status, created_at"
        ).execute()
        withdrawals = withdrawals_resp.data or []

        # Calculate withdrawal fees
        total_withdrawal_fees = sum(
            float(w.get("fee_amount") or 0)
            for w in withdrawals
            if w.get("status") in ["approved", "pending"]
        )
        
        pending_payouts = sum(
            float(w.get("gross_amount") or 0)
            for w in withdrawals
            if w.get("status") == "pending"
        )
        
        completed_payouts = sum(
            float(w.get("gross_amount") or 0)
            for w in withdrawals
            if w.get("status") == "approved"
        )

        # Fetch all bookings for platform fees (graceful fallback if migration not applied)
        booking_fees_earned = 0
        try:
            bookings_resp = supabase.table("bookings").select(
                "platform_fee_amount, created_at"
            ).execute()
            bookings = bookings_resp.data or []
            
            booking_fees_earned = sum(
                float(b.get("platform_fee_amount") or 0)
                for b in bookings
            )
        except Exception as booking_err:
            # Graceful fallback if platform_fee_amount column doesn't exist yet
            logging.warning(f"[admin] platform fees column missing (apply phase9 migration): {booking_err}")
            booking_fees_earned = 0

        # Calculate totals
        total_revenue = booking_fees_earned + total_withdrawal_fees

        # Today's revenue
        revenue_today = sum(
            float(w.get("fee_amount") or 0)
            for w in withdrawals
            if w.get("created_at") and w.get("created_at") >= today_start.isoformat()
        )

        # This month's revenue
        revenue_this_month = sum(
            float(w.get("fee_amount") or 0)
            for w in withdrawals
            if w.get("created_at") and w.get("created_at") >= month_start.isoformat()
        )

        return {
            "total_revenue": round(total_revenue, 2),
            "revenue_today": round(revenue_today, 2),
            "revenue_this_month": round(revenue_this_month, 2),
            "booking_fees_earned": round(booking_fees_earned, 2),
            "withdrawal_fees_earned": round(total_withdrawal_fees, 2),
            "pending_payouts": round(pending_payouts, 2),
            "completed_payouts": round(completed_payouts, 2),
        }

    except Exception as e:
        logging.error(f"[admin] platform earnings failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch platform earnings: {str(e)}")


# ==================== TASK 3: ADMIN SUPPORT DASHBOARD ====================

@api_router.get("/admin/support/tickets")
async def admin_list_support_tickets(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    status: Optional[str] = Query(None, description="Filter by status: open, pending, resolved, closed"),
):
    """
    Admin dashboard for support tickets.
    Protected by X-ADMIN-KEY.
    """
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key or not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    try:
        query = supabase.table("support_tickets").select("*").order("created_at", desc=True).limit(200)
        
        if status:
            query = query.eq("status", status)
        
        resp = query.execute()
        tickets = resp.data or []

        return {
            "count": len(tickets),
            "tickets": tickets
        }

    except Exception as e:
        logging.error(f"[admin] support tickets list failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch support tickets: {str(e)}")


@api_router.put("/admin/support/tickets/{ticket_id}")
async def admin_update_support_ticket(
    ticket_id: int,
    body: SupportTicketUpdate,
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    auth_id: str = Query(..., description="Admin auth_id"),
):
    """
    Admin updates support ticket (status, reply, notes).
    Protected by X-ADMIN-KEY.
    """
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key or not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    # Fetch ticket
    try:
        ticket_resp = supabase.table("support_tickets").select("*").eq("id", ticket_id).single().execute()
        ticket = ticket_resp.data
        if not ticket:
            raise HTTPException(status_code=404, detail="Support ticket not found")
    except Exception as e:
        logging.error(f"[admin] support ticket fetch failed: {e}")
        raise HTTPException(status_code=404, detail="Support ticket not found")

    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if body.status:
        update_data["status"] = body.status
        if body.status == "resolved":
            update_data["resolved_by"] = auth_id
            update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
    
    if body.admin_notes:
        update_data["admin_notes"] = body.admin_notes
    
    if body.admin_reply:
        update_data["admin_reply"] = body.admin_reply
        update_data["replied_by"] = auth_id
        update_data["replied_at"] = datetime.now(timezone.utc).isoformat()

    # Update ticket
    try:
        supabase.table("support_tickets").update(update_data).eq("id", ticket_id).execute()
    except Exception as e:
        logging.error(f"[admin] support ticket update failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update support ticket")

    # Send notification if user provided auth_id
    if ticket.get("auth_id") and body.admin_reply:
        try:
            create_notification(
                user_auth_id=ticket.get("auth_id"),
                notification_type="support_reply",
                title="Support Team Replied",
                message=f"Your support ticket #{ticket_id} has a new reply from our team.",
                metadata={"ticket_id": ticket_id}
            )
        except Exception as e:
            logging.warning(f"[admin] support notification failed: {e}")

    # Queue email notification
    _queue_email_notification(
        email_type="support_reply",
        recipient_email=ticket.get("email"),
        recipient_auth_id=ticket.get("auth_id"),
        subject=f"Support Ticket #{ticket_id} - Response from iStylist",
        body=body.admin_reply or "Your support ticket has been updated.",
        metadata={"ticket_id": ticket_id}
    )

    return {"success": True, "ticket_id": ticket_id}


# ==================== TASK 4: COPYRIGHT COMPLAINT SYSTEM ====================

@api_router.post("/copyright/report")
async def submit_copyright_complaint(
    body: CopyrightComplaintCreate,
    auth_id: Optional[str] = Query(None, description="Optional auth_id if logged in"),
):
    """
    Submit a copyright complaint (DMCA-style).
    Public endpoint but supports optional auth.
    """
    # Validate complaint type
    valid_types = ["content", "profile_photo", "post", "service_image"]
    if body.complaint_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid complaint_type. Must be one of: {valid_types}")

    # Validate target type
    valid_targets = ["post", "user", "service", "review"]
    if body.target_type not in valid_targets:
        raise HTTPException(status_code=400, detail=f"Invalid target_type. Must be one of: {valid_targets}")

    # Insert complaint
    try:
        insert_data = {
            "complainant_name": body.complainant_name[:255],
            "complainant_email": body.complainant_email[:255],
            "complainant_auth_id": auth_id,
            "complaint_type": body.complaint_type,
            "target_type": body.target_type,
            "target_id": body.target_id[:50],
            "target_url": body.target_url,
            "original_work_description": body.original_work_description,
            "proof_of_ownership": body.proof_of_ownership,
            "infringing_content_description": body.infringing_content_description,
            "good_faith_statement": body.good_faith_statement,
            "accuracy_statement": body.accuracy_statement,
            "electronic_signature": body.electronic_signature[:255],
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        resp = supabase.table("copyright_complaints").insert(insert_data).execute()
        complaint = resp.data[0] if resp.data else None

        if not complaint:
            raise HTTPException(status_code=500, detail="Failed to create copyright complaint")

        # Queue email to admin
        _queue_email_notification(
            email_type="copyright_complaint",
            recipient_email=os.environ.get("ADMIN_EMAIL", "admin@istylist.com"),
            recipient_auth_id=None,
            subject=f"New Copyright Complaint #{complaint['id']}",
            body=f"A new copyright complaint has been submitted by {body.complainant_name}.",
            metadata={"complaint_id": complaint['id']}
        )

        return {
            "success": True,
            "complaint_id": complaint['id'],
            "message": "Copyright complaint submitted successfully. We will review it within 24-48 hours."
        }

    except Exception as e:
        logging.error(f"[copyright] complaint submission failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit copyright complaint: {str(e)}")


@api_router.get("/admin/copyright/complaints")
async def admin_list_copyright_complaints(
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    """
    Admin dashboard for copyright complaints.
    Protected by X-ADMIN-KEY.
    """
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key or not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    try:
        query = supabase.table("copyright_complaints").select("*").order("created_at", desc=True).limit(200)
        
        if status:
            query = query.eq("status", status)
        
        resp = query.execute()
        complaints = resp.data or []

        return {
            "count": len(complaints),
            "complaints": complaints
        }

    except Exception as e:
        logging.error(f"[admin] copyright complaints list failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch copyright complaints: {str(e)}")


@api_router.put("/admin/copyright/complaints/{complaint_id}")
async def admin_update_copyright_complaint(
    complaint_id: int,
    body: CopyrightComplaintUpdate,
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
    auth_id: str = Query(..., description="Admin auth_id"),
):
    """
    Admin reviews and updates copyright complaint.
    Protected by X-ADMIN-KEY.
    """
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key or not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    # Fetch complaint
    try:
        complaint_resp = supabase.table("copyright_complaints").select("*").eq("id", complaint_id).single().execute()
        complaint = complaint_resp.data
        if not complaint:
            raise HTTPException(status_code=404, detail="Copyright complaint not found")
    except Exception as e:
        logging.error(f"[admin] copyright complaint fetch failed: {e}")
        raise HTTPException(status_code=404, detail="Copyright complaint not found")

    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if body.status:
        update_data["status"] = body.status
        update_data["reviewed_by"] = auth_id
        update_data["reviewed_at"] = datetime.now(timezone.utc).isoformat()
    
    if body.admin_notes:
        update_data["admin_notes"] = body.admin_notes
    
    if body.action_taken:
        update_data["action_taken"] = body.action_taken

    # Update complaint
    try:
        supabase.table("copyright_complaints").update(update_data).eq("id", complaint_id).execute()
    except Exception as e:
        logging.error(f"[admin] copyright complaint update failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update copyright complaint")

    # Send notification to complainant
    if complaint.get("complainant_auth_id"):
        try:
            create_notification(
                user_auth_id=complaint.get("complainant_auth_id"),
                notification_type="copyright_reviewed",
                title="Copyright Complaint Reviewed",
                message=f"Your copyright complaint #{complaint_id} has been reviewed. Status: {body.status}",
                metadata={"complaint_id": complaint_id, "status": body.status}
            )
        except Exception as e:
            logging.warning(f"[admin] copyright notification failed: {e}")

    # Queue email
    _queue_email_notification(
        email_type="copyright_reviewed",
        recipient_email=complaint.get("complainant_email"),
        recipient_auth_id=complaint.get("complainant_auth_id"),
        subject=f"Copyright Complaint #{complaint_id} - Update",
        body=f"Your copyright complaint has been reviewed. Status: {body.status}. {body.action_taken or ''}",
        metadata={"complaint_id": complaint_id}
    )

    return {"success": True, "complaint_id": complaint_id}


# ==================== TASK 5: ADMIN LEGAL PAGE EDITOR ====================

@api_router.put("/admin/legal/{slug}")
async def admin_update_legal_page(
    slug: str,
    body: LegalPageUpdate,
    x_admin_key: str = Header(None, alias="X-ADMIN-KEY"),
):
    """
    Admin updates legal page content.
    Protected by X-ADMIN-KEY.
    """
    admin_key = os.environ.get("ADMIN_DASH_KEY")
    if not admin_key or not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    # Validate slug
    valid_slugs = ["privacy", "terms", "community-guidelines", "refund-policy"]
    if slug not in valid_slugs:
        raise HTTPException(status_code=400, detail=f"Invalid slug. Must be one of: {valid_slugs}")

    # Update legal page
    try:
        update_data = {
            "content": body.content,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
        
        resp = supabase.table("legal_pages").update(update_data).eq("slug", slug).execute()
        
        if not resp.data:
            raise HTTPException(status_code=404, detail=f"Legal page '{slug}' not found")

        return {
            "success": True,
            "slug": slug,
            "message": "Legal page updated successfully"
        }

    except Exception as e:
        logging.error(f"[admin] legal page update failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update legal page: {str(e)}")


# ==================== TASK 6: EMAIL NOTIFICATION QUEUE ====================

def _queue_email_notification(
    email_type: str,
    recipient_email: str,
    subject: str,
    body: str,
    recipient_auth_id: Optional[str] = None,
    metadata: Optional[Dict] = None,
    html_body: Optional[str] = None,
):
    """
    Queue an email notification for async sending.
    This is a helper function - actual email sending would be done by a worker process.
    """
    try:
        insert_data = {
            "email_type": email_type,
            "recipient_email": recipient_email[:255],
            "recipient_auth_id": recipient_auth_id,
            "subject": subject[:255],
            "body": body,
            "html_body": html_body,
            "metadata": metadata,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        
        supabase.table("email_notifications").insert(insert_data).execute()
        logging.info(f"[email] queued {email_type} to {recipient_email}")
    except Exception as e:
        logging.error(f"[email] failed to queue notification: {e}")


# Enhanced notification hooks for email
def create_notification_with_email(
    user_auth_id: str,
    notification_type: str,
    title: str,
    message: str,
    metadata: Optional[Dict] = None,
):
    """
    Create in-app notification AND queue email for important events.
    """
    # Create in-app notification
    create_notification(user_auth_id, notification_type, title, message, metadata)
    
    # Fetch user email
    try:
        user_resp = supabase.table("users").select("email, name").eq("auth_id", user_auth_id).single().execute()
        user = user_resp.data
        
        if user and user.get("email"):
            # Queue email for specific notification types
            email_types = [
                "support_reply",
                "report_reviewed",
                "kyc_approved",
                "kyc_rejected",
                "dispute_opened",
                "dispute_resolved",
            ]
            
            if notification_type in email_types:
                _queue_email_notification(
                    email_type=notification_type,
                    recipient_email=user["email"],
                    recipient_auth_id=user_auth_id,
                    subject=title,
                    body=message,
                    metadata=metadata
                )
    except Exception as e:
        logging.warning(f"[email] failed to queue email for notification: {e}")


# Include the router in the main app
try:
    # Phase 5 - register KYC routes onto api_router before include
    try:
        from kyc_routes import register_kyc_routes
        register_kyc_routes(api_router, supabase, os.environ.get("ADMIN_DASH_KEY", ""))
        logging.info("[startup] KYC routes registered")
    except Exception as _ke:
        import traceback as _kt
        logging.warning("[startup] KYC routes NOT registered: %s\n%s", _ke, _kt.format_exc())

    app.include_router(api_router)
    logging.info("[startup] api_router included successfully (%d routes)", len(api_router.routes))
except Exception as _e:
    import traceback as _tb
    logging.error("[startup] FAILED to include api_router: %s\n%s", _e, _tb.format_exc())
    raise

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================================================================
# DIAGNOSTIC ENDPOINTS + GLOBAL EXCEPTION HANDLER
# Added for Railway 502 root-cause investigation. Safe, additive only.
# ====================================================================
import traceback as _diag_tb
from fastapi import Request as _DiagRequest
from fastapi.responses import JSONResponse as _DiagJSONResponse

@app.get("/health")
async def diag_health():
    """Lightweight liveness probe. No DB, no auth."""
    return {"status": "ok"}

@app.get("/debug/env")
async def diag_env():
    """Reports presence (not values) of critical env vars. Never returns secrets."""
    return {
        "supabase_url_present": bool(os.environ.get("SUPABASE_URL")),
        "supabase_key_present": bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY")),
        "cors_origins_present": bool(os.environ.get("CORS_ORIGINS")),
        "port_env": os.environ.get("PORT"),
    }

@app.exception_handler(Exception)
async def diag_global_exception_handler(request: _DiagRequest, exc: Exception):
    """Catches any unhandled exception and emits the full traceback to logs.
    Routes that already raise HTTPException are NOT affected (FastAPI handles
    those before reaching this handler)."""
    tb_str = _diag_tb.format_exc()
    logging.error(
        "[unhandled_exception] path=%s method=%s type=%s msg=%s\n%s",
        request.url.path, request.method, type(exc).__name__, str(exc), tb_str,
    )
    return _DiagJSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
        },
    )

# Startup port + env diagnostic - prints once at boot so Railway logs show
# exactly what uvicorn bound to vs what $PORT contained.
@app.on_event("startup")
async def diag_startup_env_dump():
    logging.info(
        "[startup-diag] PORT=%r SUPABASE_URL_present=%s SUPABASE_KEY_present=%s CORS_ORIGINS=%r",
        os.environ.get("PORT"),
        bool(os.environ.get("SUPABASE_URL")),
        bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY")),
        os.environ.get("CORS_ORIGINS"),
    )
# ====================================================================

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ====================================================================
# APSCHEDULER - lightweight in-app reminder automation
# ====================================================================
# Runs scan_and_create_reminders() every 5 minutes.
# coalesce=True: if multiple runs are missed (e.g., during restart), only one
#   make-up run is executed.
# max_instances=1: never run two scans concurrently.
# misfire_grace_time: still run within grace if job was delayed.

_reminder_scheduler = None


@app.on_event("startup")
async def _start_reminder_scheduler():
    """Start APScheduler on app startup. Reminder job runs every 5 minutes."""
    global _reminder_scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        if _reminder_scheduler is not None:
            logger.info("[reminder_scheduler] already running, skipping start")
            return

        scheduler = AsyncIOScheduler(timezone="Africa/Lagos")
        # Run booking reminders every 5 minutes
        scheduler.add_job(
            scan_and_create_reminders,
            "interval",
            minutes=5,
            args=[supabase, create_notification],
            id="booking_reminders_job",
            coalesce=True,
            max_instances=1,
            misfire_grace_time=300,
            replace_existing=True,
        )
        # Run no-show finalization every 5 minutes (lightweight, idempotent)
        scheduler.add_job(
            finalize_expired_no_shows,
            "interval",
            minutes=5,
            args=[supabase, _release_escrow_to_provider, _refund_escrow_to_customer, create_notification],
            id="no_show_finalize_job",
            coalesce=True,
            max_instances=1,
            misfire_grace_time=300,
            replace_existing=True,
        )
        scheduler.start()
        _reminder_scheduler = scheduler
        logger.info("[scheduler] started - booking reminders + no-show finalization (every 5 min)")
    except Exception as e:
        logger.warning(f"[reminder_scheduler] failed to start: {e}")


@app.on_event("shutdown")
async def _stop_reminder_scheduler():
    """Stop APScheduler cleanly on shutdown."""
    global _reminder_scheduler
    try:
        if _reminder_scheduler is not None:
            _reminder_scheduler.shutdown(wait=False)
            _reminder_scheduler = None
            logger.info("[reminder_scheduler] stopped")
    except Exception as e:
        logger.warning(f"[reminder_scheduler] error during shutdown: {e}")
