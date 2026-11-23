"""Admin earnings ledger: what the platform actually earned, per stream, vs money it only holds for others.

Read-only: everything is derived from existing tables, nothing is written.
  Platform revenue : booking commission, shop commission, withdrawal fees, promotions, Pro subscriptions.
  Held for others  : wallet balances, escrow, pending withdrawals (customer / provider money, not revenue).
  Gateways         : Flutterwave = wallet top-ups only; Paystack = shop, promotions, subscriptions, everything else.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from consultation_routes import _admin_key

logger = logging.getLogger(__name__)

BOOKING_RELEASED = ("completed", "user_no_show")          # escrow paid out to the provider
WITHDRAWAL_PAID = ("approved", "paid", "completed", "processed")
SHOP_REVENUE_STATUSES = ("confirmed", "shipped", "delivered", "completed", "paid")


def register_earnings_routes(api_router: APIRouter, supabase: Any, table_exists: Callable[[str], bool]) -> None:
    def fetch_all(table: str, columns: str = "*") -> List[Dict[str, Any]]:
        """Page through a table (PostgREST returns at most 1000 rows per request)."""
        rows: List[Dict[str, Any]] = []
        start = 0
        while True:
            chunk = supabase.table(table).select(columns).range(start, start + 999).execute().data or []
            rows.extend(chunk)
            if len(chunk) < 1000 or start > 50000:
                break
            start += 1000
        return rows

    def safe(table: str, columns: str = "*") -> Optional[List[Dict[str, Any]]]:
        try:
            if not table_exists(table):
                return None
            return fetch_all(table, columns)
        except Exception as exc:  # noqa: BLE001
            logger.warning("earnings: %s unreadable: %s", table, exc)
            return None

    def num(v: Any) -> float:
        try:
            return float(v or 0)
        except (TypeError, ValueError):
            return 0.0

    @api_router.get("/admin/earnings", dependencies=[Depends(_admin_key)])
    def admin_earnings(days: int = Query(30, ge=0, le=3650)):
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat() if days else None
        notes: List[str] = []

        def in_period(row: Dict[str, Any]) -> bool:
            return since is None or str(row.get("created_at") or "") >= since

        streams: Dict[str, Dict[str, float]] = {
            k: {"period": 0.0, "all_time": 0.0}
            for k in ("booking_commission", "shop_commission", "withdrawal_fees", "promotions", "subscriptions")
        }

        def add(stream: str, amount: float, row: Dict[str, Any]) -> None:
            streams[stream]["all_time"] += amount
            if in_period(row):
                streams[stream]["period"] += amount

        # Booking commission: only bookings whose escrow was released to the provider
        bookings = safe("bookings", "id, status, platform_fee_amount, created_at")
        if bookings is None:
            notes.append("Bookings could not be read, so booking commission is missing.")
        else:
            for b in bookings:
                if b.get("status") in BOOKING_RELEASED:
                    add("booking_commission", num(b.get("platform_fee_amount")), b)
            if streams["booking_commission"]["all_time"] == 0 and any(b.get("status") in BOOKING_RELEASED for b in bookings):
                notes.append("Completed bookings exist but no booking commission has been recorded. Set the booking commission % in Financial Settings (only bookings completed after that are charged).")

        # Shop commission: recorded on confirmed orders
        orders = safe("shop_orders")
        shop_sales = 0.0
        if orders is not None:
            for o in orders:
                if (o.get("status") or "") in SHOP_REVENUE_STATUSES:
                    shop_sales += num(o.get("total_amount") or o.get("amount"))
                    add("shop_commission", num(o.get("platform_fee_amount") or o.get("commission_amount") or o.get("shop_commission_amount")), o)
            if streams["shop_commission"]["all_time"] == 0 and shop_sales > 0:
                notes.append("Shop sales exist but no shop commission is being recorded on orders yet.")

        # Withdrawal fees: only once the payout is approved (pending/rejected requests are not revenue)
        withdrawals = safe("withdrawal_requests", "gross_amount, fee_amount, net_amount, status, created_at") or []
        paid_out = 0.0
        pending_gross = 0.0
        for w in withdrawals:
            if w.get("status") in WITHDRAWAL_PAID:
                add("withdrawal_fees", num(w.get("fee_amount")), w)
                paid_out += num(w.get("net_amount"))
            elif w.get("status") == "pending":
                pending_gross += num(w.get("gross_amount"))

        # Promotions and Pro: 100% platform revenue, paid through Paystack
        promo = safe("promo_payments", "amount, purpose, status, created_at") or []
        for p in promo:
            if p.get("status") == "success":
                add("subscriptions" if p.get("purpose") == "subscription" else "promotions", num(p.get("amount")), p)

        # Money held for others
        wallets = safe("wallets", "balance, escrow_balance") or []
        wallet_balances = sum(num(w.get("balance")) for w in wallets)
        escrow = sum(num(w.get("escrow_balance")) for w in wallets)

        # Money in, per gateway (successful, real-money payments only)
        inflow: Dict[tuple, Dict[str, float]] = {}
        for p in safe("payments", "amount, purpose, payment_provider, status, created_at") or []:
            provider = p.get("payment_provider") or "unknown"
            if p.get("status") != "success" or provider == "internal":
                continue
            key = (provider, p.get("purpose") or "other")
            slot = inflow.setdefault(key, {"count": 0, "all_time": 0.0, "period": 0.0})
            slot["count"] += 1
            slot["all_time"] += num(p.get("amount"))
            if in_period(p):
                slot["period"] += num(p.get("amount"))
        promo_in = sum(num(p.get("amount")) for p in promo if p.get("status") == "success")
        if promo_in:
            inflow[("paystack", "promotions_and_pro")] = {
                "count": sum(1 for p in promo if p.get("status") == "success"),
                "all_time": promo_in,
                "period": sum(num(p.get("amount")) for p in promo if p.get("status") == "success" and in_period(p)),
            }
        gateways = [
            {"gateway": g, "purpose": purpose, "count": int(v["count"]), "amount": round(v["all_time"], 2), "amount_period": round(v["period"], 2)}
            for (g, purpose), v in sorted(inflow.items())
        ]
        if any(g["gateway"] == "flutterwave" and g["purpose"] != "wallet_topup" for g in gateways):
            notes.append("Flutterwave has payments that are not wallet top-ups. It should only be used for top-ups.")

        revenue_period = sum(v["period"] for v in streams.values())
        revenue_all = sum(v["all_time"] for v in streams.values())
        return {
            "days": days,
            "streams": {k: {"period": round(v["period"], 2), "all_time": round(v["all_time"], 2)} for k, v in streams.items()},
            "revenue": {"period": round(revenue_period, 2), "all_time": round(revenue_all, 2)},
            "held_for_others": {
                "wallet_balances": round(wallet_balances, 2),
                "escrow": round(escrow, 2),
                "pending_withdrawals": round(pending_gross, 2),
                "note": "Customer and provider money. Not revenue. Pending withdrawals are still inside wallet balances.",
            },
            "gateways": gateways,
            "paid_out_to_providers": round(paid_out, 2),
            "shop_sales_total": round(shop_sales, 2),
            "notes": notes,
        }
