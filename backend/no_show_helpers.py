"""
Hybrid no-show automation helpers.

Status flow (uses existing `status` column on bookings; additive values only):
  confirmed
    ├──> (provider reports) ──> no_show_pending  (reporter_role=provider)
    │                                ├──> (customer confirms) ──> user_no_show         (release escrow to provider)
    │                                ├──> (customer disputes) ──> disputed
    │                                └──> (deadline elapses)  ──> user_no_show         (release escrow to provider)
    │
    └──> (customer reports) ──> no_show_pending  (reporter_role=customer)
                                     ├──> (provider confirms) ──> provider_no_show     (refund escrow to customer)
                                     ├──> (provider disputes) ──> disputed
                                     └──> (deadline elapses)  ──> provider_no_show     (refund escrow to customer)

Idempotency / safety:
  - Each transition is guarded by the current `status` value.
  - Finalization is gated by `no_show_deadline < now()` AND `status == no_show_pending`.
  - Escrow release/refund uses the EXISTING helpers (_release_escrow_to_provider /
    _refund_escrow_to_customer) which already have their own duplicate-protection.
  - We never modify wallet/escrow code directly.

Tunables (env vars):
  NO_SHOW_GRACE_MINUTES        default 20
"""

from __future__ import annotations
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, Awaitable, Optional, Dict, Any, List

# Status constants (lowercase to match existing booking statuses)
STATUS_NO_SHOW_PENDING = "no_show_pending"
STATUS_USER_NO_SHOW = "user_no_show"
STATUS_PROVIDER_NO_SHOW = "provider_no_show"
STATUS_DISPUTED = "disputed"

# Statuses from which a no-show can be reported
ELIGIBLE_REPORT_STATUSES = {"confirmed", "pending"}

ROLE_CUSTOMER = "customer"
ROLE_PROVIDER = "provider"


def grace_period_minutes() -> int:
    try:
        return max(1, int(os.environ.get("NO_SHOW_GRACE_MINUTES", "20")))
    except Exception:
        return 20


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def compute_deadline(reported_at: Optional[datetime] = None) -> datetime:
    base = reported_at or now_utc()
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    return base + timedelta(minutes=grace_period_minutes())


def _parse_iso(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        # Supabase returns ISO 8601 UTC with 'Z' or +00:00
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        return None


def is_deadline_expired(deadline_iso: Optional[str]) -> bool:
    dt = _parse_iso(deadline_iso)
    if not dt:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return now_utc() >= dt


def determine_finalization(reporter_role: str) -> Dict[str, str]:
    """
    Map reporter_role -> (final_status, escrow_action).

    - provider reports → no response → user_no_show → release escrow to provider
    - customer reports → no response → provider_no_show → refund escrow to customer
    """
    if reporter_role == ROLE_PROVIDER:
        return {"final_status": STATUS_USER_NO_SHOW, "escrow_action": "release_to_provider"}
    return {"final_status": STATUS_PROVIDER_NO_SHOW, "escrow_action": "refund_to_customer"}


async def finalize_expired_no_shows(
    supabase,
    release_escrow_to_provider: Callable[..., Awaitable[Any]],
    refund_escrow_to_customer: Callable[..., Awaitable[Any]],
    create_notification: Callable[..., Awaitable[bool]],
) -> Dict[str, int]:
    """
    Scheduler job. Scans no_show_pending bookings past their deadline and finalizes them.

    Stays read-only on errors per booking (continues processing the rest).
    """
    stats = {"scanned": 0, "finalized": 0, "skipped": 0, "errors": 0}

    try:
        resp = (
            supabase.table("bookings")
            .select("*")
            .eq("status", STATUS_NO_SHOW_PENDING)
            .execute()
        )
        bookings = resp.data or []
    except Exception as e:
        logging.warning(f"[no_show] failed to fetch pending no_shows: {e}")
        return stats

    stats["scanned"] = len(bookings)

    for booking in bookings:
        try:
            booking_id = booking.get("id")
            deadline_iso = booking.get("no_show_deadline")
            reporter_role = (booking.get("no_show_reporter_role") or "").lower()
            customer_auth_id = booking.get("customer_auth_id")
            provider_auth_id = booking.get("provider_id")

            if not booking_id:
                continue
            if not deadline_iso:
                stats["skipped"] += 1
                continue
            if not is_deadline_expired(deadline_iso):
                stats["skipped"] += 1
                continue
            if reporter_role not in (ROLE_CUSTOMER, ROLE_PROVIDER):
                # Cannot decide finalization → leave for admin
                stats["skipped"] += 1
                continue

            # Re-fetch to guard against concurrent updates (defensive)
            cur = supabase.table("bookings").select("status, no_show_deadline").eq("id", booking_id).limit(1).execute()
            if not cur.data or cur.data[0].get("status") != STATUS_NO_SHOW_PENDING:
                stats["skipped"] += 1
                continue

            finalization = determine_finalization(reporter_role)
            final_status = finalization["final_status"]
            action = finalization["escrow_action"]

            # Apply status FIRST so a duplicate run cannot double-process
            update_resp = (
                supabase.table("bookings")
                .update({"status": final_status})
                .eq("id", booking_id)
                .eq("status", STATUS_NO_SHOW_PENDING)  # conditional - prevents race
                .execute()
            )
            if not update_resp.data:
                # Someone else already finalized
                stats["skipped"] += 1
                continue

            # Apply escrow change using existing safe helpers
            try:
                if action == "release_to_provider" and provider_auth_id and customer_auth_id:
                    await release_escrow_to_provider(booking_id, provider_auth_id, customer_auth_id)
                elif action == "refund_to_customer" and customer_auth_id:
                    await refund_escrow_to_customer(booking_id, customer_auth_id)
            except Exception as escrow_err:
                logging.warning(f"[no_show] escrow action failed for booking {booking_id}: {escrow_err}")

            # Notify both parties
            try:
                # Notify customer
                if customer_auth_id:
                    if final_status == STATUS_USER_NO_SHOW:
                        await create_notification(
                            recipient_auth_id=customer_auth_id,
                            notification_type="no_show_finalized",
                            title="Booking marked as no-show",
                            message="You did not respond in time. The booking has been finalized as a no-show.",
                            metadata={"booking_id": booking_id, "outcome": final_status, "role": "customer"},
                        )
                    else:  # provider_no_show
                        await create_notification(
                            recipient_auth_id=customer_auth_id,
                            notification_type="no_show_finalized",
                            title="Provider no-show confirmed",
                            message="The provider did not respond. Your refund has been processed.",
                            metadata={"booking_id": booking_id, "outcome": final_status, "role": "customer"},
                        )

                # Notify provider
                if provider_auth_id:
                    if final_status == STATUS_USER_NO_SHOW:
                        await create_notification(
                            recipient_auth_id=provider_auth_id,
                            notification_type="no_show_finalized",
                            title="User no-show confirmed",
                            message="The customer did not respond. Payment has been released to your wallet.",
                            metadata={"booking_id": booking_id, "outcome": final_status, "role": "provider"},
                        )
                    else:
                        await create_notification(
                            recipient_auth_id=provider_auth_id,
                            notification_type="no_show_finalized",
                            title="Booking marked as no-show",
                            message="You did not respond in time. The booking has been finalized as a no-show.",
                            metadata={"booking_id": booking_id, "outcome": final_status, "role": "provider"},
                        )
            except Exception as notif_err:
                logging.warning(f"[no_show] notify error for booking {booking_id}: {notif_err}")

            stats["finalized"] += 1

        except Exception as inner:
            stats["errors"] += 1
            logging.warning(f"[no_show] error processing booking {booking.get('id')}: {inner}")
            continue

    logging.info(
        f"[no_show] scanned={stats['scanned']} finalized={stats['finalized']} "
        f"skipped={stats['skipped']} errors={stats['errors']}"
    )
    return stats
