"""
Booking reminder automation - lightweight in-app reminders.

Generates two reminder notifications per confirmed booking:
  - booking_reminder_2h  : ~2 hours before appointment
  - booking_reminder_30m : ~30 minutes before appointment

Recipients: customer (via customer_auth_id) AND provider (via provider_id which
is a UUID in the bookings table).

Idempotency:
  Before inserting a reminder for (booking_id, reminder_type) we query the
  notifications table for an existing row with the same metadata.booking_id
  and same type. If it exists for that auth_id, we skip.

Performance:
  - Job runs every 5 minutes via APScheduler (interval, coalesce=true,
    max_instances=1).
  - Each run only scans confirmed bookings whose booking_date is TODAY or
    TOMORROW in Africa/Lagos. Typical scan = small (< few hundred rows).
  - No polling loop in the request path.
  - Designed to be safe on restart: missed runs are coalesced; next run will
    still create the reminder if the appointment is still within the window.

Safety:
  - This module never writes to bookings/wallets/payments tables.
  - Only INSERTs into notifications via the shared create_notification helper.
  - All Supabase errors are caught and logged.
"""

from __future__ import annotations

import logging
from datetime import datetime, date, time, timedelta
from typing import Optional, Callable, Awaitable, Any

try:
    import pytz
    LAGOS_TZ = pytz.timezone("Africa/Lagos")
except Exception:  # pragma: no cover
    LAGOS_TZ = None  # type: ignore


# Reminder windows (minutes before appointment when reminder should fire)
REMINDER_DEFINITIONS = [
    # (notification_type, minutes_before, label)
    ("booking_reminder_2h", 120, "in 2 hours"),
    ("booking_reminder_30m", 30, "in 30 minutes"),
]

# How wide the firing window is on either side of the target time.
# Scheduler runs every 5 min, so a 5-min window is enough to guarantee a hit.
WINDOW_MINUTES = 5


def _parse_appointment_datetime(booking: dict) -> Optional[datetime]:
    """Combine booking_date (YYYY-MM-DD) + booking_time (HH:MM) into a tz-aware datetime."""
    date_str = booking.get("booking_date")
    time_str = booking.get("booking_time")
    if not date_str or not time_str:
        return None
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        t = datetime.strptime(time_str, "%H:%M").time()
    except Exception:
        return None
    dt = datetime.combine(d, t)
    if LAGOS_TZ is not None:
        dt = LAGOS_TZ.localize(dt)
    return dt


def _now_lagos() -> datetime:
    if LAGOS_TZ is not None:
        return datetime.now(LAGOS_TZ)
    return datetime.now()


def _existing_reminder(
    supabase, notification_type: str, recipient_auth_id: str, booking_id: int
) -> bool:
    """Check if a reminder notification of this type already exists for this booking + recipient."""
    try:
        # Filter using JSONB metadata->>'booking_id' equality. Supabase-py supports
        # `.filter('metadata->>booking_id', 'eq', str(booking_id))`.
        # Also restrict by auth_id and type for index efficiency.
        resp = (
            supabase.table("notifications")
            .select("id")
            .eq("auth_id", recipient_auth_id)
            .eq("type", notification_type)
            .filter("metadata->>booking_id", "eq", str(booking_id))
            .limit(1)
            .execute()
        )
        return bool(resp.data)
    except Exception as e:
        # If JSONB filter is not supported (older schema), fall back to a wider
        # check using message LIKE - safer to skip than duplicate.
        logging.debug(f"Existing reminder JSONB check failed: {e}; using fallback")
        try:
            resp = (
                supabase.table("notifications")
                .select("id, message")
                .eq("auth_id", recipient_auth_id)
                .eq("type", notification_type)
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            )
            rows = resp.data or []
            needle = f"#{booking_id}"
            return any(needle in (r.get("message") or "") for r in rows)
        except Exception as e2:
            logging.warning(f"Fallback existence check failed: {e2}")
            # Be safe: assume it exists so we don't spam duplicates
            return True


def _scan_window_bookings(supabase) -> list:
    """Fetch confirmed bookings for today and tomorrow only (Africa/Lagos)."""
    try:
        today = _now_lagos().date()
        tomorrow = today + timedelta(days=1)
        # Filter status in ('confirmed', 'accepted') to be permissive across schemas
        resp = (
            supabase.table("bookings")
            .select("id, status, booking_date, booking_time, customer_auth_id, provider_id, customer_id")
            .in_("status", ["confirmed", "accepted"])
            .in_("booking_date", [today.isoformat(), tomorrow.isoformat()])
            .execute()
        )
        return resp.data or []
    except Exception as e:
        logging.warning(f"Reminder scan: failed to fetch bookings: {e}")
        return []


async def scan_and_create_reminders(
    supabase,
    create_notification: Callable[..., Awaitable[bool]],
) -> dict:
    """
    Main reminder job.

    Args:
      supabase: configured Supabase client
      create_notification: async fn (recipient_auth_id, type, title, message,
                           actor_auth_id=None, metadata=None) -> bool

    Returns: stats dict for logging/monitoring.
    """
    stats = {"scanned": 0, "checked": 0, "created": 0, "skipped_existing": 0, "errors": 0}

    bookings = _scan_window_bookings(supabase)
    stats["scanned"] = len(bookings)
    if not bookings:
        return stats

    now = _now_lagos()

    for booking in bookings:
        try:
            booking_id = booking.get("id")
            if not booking_id:
                continue

            appt_dt = _parse_appointment_datetime(booking)
            if not appt_dt:
                continue

            # delta in minutes until appointment
            minutes_until = (appt_dt - now).total_seconds() / 60.0

            # Skip past appointments and far-future ones quickly
            if minutes_until < 0:
                continue
            # Hard cap: only consider <= 2h 30m out
            if minutes_until > 150:
                continue

            customer_auth_id = booking.get("customer_auth_id")
            provider_auth_id = booking.get("provider_id")  # this column stores UUID

            # Build a date/time label for the message
            time_str = booking.get("booking_time") or ""
            date_str = booking.get("booking_date") or ""

            for ntype, mins_before, label in REMINDER_DEFINITIONS:
                lo = mins_before - WINDOW_MINUTES
                hi = mins_before + WINDOW_MINUTES
                if not (lo <= minutes_until <= hi):
                    continue

                stats["checked"] += 1

                # Construct messages
                cust_title = "Upcoming appointment"
                prov_title = "Upcoming appointment"
                cust_msg = f"Reminder: Your appointment starts {label} ({time_str})."
                prov_msg = f"Reminder: A booking with you starts {label} ({time_str})."

                # Build canonical metadata
                meta_base = {
                    "booking_id": booking_id,
                    "reminder_type": ntype,
                    "minutes_before": mins_before,
                    "appointment_date": date_str,
                    "appointment_time": time_str,
                }

                # Customer
                if customer_auth_id:
                    if _existing_reminder(supabase, ntype, customer_auth_id, booking_id):
                        stats["skipped_existing"] += 1
                    else:
                        ok = await create_notification(
                            recipient_auth_id=customer_auth_id,
                            notification_type=ntype,
                            title=cust_title,
                            message=cust_msg,
                            metadata={**meta_base, "role": "customer"},
                        )
                        if ok:
                            stats["created"] += 1
                        else:
                            stats["errors"] += 1

                # Provider
                if provider_auth_id and provider_auth_id != customer_auth_id:
                    if _existing_reminder(supabase, ntype, provider_auth_id, booking_id):
                        stats["skipped_existing"] += 1
                    else:
                        ok = await create_notification(
                            recipient_auth_id=provider_auth_id,
                            notification_type=ntype,
                            title=prov_title,
                            message=prov_msg,
                            metadata={**meta_base, "role": "provider"},
                        )
                        if ok:
                            stats["created"] += 1
                        else:
                            stats["errors"] += 1
        except Exception as inner:
            stats["errors"] += 1
            logging.warning(f"Reminder loop error for booking {booking.get('id')}: {inner}")
            continue

    logging.info(
        f"[booking_reminders] scanned={stats['scanned']} checked={stats['checked']} "
        f"created={stats['created']} skipped={stats['skipped_existing']} errors={stats['errors']}"
    )
    return stats
