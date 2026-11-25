"""
Booking lifecycle automation (phase 39).

Rules
  1. Provider must accept within ACCEPT_TIMEOUT_MIN minutes (counted only inside the provider's
     working hours). Otherwise the booking becomes status='no_response' and any payment is refunded.
  2. Once accepted ('confirmed'), the customer may cancel free of charge until CANCEL_CUTOFF_MIN
     minutes before the appointment. Inside that window a late-cancel penalty
     (LATE_CANCEL_PENALTY_PCT % of the booking amount) goes to the provider.
     After the appointment has started the customer can no longer cancel (use completion / no-show).
  3. When the booked session ends (start + total service duration):
       - customer is asked "Was your service completed?"  (Yes -> completed + escrow released,
         No -> both sides can file a no-show through the existing no-show flow)
       - provider is asked to mark the session Completed or No-show
  4. If the customer never answers, the booking auto-completes AUTO_COMPLETE_HOURS after the session
     ends (unless the customer said "No" or a no-show / dispute is open) and escrow is released.
  5. After completion the customer is asked to review the service.

All jobs are idempotent: every action is gated by the current status and a timestamp column.
Tunables (env): BOOKING_ACCEPT_TIMEOUT_MIN, BOOKING_CANCEL_CUTOFF_MIN,
                BOOKING_AUTO_COMPLETE_HOURS, BOOKING_LATE_CANCEL_PENALTY_PCT
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List

from booking_reminders import _parse_appointment_datetime, _now_lagos, LAGOS_TZ, _existing_reminder


def _env_num(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except Exception:
        return float(default)


ACCEPT_TIMEOUT_MIN = int(_env_num("BOOKING_ACCEPT_TIMEOUT_MIN", 10))
CANCEL_CUTOFF_MIN = int(_env_num("BOOKING_CANCEL_CUTOFF_MIN", 45))
AUTO_COMPLETE_HOURS = _env_num("BOOKING_AUTO_COMPLETE_HOURS", 24)
LATE_CANCEL_PENALTY_PCT = _env_num("BOOKING_LATE_CANCEL_PENALTY_PCT", 20)

STATUS_NO_RESPONSE = "no_response"


def _utc_iso(dt: Optional[datetime] = None) -> str:
    return (dt or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat()


def parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d
    except Exception:
        return None


def appointment_start(booking: Dict[str, Any]) -> Optional[datetime]:
    return _parse_appointment_datetime(booking)


def session_minutes(supabase, booking: Dict[str, Any]) -> int:
    """Total booked duration in minutes (sum of services, fallback to booking columns, then 60)."""
    try:
        resp = supabase.table("booking_services").select("duration_minutes").eq(
            "booking_id", booking["id"]
        ).execute()
        total = sum(int(r.get("duration_minutes") or 0) for r in (resp.data or []))
        if total > 0:
            return total
    except Exception:
        pass
    for key in ("service_duration_minutes", "duration_minutes", "total_duration"):
        try:
            v = int(booking.get(key) or 0)
            if v > 0:
                return v
        except Exception:
            continue
    return 60


def session_end(supabase, booking: Dict[str, Any]) -> Optional[datetime]:
    start = appointment_start(booking)
    if not start:
        return None
    return start + timedelta(minutes=session_minutes(supabase, booking))


def cancel_policy(booking: Dict[str, Any], now: Optional[datetime] = None) -> Dict[str, Any]:
    """What happens if the CUSTOMER cancels right now."""
    now = now or _now_lagos()
    status = (booking.get("status") or "").lower()
    start = appointment_start(booking)
    base = {
        "cutoff_minutes": CANCEL_CUTOFF_MIN,
        "penalty_percentage": LATE_CANCEL_PENALTY_PCT,
    }
    if status in ("pending", "pending_payment") or start is None:
        return {**base, "state": "free", "minutes_to_start": None,
                "message": "The provider has not accepted yet, so you can cancel for free and get a full refund."}
    minutes_to_start = int((start - now).total_seconds() // 60)
    if minutes_to_start >= CANCEL_CUTOFF_MIN:
        return {**base, "state": "free", "minutes_to_start": minutes_to_start,
                "message": f"Free cancellation. You will receive a full refund. Cancelling is free until {CANCEL_CUTOFF_MIN} minutes before your appointment."}
    if minutes_to_start >= 0:
        return {**base, "state": "late", "minutes_to_start": minutes_to_start,
                "message": (f"Your appointment starts in {minutes_to_start} minutes. Cancellations within {CANCEL_CUTOFF_MIN} minutes "
                            f"of the appointment cost {LATE_CANCEL_PENALTY_PCT:g}% of the booking, paid to the provider "
                            f"for the time they reserved for you. The rest is refunded.")}
    return {**base, "state": "closed", "minutes_to_start": minutes_to_start,
            "message": "The appointment time has passed, so it can no longer be cancelled. Please confirm whether the service happened or file a no-show."}


# ---------------------------------------------------------------- working hours

def _hhmm(value: Any):
    s = str(value or "")
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    return None


def _load_windows(supabase, provider_auth_id: str) -> Dict[int, List[tuple]]:
    """{day_of_week(0=Sun): [(start_time, end_time), ...]} for active availability rows."""
    out: Dict[int, List[tuple]] = {}
    try:
        resp = supabase.table("provider_availability").select("*").eq("provider_id", provider_auth_id).execute()
        for r in resp.data or []:
            if r.get("is_active") is False:
                continue
            s, e = _hhmm(r.get("start_time")), _hhmm(r.get("end_time"))
            if s and e and s < e:
                out.setdefault(int(r.get("day_of_week")), []).append((s, e))
    except Exception as ex:
        logging.warning(f"[lifecycle] availability lookup failed: {ex}")
    for v in out.values():
        v.sort()
    return out


def acceptance_deadline(supabase, provider_auth_id: str, created: datetime) -> datetime:
    """created + ACCEPT_TIMEOUT_MIN minutes of *working time*. Provider with no hours set = always on."""
    windows = _load_windows(supabase, provider_auth_id)
    created_l = created.astimezone(LAGOS_TZ) if LAGOS_TZ else created
    remaining = timedelta(minutes=ACCEPT_TIMEOUT_MIN)
    if not windows:
        return created_l + remaining
    cursor = created_l
    for _ in range(8):
        dow = (cursor.weekday() + 1) % 7
        for (s, e) in windows.get(dow, []):
            ws = cursor.replace(hour=s.hour, minute=s.minute, second=0, microsecond=0)
            we = cursor.replace(hour=e.hour, minute=e.minute, second=0, microsecond=0)
            if we <= cursor:
                continue
            begin = max(cursor, ws)
            avail = we - begin
            if avail >= remaining:
                return begin + remaining
            remaining -= avail
        cursor = (cursor + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return created_l + timedelta(minutes=ACCEPT_TIMEOUT_MIN)


# ---------------------------------------------------------------------- jobs

async def run_lifecycle(supabase, create_notification, release_escrow, refund_if_paid) -> Dict[str, int]:
    """Runs every minute. Auto-cancel, session-end prompts, 24h auto-complete."""
    stats = {"no_response": 0, "prompts": 0, "auto_completed": 0, "errors": 0}
    now = _now_lagos()
    now_utc_iso = _utc_iso()

    # ---- 1. provider did not accept in time -> no_response -------------------
    try:
        pend = supabase.table("bookings").select("*").eq("status", "pending").execute().data or []
    except Exception as e:
        logging.warning(f"[lifecycle] fetch pending failed: {e}")
        pend = []
    for b in pend:
        try:
            created = parse_ts(b.get("created_at"))
            provider_id = b.get("provider_id")
            if not created or not provider_id:
                continue
            deadline = parse_ts(b.get("auto_cancel_at"))
            if not deadline:
                deadline = acceptance_deadline(supabase, provider_id, created)
                try:
                    supabase.table("bookings").update({"auto_cancel_at": _utc_iso(deadline)}).eq("id", b["id"]).execute()
                except Exception:
                    pass  # column missing (migration not run) -> still compute each run
            start = appointment_start(b)
            expired = now >= deadline or (start is not None and now >= start)
            if not expired:
                continue
            upd = supabase.table("bookings").update({"status": STATUS_NO_RESPONSE}).eq("id", b["id"]).eq("status", "pending").execute()
            if not upd.data:
                continue
            try:
                await refund_if_paid(b)
            except Exception as ex:
                logging.warning(f"[lifecycle] refund failed for {b['id']}: {ex}")
            when = f"{b.get('booking_date')} at {str(b.get('booking_time'))[:5]}"
            if b.get("customer_auth_id"):
                await create_notification(
                    recipient_auth_id=b["customer_auth_id"], notification_type="booking_no_response",
                    title="Booking cancelled: no response",
                    message=(f"Your provider did not accept your booking for {when} within {ACCEPT_TIMEOUT_MIN} minutes, "
                             f"so it was cancelled automatically. Any payment has been refunded to your wallet. No penalty applies to you."),
                    metadata={"booking_id": b["id"], "outcome": STATUS_NO_RESPONSE})
            await create_notification(
                recipient_auth_id=provider_id, notification_type="booking_no_response",
                title="Booking missed: no response",
                message=(f"You did not accept the booking for {when} within {ACCEPT_TIMEOUT_MIN} minutes of working time, "
                         f"so it was cancelled and the customer was refunded. Please respond to requests quickly to keep your ranking and earnings."),
                metadata={"booking_id": b["id"], "outcome": STATUS_NO_RESPONSE})
            stats["no_response"] += 1
        except Exception as ex:
            stats["errors"] += 1
            logging.warning(f"[lifecycle] no_response error: {ex}")

    # ---- 2 & 3. session ended -> prompts; 24h auto-complete -----------------
    try:
        conf = supabase.table("bookings").select("*").eq("status", "confirmed").execute().data or []
    except Exception as e:
        logging.warning(f"[lifecycle] fetch confirmed failed: {e}")
        conf = []
    for b in conf:
        try:
            when = f"{b.get('booking_date')} at {str(b.get('booking_time'))[:5]}"
            cust, prov = b.get("customer_auth_id"), b.get("provider_id")
            start = appointment_start(b)
            end = session_end(supabase, b)
            if start and now < start:
                await _notify_before_start(create_notification, supabase, b, start, now, cust, prov, when)
                continue
            if start and end and now < end:
                await _notify_started(create_notification, supabase, b, cust, prov, when, end)
                continue
            if not end or now < end:
                continue
            if not b.get("completion_prompt_sent_at"):
                auto_at = end + timedelta(hours=AUTO_COMPLETE_HOURS)
                upd = supabase.table("bookings").update({
                    "completion_prompt_sent_at": now_utc_iso,
                    "auto_complete_at": _utc_iso(auto_at),
                }).eq("id", b["id"]).is_("completion_prompt_sent_at", "null").execute()
                if upd.data:
                    if cust:
                        await create_notification(
                            recipient_auth_id=cust, notification_type="booking_completion_prompt",
                            title="Your session has ended: was it completed?",
                            message=(f"Your session for {when} has ended. Tap Yes to confirm and release payment to your provider. "
                                     f"Tap No if the service did not happen and you can file a no-show. "
                                     f"If you don't respond within {AUTO_COMPLETE_HOURS:g} hours, the booking is completed automatically and the provider is paid."),
                            metadata={"booking_id": b["id"]})
                    if prov:
                        await create_notification(
                            recipient_auth_id=prov, notification_type="booking_provider_completion_prompt",
                            title="Session has ended: mark it",
                            message=(f"The booked session for {when} has ended. Please mark it Completed, or No-show if the customer did not come. "
                                     f"Payment is only released after the customer confirms, or automatically {AUTO_COMPLETE_HOURS:g} hours after the session ends."),
                            metadata={"booking_id": b["id"]})
                    stats["prompts"] += 1
                continue

            # prompt already sent -> consider auto-complete
            if b.get("customer_disputed_completion_at") or b.get("no_show_reported_at"):
                continue
            auto_at = parse_ts(b.get("auto_complete_at"))
            if not auto_at or datetime.now(timezone.utc) < auto_at:
                continue
            upd = supabase.table("bookings").update({
                "status": "completed", "completed_by": "auto"
            }).eq("id", b["id"]).eq("status", "confirmed").execute()
            if not upd.data:
                continue
            if prov and cust:
                await release_escrow(b["id"], prov, cust)
            await notify_completed(create_notification, b, auto=True)
            stats["auto_completed"] += 1
        except Exception as ex:
            stats["errors"] += 1
            logging.warning(f"[lifecycle] confirmed loop error: {ex}")
    return stats


async def _send_once(create_notification, supabase, ntype, recipient, booking_id, title, message, meta):
    if not recipient or _existing_reminder(supabase, ntype, recipient, booking_id):
        return
    await create_notification(recipient_auth_id=recipient, notification_type=ntype, title=title, message=message,
                              metadata={"booking_id": booking_id, **meta})


async def _notify_before_start(create_notification, supabase, b, start, now, cust, prov, when):
    """10 minutes before the session: heads-up for both sides."""
    mins = (start - now).total_seconds() / 60.0
    if mins > 10:
        return
    left = max(1, int(round(mins)))
    await _send_once(create_notification, supabase, "booking_reminder_10m", cust, b["id"],
                     "Your session starts soon",
                     f"Your appointment starts in about {left} minute(s) ({when}). Rescheduling is now closed (it closes {CANCEL_CUTOFF_MIN} minutes before). "
                     f"Cancelling now costs a {LATE_CANCEL_PENALTY_PCT:g}% fee paid to the provider, so please be ready.",
                     {"reminder_type": "booking_reminder_10m", "role": "customer"})
    await _send_once(create_notification, supabase, "booking_reminder_10m", prov, b["id"],
                     "Session starts soon",
                     f"A booking with you starts in about {left} minute(s) ({when}). Please be ready and on time. "
                     f"Late or missed sessions can be reported as a no-show.",
                     {"reminder_type": "booking_reminder_10m", "role": "provider"})


async def _notify_started(create_notification, supabase, b, cust, prov, when, end):
    """At the start time: the session has started."""
    end_txt = end.strftime("%H:%M")
    await _send_once(create_notification, supabase, "booking_session_started", cust, b["id"],
                     "Your session has started",
                     f"Your session ({when}) has started and is booked until {end_txt}. When it ends we'll ask you to confirm it was completed. "
                     f"If your provider hasn't arrived or started, message them in the booking chat.",
                     {"role": "customer"})
    await _send_once(create_notification, supabase, "booking_session_started", prov, b["id"],
                     "Session has started",
                     f"The session ({when}) has started and is booked until {end_txt}. At the end you'll be asked to mark it Completed or No-show.",
                     {"role": "provider"})


async def notify_completed(create_notification, booking: Dict[str, Any], auto: bool = False):
    """Completion notices + review prompt."""
    cust, prov = booking.get("customer_auth_id"), booking.get("provider_id")
    when = f"{booking.get('booking_date')} at {str(booking.get('booking_time'))[:5]}"
    if cust:
        await create_notification(
            recipient_auth_id=cust, notification_type="booking_completed",
            title="Booking completed",
            message=(f"Your booking for {when} was completed automatically because there was no response within {AUTO_COMPLETE_HOURS:g} hours. Payment was released to the provider."
                     if auto else f"Thanks for confirming. Your booking for {when} is completed and payment was released to the provider."),
            metadata={"booking_id": booking["id"]})
        await create_notification(
            recipient_auth_id=cust, notification_type="review_prompt",
            title="How was your service?",
            message="Please leave a quick review. It helps other customers and rewards good providers.",
            metadata={"booking_id": booking["id"], "provider_id": prov})
    if prov:
        await create_notification(
            recipient_auth_id=prov, notification_type="booking_completed",
            title="Payment released",
            message=(f"Booking {when} was auto-completed ({AUTO_COMPLETE_HOURS:g}h without a customer response). Your earnings are now in your wallet."
                     if auto else f"The customer confirmed booking {when}. Your earnings are now in your wallet."),
            metadata={"booking_id": booking["id"]})
