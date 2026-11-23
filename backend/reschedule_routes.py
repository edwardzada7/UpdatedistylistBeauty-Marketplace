"""Reschedule bookings: either side proposes a new time, the other accepts or declines.

Rules (server-enforced):
  * Only pending/confirmed bookings, and only until RESCHEDULE_CUTOFF_MIN minutes before the current appointment.
  * At most MAX_RESCHEDULES accepted reschedules per booking; one open proposal at a time.
  * The new time must be one of the provider's real open slots.
  * The booking (and its escrowed money) is untouched until the proposal is accepted.
Tables: migrations/phase36_reschedule.sql.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from booking_reminders import _now_lagos, _parse_appointment_datetime
from consultation_routes import _current_auth_id

logger = logging.getLogger(__name__)

RESCHEDULE_CUTOFF_MIN = 30
MAX_RESCHEDULES = 2
MAX_DAYS_AHEAD = 30
ALLOWED_STATUSES = ("pending", "confirmed")


class ProposeBody(BaseModel):
    new_date: str = Field(..., description="YYYY-MM-DD")
    new_time: str = Field(..., description="HH:MM")
    reason: Optional[str] = Field(None, max_length=300)


class RespondBody(BaseModel):
    action: str = Field(..., pattern="^(accept|decline|cancel)$")


def _hhmm(value: Any) -> str:
    return str(value or "")[:5]


def register_reschedule_routes(api_router: APIRouter, supabase: Any, get_slots: Callable[..., Awaitable[dict]]) -> None:
    def first(query) -> Optional[dict]:
        data = query.limit(1).execute().data or []
        return data[0] if data else None

    def load_booking(booking_id: int) -> dict:
        b = first(supabase.table("bookings").select("*").eq("id", booking_id))
        if not b:
            raise HTTPException(status_code=404, detail="Booking not found")
        return b

    def role_of(b: dict, auth_id: str) -> str:
        if b.get("customer_auth_id") == auth_id:
            return "customer"
        if b.get("provider_id") == auth_id:
            return "provider"
        raise HTTPException(status_code=403, detail="You are not part of this booking")

    def minutes_until(b: dict) -> Optional[float]:
        appt = _parse_appointment_datetime(b)
        return None if appt is None else (appt - _now_lagos()).total_seconds() / 60.0

    def expire_if_late(b: dict, proposal: Optional[dict]) -> Optional[dict]:
        """A proposal nobody answered before the cutoff is no longer valid."""
        if not proposal:
            return None
        left = minutes_until(b)
        if left is not None and left < RESCHEDULE_CUTOFF_MIN:
            supabase.table("booking_reschedules").update({"status": "expired", "responded_at": datetime.now(timezone.utc).isoformat()}).eq("id", proposal["id"]).execute()
            return None
        return proposal

    def pending_for(booking_id: int) -> Optional[dict]:
        return first(supabase.table("booking_reschedules").select("*").eq("booking_id", booking_id).eq("status", "pending").order("id", desc=True))

    def state(b: dict, auth_id: str) -> dict:
        role = role_of(b, auth_id)
        proposal = expire_if_late(b, pending_for(b["id"]))
        used = int(b.get("reschedule_count") or 0)
        left = minutes_until(b)
        reason = None
        if b.get("status") not in ALLOWED_STATUSES:
            reason = "This booking can't be rescheduled."
        elif left is None or left < RESCHEDULE_CUTOFF_MIN:
            reason = f"Too late to reschedule (changes close {RESCHEDULE_CUTOFF_MIN} minutes before the appointment)."
        elif used >= MAX_RESCHEDULES:
            reason = f"This booking has already been rescheduled {MAX_RESCHEDULES} times."
        elif proposal:
            reason = "There is already a request waiting for an answer."
        return {
            "role": role,
            "can_propose": reason is None,
            "blocked_reason": reason,
            "reschedules_used": used,
            "reschedules_left": max(0, MAX_RESCHEDULES - used),
            "cutoff_minutes": RESCHEDULE_CUTOFF_MIN,
            "pending": (
                {**proposal, "awaiting_you": proposal["proposed_by_auth_id"] != auth_id} if proposal else None
            ),
        }

    async def slot_open(b: dict, new_date: str, new_time: str) -> bool:
        user = first(supabase.table("users").select("id").eq("auth_id", b["provider_id"]))
        if not user:
            return False
        duration = int(b.get("service_duration_minutes") or b.get("duration_minutes") or 30)
        staff = b.get("staff_id")
        res = await get_slots(user["id"], new_date, duration, int(staff) if staff else None)
        slots = [_hhmm(s.get("time") if isinstance(s, dict) else s) for s in (res.get("slots") or [])]
        if new_date == b.get("booking_date"):
            # The booking's own current slot is free once it moves, so don't let it block itself.
            own = _hhmm(b.get("booking_time"))
            if own and new_time != own:
                return _hhmm(new_time) in slots or _own_overlap_ok(b, new_time, duration, slots)
        return _hhmm(new_time) in slots

    def _own_overlap_ok(b: dict, new_time: str, duration: int, slots: List[str]) -> bool:
        # Accept a same-day shift when the only blocker is the booking's own current slot.
        def mins(t: str) -> int:
            h, m = t.split(":")[:2]
            return int(h) * 60 + int(m)
        old_start = mins(_hhmm(b.get("booking_time")))
        new_start = mins(_hhmm(new_time))
        if not (new_start < old_start + duration and new_start + duration > old_start):
            return False
        # every 30-min step of the new range must be either open or inside the old slot
        step = 5
        for t in range(new_start, new_start + duration, step):
            if old_start <= t < old_start + duration:
                continue
            if not any(mins(s) <= t < mins(s) + duration for s in slots):
                return False
        return True

    def tell(auth_id: Optional[str], ntype: str, title: str, message: str, meta: dict) -> None:
        try:
            from push_and_public import notify_user_sync
            if auth_id:
                notify_user_sync(auth_id, ntype, title, message, meta)
        except Exception as exc:  # noqa: BLE001
            logger.warning("reschedule notify failed: %s", exc)

    @api_router.get("/bookings/{booking_id}/reschedule")
    def get_reschedule_state(booking_id: int, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        return state(load_booking(booking_id), auth_id)

    @api_router.get("/bookings/{booking_id}/reschedule/slots")
    async def reschedule_slots(booking_id: int, date: str, authorization: Optional[str] = Header(None)):
        """Open slots for this booking's provider (and service length) on a date."""
        auth_id = _current_auth_id(authorization)
        b = load_booking(booking_id)
        role_of(b, auth_id)
        user = first(supabase.table("users").select("id").eq("auth_id", b["provider_id"]))
        if not user:
            raise HTTPException(status_code=404, detail="Provider not found")
        duration = int(b.get("service_duration_minutes") or b.get("duration_minutes") or 30)
        staff = b.get("staff_id")
        res = await get_slots(user["id"], date, duration, int(staff) if staff else None)
        slots = [_hhmm(x.get("time") if isinstance(x, dict) else x) for x in (res.get("slots") or [])]
        if date == _now_lagos().strftime("%Y-%m-%d"):
            cutoff = (_now_lagos() + timedelta(minutes=RESCHEDULE_CUTOFF_MIN)).strftime("%H:%M")
            slots = [t for t in slots if t >= cutoff]
        return {"date": date, "slots": slots}

    @api_router.post("/bookings/{booking_id}/reschedule")
    async def propose_reschedule(booking_id: int, body: ProposeBody, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        b = load_booking(booking_id)
        st = state(b, auth_id)
        if not st["can_propose"]:
            raise HTTPException(status_code=400, detail=st["blocked_reason"])
        try:
            new_dt = datetime.strptime(f"{body.new_date} {_hhmm(body.new_time)}", "%Y-%m-%d %H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="Pick a valid date and time")
        now = _now_lagos().replace(tzinfo=None)
        if new_dt < now + timedelta(minutes=RESCHEDULE_CUTOFF_MIN):
            raise HTTPException(status_code=400, detail="Pick a time at least 30 minutes from now")
        if new_dt > now + timedelta(days=MAX_DAYS_AHEAD):
            raise HTTPException(status_code=400, detail=f"Pick a date within the next {MAX_DAYS_AHEAD} days")
        if body.new_date == b.get("booking_date") and _hhmm(body.new_time) == _hhmm(b.get("booking_time")):
            raise HTTPException(status_code=400, detail="That is the time you already have")
        if not await slot_open(b, body.new_date, _hhmm(body.new_time)):
            raise HTTPException(status_code=409, detail="That time isn't available. Please choose another slot.")
        row = {
            "booking_id": booking_id,
            "proposed_by_auth_id": auth_id,
            "proposed_by_role": st["role"],
            "old_date": b.get("booking_date"),
            "old_time": _hhmm(b.get("booking_time")),
            "new_date": body.new_date,
            "new_time": _hhmm(body.new_time),
            "reason": (body.reason or "").strip() or None,
            "status": "pending",
        }
        saved = supabase.table("booking_reschedules").insert(row).execute().data[0]
        other = b["provider_id"] if st["role"] == "customer" else b.get("customer_auth_id")
        who = "The customer" if st["role"] == "customer" else "The provider"
        tell(
            other, "reschedule_proposed", "Reschedule request",
            f"{who} asks to move booking #{booking_id} to {body.new_date} at {_hhmm(body.new_time)}. Please accept or decline.",
            {"booking_id": booking_id, "reschedule_id": saved["id"], "action": "review_reschedule"},
        )
        return state(b, auth_id)

    @api_router.post("/bookings/{booking_id}/reschedule/respond")
    async def respond_reschedule(booking_id: int, body: RespondBody, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        b = load_booking(booking_id)
        role = role_of(b, auth_id)
        proposal = expire_if_late(b, pending_for(booking_id))
        if not proposal:
            raise HTTPException(status_code=404, detail="There is no open reschedule request (it may have expired).")
        mine = proposal["proposed_by_auth_id"] == auth_id
        now_iso = datetime.now(timezone.utc).isoformat()
        other = b["provider_id"] if role == "customer" else b.get("customer_auth_id")

        if body.action == "cancel":
            if not mine:
                raise HTTPException(status_code=403, detail="Only the person who asked can withdraw it")
            supabase.table("booking_reschedules").update({"status": "canceled", "responded_at": now_iso}).eq("id", proposal["id"]).execute()
            return state(b, auth_id)

        if mine:
            raise HTTPException(status_code=403, detail="The other side has to answer your request")

        if body.action == "decline":
            supabase.table("booking_reschedules").update({"status": "declined", "responded_at": now_iso}).eq("id", proposal["id"]).execute()
            tell(other, "reschedule_declined", "Reschedule declined",
                 f"Your request to move booking #{booking_id} was declined. The original time ({proposal['old_date']} {proposal['old_time']}) still stands.",
                 {"booking_id": booking_id, "reschedule_id": proposal["id"]})
            return state(b, auth_id)

        # accept
        if int(b.get("reschedule_count") or 0) >= MAX_RESCHEDULES or b.get("status") not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="This booking can't be rescheduled any more.")
        if not await slot_open(b, proposal["new_date"], proposal["new_time"]):
            supabase.table("booking_reschedules").update({"status": "expired", "responded_at": now_iso}).eq("id", proposal["id"]).execute()
            raise HTTPException(status_code=409, detail="That time was taken in the meantime. Ask for a new time.")
        update = {
            "booking_date": proposal["new_date"],
            "booking_time": proposal["new_time"],
            "reschedule_count": int(b.get("reschedule_count") or 0) + 1,
        }
        try:
            supabase.table("bookings").update(update).eq("id", booking_id).execute()
        except Exception as exc:  # noqa: BLE001
            logger.error("reschedule update failed: %s", exc)
            raise HTTPException(status_code=500, detail="Could not move the booking. Run the phase36 SQL, then try again.")
        supabase.table("booking_reschedules").update({"status": "accepted", "responded_at": now_iso}).eq("id", proposal["id"]).execute()
        # Reminders are sent once per booking, so clear the old ones: new time, new reminders.
        try:
            supabase.table("notifications").delete().in_("type", ["booking_reminder_2h", "booking_reminder_30m"]).filter("metadata->>booking_id", "eq", str(booking_id)).execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("reminder reset skipped: %s", exc)
        msg = f"Booking #{booking_id} moved to {proposal['new_date']} at {proposal['new_time']}."
        meta = {"booking_id": booking_id, "reschedule_id": proposal["id"]}
        tell(other, "reschedule_accepted", "Reschedule accepted", msg, meta)
        tell(auth_id, "reschedule_accepted", "Booking rescheduled", msg, meta)
        return state(load_booking(booking_id), auth_id)
