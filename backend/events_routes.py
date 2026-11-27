"""Events + one-time-use tickets.

Flow: admin publishes an event with ticket types -> user buys (Paystack) or claims a free ticket ->
once payment is confirmed on the SERVER, one ticket per seat is created, each with its own secret QR
token and 6-digit PIN -> door staff scan the QR (or type the PIN); the first scan marks the ticket
used with a single atomic update, so a ticket can never be admitted twice.

Money: subtotal (ticket price) + optional service fee (add_on mode). Admin events are 100% platform.
For future provider events, `commission_percentage` is the platform's cut of the subtotal and the rest
is recorded as `organizer_payout` (paid out manually, like shop sellers).
Tables: migrations/phase37_events.sql.
"""
from __future__ import annotations

import io
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from consultation_routes import _admin_key, _current_auth_id
from email_service import email_configured, send_email

logger = logging.getLogger(__name__)

OFFICIAL_NAME = "iStylist Official"
REFERENCE_PREFIX = "istylist_evt_"
GUEST_MAX_PER_ORDER = 5
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
PENDING_HOLD_MINUTES = 30
DEFAULT_SETTINGS = {
    "service_fee_percentage": 0.0,   # % of the ticket subtotal charged as a service fee
    "service_fee_flat": 0.0,         # flat amount per paid ticket
    "commission_percentage": 7.0,    # platform cut on provider organised events
    "provider_trust_after_approved": 3.0,  # provider events skip review after this many approved events
}
PROMO_REFERENCE_PREFIX = "istylist_evpromo_"
DEFAULT_PROMO_TIERS = [
    {"days": 3, "price": 2000},
    {"days": 7, "price": 5000},
    {"days": 14, "price": 10000},
]
PAYOUT_HOLD_HOURS = 24

_FULFIL = {"fn": None}


def fulfil_event_reference(reference: str) -> bool:
    """Used by the Paystack webhook: confirm + issue tickets for an event order reference."""
    fn = _FULFIL.get("promo") if str(reference).startswith(PROMO_REFERENCE_PREFIX) else _FULFIL.get("fn")
    if not fn:
        return False
    try:
        fn(reference)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("event webhook fulfil failed for %s: %s", reference, exc)
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime] = None) -> str:
    return (dt or _now()).isoformat()


def _parse(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _paystack_headers() -> Optional[Dict[str, str]]:
    key = os.environ.get("PAYSTACK_SECRET_KEY")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"} if key else None


def _notify(auth_id: str, kind: str, title: str, message: str, metadata: Optional[dict] = None) -> None:
    try:
        from push_and_public import notify_user_sync

        notify_user_sync(auth_id, kind, title, message, metadata)
    except Exception as exc:  # noqa: BLE001 - best effort
        logger.warning("notify failed: %s", exc)


def qr_svg(data: str) -> Optional[str]:
    """Inline SVG for a QR code (pure Python, no image libraries). None if the package is missing."""
    try:
        import qrcode
        import qrcode.image.svg

        img = qrcode.make(data, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2)
        buf = io.BytesIO()
        img.save(buf)
        svg = buf.getvalue().decode("utf-8")
        svg = re.sub(r"^<\?xml[^>]*\?>\s*", "", svg)
        svg = re.sub(r'\s(width|height)="[^"]*"', "", svg, count=2)
        return svg
    except Exception as exc:  # noqa: BLE001
        logger.warning("QR generation unavailable: %s", exc)
        return None


class TicketTypeIn(BaseModel):
    id: Optional[int] = None
    name: str = Field(min_length=1, max_length=80)
    description: Optional[str] = Field(None, max_length=300)
    price: float = Field(ge=0)
    capacity: Optional[int] = Field(None, ge=1)
    max_per_order: int = Field(10, ge=1, le=50)
    sales_end: Optional[str] = None
    is_active: bool = True


class EventIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: Optional[str] = Field(None, max_length=5000)
    banner_url: Optional[str] = None
    venue: Optional[str] = Field(None, max_length=200)
    address: Optional[str] = Field(None, max_length=300)
    starts_at: str
    ends_at: Optional[str] = None
    status: str = Field("draft", pattern="^(draft|published)$")
    is_featured: bool = False
    fee_mode: str = Field("add_on", pattern="^(add_on|absorbed)$")
    ticket_types: List[TicketTypeIn] = Field(default_factory=list)
    announce_in_feed: bool = False


class SettingsIn(BaseModel):
    service_fee_percentage: Optional[float] = Field(None, ge=0, le=100)
    service_fee_flat: Optional[float] = Field(None, ge=0)
    commission_percentage: Optional[float] = Field(None, ge=0, le=100)
    provider_trust_after_approved: Optional[float] = Field(None, ge=0, le=100)


class CheckoutIn(BaseModel):
    ticket_type_id: int
    quantity: int = Field(ge=1, le=50)
    email: Optional[str] = None
    redirect_url: Optional[str] = None


class GuestCheckoutIn(BaseModel):
    ticket_type_id: int
    quantity: int = Field(ge=1, le=GUEST_MAX_PER_ORDER)
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=200)
    phone: Optional[str] = Field(None, max_length=30)
    redirect_url: Optional[str] = None


class ScannerIn(BaseModel):
    label: Optional[str] = Field(None, max_length=60)


class ScanIn(BaseModel):
    code: str = Field(min_length=3, max_length=200)
    event_id: Optional[int] = None


class LoginIn(BaseModel):
    access_code: str = Field(min_length=3, max_length=40)


def register_events_routes(api_router: APIRouter, supabase: Any) -> None:
    # ------------------------------------------------------------------ helpers
    def first(query) -> Optional[dict]:
        data = query.limit(1).execute().data or []
        return data[0] if data else None

    def load_settings() -> dict:
        merged = dict(DEFAULT_SETTINGS)
        try:
            row = first(supabase.table("app_settings").select("value").eq("key", "event_settings"))
            if row and isinstance(row.get("value"), dict):
                merged.update({k: row["value"][k] for k in DEFAULT_SETTINGS if k in row["value"]})
        except Exception as exc:  # noqa: BLE001
            logger.warning("event settings load failed: %s", exc)
        return {k: float(v or 0) for k, v in merged.items()}

    def optional_auth(authorization: Optional[str]) -> Optional[str]:
        if not authorization:
            return None
        try:
            return _current_auth_id(authorization)
        except HTTPException:
            return None

    def organizer_name(event: dict) -> str:
        if (event.get("organizer_type") or "admin") == "admin":
            return OFFICIAL_NAME
        row = first(supabase.table("users").select("*").eq("auth_id", event.get("organizer_auth_id") or ""))
        return (row or {}).get("name") or (row or {}).get("full_name") or "Organizer"

    def pending_hold(ticket_type_id: int) -> int:
        cutoff = _iso(_now() - timedelta(minutes=PENDING_HOLD_MINUTES))
        rows = (
            supabase.table("event_orders").select("quantity")
            .eq("ticket_type_id", ticket_type_id).eq("status", "pending").gte("created_at", cutoff)
            .execute().data or []
        )
        return sum(int(r.get("quantity") or 0) for r in rows)

    def type_view(t: dict, with_hold: bool = False) -> dict:
        cap = t.get("capacity")
        sold = int(t.get("sold") or 0)
        remaining = None if cap is None else max(int(cap) - sold - (pending_hold(t["id"]) if with_hold else 0), 0)
        sales_end = _parse(t.get("sales_end"))
        on_sale = bool(t.get("is_active", True)) and (not sales_end or sales_end > _now())
        return {
            "id": t["id"], "name": t.get("name"), "description": t.get("description"),
            "price": float(t.get("price") or 0), "capacity": cap, "sold": sold, "remaining": remaining,
            "max_per_order": int(t.get("max_per_order") or 10), "sales_end": t.get("sales_end"),
            "is_active": bool(t.get("is_active", True)),
            "on_sale": on_sale and (remaining is None or remaining > 0),
            "sold_out": remaining is not None and remaining <= 0,
        }

    def event_view(e: dict, types: List[dict], with_hold: bool = False) -> dict:
        tv = [type_view(t, with_hold) for t in types]
        priced = [t["price"] for t in tv if t["is_active"]]
        return {
            "id": e["id"], "title": e.get("title"), "description": e.get("description"),
            "banner_url": e.get("banner_url"), "venue": e.get("venue"), "address": e.get("address"),
            "starts_at": e.get("starts_at"), "ends_at": e.get("ends_at"), "status": e.get("status"),
            "is_featured": bool(e.get("is_featured")), "fee_mode": e.get("fee_mode") or "add_on",
            "organizer_type": e.get("organizer_type") or "admin",
            "organizer_auth_id": e.get("organizer_auth_id") if (e.get("organizer_type") or "admin") != "admin" else None,
            "is_promoted": bool(_parse(e.get("promoted_until")) and _parse(e.get("promoted_until")) > _now()),
            "promoted_until": e.get("promoted_until"),
            "organizer_name": organizer_name(e), "is_official": (e.get("organizer_type") or "admin") == "admin",
            "ticket_types": tv,
            "min_price": min(priced) if priced else 0,
            "is_free": bool(priced) and max(priced) == 0,
        }

    def types_for(event_ids: List[int]) -> Dict[int, List[dict]]:
        out: Dict[int, List[dict]] = {i: [] for i in event_ids}
        if event_ids:
            for t in supabase.table("event_ticket_types").select("*").in_("event_id", event_ids).order("price").execute().data or []:
                out.setdefault(t["event_id"], []).append(t)
        return out

    def quote(event: dict, ttype: dict, qty: int) -> dict:
        settings = load_settings()
        unit = float(ttype.get("price") or 0)
        subtotal = round(unit * qty, 2)
        fee = 0.0
        if subtotal > 0:
            fee = round(subtotal * settings["service_fee_percentage"] / 100 + settings["service_fee_flat"] * qty, 2)
        add_on = (event.get("fee_mode") or "add_on") == "add_on"
        total = round(subtotal + (fee if add_on else 0), 2)
        organizer_is_admin = (event.get("organizer_type") or "admin") == "admin"
        commission = 0.0 if organizer_is_admin else round(subtotal * settings["commission_percentage"] / 100, 2)
        # Platform's total take: everything on admin events, fee + commission on organiser events.
        platform_fee = total if organizer_is_admin else round(fee + commission, 2)
        payout = 0.0 if organizer_is_admin else round(max(subtotal - commission - (0 if add_on else fee), 0), 2)
        return {
            "unit_price": unit, "quantity": qty, "subtotal": subtotal, "service_fee": fee if add_on else 0.0,
            "included_fee": 0.0 if add_on else fee, "total": total,
            "platform_fee": platform_fee, "organizer_payout": payout,
        }

    def load_event_and_type(event_id: int, ticket_type_id: int, require_public: bool = True):
        event = first(supabase.table("events").select("*").eq("id", event_id))
        if not event or (require_public and event.get("status") != "published"):
            raise HTTPException(status_code=404, detail="Event not found")
        ttype = first(supabase.table("event_ticket_types").select("*").eq("id", ticket_type_id).eq("event_id", event_id))
        if not ttype:
            raise HTTPException(status_code=404, detail="Ticket type not found")
        return event, ttype

    def check_purchasable(event: dict, ttype: dict, qty: int, buyer: Optional[str] = None) -> None:
        end = _parse(event.get("ends_at")) or (_parse(event.get("starts_at")) or _now()) + timedelta(hours=6)
        if end < _now():
            raise HTTPException(status_code=400, detail="This event has already ended")
        view = type_view(ttype, with_hold=True)
        if not view["on_sale"]:
            raise HTTPException(status_code=400, detail="Tickets of this type are no longer on sale" if not view["sold_out"] else "Sold out")
        if qty > view["max_per_order"]:
            raise HTTPException(status_code=400, detail=f"You can buy at most {view['max_per_order']} per order")
        if view["remaining"] is not None and qty > view["remaining"]:
            raise HTTPException(status_code=400, detail=f"Only {view['remaining']} left")
        if float(ttype.get("price") or 0) == 0 and buyer:
            have = supabase.table("event_tickets").select("id", count="exact").eq("event_id", event["id"]).eq("ticket_type_id", ttype["id"]).eq("owner_auth_id", buyer).execute()
            if (have.count or 0) + qty > view["max_per_order"]:
                raise HTTPException(status_code=400, detail="You already have the maximum free tickets for this event")

    def new_pins(event_id: int, count: int) -> List[str]:
        used = {r["pin"] for r in supabase.table("event_tickets").select("pin").eq("event_id", event_id).execute().data or []}
        pins: List[str] = []
        while len(pins) < count:
            pin = f"{secrets.randbelow(900000) + 100000}"
            if pin not in used:
                used.add(pin)
                pins.append(pin)
        return pins

    def issue_tickets(order: dict) -> List[dict]:
        qty = int(order["quantity"])
        pins = new_pins(order["event_id"], qty)
        rows = [{
            "order_id": order["id"], "event_id": order["event_id"], "ticket_type_id": order["ticket_type_id"],
            "owner_auth_id": order.get("buyer_auth_id"), "owner_email": order.get("guest_email"), "owner_name": order.get("guest_name"),
            "code_token": secrets.token_urlsafe(18), "pin": pins[i], "status": "valid",
        } for i in range(qty)]
        created = supabase.table("event_tickets").insert(rows).execute().data or []
        ttype = first(supabase.table("event_ticket_types").select("*").eq("id", order["ticket_type_id"])) or {}
        supabase.table("event_ticket_types").update({"sold": int(ttype.get("sold") or 0) + qty}).eq("id", order["ticket_type_id"]).execute()
        event = first(supabase.table("events").select("*").eq("id", order["event_id"])) or {}
        if order.get("buyer_auth_id"):
            _notify(
                order["buyer_auth_id"], "event_ticket", "Your tickets are ready",
                f"{qty} ticket(s) for {event.get('title', 'the event')}. Open My Tickets to see your QR code and PIN.",
                {"event_id": order["event_id"], "action": "tickets"},
            )
        elif order.get("guest_email"):
            email_guest_tickets(order, event, created)
        return created

    def email_guest_tickets(order: dict, event: dict, tickets: List[dict]) -> bool:
        base = (os.environ.get("PUBLIC_APP_URL") or "https://app.istylist.online").rstrip("/")
        link = f"{base}/events/guest-tickets?reference={order['reference']}&t={order.get('access_token')}"
        when = (_parse(event.get("starts_at")) or _now()).astimezone(timezone(timedelta(hours=1))).strftime("%A %d %B %Y, %I:%M %p")
        pins = "".join(f"<li>Ticket {i + 1}: <b style='letter-spacing:3px'>{t['pin']}</b></li>" for i, t in enumerate(tickets))
        html = (
            f"<div style='font-family:Arial,sans-serif;max-width:480px;margin:auto'>"
            f"<h2>Your tickets are ready 🎟️</h2><p>Hi {order.get('guest_name') or 'there'},</p>"
            f"<p><b>{event.get('title')}</b><br>{when}<br>{event.get('venue') or ''}</p>"
            f"<p><a href='{link}' style='background:#7c3aed;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block'>Open my tickets (QR codes)</a></p>"
            f"<p>Show the QR code at the door. If scanning fails, give them the PIN for that ticket:</p><ul>{pins}</ul>"
            f"<p style='color:#666;font-size:13px'>Each ticket works once, so don't share the link or PINs. "
            f"Create a free iStylist account with this email to keep your tickets in the app and book trusted stylists.</p></div>"
        )
        text = (
            f"Your tickets for {event.get('title')} ({when}) are ready.\nOpen them (QR codes): {link}\n"
            + "\n".join(f"Ticket {i + 1} PIN: {t['pin']}" for i, t in enumerate(tickets))
            + "\nEach ticket works once. Don't share the link or PINs."
        )
        return send_email(order["guest_email"], f"Your tickets: {event.get('title')}", html, text)

    def fulfil(reference: str) -> dict:
        order = first(supabase.table("event_orders").select("*").eq("reference", reference))
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.get("processed") and order.get("status") == "paid":
            return {"status": "success", "message": "Already processed", "reference": reference, "event_id": order["event_id"]}
        headers = _paystack_headers()
        if not headers:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        res = requests.get(f"https://api.paystack.co/transaction/verify/{reference}", headers=headers, timeout=30)
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not verify the payment")
        tx = (res.json() or {}).get("data") or {}
        status = tx.get("status")
        if status != "success":
            if status in ("failed", "abandoned", "reversed"):
                supabase.table("event_orders").update({"status": "failed"}).eq("reference", reference).eq("processed", False).execute()
            return {"status": status or "failed", "message": f"Payment {status or 'not completed'}", "reference": reference}
        if abs(float(tx.get("amount", 0)) / 100 - float(order["total_amount"])) > 0.01:
            raise HTTPException(status_code=400, detail="Paid amount does not match the order")
        # Claim exactly once: a double verify or webhook + redirect race can't issue tickets twice.
        claimed = supabase.table("event_orders").update({"processed": True, "status": "paid", "paid_at": _iso()}).eq("reference", reference).eq("processed", False).execute().data
        if not claimed:
            return {"status": "success", "message": "Already processed", "reference": reference, "event_id": order["event_id"]}
        issue_tickets(order)
        return {"status": "success", "message": "Payment verified", "reference": reference, "event_id": order["event_id"]}

    _FULFIL["fn"] = fulfil

    def ticket_view(t: dict, event: dict, ttype: dict, with_qr: bool = True) -> dict:
        return {
            "id": t["id"], "event_id": t["event_id"], "pin": t["pin"], "status": t["status"], "used_at": t.get("used_at"),
            "ticket_type": ttype.get("name"), "event_title": event.get("title"), "event_starts_at": event.get("starts_at"),
            "event_venue": event.get("venue"), "event_address": event.get("address"), "event_banner_url": event.get("banner_url"),
            "event_status": event.get("status"),
            "qr_svg": qr_svg(f"IST:{t['code_token']}") if (with_qr and t["status"] == "valid") else None,
        }

    # ------------------------------------------------------------------ public / user
    def claim_guest_tickets(auth_id: str) -> None:
        """Attach tickets bought as a guest to the account that later signs up with the same email."""
        try:
            user = first(supabase.table("users").select("*").eq("auth_id", auth_id)) or {}
            email = (user.get("email") or "").strip().lower()
            if not email:
                return
            orders = supabase.table("event_orders").select("id").eq("guest_email", email).is_("buyer_auth_id", "null").execute().data or []
            if not orders:
                return
            ids = [o["id"] for o in orders]
            supabase.table("event_orders").update({"buyer_auth_id": auth_id}).in_("id", ids).execute()
            supabase.table("event_tickets").update({"owner_auth_id": auth_id}).in_("order_id", ids).execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("claim_guest_tickets failed: %s", exc)

    @api_router.get("/events")
    def list_events(authorization: Optional[str] = Header(None), include_past: bool = False):
        events = supabase.table("events").select("*").eq("status", "published").order("starts_at").limit(200).execute().data or []
        cutoff = _now() - timedelta(hours=6)
        if not include_past:
            events = [e for e in events if (_parse(e.get("ends_at")) or _parse(e.get("starts_at")) or cutoff) >= cutoff]
        tmap = types_for([e["id"] for e in events])
        out = [event_view(e, tmap.get(e["id"], [])) for e in events]
        out.sort(key=lambda e: (not e["is_promoted"], not e["is_featured"], e["starts_at"] or ""))
        auth_id = optional_auth(authorization)
        if auth_id and out:
            mine = supabase.table("event_tickets").select("event_id").eq("owner_auth_id", auth_id).execute().data or []
            counts: Dict[int, int] = {}
            for r in mine:
                counts[r["event_id"]] = counts.get(r["event_id"], 0) + 1
            for e in out:
                e["my_ticket_count"] = counts.get(e["id"], 0)
        return {"events": out}

    @api_router.get("/events/my-tickets")
    def my_tickets(authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        claim_guest_tickets(auth_id)
        rows = supabase.table("event_tickets").select("*").eq("owner_auth_id", auth_id).order("id", desc=True).limit(200).execute().data or []
        if not rows:
            return {"tickets": []}
        events = {e["id"]: e for e in supabase.table("events").select("*").in_("id", list({r["event_id"] for r in rows})).execute().data or []}
        types = {t["id"]: t for t in supabase.table("event_ticket_types").select("*").in_("id", list({r["ticket_type_id"] for r in rows})).execute().data or []}
        return {"tickets": [ticket_view(r, events.get(r["event_id"], {}), types.get(r["ticket_type_id"], {})) for r in rows]}

    @api_router.get("/events/orders/verify")
    def verify_order(reference: str = Query(...), authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        order = first(supabase.table("event_orders").select("*").eq("reference", reference))
        if not order or order.get("buyer_auth_id") != auth_id:
            raise HTTPException(status_code=404, detail="Order not found")
        return fulfil(reference)

    def guest_order(reference: str, token: str) -> dict:
        order = first(supabase.table("event_orders").select("*").eq("reference", reference))
        if not order or order.get("buyer_auth_id") and not order.get("guest_email") or not order.get("access_token") or not secrets.compare_digest(str(order["access_token"]), token or ""):
            raise HTTPException(status_code=404, detail="Tickets not found")
        return order

    def guest_ticket_list(order: dict) -> List[dict]:
        rows = supabase.table("event_tickets").select("*").eq("order_id", order["id"]).order("id").execute().data or []
        event = first(supabase.table("events").select("*").eq("id", order["event_id"])) or {}
        ttype = first(supabase.table("event_ticket_types").select("*").eq("id", order["ticket_type_id"])) or {}
        return [ticket_view(r, event, ttype) for r in rows]

    @api_router.get("/events/guest/verify")
    def guest_verify(reference: str = Query(...), t: str = Query(...)):
        order = guest_order(reference, t)
        result = fulfil(reference)
        if result.get("status") == "success":
            result["tickets"] = guest_ticket_list(order)
        return result

    @api_router.get("/events/guest/tickets")
    def guest_tickets(reference: str = Query(...), t: str = Query(...)):
        order = guest_order(reference, t)
        if order.get("status") not in ("paid", "refund_due"):
            raise HTTPException(status_code=402, detail="Payment not completed yet")
        return {"tickets": guest_ticket_list(order)}

    @api_router.post("/events/{event_id}/guest-checkout")
    def guest_checkout(event_id: int, payload: GuestCheckoutIn):
        email = payload.email.strip().lower()
        if not EMAIL_RE.match(email):
            raise HTTPException(status_code=422, detail="Enter a valid email address")
        event, ttype = load_event_and_type(event_id, payload.ticket_type_id)
        qty = payload.quantity
        check_purchasable(event, ttype, qty, None)
        free_ticket = float(ttype.get("price") or 0) == 0
        if free_ticket:
            have = supabase.table("event_tickets").select("id", count="exact").eq("event_id", event_id).eq("ticket_type_id", ttype["id"]).eq("owner_email", email).execute()
            if (have.count or 0) + qty > min(int(ttype.get("max_per_order") or 10), GUEST_MAX_PER_ORDER):
                raise HTTPException(status_code=400, detail="This email already has the maximum free tickets for this event")
        q = quote(event, ttype, qty)
        reference = f"{REFERENCE_PREFIX}{uuid.uuid4().hex[:14]}"
        access_token = secrets.token_urlsafe(24)
        order_row = {
            "reference": reference, "event_id": event_id, "ticket_type_id": ttype["id"], "buyer_auth_id": None,
            "guest_email": email, "guest_name": payload.name.strip(), "guest_phone": payload.phone, "access_token": access_token,
            "email": email, "quantity": qty, "unit_price": q["unit_price"], "subtotal": q["subtotal"], "service_fee": q["service_fee"],
            "total_amount": q["total"], "platform_fee": q["platform_fee"], "organizer_payout": q["organizer_payout"],
            "status": "pending", "processed": False,
        }
        if q["total"] <= 0:
            order_row.update({"status": "paid", "processed": True, "paid_at": _iso()})
            try:
                order = supabase.table("event_orders").insert(order_row).execute().data[0]
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=503, detail=f"Guest tickets need the latest database update (phase38): {exc}")
            tickets = issue_tickets(order)
            if email_configured():
                # The tickets go to the inbox only, so nobody can grab free tickets with someone else's address.
                return {"status": "free", "reference": reference, "ticket_count": len(tickets), "emailed": True, "email": email}
            return {"status": "free", "reference": reference, "ticket_count": len(tickets), "emailed": False, "access_token": access_token}
        if not payload.redirect_url:
            raise HTTPException(status_code=422, detail="redirect_url is required for paid tickets")
        headers = _paystack_headers()
        if not headers:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        try:
            supabase.table("event_orders").insert(order_row).execute()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Guest tickets need the latest database update (phase38): {exc}")
        sep = "&" if "?" in payload.redirect_url else "?"
        res = requests.post(
            "https://api.paystack.co/transaction/initialize",
            json={
                "email": email, "amount": int(round(q["total"] * 100)), "reference": reference,
                "callback_url": f"{payload.redirect_url}{sep}t={access_token}",
                "metadata": {"purpose": "event_ticket", "guest": True, "event_id": event_id, "ticket_type_id": ttype["id"], "quantity": qty},
            },
            headers=headers, timeout=30,
        )
        body = res.json() if res.content else {}
        if res.status_code != 200 or not body.get("status"):
            logger.error("guest checkout init failed: %s", res.text[:300])
            supabase.table("event_orders").update({"status": "failed"}).eq("reference", reference).execute()
            raise HTTPException(status_code=502, detail="Could not start the payment")
        return {"status": "pending", "authorization_url": body["data"].get("authorization_url"), "reference": reference, "amount": q["total"], "access_token": access_token}

    @api_router.get("/events/{event_id}")
    def get_event(event_id: int, authorization: Optional[str] = Header(None)):
        event = first(supabase.table("events").select("*").eq("id", event_id))
        if not event or event.get("status") not in ("published", "canceled"):
            raise HTTPException(status_code=404, detail="Event not found")
        view = event_view(event, types_for([event_id]).get(event_id, []), with_hold=True)
        settings = load_settings()
        view["service_fee_percentage"] = settings["service_fee_percentage"]
        view["service_fee_flat"] = settings["service_fee_flat"]
        auth_id = optional_auth(authorization)
        if auth_id:
            view["my_ticket_count"] = (supabase.table("event_tickets").select("id", count="exact").eq("event_id", event_id).eq("owner_auth_id", auth_id).execute().count or 0)
        return view

    @api_router.get("/events/{event_id}/quote")
    def get_quote(event_id: int, ticket_type_id: int, quantity: int = Query(1, ge=1, le=50)):
        event, ttype = load_event_and_type(event_id, ticket_type_id)
        return quote(event, ttype, quantity)

    @api_router.post("/events/{event_id}/checkout")
    def checkout(event_id: int, payload: CheckoutIn, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        event, ttype = load_event_and_type(event_id, payload.ticket_type_id)
        if event.get("status") != "published":
            raise HTTPException(status_code=400, detail="This event is not open for tickets")
        check_purchasable(event, ttype, payload.quantity, auth_id)
        q = quote(event, ttype, payload.quantity)
        reference = f"{REFERENCE_PREFIX}{uuid.uuid4().hex[:14]}"
        order_row = {
            "reference": reference, "event_id": event_id, "ticket_type_id": ttype["id"], "buyer_auth_id": auth_id,
            "email": payload.email, "quantity": payload.quantity, "unit_price": q["unit_price"], "subtotal": q["subtotal"],
            "service_fee": q["service_fee"], "total_amount": q["total"], "platform_fee": q["platform_fee"],
            "organizer_payout": q["organizer_payout"], "status": "pending", "processed": False,
        }
        if q["total"] <= 0:
            order_row.update({"status": "paid", "processed": True, "paid_at": _iso()})
            try:
                order = supabase.table("event_orders").insert(order_row).execute().data[0]
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=503, detail=f"Events need the latest database update (phase37): {exc}")
            tickets = issue_tickets(order)
            return {"status": "free", "reference": reference, "ticket_count": len(tickets), "event_id": event_id}
        if not payload.email or not payload.redirect_url:
            raise HTTPException(status_code=422, detail="Email and redirect_url are required for paid tickets")
        headers = _paystack_headers()
        if not headers:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        try:
            supabase.table("event_orders").insert(order_row).execute()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Events need the latest database update (phase37): {exc}")
        res = requests.post(
            "https://api.paystack.co/transaction/initialize",
            json={
                "email": payload.email, "amount": int(round(q["total"] * 100)), "reference": reference,
                "callback_url": payload.redirect_url,
                "metadata": {"purpose": "event_ticket", "event_id": event_id, "ticket_type_id": ttype["id"], "quantity": payload.quantity},
            },
            headers=headers, timeout=30,
        )
        body = res.json() if res.content else {}
        if res.status_code != 200 or not body.get("status"):
            logger.error("event checkout init failed: %s", res.text[:300])
            supabase.table("event_orders").update({"status": "failed"}).eq("reference", reference).execute()
            raise HTTPException(status_code=502, detail="Could not start the payment")
        return {"status": "pending", "authorization_url": body["data"].get("authorization_url"), "reference": reference, "amount": q["total"]}

    # ------------------------------------------------------------------ admin
    def save_ticket_types(event_id: int, types: List[TicketTypeIn]) -> None:
        existing = {t["id"]: t for t in supabase.table("event_ticket_types").select("*").eq("event_id", event_id).execute().data or []}
        keep = set()
        for t in types:
            row = {
                "name": t.name.strip(), "description": t.description, "price": t.price, "capacity": t.capacity,
                "max_per_order": t.max_per_order, "sales_end": t.sales_end or None, "is_active": t.is_active,
            }
            if t.id and t.id in existing:
                if t.capacity is not None and t.capacity < int(existing[t.id].get("sold") or 0):
                    raise HTTPException(status_code=400, detail=f"'{t.name}' already sold {existing[t.id].get('sold')}; capacity can't go below that")
                supabase.table("event_ticket_types").update(row).eq("id", t.id).execute()
                keep.add(t.id)
            else:
                created = supabase.table("event_ticket_types").insert({**row, "event_id": event_id}).execute().data
                keep.add(created[0]["id"])
        # Types that were removed: delete if nothing was sold, otherwise just switch them off.
        for tid, old in existing.items():
            if tid in keep:
                continue
            if int(old.get("sold") or 0) == 0:
                supabase.table("event_ticket_types").delete().eq("id", tid).execute()
            else:
                supabase.table("event_ticket_types").update({"is_active": False}).eq("id", tid).execute()

    def announce(event: dict) -> None:
        try:
            when = (_parse(event.get("starts_at")) or _now()).astimezone(timezone(timedelta(hours=1))).strftime("%a %d %b, %I:%M %p")
            caption = f"EVENT: {event.get('title')}\n{when}" + (f"\n{event.get('venue')}" if event.get("venue") else "") + "\nGet your tickets in the Events section."
            urls = [event["banner_url"]] if event.get("banner_url") else []
            supabase.table("provider_posts").insert({
                "provider_id": 0, "provider_auth_id": None, "caption": caption, "image_url": urls[0] if urls else "",
                "image_urls": urls, "media_type": "photo", "likes_count": 0, "comments_count": 0, "is_active": True, "is_official": True,
            }).execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("event feed announcement failed: %s", exc)

    def admin_event_row(e: dict, types: List[dict]) -> dict:
        view = event_view(e, types)
        tickets = supabase.table("event_tickets").select("status").eq("event_id", e["id"]).execute().data or []
        orders = supabase.table("event_orders").select("subtotal,service_fee,platform_fee,organizer_payout,status").eq("event_id", e["id"]).in_("status", ["paid", "refund_due"]).execute().data or []
        view["stats"] = {
            "tickets_issued": len(tickets),
            "checked_in": sum(1 for t in tickets if t["status"] == "used"),
            "refund_due": sum(1 for t in tickets if t["status"] == "refund_due"),
            "revenue": round(sum(float(o.get("subtotal") or 0) + float(o.get("service_fee") or 0) for o in orders if o["status"] == "paid"), 2),
            "platform_earnings": round(sum(float(o.get("platform_fee") or 0) for o in orders if o["status"] == "paid"), 2),
            "organizer_payout_due": round(sum(float(o.get("organizer_payout") or 0) for o in orders if o["status"] == "paid"), 2),
        }
        return view

    @api_router.get("/admin/events", dependencies=[Depends(_admin_key)])
    def admin_list_events():
        events = supabase.table("events").select("*").order("starts_at", desc=True).limit(300).execute().data or []
        tmap = types_for([e["id"] for e in events])
        return {"events": [admin_event_row(e, tmap.get(e["id"], [])) for e in events], "settings": load_settings()}

    @api_router.post("/admin/events", status_code=201, dependencies=[Depends(_admin_key)])
    def admin_create_event(payload: EventIn):
        if not _parse(payload.starts_at):
            raise HTTPException(status_code=422, detail="Invalid start date/time")
        if payload.status == "published" and not payload.ticket_types:
            raise HTTPException(status_code=422, detail="Add at least one ticket type before publishing")
        row = {
            "title": payload.title.strip(), "description": payload.description, "banner_url": payload.banner_url,
            "venue": payload.venue, "address": payload.address, "starts_at": payload.starts_at, "ends_at": payload.ends_at or None,
            "status": payload.status, "is_featured": payload.is_featured, "fee_mode": payload.fee_mode,
            "organizer_type": "admin", "organizer_auth_id": None,
        }
        try:
            event = supabase.table("events").insert(row).execute().data[0]
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Events need the latest database update (phase37): {exc}")
        save_ticket_types(event["id"], payload.ticket_types)
        if payload.status == "published" and payload.announce_in_feed:
            announce(event)
        return admin_event_row(event, types_for([event["id"]]).get(event["id"], []))

    @api_router.put("/admin/events/{event_id}", dependencies=[Depends(_admin_key)])
    def admin_update_event(event_id: int, payload: EventIn):
        event = first(supabase.table("events").select("*").eq("id", event_id))
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        if event.get("status") == "canceled":
            raise HTTPException(status_code=400, detail="A canceled event can't be edited")
        if payload.status == "published" and not payload.ticket_types:
            raise HTTPException(status_code=422, detail="Add at least one ticket type before publishing")
        row = {
            "title": payload.title.strip(), "description": payload.description, "banner_url": payload.banner_url,
            "venue": payload.venue, "address": payload.address, "starts_at": payload.starts_at, "ends_at": payload.ends_at or None,
            "status": payload.status, "is_featured": payload.is_featured, "fee_mode": payload.fee_mode, "updated_at": _iso(),
        }
        updated = supabase.table("events").update(row).eq("id", event_id).execute().data[0]
        save_ticket_types(event_id, payload.ticket_types)
        if payload.status == "published" and event.get("status") != "published" and payload.announce_in_feed:
            announce(updated)
        return admin_event_row(updated, types_for([event_id]).get(event_id, []))

    @api_router.post("/admin/events/{event_id}/cancel", dependencies=[Depends(_admin_key)])
    def admin_cancel_event(event_id: int):
        event = first(supabase.table("events").select("*").eq("id", event_id))
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        supabase.table("events").update({"status": "canceled", "updated_at": _iso()}).eq("id", event_id).execute()
        affected = supabase.table("event_tickets").select("*").eq("event_id", event_id).eq("status", "valid").execute().data or []
        supabase.table("event_tickets").update({"status": "refund_due"}).eq("event_id", event_id).eq("status", "valid").execute()
        paid = supabase.table("event_orders").select("*").eq("event_id", event_id).eq("status", "paid").execute().data or []
        for o in paid:
            if float(o.get("total_amount") or 0) > 0:
                supabase.table("event_orders").update({"status": "refund_due"}).eq("id", o["id"]).execute()
        for owner in {t["owner_auth_id"] for t in affected if t.get("owner_auth_id")}:
            _notify(owner, "event_canceled", "Event canceled", f"{event.get('title')} has been canceled. Any ticket payment will be refunded.", {"event_id": event_id})
        for guest in {t["owner_email"] for t in affected if not t.get("owner_auth_id") and t.get("owner_email")}:
            msg = f"{event.get('title')} has been canceled. Any ticket payment will be refunded."
            send_email(guest, f"Event canceled: {event.get('title')}", f"<p>{msg}</p>", msg)
        return {"status": "canceled", "tickets_affected": len(affected)}

    @api_router.get("/admin/events/{event_id}/attendees", dependencies=[Depends(_admin_key)])
    def admin_attendees(event_id: int):
        tickets = supabase.table("event_tickets").select("*").eq("event_id", event_id).order("id").execute().data or []
        owners = list({t["owner_auth_id"] for t in tickets if t.get("owner_auth_id")})
        names: Dict[str, dict] = {}
        if owners:
            for u in supabase.table("users").select("*").in_("auth_id", owners).execute().data or []:
                names[u["auth_id"]] = u
        types = {t["id"]: t for t in supabase.table("event_ticket_types").select("*").eq("event_id", event_id).execute().data or []}
        return {"attendees": [{
            "id": t["id"], "pin": t["pin"], "status": t["status"], "used_at": t.get("used_at"), "used_via": t.get("used_via"),
            "ticket_type": (types.get(t["ticket_type_id"]) or {}).get("name"),
            "name": (names.get(t["owner_auth_id"]) or {}).get("name") or (names.get(t["owner_auth_id"]) or {}).get("full_name") or t.get("owner_name") or "Guest",
            "email": (names.get(t["owner_auth_id"]) or {}).get("email") or t.get("owner_email"),
        } for t in tickets]}

    @api_router.get("/admin/events-settings", dependencies=[Depends(_admin_key)])
    def admin_get_event_settings():
        return load_settings()

    @api_router.put("/admin/events-settings", dependencies=[Depends(_admin_key)])
    def admin_put_event_settings(payload: SettingsIn):
        current = load_settings()
        current.update({k: v for k, v in payload.dict().items() if v is not None})
        try:
            exists = first(supabase.table("app_settings").select("key").eq("key", "event_settings"))
            if exists:
                supabase.table("app_settings").update({"value": current}).eq("key", "event_settings").execute()
            else:
                supabase.table("app_settings").insert({"key": "event_settings", "value": current}).execute()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Could not save event settings: {exc}")
        return current

    @api_router.get("/admin/events/{event_id}/scanners", dependencies=[Depends(_admin_key)])
    def admin_list_scanners(event_id: int):
        return {"scanners": supabase.table("event_scanners").select("*").eq("event_id", event_id).order("id").execute().data or []}

    @api_router.post("/admin/events/{event_id}/scanners", status_code=201, dependencies=[Depends(_admin_key)])
    def admin_create_scanner(event_id: int, payload: ScannerIn):
        if not first(supabase.table("events").select("id").eq("id", event_id)):
            raise HTTPException(status_code=404, detail="Event not found")
        code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
        return supabase.table("event_scanners").insert({"event_id": event_id, "label": payload.label, "access_code": code, "is_active": True}).execute().data[0]

    @api_router.delete("/admin/events/{event_id}/scanners/{scanner_id}", dependencies=[Depends(_admin_key)])
    def admin_delete_scanner(event_id: int, scanner_id: int):
        supabase.table("event_scanners").delete().eq("id", scanner_id).eq("event_id", event_id).execute()
        return {"status": "deleted"}

    # ------------------------------------------------------------------ scanner
    def resolve_scanner(x_scanner_code: Optional[str], x_admin_key: Optional[str], body_event_id: Optional[int]) -> tuple:
        """Returns (event_id or None for admin-any, label). Raises 401 if neither credential is valid."""
        if x_scanner_code:
            row = first(supabase.table("event_scanners").select("*").eq("access_code", x_scanner_code.strip().upper()).eq("is_active", True))
            if not row:
                raise HTTPException(status_code=401, detail="Invalid scanner code")
            return row["event_id"], row.get("label") or "scanner"
        if x_admin_key:
            _admin_key(x_admin_key)
            return body_event_id, "admin"
        raise HTTPException(status_code=401, detail="Scanner code required")

    def event_counts(event_id: int) -> dict:
        tickets = supabase.table("event_tickets").select("status").eq("event_id", event_id).execute().data or []
        valid_total = sum(1 for t in tickets if t["status"] in ("valid", "used"))
        return {"total": valid_total, "checked_in": sum(1 for t in tickets if t["status"] == "used")}

    @api_router.post("/events/scanner/login")
    def scanner_login(payload: LoginIn):
        event_id, label = resolve_scanner(payload.access_code, None, None)
        event = first(supabase.table("events").select("*").eq("id", event_id)) or {}
        return {"event_id": event_id, "event_title": event.get("title"), "starts_at": event.get("starts_at"), "label": label, **event_counts(event_id)}

    @api_router.post("/events/scanner/scan")
    def scanner_scan(
        payload: ScanIn,
        x_scanner_code: Optional[str] = Header(None, alias="X-SCANNER-CODE"),
        x_admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY"),
    ):
        scope_event, label = resolve_scanner(x_scanner_code, x_admin_key, payload.event_id)
        raw = payload.code.strip()
        ticket = None
        via = "qr"
        if raw.upper().startswith("IST:"):
            ticket = first(supabase.table("event_tickets").select("*").eq("code_token", raw[4:]))
        elif re.fullmatch(r"\d{6}", raw):
            via = "pin"
            if scope_event is None:
                raise HTTPException(status_code=422, detail="Choose an event to check a PIN")
            ticket = first(supabase.table("event_tickets").select("*").eq("event_id", scope_event).eq("pin", raw))
        else:
            return {"result": "invalid", "message": "Not an iStylist ticket"}
        if not ticket:
            return {"result": "invalid", "message": "Ticket not found"}
        if scope_event is not None and ticket["event_id"] != scope_event:
            return {"result": "wrong_event", "message": "This ticket is for a different event"}
        event = first(supabase.table("events").select("*").eq("id", ticket["event_id"])) or {}
        ttype = first(supabase.table("event_ticket_types").select("name").eq("id", ticket["ticket_type_id"])) or {}
        owner = (first(supabase.table("users").select("*").eq("auth_id", ticket["owner_auth_id"])) if ticket.get("owner_auth_id") else None) or {}
        info = {
            "ticket_id": ticket["id"], "ticket_type": ttype.get("name"), "event_title": event.get("title"),
            "holder": owner.get("name") or owner.get("full_name") or ticket.get("owner_name") or "Guest", "pin": ticket["pin"],
        }
        if ticket["status"] in ("refund_due", "canceled") or event.get("status") == "canceled":
            return {"result": "canceled", "message": "This ticket is canceled/refunded", **info}
        if ticket["status"] == "used":
            return {"result": "used", "message": "Already used", "used_at": ticket.get("used_at"), **info}
        # Atomic one-time use: only the request that flips valid -> used succeeds.
        won = supabase.table("event_tickets").update({"status": "used", "used_at": _iso(), "used_via": via, "scanned_by": label}).eq("id", ticket["id"]).eq("status", "valid").execute().data
        if not won:
            fresh = first(supabase.table("event_tickets").select("used_at").eq("id", ticket["id"])) or {}
            return {"result": "used", "message": "Already used", "used_at": fresh.get("used_at"), **info}
        return {"result": "valid", "message": "Valid ticket. Admit.", **info, **event_counts(ticket["event_id"])}

    from provider_events_routes import register_provider_events
    register_provider_events(api_router, supabase, {
        "first": first, "types_for": types_for, "event_view": event_view, "save_ticket_types": save_ticket_types,
        "admin_event_row": admin_event_row, "admin_cancel_event": admin_cancel_event, "admin_attendees": admin_attendees,
        "admin_list_scanners": admin_list_scanners, "admin_create_scanner": admin_create_scanner,
        "admin_delete_scanner": admin_delete_scanner, "load_settings": load_settings, "announce": announce,
        "fulfil_registry": _FULFIL,
    })
