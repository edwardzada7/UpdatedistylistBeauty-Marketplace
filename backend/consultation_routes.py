"""Certification, shared conversation, consultation, and invoice routes.

This module is intentionally additive. Booking chat and the existing shop and
payment routes remain owned by server.py; service invoice settlement delegates
to those existing routes.
"""
from __future__ import annotations

import hmac
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ProviderCertificationInput(BaseModel):
    specialty: str = Field(min_length=1)
    certification_name: str = Field(min_length=1)
    certificate_url: str = Field(min_length=1)
    expiry_date: Optional[str] = None


class ConsultationSettingsInput(BaseModel):
    enabled: bool = False
    consultation_fee: Optional[float] = Field(default=None, gt=0)
    description: Optional[str] = None
    currency: str = "NGN"


class AdminCertificationRejectionInput(BaseModel):
    rejection_reason: str = Field(min_length=1)


class InquiryInput(BaseModel):
    provider_auth_id: str
    product_id: Optional[int] = None
    product_name: Optional[str] = None


class ConsultationInput(BaseModel):
    provider_auth_id: str
    specialty: Optional[str] = None
    fee: Optional[float] = Field(default=None, gt=0)
    currency: str = "NGN"


class ActivateConsultationInput(BaseModel):
    payment_reference: str
    transaction_id: Optional[str] = None


class SendConversationMessageInput(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    message_type: str = "text"
    location_data: Optional[Dict[str, Any]] = None
    invoice_data: Optional[Dict[str, Any]] = None
    recommendation_data: Optional[Dict[str, Any]] = None


class ProviderRecommendationInput(BaseModel):
    recommended_provider_auth_id: str
    message: str = ""


class InvoiceItemInput(BaseModel):
    service_id: Optional[int] = None
    product_id: Optional[int] = None
    quantity: int = Field(default=1, gt=0)


class CreateInvoiceInput(BaseModel):
    conversation_id: int
    customer_auth_id: str
    provider_auth_id: str
    invoice_type: str
    amount: float = Field(gt=0)
    service_date: Optional[str] = None
    service_time: Optional[str] = None
    location: Optional[str] = None
    service_type: Optional[str] = None
    staff_id: Optional[int] = None
    note: Optional[str] = None
    items: List[InvoiceItemInput] = Field(min_items=1)


class PayServiceInvoiceInput(BaseModel):
    payment_reference: str
    transaction_id: Optional[str] = None


class CompleteProductInvoiceInput(BaseModel):
    order_id: int
    payment_reference: Optional[str] = None


def _headers() -> Dict[str, str]:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}


def _request(method: str, table: str, **kwargs: Any) -> List[dict]:
    try:
        response = requests.request(method, f"{os.environ['SUPABASE_URL']}/rest/v1/{table}", headers=_headers(), timeout=15, **kwargs)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Could not access {table}") from exc
    if response.status_code not in (200, 201, 204):
        logger.warning("Supabase %s %s failed: %s", method, table, response.text[:300])
        raise HTTPException(status_code=502, detail=f"Could not access {table}")
    return response.json() if response.content else []


def _current_auth_id(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        response = requests.get(
            f"{os.environ['SUPABASE_URL']}/auth/v1/user",
            headers={"Authorization": authorization, "apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"]},
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Authentication service unavailable") from exc
    if response.status_code != 200 or not response.json().get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return response.json()["id"]


def _admin_key(admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY")) -> None:
    configured = os.environ.get("ADMIN_DASH_KEY", "")
    if not configured or not admin_key or not hmac.compare_digest(admin_key, configured):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")


def _active_certification(row: dict) -> bool:
    if (row.get("status") or row.get("verification_status")) != "approved" or row.get("is_active") is not True:
        return False
    expiry = row.get("expiry_date") or row.get("expires_at")
    if not expiry:
        return True
    try:
        return datetime.fromisoformat(str(expiry).replace("Z", "+00:00")).date() >= datetime.utcnow().date()
    except ValueError:
        return False


def _participant(conversation_id: int, auth_id: str) -> dict:
    rows = _request("GET", "conversations", params={"id": f"eq.{conversation_id}", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conversation = rows[0]
    if auth_id not in (conversation.get("customer_auth_id"), conversation.get("provider_auth_id")):
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation")
    return conversation


def _provider_info(auth_id: str) -> dict:
    users = _request("GET", "users", params={"auth_id": f"eq.{auth_id}", "select": "*", "limit": "1"})
    stylists = _request("GET", "stylists", params={"auth_id": f"eq.{auth_id}", "select": "*", "limit": "1"})
    return {**(stylists[0] if stylists else {}), **(users[0] if users else {}), "auth_id": auth_id}


def _conversation(customer_auth_id: str, provider_auth_id: str, conversation_type: str) -> dict:
    rows = _request("GET", "conversations", params={"customer_auth_id": f"eq.{customer_auth_id}", "provider_auth_id": f"eq.{provider_auth_id}", "type": f"eq.{conversation_type}", "select": "*", "limit": "1"})
    if rows:
        return rows[0]
    created = _request("POST", "conversations", json={"customer_auth_id": customer_auth_id, "provider_auth_id": provider_auth_id, "type": conversation_type})
    return created[0]


def _consultation_eligibility(provider_auth_id: str) -> dict:
    certifications = _request("GET", "provider_certifications", params={"provider_auth_id": f"eq.{provider_auth_id}", "select": "*", "order": "created_at.desc", "limit": "20"})
    active = next((row for row in certifications if _active_certification(row)), None)
    settings = _request("GET", "provider_consultation_settings", params={"provider_auth_id": f"eq.{provider_auth_id}", "select": "*", "limit": "1"})
    setting = settings[0] if settings else {}
    return {"eligible": bool(active and setting.get("enabled") is True), "specialty": (active or {}).get("specialty") or setting.get("specialty"), "consultation_fee": setting.get("consultation_fee"), "currency": setting.get("currency") or "NGN"}


def send_shared_chat_message(conversation_id: int, auth_id: str, message: str, message_type: str = "text", location_data: Optional[Dict[str, Any]] = None, invoice_data: Optional[Dict[str, Any]] = None, recommendation_data: Optional[Dict[str, Any]] = None) -> dict:
    """Send a typed message through the existing generic chat endpoint."""
    conversation = _participant(conversation_id, auth_id)
    allowed_types = {"text", "image", "invoice", "provider_recommendation", "system"}
    if message_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported message type")
    if conversation.get("type") == "consultation" and not _request("GET", "consultations", params={"conversation_id": f"eq.{conversation_id}", "status": "eq.active", "select": "id", "limit": "1"}):
        raise HTTPException(status_code=403, detail="Consultation payment is required before chatting")
    receiver = conversation["provider_auth_id"] if auth_id == conversation["customer_auth_id"] else conversation["customer_auth_id"]
    content = message.strip()
    if message_type == "provider_recommendation":
        recommendation = recommendation_data or {}
        recommended = recommendation.get("recommended_provider_auth_id")
        if not recommended or recommended == auth_id or not _request("GET", "stylists", params={"auth_id": f"eq.{recommended}", "select": "auth_id", "limit": "1"}):
            raise HTTPException(status_code=400, detail="A valid different provider is required")
        recommendation_row = _request("POST", "provider_recommendations", json={"conversation_id": conversation_id, "sender_auth_id": auth_id, "recommended_provider_auth_id": recommended, "message": content})
        content = json.dumps({**recommendation, "recommendation_id": recommendation_row[0].get("id"), "message": content})
    return _request("POST", "chats", json={"conversation_id": conversation_id, "sender_auth_id": auth_id, "receiver_auth_id": receiver, "message": content, "message_type": message_type, "location_data": location_data, "invoice_data": invoice_data, "is_read": False, "read": False})[0]


def register_consultation_routes(api_router: APIRouter, supabase: Any) -> None:
    """Register additive routes on the production router."""
    @api_router.get("/providers/{provider_auth_id}/consultation-eligibility")
    def consultation_eligibility(provider_auth_id: str, authorization: Optional[str] = Header(None)):
        _current_auth_id(authorization)
        return _consultation_eligibility(provider_auth_id)

    @api_router.get("/providers/{provider_auth_id}/certification")
    def get_certification(provider_auth_id: str, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        if auth_id != provider_auth_id:
            raise HTTPException(status_code=403, detail="You can only view your own certification")
        rows = _request("GET", "provider_certifications", params={"provider_auth_id": f"eq.{auth_id}", "select": "*", "order": "created_at.desc", "limit": "1"})
        return {"certification": rows[0] if rows else None, "status": (rows[0].get("status") if rows else "not_submitted")}

    @api_router.post("/providers/{provider_auth_id}/certification")
    def submit_certification(provider_auth_id: str, payload: ProviderCertificationInput, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        if auth_id != provider_auth_id:
            raise HTTPException(status_code=403, detail="You can only submit your own certification")
        rows = _request("GET", "provider_certifications", params={"provider_auth_id": f"eq.{auth_id}", "select": "id,status", "order": "created_at.desc", "limit": "1"})
        data = {"provider_auth_id": auth_id, "specialty": payload.specialty.strip(), "certification_name": payload.certification_name.strip(), "certificate_url": payload.certificate_url, "expiry_date": payload.expiry_date, "status": "pending", "is_active": False, "rejection_reason": None, "verified_at": None}
        if rows and rows[0].get("status") == "approved":
            raise HTTPException(status_code=409, detail="Your certificate is already approved and active")
        return (_request("PATCH", "provider_certifications", params={"id": f"eq.{rows[0]['id']}"}, json=data) if rows else _request("POST", "provider_certifications", json=data))[0]

    @api_router.get("/providers/{provider_auth_id}/consultation-settings")
    def get_consultation_settings(provider_auth_id: str, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        if auth_id != provider_auth_id:
            raise HTTPException(status_code=403, detail="You can only view your own consultation settings")
        eligibility = _consultation_eligibility(auth_id)
        rows = _request("GET", "provider_consultation_settings", params={"provider_auth_id": f"eq.{auth_id}", "select": "*", "limit": "1"})
        return {**(rows[0] if rows else {}), "enabled": bool(rows and rows[0].get("enabled") and eligibility["eligible"]), "eligible": eligibility["eligible"], "specialty": eligibility["specialty"]}

    @api_router.patch("/providers/{provider_auth_id}/consultation-settings")
    def update_consultation_settings(provider_auth_id: str, payload: ConsultationSettingsInput, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        if auth_id != provider_auth_id:
            raise HTTPException(status_code=403, detail="You can only update your own consultation settings")
        eligibility = _consultation_eligibility(auth_id)
        if payload.enabled and not eligibility["eligible"]:
            certs = _request("GET", "provider_certifications", params={"provider_auth_id": f"eq.{auth_id}", "select": "*"})
            if not any(_active_certification(row) for row in certs):
                raise HTTPException(status_code=403, detail="An approved professional certification is required")
        if payload.enabled and payload.consultation_fee is None:
            raise HTTPException(status_code=400, detail="A consultation fee is required when enabled")
        data = {"provider_auth_id": auth_id, "enabled": payload.enabled, "consultation_fee": payload.consultation_fee, "description": (payload.description or "").strip() or None, "currency": payload.currency.upper()}
        rows = _request("GET", "provider_consultation_settings", params={"provider_auth_id": f"eq.{auth_id}", "select": "id", "limit": "1"})
        return (_request("PATCH", "provider_consultation_settings", params={"id": f"eq.{rows[0]['id']}"}, json=data) if rows else _request("POST", "provider_consultation_settings", json=data))[0]

    @api_router.post("/conversations/inquiry")
    def create_inquiry(payload: InquiryInput, authorization: Optional[str] = Header(None)):
        customer = _current_auth_id(authorization)
        if not _request("GET", "stylists", params={"auth_id": f"eq.{payload.provider_auth_id}", "select": "auth_id", "limit": "1"}):
            raise HTTPException(status_code=404, detail="Provider not found")
        if payload.product_id is not None and not _request("GET", "products", params={"id": f"eq.{payload.product_id}", "stylist_auth_id": f"eq.{payload.provider_auth_id}", "select": "id", "limit": "1"}):
            raise HTTPException(status_code=403, detail="That product does not belong to this provider")
        conversation = _conversation(customer, payload.provider_auth_id, "inquiry")
        if payload.product_id is not None:
            _request("POST", "chats", json={"conversation_id": conversation["id"], "sender_auth_id": customer, "receiver_auth_id": payload.provider_auth_id, "message": f"Product inquiry: {payload.product_name or f'Product #{payload.product_id}'} (product ID {payload.product_id})", "message_type": "text", "is_read": False, "read": False})
        return conversation

    @api_router.get("/conversations")
    def list_conversations(authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        rows = _request("GET", "conversations", params={"or": f"(customer_auth_id.eq.{auth_id},provider_auth_id.eq.{auth_id})", "select": "*", "order": "updated_at.desc"})
        for row in rows:
            messages = _request("GET", "chats", params={"conversation_id": f"eq.{row['id']}", "select": "*", "order": "created_at.desc", "limit": "1"})
            row["last_message"] = messages[0] if messages else None
        return rows

    @api_router.post("/consultations")
    def create_consultation(payload: ConsultationInput, authorization: Optional[str] = Header(None)):
        customer = _current_auth_id(authorization)
        eligibility = _consultation_eligibility(payload.provider_auth_id)
        if not eligibility["eligible"]:
            raise HTTPException(status_code=403, detail="This provider is not eligible for consultation")
        conversation = _conversation(customer, payload.provider_auth_id, "consultation")
        fee = payload.fee or eligibility["consultation_fee"]
        if fee is None:
            raise HTTPException(status_code=400, detail="Consultation fee is not configured")
        created = _request("POST", "consultations", json={"conversation_id": conversation["id"], "customer_auth_id": customer, "provider_auth_id": payload.provider_auth_id, "specialty": payload.specialty or eligibility["specialty"], "fee": fee, "currency": payload.currency, "payment_provider": "flutterwave", "payment_status": "pending", "status": "pending"})
        return {"conversation": conversation, "consultation": created[0]}

    @api_router.post("/consultations/{consultation_id}/activate")
    def activate_consultation(consultation_id: int, payload: ActivateConsultationInput, request: Request, authorization: Optional[str] = Header(None)):
        customer = _current_auth_id(authorization)
        rows = _request("GET", "consultations", params={"id": f"eq.{consultation_id}", "customer_auth_id": f"eq.{customer}", "status": "eq.pending", "select": "*", "limit": "1"})
        if not rows:
            raise HTTPException(status_code=404, detail="Consultation not found")
        verification_url = os.environ.get("BACKEND_PUBLIC_URL", "https://updatedistylistbeauty-marketplace-production.up.railway.app").rstrip("/") + "/api/payments/flutterwave/verify"
        verification = requests.get(verification_url, params={"reference": payload.payment_reference, "transaction_id": payload.transaction_id}, timeout=20)
        if verification.status_code != 200 or verification.json().get("status") != "success":
            raise HTTPException(status_code=402, detail="Payment could not be verified")
        now = datetime.utcnow().isoformat()
        updated = _request("PATCH", "consultations", params={"id": f"eq.{consultation_id}"}, json={"payment_status": "paid", "payment_reference": payload.payment_reference, "status": "active", "paid_at": now, "activated_at": now})
        return updated[0] if updated else {**rows[0], "status": "active", "payment_status": "paid"}

    @api_router.get("/conversations/{conversation_id}/messages")
    def get_messages(conversation_id: int, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        conversation = _participant(conversation_id, auth_id)
        return {"conversation": conversation, "messages": _request("GET", "chats", params={"conversation_id": f"eq.{conversation_id}", "select": "*", "order": "created_at.asc"})}

    @api_router.post("/conversations/{conversation_id}/messages")
    def send_message(conversation_id: int, payload: SendConversationMessageInput, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        conversation = _participant(conversation_id, auth_id)
        if payload.message_type not in {"text", "image", "invoice", "provider_recommendation", "system"}:
            raise HTTPException(status_code=400, detail="Unsupported message type")
        if conversation.get("type") == "consultation" and not _request("GET", "consultations", params={"conversation_id": f"eq.{conversation_id}", "status": "eq.active", "select": "id", "limit": "1"}):
            raise HTTPException(status_code=403, detail="Consultation payment is required before chatting")
        receiver = conversation["provider_auth_id"] if auth_id == conversation["customer_auth_id"] else conversation["customer_auth_id"]
        message = payload.message.strip()
        if payload.message_type == "provider_recommendation":
            recommendation = payload.recommendation_data or {}
            recommended = recommendation.get("recommended_provider_auth_id")
            if not recommended or recommended == auth_id or not _request("GET", "stylists", params={"auth_id": f"eq.{recommended}", "select": "auth_id", "limit": "1"}):
                raise HTTPException(status_code=400, detail="A valid different provider is required")
            recommendation_row = _request("POST", "provider_recommendations", json={"conversation_id": conversation_id, "sender_auth_id": auth_id, "recommended_provider_auth_id": recommended, "message": message})
            message = json.dumps({**recommendation, "recommendation_id": recommendation_row[0].get("id"), "message": message})
        data = {"conversation_id": conversation_id, "sender_auth_id": auth_id, "receiver_auth_id": receiver, "message": message, "message_type": payload.message_type, "location_data": payload.location_data, "invoice_data": payload.invoice_data, "is_read": False, "read": False}
        return _request("POST", "chats", json=data)[0]

    @api_router.get("/conversations/unread-count")
    def unread_count(authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        rows = _request("GET", "chats", params={"receiver_auth_id": f"eq.{auth_id}", "is_read": "eq.false", "select": "id"})
        return {"unreadCount": len(rows)}

    @api_router.post("/conversations/{conversation_id}/mark-read")
    def mark_read(conversation_id: int, conversation_type: Optional[str] = None, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        if conversation_type not in ("inquiry", "consultation"):
            raise HTTPException(status_code=400, detail="conversation_type is required")
        _participant(conversation_id, auth_id)
        updated = _request("PATCH", "chats", params={"conversation_id": f"eq.{conversation_id}", "receiver_auth_id": f"eq.{auth_id}", "is_read": "eq.false"}, json={"is_read": True, "read": True, "read_at": datetime.utcnow().isoformat()})
        return {"conversationId": conversation_id, "clearedCount": len(updated)}

    @api_router.post("/invoices")
    def create_invoice(payload: CreateInvoiceInput, authorization: Optional[str] = Header(None)):
        provider = _current_auth_id(authorization)
        if provider != payload.provider_auth_id or payload.invoice_type not in ("service", "product"):
            raise HTTPException(status_code=403, detail="Only the provider can create this invoice")
        conversation = _participant(payload.conversation_id, provider)
        if conversation["customer_auth_id"] != payload.customer_auth_id or conversation["provider_auth_id"] != provider:
            raise HTTPException(status_code=403, detail="Invoice participants do not match the conversation")
        if payload.invoice_type == "service":
            if len(payload.items) != 1 or not payload.items[0].service_id:
                raise HTTPException(status_code=400, detail="A provider service is required")
            stylist = _request("GET", "stylists", params={"auth_id": f"eq.{provider}", "select": "id", "limit": "1"})
            owned = _request("GET", "provider_services", params={"id": f"eq.{payload.items[0].service_id}", "provider_id": f"eq.{stylist[0]['id']}" if stylist else "eq.0", "is_active": "eq.true", "select": "id,price", "limit": "1"})
            if not owned or round(float(owned[0]["price"]), 2) != round(payload.amount, 2):
                raise HTTPException(status_code=400, detail="Invoice amount must match the selected service price")
            payment_provider = "flutterwave"
        else:
            payment_provider = "paystack"
            for item in payload.items:
                products = _request("GET", "products", params={"id": f"eq.{item.product_id}", "stylist_auth_id": f"eq.{provider}", "select": "id,price,stock", "limit": "1"})
                if not products or (products[0].get("stock") is not None and products[0]["stock"] < item.quantity):
                    raise HTTPException(status_code=400, detail="Product is unavailable or not sold by this provider")
        invoice = _request("POST", "invoices", json={"conversation_id": payload.conversation_id, "customer_auth_id": payload.customer_auth_id, "provider_auth_id": provider, "invoice_type": payload.invoice_type, "payment_provider": payment_provider, "amount": payload.amount, "status": "pending", "service_date": payload.service_date, "service_time": payload.service_time, "location": payload.location, "service_type": payload.service_type, "note": payload.note})[0]
        items = _request("POST", "invoice_items", json=[{"invoice_id": invoice["id"], "service_id": item.service_id, "product_id": item.product_id, "quantity": item.quantity} for item in payload.items])
        return {**invoice, "items": items}

    @api_router.get("/invoices/{invoice_id}")
    def get_invoice(invoice_id: int, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        rows = _request("GET", "invoices", params={"id": f"eq.{invoice_id}", "select": "*", "limit": "1"})
        if not rows or auth_id not in (rows[0].get("customer_auth_id"), rows[0].get("provider_auth_id")):
            raise HTTPException(status_code=403, detail="You cannot access this invoice")
        return {**rows[0], "items": _request("GET", "invoice_items", params={"invoice_id": f"eq.{invoice_id}", "select": "*"})}

    @api_router.post("/invoices/{invoice_id}/pay-service")
    def pay_service_invoice(invoice_id: int, payload: PayServiceInvoiceInput, request: Request, authorization: Optional[str] = Header(None)):
        customer = _current_auth_id(authorization)
        rows = _request("GET", "invoices", params={"id": f"eq.{invoice_id}", "invoice_type": "eq.service", "customer_auth_id": f"eq.{customer}", "status": "eq.pending", "select": "*", "limit": "1"})
        if not rows:
            raise HTTPException(status_code=404, detail="Pending service invoice not found")
        url = os.environ.get("BACKEND_PUBLIC_URL", "https://updatedistylistbeauty-marketplace-production.up.railway.app").rstrip("/") + "/api/payments/flutterwave/verify"
        verification = requests.get(url, params={"reference": payload.payment_reference, "transaction_id": payload.transaction_id}, timeout=20)
        if verification.status_code != 200 or verification.json().get("status") != "success":
            raise HTTPException(status_code=402, detail="Payment could not be verified")
        items = _request("GET", "invoice_items", params={"invoice_id": f"eq.{invoice_id}", "select": "service_id", "limit": "1"})
        provider = _request("GET", "stylists", params={"auth_id": f"eq.{rows[0]['provider_auth_id']}", "select": "id", "limit": "1"})
        if not items or not provider:
            raise HTTPException(status_code=400, detail="Invoice is missing its service or provider")
        booking_response = requests.post(os.environ.get("BACKEND_PUBLIC_URL", "https://updatedistylistbeauty-marketplace-production.up.railway.app").rstrip("/") + "/api/bookings", headers={"Content-Type": "application/json"}, json={"provider_id": provider[0]["id"], "customer_auth_id": customer, "service_ids": [items[0]["service_id"]], "booking_date": rows[0].get("service_date"), "booking_time": rows[0].get("service_time"), "total_amount": rows[0]["amount"], "payment_method": "FLUTTERWAVE", "notes": rows[0].get("note"), "status": "pending_payment"}, timeout=20)
        if booking_response.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail="Could not create booking")
        booking = booking_response.json()
        booking_id = booking.get("id") or booking.get("booking", {}).get("id")
        updated = _request("PATCH", "invoices", params={"id": f"eq.{invoice_id}"}, json={"status": "paid", "payment_reference": payload.payment_reference, "booking_id": booking_id})
        return {"invoice": updated[0] if updated else {**rows[0], "status": "paid"}, "booking": booking}

    @api_router.post("/invoices/{invoice_id}/complete-product")
    def complete_product_invoice(invoice_id: int, payload: CompleteProductInvoiceInput, authorization: Optional[str] = Header(None)):
        customer = _current_auth_id(authorization)
        rows = _request("GET", "invoices", params={"id": f"eq.{invoice_id}", "invoice_type": "eq.product", "customer_auth_id": f"eq.{customer}", "status": "eq.pending", "select": "*", "limit": "1"})
        if not rows:
            raise HTTPException(status_code=404, detail="Pending product invoice not found")
        order = _request("GET", "shop_orders", params={"id": f"eq.{payload.order_id}", "customer_auth_id": f"eq.{customer}", "select": "id,status,payment_reference", "limit": "1"})
        if not order:
            raise HTTPException(status_code=403, detail="Order does not belong to the customer")
        if payload.payment_reference:
            verification_url = os.environ.get("BACKEND_PUBLIC_URL", "https://updatedistylistbeauty-marketplace-production.up.railway.app").rstrip("/") + "/api/payments/paystack/shop/verify"
            verification = requests.get(verification_url, params={"reference": payload.payment_reference}, timeout=20)
            if verification.status_code != 200 or verification.json().get("status") != "success":
                raise HTTPException(status_code=402, detail="Paystack payment could not be verified")
        elif order[0].get("status") != "confirmed":
            raise HTTPException(status_code=402, detail="A confirmed Paystack shop order is required")
        updated = _request("PATCH", "invoices", params={"id": f"eq.{invoice_id}"}, json={"status": "paid", "payment_reference": payload.payment_reference, "order_id": payload.order_id})
        return {"status": "paid", "invoice_id": invoice_id, "order_id": payload.order_id, "invoice": updated[0] if updated else rows[0]}

    @api_router.get("/admin/certifications")
    def admin_certifications(status: Optional[str] = None, provider_auth_id: Optional[str] = None, _authorized: None = Depends(_admin_key)):
        rows = _request("GET", "provider_certifications", params={"select": "*", "order": "created_at.desc"})
        result = []
        for row in rows:
            if provider_auth_id and row.get("provider_auth_id") != provider_auth_id:
                continue
            row_status = "expired" if row.get("status") == "approved" and not _active_certification(row) else row.get("status", "pending")
            if status and status.lower() != row_status:
                continue
            result.append({**row, "provider": _provider_info(row["provider_auth_id"]), "verification_status": row_status})
        return {"certifications": result}

    @api_router.get("/admin/certifications/{certification_id}")
    def admin_certification(certification_id: int, _authorized: None = Depends(_admin_key)):
        rows = _request("GET", "provider_certifications", params={"id": f"eq.{certification_id}", "select": "*", "limit": "1"})
        if not rows:
            raise HTTPException(status_code=404, detail="Certificate not found")
        return {"certification": {**rows[0], "provider": _provider_info(rows[0]["provider_auth_id"])} }

    @api_router.post("/admin/certifications/{certification_id}/approve")
    def approve_certification(certification_id: int, _authorized: None = Depends(_admin_key)):
        rows = _request("PATCH", "provider_certifications", params={"id": f"eq.{certification_id}"}, json={"status": "approved", "is_active": True, "verified_at": datetime.utcnow().isoformat()})
        if not rows:
            raise HTTPException(status_code=404, detail="Certificate not found")
        return {"certification": rows[0]}

    @api_router.post("/admin/certifications/{certification_id}/reject")
    def reject_certification(certification_id: int, payload: AdminCertificationRejectionInput, _authorized: None = Depends(_admin_key)):
        rows = _request("PATCH", "provider_certifications", params={"id": f"eq.{certification_id}"}, json={"status": "rejected", "is_active": False, "rejection_reason": payload.rejection_reason.strip(), "verified_at": datetime.utcnow().isoformat()})
        if not rows:
            raise HTTPException(status_code=404, detail="Certificate not found")
        return {"certification": rows[0]}

    @api_router.get("/admin/consultations")
    def admin_consultations(_authorized: None = Depends(_admin_key)):
        return {"consultations": _request("GET", "provider_consultation_settings", params={"select": "*", "order": "updated_at.desc"})}

    @api_router.get("/admin/consultations/{provider_auth_id}")
    def admin_consultation(provider_auth_id: str, _authorized: None = Depends(_admin_key)):
        eligibility = _consultation_eligibility(provider_auth_id)
        return {"provider_auth_id": provider_auth_id, **eligibility}
