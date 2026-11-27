"""Provider-organised events: create/edit/cancel, admin approval, payout hold, promotions.

Rules (agreed with the owner):
- A provider's first events are reviewed by admin; after `provider_trust_after_approved` approved events they publish instantly.
- Platform commission = Events commission setting (default 7%) on ticket subtotal.
- Ticket money is held; payout to the provider becomes due PAYOUT_HOLD_HOURS after the event ends (manual payout, admin list).
- Cancelling refunds every paid order automatically through Paystack (falls back to 'refund_due' for manual handling).
- Promotion (Paystack, reference prefix istylist_evpromo_): tiers are admin-editable; promoted events show a tag and sort first.
Tables: migrations/phase42_provider_events.sql.
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from consultation_routes import _admin_key, _current_auth_id
from events_routes import (
    DEFAULT_PROMO_TIERS, PAYOUT_HOLD_HOURS, PROMO_REFERENCE_PREFIX, EventIn, ScannerIn,
    _iso, _notify, _now, _paystack_headers, _parse,
)

logger = logging.getLogger(__name__)


class PromoteIn(BaseModel):
    days: int = Field(ge=1, le=60)
    email: str = Field(max_length=200)
    redirect_url: str = Field(max_length=500)
    announce_in_feed: bool = False


class RejectIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class TiersIn(BaseModel):
    tiers: List[Dict[str, float]]


def register_provider_events(api_router: APIRouter, supabase: Any, ctx: Dict[str, Any]) -> None:
    first = ctx["first"]
    types_for = ctx["types_for"]
    event_view = ctx["event_view"]
    save_ticket_types = ctx["save_ticket_types"]
    admin_event_row = ctx["admin_event_row"]
    load_settings = ctx["load_settings"]

    # ------------------------------------------------------------------ helpers
    def provider_id(authorization: Optional[str]) -> str:
        auth_id = _current_auth_id(authorization)
        user = first(supabase.table("users").select("*").eq("auth_id", auth_id))
        if not user:
            raise HTTPException(status_code=404, detail="Account not found")
        if user.get("role") != "stylist":
            raise HTTPException(status_code=403, detail="Only provider accounts can organise events")
        return auth_id

    def own_event(event_id: int, auth_id: str) -> dict:
        ev = first(supabase.table("events").select("*").eq("id", event_id))
        if not ev or ev.get("organizer_type") != "provider" or ev.get("organizer_auth_id") != auth_id:
            raise HTTPException(status_code=404, detail="Event not found")
        return ev

    def event_end(ev: dict) -> datetime:
        return _parse(ev.get("ends_at")) or (_parse(ev.get("starts_at")) or _now()) + timedelta(hours=6)

    def payout_due_at(ev: dict) -> datetime:
        return event_end(ev) + timedelta(hours=PAYOUT_HOLD_HOURS)

    def is_trusted(auth_id: str) -> bool:
        need = int(load_settings().get("provider_trust_after_approved") or 0)
        approved = supabase.table("events").select("id", count="exact").eq("organizer_auth_id", auth_id).not_.is_("approved_at", "null").execute()
        return need == 0 or (approved.count or 0) >= need

    def promo_tiers() -> List[dict]:
        try:
            row = first(supabase.table("app_settings").select("value").eq("key", "event_promo_tiers"))
            if row and isinstance(row.get("value"), list) and row["value"]:
                return [{"days": int(t["days"]), "price": float(t["price"])} for t in row["value"] if t.get("days") and t.get("price") is not None]
        except Exception as exc:  # noqa: BLE001
            logger.warning("promo tiers load failed: %s", exc)
        return DEFAULT_PROMO_TIERS

    def validate_payload(payload: EventIn) -> None:
        if not _parse(payload.starts_at):
            raise HTTPException(status_code=422, detail="Invalid start date/time")
        if _parse(payload.starts_at) < _now():
            raise HTTPException(status_code=422, detail="The event must start in the future")
        end = _parse(payload.ends_at)
        if payload.ends_at and (not end or end <= _parse(payload.starts_at)):
            raise HTTPException(status_code=422, detail="The end time must be after the start time")
        if not payload.ticket_types:
            raise HTTPException(status_code=422, detail="Add at least one ticket type (price 0 for a free event)")

    def provider_row(ev: dict, types: List[dict]) -> dict:
        view = admin_event_row(ev, types)
        view["rejection_reason"] = ev.get("rejection_reason")
        view["payout_status"] = ev.get("payout_status") or "pending"
        view["payout_due_at"] = payout_due_at(ev).isoformat() if ev.get("status") in ("published",) else None
        stats = view.get("stats") or {}
        stats.pop("platform_earnings", None)
        view["stats"] = stats
        return view

    def refund_order(order: dict) -> bool:
        headers = _paystack_headers()
        if not headers or float(order.get("total_amount") or 0) <= 0:
            return False
        try:
            res = requests.post("https://api.paystack.co/refund", json={"transaction": order["reference"]}, headers=headers, timeout=30)
            ok = res.status_code in (200, 201) and (res.json() or {}).get("status")
            return bool(ok)
        except Exception as exc:  # noqa: BLE001
            logger.warning("event refund failed for %s: %s", order.get("reference"), exc)
            return False

    # ------------------------------------------------------------------ provider: manage
    def to_row(payload: EventIn) -> dict:
        return {
            "title": payload.title.strip(), "description": payload.description, "banner_url": payload.banner_url,
            "venue": payload.venue, "address": payload.address, "starts_at": payload.starts_at,
            "ends_at": payload.ends_at or None, "fee_mode": payload.fee_mode, "updated_at": _iso(),
        }

    @api_router.get("/provider/events")
    def my_events(authorization: Optional[str] = Header(None)):
        auth_id = provider_id(authorization)
        events = supabase.table("events").select("*").eq("organizer_type", "provider").eq("organizer_auth_id", auth_id).order("starts_at", desc=True).execute().data or []
        tmap = types_for([e["id"] for e in events])
        return {"events": [provider_row(e, tmap.get(e["id"], [])) for e in events], "trusted": is_trusted(auth_id), "promo_tiers": promo_tiers()}

    @api_router.post("/provider/events", status_code=201)
    def create_event(payload: EventIn, authorization: Optional[str] = Header(None)):
        auth_id = provider_id(authorization)
        validate_payload(payload)
        submit = payload.status == "published"
        status, approved_at = "draft", None
        if submit:
            status = "published" if is_trusted(auth_id) else "pending_review"
            approved_at = _iso() if status == "published" else None
        row = {**to_row(payload), "status": status, "approved_at": approved_at, "is_featured": False,
               "organizer_type": "provider", "organizer_auth_id": auth_id}
        try:
            ev = supabase.table("events").insert(row).execute().data[0]
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Events need the latest database update (phase42): {exc}")
        save_ticket_types(ev["id"], payload.ticket_types)
        return provider_row(ev, types_for([ev["id"]]).get(ev["id"], []))

    @api_router.put("/provider/events/{event_id}")
    def update_event(event_id: int, payload: EventIn, authorization: Optional[str] = Header(None)):
        auth_id = provider_id(authorization)
        ev = own_event(event_id, auth_id)
        if ev["status"] == "canceled":
            raise HTTPException(status_code=400, detail="A canceled event can't be edited")
        if event_end(ev) < _now():
            raise HTTPException(status_code=400, detail="This event has already ended")
        if payload.ends_at or payload.starts_at:
            if not _parse(payload.starts_at):
                raise HTTPException(status_code=422, detail="Invalid start date/time")
        if not payload.ticket_types:
            raise HTTPException(status_code=422, detail="Add at least one ticket type")
        row = to_row(payload)
        status = ev["status"]
        if ev["status"] in ("draft", "rejected") and payload.status == "published":
            status = "published" if is_trusted(auth_id) else "pending_review"
            row["rejection_reason"] = None
            if status == "published":
                row["approved_at"] = _iso()
        row["status"] = status
        updated = supabase.table("events").update(row).eq("id", event_id).execute().data[0]
        save_ticket_types(event_id, payload.ticket_types)
        return provider_row(updated, types_for([event_id]).get(event_id, []))

    @api_router.post("/provider/events/{event_id}/cancel")
    def cancel_event(event_id: int, authorization: Optional[str] = Header(None)):
        auth_id = provider_id(authorization)
        ev = own_event(event_id, auth_id)
        if ev["status"] == "canceled":
            return {"status": "canceled", "refunded": 0, "refund_pending": 0}
        paid = supabase.table("event_orders").select("*").eq("event_id", event_id).eq("status", "paid").execute().data or []
        result = ctx["admin_cancel_event"](event_id)  # marks tickets/orders refund_due + notifies holders
        refunded = pending = 0
        for o in paid:
            if float(o.get("total_amount") or 0) <= 0:
                continue
            if refund_order(o):
                supabase.table("event_orders").update({"status": "refunded"}).eq("id", o["id"]).execute()
                supabase.table("event_tickets").update({"status": "canceled"}).eq("order_id", o["id"]).eq("status", "refund_due").execute()
                refunded += 1
            else:
                pending += 1
        supabase.table("events").update({"payout_status": "void"}).eq("id", event_id).execute()
        return {"status": "canceled", "tickets_affected": result.get("tickets_affected", 0), "refunded": refunded, "refund_pending": pending}

    @api_router.get("/provider/events/{event_id}/attendees")
    def attendees(event_id: int, authorization: Optional[str] = Header(None)):
        own_event(event_id, provider_id(authorization))
        return ctx["admin_attendees"](event_id)

    @api_router.get("/provider/events/{event_id}/scanners")
    def scanners(event_id: int, authorization: Optional[str] = Header(None)):
        own_event(event_id, provider_id(authorization))
        return ctx["admin_list_scanners"](event_id)

    @api_router.post("/provider/events/{event_id}/scanners", status_code=201)
    def add_scanner(event_id: int, payload: ScannerIn, authorization: Optional[str] = Header(None)):
        own_event(event_id, provider_id(authorization))
        return ctx["admin_create_scanner"](event_id, payload)

    @api_router.delete("/provider/events/{event_id}/scanners/{scanner_id}")
    def remove_scanner(event_id: int, scanner_id: int, authorization: Optional[str] = Header(None)):
        own_event(event_id, provider_id(authorization))
        return ctx["admin_delete_scanner"](event_id, scanner_id)

    # ------------------------------------------------------------------ promotion
    @api_router.get("/event-promo-tiers")
    def get_promo_tiers():
        return {"tiers": promo_tiers()}

    @api_router.post("/provider/events/{event_id}/promote")
    def promote(event_id: int, payload: PromoteIn, authorization: Optional[str] = Header(None)):
        auth_id = provider_id(authorization)
        ev = own_event(event_id, auth_id)
        if ev["status"] != "published" or event_end(ev) < _now():
            raise HTTPException(status_code=400, detail="Only live, upcoming events can be promoted")
        tier = next((t for t in promo_tiers() if t["days"] == payload.days), None)
        if not tier:
            raise HTTPException(status_code=422, detail="Choose one of the promotion plans")
        headers = _paystack_headers()
        if not headers:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        reference = f"{PROMO_REFERENCE_PREFIX}{secrets.token_hex(10)}"
        try:
            supabase.table("event_promotions").insert({
                "reference": reference, "event_id": event_id, "provider_auth_id": auth_id, "days": tier["days"],
                "amount": tier["price"], "announce_in_feed": payload.announce_in_feed,
            }).execute()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Promotions need the latest database update (phase42): {exc}")
        res = requests.post(
            "https://api.paystack.co/transaction/initialize",
            json={"email": payload.email, "amount": int(round(tier["price"] * 100)), "reference": reference,
                  "callback_url": payload.redirect_url, "metadata": {"purpose": "event_promotion", "event_id": event_id, "days": tier["days"]}},
            headers=headers, timeout=30,
        )
        body = res.json() if res.content else {}
        if res.status_code != 200 or not body.get("status"):
            supabase.table("event_promotions").update({"status": "failed"}).eq("reference", reference).execute()
            raise HTTPException(status_code=502, detail="Could not start the payment")
        return {"authorization_url": body["data"].get("authorization_url"), "reference": reference, "amount": tier["price"], "days": tier["days"]}

    def fulfil_promo(reference: str) -> dict:
        promo = first(supabase.table("event_promotions").select("*").eq("reference", reference))
        if not promo:
            raise HTTPException(status_code=404, detail="Promotion not found")
        if promo.get("processed") and promo.get("status") == "paid":
            return {"status": "success", "message": "Already processed", "event_id": promo["event_id"]}
        headers = _paystack_headers()
        if not headers:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        res = requests.get(f"https://api.paystack.co/transaction/verify/{reference}", headers=headers, timeout=30)
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not verify the payment")
        tx = (res.json() or {}).get("data") or {}
        if tx.get("status") != "success":
            if tx.get("status") in ("failed", "abandoned", "reversed"):
                supabase.table("event_promotions").update({"status": "failed"}).eq("reference", reference).eq("processed", False).execute()
            return {"status": tx.get("status") or "failed", "message": "Payment not completed"}
        if abs(float(tx.get("amount", 0)) / 100 - float(promo["amount"])) > 0.01:
            raise HTTPException(status_code=400, detail="Paid amount does not match the plan")
        claimed = supabase.table("event_promotions").update({"processed": True, "status": "paid", "paid_at": _iso()}).eq("reference", reference).eq("processed", False).execute().data
        if not claimed:
            return {"status": "success", "message": "Already processed", "event_id": promo["event_id"]}
        ev = first(supabase.table("events").select("*").eq("id", promo["event_id"])) or {}
        base = max(_parse(ev.get("promoted_until")) or _now(), _now())
        until = base + timedelta(days=int(promo["days"]))
        supabase.table("events").update({"promoted_until": until.isoformat()}).eq("id", promo["event_id"]).execute()
        _notify(promo["provider_auth_id"], "event_promoted", "Your event is promoted",
                f"{ev.get('title', 'Your event')} is promoted until {until.astimezone(timezone(timedelta(hours=1))).strftime('%d %b %Y')}.", {"event_id": promo["event_id"]})
        if promo.get("announce_in_feed"):
            _feed_announce(ev, promo["provider_auth_id"])
        return {"status": "success", "message": "Promotion active", "event_id": promo["event_id"], "promoted_until": until.isoformat()}

    ctx["fulfil_registry"]["promo"] = fulfil_promo

    def _feed_announce(ev: dict, auth_id: str) -> None:
        try:
            user = first(supabase.table("users").select("*").eq("auth_id", auth_id)) or {}
            when = (_parse(ev.get("starts_at")) or _now()).astimezone(timezone(timedelta(hours=1))).strftime("%a %d %b, %I:%M %p")
            caption = f"EVENT: {ev.get('title')}\n{when}" + (f"\n{ev.get('venue')}" if ev.get("venue") else "") + "\nTickets in the Events section."
            urls = [ev["banner_url"]] if ev.get("banner_url") else []
            supabase.table("provider_posts").insert({
                "provider_id": user.get("id"), "provider_auth_id": auth_id, "caption": caption, "image_url": urls[0] if urls else "",
                "image_urls": urls, "media_type": "photo", "likes_count": 0, "comments_count": 0, "is_active": True,
            }).execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("provider event feed post failed: %s", exc)

    @api_router.get("/provider/events/promote/verify")
    def verify_promo(reference: str, authorization: Optional[str] = Header(None)):
        auth_id = provider_id(authorization)
        promo = first(supabase.table("event_promotions").select("provider_auth_id").eq("reference", reference))
        if not promo or promo["provider_auth_id"] != auth_id:
            raise HTTPException(status_code=404, detail="Promotion not found")
        return fulfil_promo(reference)

    # ------------------------------------------------------------------ admin
    @api_router.get("/admin/events-review", dependencies=[Depends(_admin_key)])
    def review_queue():
        events = supabase.table("events").select("*").eq("status", "pending_review").order("created_at").execute().data or []
        tmap = types_for([e["id"] for e in events])
        return {"events": [admin_event_row(e, tmap.get(e["id"], [])) for e in events]}

    @api_router.post("/admin/events/{event_id}/approve", dependencies=[Depends(_admin_key)])
    def approve(event_id: int):
        ev = first(supabase.table("events").select("*").eq("id", event_id))
        if not ev or ev["status"] != "pending_review":
            raise HTTPException(status_code=404, detail="No pending event found")
        supabase.table("events").update({"status": "published", "approved_at": _iso(), "rejection_reason": None}).eq("id", event_id).execute()
        if ev.get("organizer_auth_id"):
            _notify(ev["organizer_auth_id"], "event_approved", "Event approved", f"{ev['title']} is now live. Tickets can be bought.", {"event_id": event_id})
        return {"status": "published"}

    @api_router.post("/admin/events/{event_id}/reject", dependencies=[Depends(_admin_key)])
    def reject(event_id: int, payload: RejectIn):
        ev = first(supabase.table("events").select("*").eq("id", event_id))
        if not ev or ev["status"] != "pending_review":
            raise HTTPException(status_code=404, detail="No pending event found")
        supabase.table("events").update({"status": "rejected", "rejection_reason": payload.reason.strip()}).eq("id", event_id).execute()
        if ev.get("organizer_auth_id"):
            _notify(ev["organizer_auth_id"], "event_rejected", "Event not approved",
                    f"{ev['title']} was not approved: {payload.reason.strip()}. You can edit it and submit again.", {"event_id": event_id})
        return {"status": "rejected"}

    @api_router.get("/admin/event-payouts", dependencies=[Depends(_admin_key)])
    def payouts():
        """Provider events whose payout is due (event ended + hold period) or still held."""
        events = supabase.table("events").select("*").eq("organizer_type", "provider").neq("status", "pending_review").order("starts_at", desc=True).limit(300).execute().data or []
        out = []
        for e in events:
            if e.get("payout_status") == "void" or e["status"] == "canceled":
                continue
            orders = supabase.table("event_orders").select("organizer_payout").eq("event_id", e["id"]).eq("status", "paid").execute().data or []
            amount = round(sum(float(o.get("organizer_payout") or 0) for o in orders), 2)
            if amount <= 0 and e.get("payout_status") != "paid":
                continue
            user = first(supabase.table("users").select("*").eq("auth_id", e.get("organizer_auth_id") or "")) or {}
            due_at = payout_due_at(e)
            out.append({
                "event_id": e["id"], "title": e["title"], "provider_name": user.get("name") or user.get("full_name"),
                "provider_email": user.get("email"), "amount": e.get("payout_amount") if e.get("payout_status") == "paid" else amount,
                "payout_status": e.get("payout_status") or "pending", "due_at": due_at.isoformat(), "is_due": due_at <= _now(),
                "paid_at": e.get("payout_paid_at"),
            })
        out.sort(key=lambda r: (r["payout_status"] == "paid", r["due_at"]))
        return {"payouts": out}

    @api_router.post("/admin/event-payouts/{event_id}/mark-paid", dependencies=[Depends(_admin_key)])
    def mark_paid(event_id: int):
        e = first(supabase.table("events").select("*").eq("id", event_id))
        if not e or e.get("organizer_type") != "provider":
            raise HTTPException(status_code=404, detail="Event not found")
        if payout_due_at(e) > _now():
            raise HTTPException(status_code=400, detail="Payout is still on hold until 24 hours after the event ends")
        orders = supabase.table("event_orders").select("organizer_payout").eq("event_id", event_id).eq("status", "paid").execute().data or []
        amount = round(sum(float(o.get("organizer_payout") or 0) for o in orders), 2)
        supabase.table("events").update({"payout_status": "paid", "payout_amount": amount, "payout_paid_at": _iso()}).eq("id", event_id).execute()
        if e.get("organizer_auth_id"):
            _notify(e["organizer_auth_id"], "event_payout", "Event payout sent", f"Your payout of ₦{amount:,.0f} for {e['title']} has been sent.", {"event_id": event_id})
        return {"status": "paid", "amount": amount}

    @api_router.get("/admin/event-promo-tiers", dependencies=[Depends(_admin_key)])
    def admin_get_tiers():
        return {"tiers": promo_tiers()}

    @api_router.put("/admin/event-promo-tiers", dependencies=[Depends(_admin_key)])
    def admin_put_tiers(payload: TiersIn):
        tiers = [{"days": int(t["days"]), "price": float(t["price"])} for t in payload.tiers if t.get("days", 0) >= 1 and t.get("price", -1) >= 0]
        if not tiers:
            raise HTTPException(status_code=422, detail="Add at least one plan")
        exists = first(supabase.table("app_settings").select("key").eq("key", "event_promo_tiers"))
        if exists:
            supabase.table("app_settings").update({"value": tiers}).eq("key", "event_promo_tiers").execute()
        else:
            supabase.table("app_settings").insert({"key": "event_promo_tiers", "value": tiers}).execute()
        return {"tiers": tiers}
