"""
Phase 5 - KYC submission + admin review endpoints.

Endpoints:
    POST   /api/kyc/submit                  - Create or update a KYC submission (user)
    GET    /api/kyc/me                      - Get current user's KYC submission + status
    GET    /api/admin/kyc                   - Admin: list submissions (filterable by status)
    PUT    /api/admin/kyc/{id}              - Admin: approve or reject a submission

File uploads use small base64 strings in JSON (max ~5MB per file). Files are stored
in the private 'kyc-documents' Supabase Storage bucket; signed URLs are returned.

Gracefully degrades to HTTP 503 if the phase5 migration hasn't been applied.
"""
from __future__ import annotations

import base64
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Router with /api prefix matches the app's main router convention
kyc_router = APIRouter(prefix="/api", tags=["kyc"])

# Maximum decoded file size (5MB) - keeps Lambda/Railway payload small
MAX_FILE_BYTES = 5 * 1024 * 1024

KYC_BUCKET = "kyc-documents"


# ----- Pydantic models ----------------------------------------------------

class KycFile(BaseModel):
    """A small file uploaded as base64 in JSON. Two fields: mime + data."""
    mime: str
    data: str  # base64-encoded bytes (no `data:` prefix expected)


class KycIndividualSubmit(BaseModel):
    full_name: str
    phone_number: str
    date_of_birth: str  # ISO date YYYY-MM-DD
    id_type: str
    id_number: str
    selfie: Optional[KycFile] = None
    id_doc: Optional[KycFile] = None


class KycBusinessSubmit(BaseModel):
    business_name: str
    registration_number: str
    business_address: str
    contact_person: str
    contact_phone: str
    cac_doc: Optional[KycFile] = None
    logo: Optional[KycFile] = None


class KycSubmitRequest(BaseModel):
    auth_id: str
    account_type: Literal["individual", "business"]
    individual: Optional[KycIndividualSubmit] = None
    business: Optional[KycBusinessSubmit] = None


class KycAdminAction(BaseModel):
    action: Literal["approve", "reject"]
    rejection_reason: Optional[str] = None
    reviewer_auth_id: Optional[str] = None


# ----- Helpers ------------------------------------------------------------

def _check_kyc_table(supabase) -> None:
    """Raise 503 if the kyc_submissions table doesn't exist (migration not run)."""
    try:
        supabase.table("kyc_submissions").select("id").limit(1).execute()
    except Exception as e:
        msg = str(e).lower()
        if "does not exist" in msg or "kyc_submissions" in msg:
            raise HTTPException(
                status_code=503,
                detail="KYC tables not provisioned. Apply phase5_account_types_kyc.sql migration in Supabase.",
            )
        raise


def _upload_file(supabase, auth_id: str, label: str, file_obj: Optional[KycFile]) -> Optional[str]:
    """Upload a base64 file to the kyc-documents bucket. Returns the storage path or None."""
    if not file_obj or not file_obj.data:
        return None
    try:
        raw = base64.b64decode(file_obj.data, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail=f"{label}: invalid base64 data")
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"{label}: file exceeds 5MB limit")
    ext = "jpg"
    mime = (file_obj.mime or "").lower()
    if "png" in mime:
        ext = "png"
    elif "pdf" in mime:
        ext = "pdf"
    elif "webp" in mime:
        ext = "webp"
    path = f"{auth_id}/{label}-{uuid.uuid4().hex[:8]}.{ext}"
    try:
        # Supabase Python client storage upload
        supabase.storage.from_(KYC_BUCKET).upload(
            path=path,
            file=raw,
            file_options={"content-type": file_obj.mime or f"image/{ext}", "upsert": "true"},
        )
    except Exception as e:
        logger.error("[kyc] storage upload failed for %s: %s", path, e)
        # If the bucket doesn't exist yet, surface a clean 503
        if "bucket" in str(e).lower() or "not found" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail="KYC storage bucket missing. Apply phase5 migration (creates 'kyc-documents' bucket).",
            )
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {e}")
    return path


def _signed_url(supabase, path: Optional[str], expires_in: int = 3600) -> Optional[str]:
    """Generate a short-lived signed URL for a private storage object."""
    if not path:
        return None
    try:
        res = supabase.storage.from_(KYC_BUCKET).create_signed_url(path, expires_in)
        # supabase-py returns {'signedURL': '...'} or {'signedUrl': '...'} depending on version
        return res.get("signedURL") or res.get("signedUrl") or res.get("signed_url")
    except Exception as e:
        logger.warning("[kyc] signed_url failed for %s: %s", path, e)
        return None


def _decorate_submission_with_urls(supabase, row: dict) -> dict:
    """Replace storage paths with signed URLs in the response."""
    for key in ("selfie_url", "id_doc_url", "cac_doc_url", "logo_url"):
        if row.get(key):
            row[key] = _signed_url(supabase, row[key])
    return row


# ----- Endpoint registration ---------------------------------------------

def register_kyc_routes(api_router, supabase, admin_dash_key: str, create_notification=None):
    """Attach KYC routes to the given api_router. Called from server.py after init."""

    @api_router.post("/kyc/submit", status_code=status.HTTP_201_CREATED)
    async def kyc_submit(req: KycSubmitRequest):
        _check_kyc_table(supabase)

        if req.account_type == "individual" and not req.individual:
            raise HTTPException(status_code=400, detail="individual payload required for individual account type")
        if req.account_type == "business" and not req.business:
            raise HTTPException(status_code=400, detail="business payload required for business account type")

        payload: dict = {
            "user_auth_id": req.auth_id,
            "account_type": req.account_type,
            "status": "pending",
            "rejection_reason": None,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": None,
            "reviewed_by_auth_id": None,
        }

        if req.account_type == "individual":
            i = req.individual
            payload.update({
                "full_name": i.full_name,
                "phone_number": i.phone_number,
                "date_of_birth": i.date_of_birth,
                "id_type": i.id_type,
                "id_number": i.id_number,
                "selfie_url": _upload_file(supabase, req.auth_id, "selfie", i.selfie),
                "id_doc_url": _upload_file(supabase, req.auth_id, "id", i.id_doc),
                # Clear business fields if a user is switching types
                "business_name": None, "registration_number": None,
                "business_address": None, "contact_person": None,
                "contact_phone": None, "cac_doc_url": None, "logo_url": None,
            })
        else:
            b = req.business
            payload.update({
                "business_name": b.business_name,
                "registration_number": b.registration_number,
                "business_address": b.business_address,
                "contact_person": b.contact_person,
                "contact_phone": b.contact_phone,
                "cac_doc_url": _upload_file(supabase, req.auth_id, "cac", b.cac_doc),
                "logo_url": _upload_file(supabase, req.auth_id, "logo", b.logo),
                # Clear individual fields
                "full_name": None, "phone_number": None, "date_of_birth": None,
                "id_type": None, "id_number": None,
                "selfie_url": None, "id_doc_url": None,
            })

        # Upsert by user_auth_id
        try:
            existing = supabase.table("kyc_submissions").select("id").eq("user_auth_id", req.auth_id).execute()
            if existing.data:
                supabase.table("kyc_submissions").update(payload).eq("user_auth_id", req.auth_id).execute()
            else:
                supabase.table("kyc_submissions").insert(payload).execute()
        except Exception as e:
            logger.error("[kyc] submit failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to save KYC submission: {e}")

        return {"ok": True, "status": "pending"}


    @api_router.get("/kyc/me")
    async def kyc_me(auth_id: str):
        _check_kyc_table(supabase)
        if not auth_id:
            raise HTTPException(status_code=400, detail="auth_id query param required")
        res = supabase.table("kyc_submissions").select("*").eq("user_auth_id", auth_id).limit(1).execute()
        if not res.data:
            return {"status": "not_submitted", "submission": None}
        row = _decorate_submission_with_urls(supabase, res.data[0])
        return {"status": row.get("status") or "not_submitted", "submission": row}


    @api_router.get("/admin/kyc")
    async def admin_list_kyc(
        status_filter: Optional[str] = None,
        limit: int = 50,
        x_admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY"),
    ):
        if not x_admin_key or x_admin_key != admin_dash_key:
            raise HTTPException(status_code=401, detail="Invalid or missing admin key")
        _check_kyc_table(supabase)

        q = supabase.table("kyc_submissions").select("*", count="exact")
        if status_filter:
            q = q.eq("status", status_filter)
        q = q.order("submitted_at", desc=True).limit(limit)
        res = q.execute()
        rows = [_decorate_submission_with_urls(supabase, r) for r in (res.data or [])]
        return {"submissions": rows, "total": res.count or len(rows)}


    @api_router.put("/admin/kyc/{submission_id}")
    async def admin_review_kyc(
        submission_id: int,
        body: KycAdminAction,
        x_admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY"),
    ):
        if not x_admin_key or x_admin_key != admin_dash_key:
            raise HTTPException(status_code=401, detail="Invalid or missing admin key")
        _check_kyc_table(supabase)

        existing = supabase.table("kyc_submissions").select("*").eq("id", submission_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="KYC submission not found")

        if body.action == "reject" and not (body.rejection_reason and body.rejection_reason.strip()):
            raise HTTPException(status_code=400, detail="rejection_reason is required when action='reject'")

        new_status = "verified" if body.action == "approve" else "rejected"
        update = {
            "status": new_status,
            "rejection_reason": body.rejection_reason if body.action == "reject" else None,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by_auth_id": body.reviewer_auth_id,
        }
        try:
            supabase.table("kyc_submissions").update(update).eq("id", submission_id).execute()
        except Exception as e:
            logger.error("[kyc] admin review failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to update KYC: {e}")

        # Phase 6 - notify the user about approval/rejection (uses existing
        # notification infrastructure; failures are swallowed by helper).
        if create_notification is not None:
            try:
                submission_row = existing.data[0]
                recipient = submission_row.get("user_auth_id")
                if body.action == "approve":
                    await create_notification(
                        recipient_auth_id=recipient,
                        notification_type="kyc_approved",
                        title="KYC Approved",
                        message="Your KYC verification has been approved.",
                        metadata={"submission_id": submission_id},
                    )
                else:
                    reason = (body.rejection_reason or "").strip()
                    msg = "Your KYC verification was rejected."
                    if reason:
                        msg = f"{msg} Reason: {reason}"
                    await create_notification(
                        recipient_auth_id=recipient,
                        notification_type="kyc_rejected",
                        title="KYC Rejected",
                        message=msg,
                        metadata={"submission_id": submission_id, "reason": reason or None},
                    )
            except Exception as ne:
                logger.warning("[kyc] notification dispatch failed (non-fatal): %s", ne)

        return {"ok": True, "status": new_status}
