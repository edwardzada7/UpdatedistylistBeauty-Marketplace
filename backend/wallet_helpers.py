"""
Wallet helpers for safe, additive improvements to the wallet & earnings system.

This module is purely additive: it does NOT modify any database schema, table,
or column. It only provides:
  - Category derivation for existing wallet_transactions rows
  - Normalization of transaction rows for API responses
  - Helpers to compute balance / earnings from transactions

Rule of truth for provider earnings:
  earnings = SUM(amount) where category == ESCROW_RELEASE AND direction == credit

Rule of truth for wallet balance (from transactions):
  balance = SUM(credit amounts excluding ESCROW_HOLD) - SUM(debit amounts excluding escrow movements)

We do NOT change the stored wallet balance unless explicitly invoked via the
admin recalculate endpoint.
"""

from typing import Any, Dict, List, Optional
import logging

# Canonical transaction categories
CATEGORY_TOPUP = "TOPUP"
CATEGORY_ESCROW_HOLD = "ESCROW_HOLD"
CATEGORY_ESCROW_RELEASE = "ESCROW_RELEASE"
CATEGORY_REFUND = "REFUND"
CATEGORY_WITHDRAWAL = "WITHDRAWAL"
CATEGORY_PAYOUT = "PAYOUT"
CATEGORY_ADJUSTMENT = "ADJUSTMENT"

VALID_CATEGORIES = {
    CATEGORY_TOPUP,
    CATEGORY_ESCROW_HOLD,
    CATEGORY_ESCROW_RELEASE,
    CATEGORY_REFUND,
    CATEGORY_WITHDRAWAL,
    CATEGORY_PAYOUT,
    CATEGORY_ADJUSTMENT,
}


def categorize_transaction(tx: Dict[str, Any]) -> str:
    """
    Derive a semantic category from an existing wallet_transactions row.

    Uses (in order): metadata.category if present, reference prefix, description heuristics.
    Falls back to ADJUSTMENT when undetermined.
    """
    if not tx:
        return CATEGORY_ADJUSTMENT

    # 1) If metadata already carries a category, prefer it
    metadata = tx.get("metadata") or {}
    if isinstance(metadata, dict):
        meta_cat = (metadata.get("category") or "").upper()
        if meta_cat in VALID_CATEGORIES:
            return meta_cat

    reference = (tx.get("reference") or "").lower()
    description = (tx.get("description") or "").lower()
    direction = (tx.get("direction") or "").lower()
    booking_id = tx.get("booking_id")

    # 2) Reference-prefix heuristics (most reliable - we control these prefixes)
    if reference.startswith("escrow_release_"):
        return CATEGORY_ESCROW_RELEASE
    if reference.startswith("escrow_refund_"):
        return CATEGORY_REFUND
    if reference.startswith("withdraw_paid_"):
        return CATEGORY_WITHDRAWAL
    if reference.startswith("withdraw_req_") or reference.startswith("withdraw_rejected_"):
        # Pending or rejected withdrawal log row (no balance impact)
        return CATEGORY_WITHDRAWAL
    if reference.startswith("wallet_pay_") or reference.startswith("booking_pay_"):
        # Wallet-funded booking payment - moves from available -> escrow
        # Direction is debit on customer side
        return CATEGORY_ESCROW_HOLD

    # 3) Description-based heuristics (legacy / human readable)
    if "top-up" in description or "topup" in description or "wallet top" in description:
        return CATEGORY_TOPUP
    if "earnings from booking" in description:
        return CATEGORY_ESCROW_RELEASE
    if "escrow released" in description or "escrow release" in description:
        return CATEGORY_ESCROW_RELEASE
    if "escrow hold" in description or "hold for booking" in description:
        return CATEGORY_ESCROW_HOLD
    if "refund" in description:
        return CATEGORY_REFUND
    if "withdrawal" in description or "withdraw" in description:
        return CATEGORY_WITHDRAWAL
    if "payout" in description:
        return CATEGORY_PAYOUT

    # 4) Last resort fallbacks based on booking_id + direction
    if booking_id:
        # Has a booking_id - likely an escrow movement
        return CATEGORY_ESCROW_HOLD if direction == "debit" else CATEGORY_ESCROW_RELEASE

    return CATEGORY_ADJUSTMENT


def normalize_transaction(tx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Return a standardized transaction object suitable for API responses.

    Output keys: id, type (category), direction (UPPER), amount, description,
                 created_at, booking_id, reference, status, raw_type
    """
    if not tx:
        return {}

    category = categorize_transaction(tx)
    direction_lower = (tx.get("direction") or "").lower()
    direction_upper = direction_lower.upper() if direction_lower else ""

    try:
        amount = float(tx.get("amount") or 0)
    except (TypeError, ValueError):
        amount = 0.0

    return {
        "id": tx.get("id"),
        "type": category,                        # semantic category (TOPUP, ESCROW_RELEASE, etc.)
        "direction": direction_upper,            # CREDIT or DEBIT
        "amount": amount,
        "description": tx.get("description") or _default_description(category, tx),
        "created_at": tx.get("created_at"),
        "booking_id": tx.get("booking_id"),
        "reference": tx.get("reference"),
        "status": tx.get("status") or "completed",
        # keep the raw DB "type" value (credit/debit) for full backward compat
        "raw_type": tx.get("type"),
    }


def _default_description(category: str, tx: Dict[str, Any]) -> str:
    """Generate a friendly description if none is present."""
    booking_id = tx.get("booking_id")
    booking_suffix = f" for booking #{booking_id}" if booking_id else ""
    labels = {
        CATEGORY_TOPUP: "Wallet top-up",
        CATEGORY_ESCROW_HOLD: f"Escrow hold{booking_suffix}",
        CATEGORY_ESCROW_RELEASE: f"Earnings released{booking_suffix}",
        CATEGORY_REFUND: f"Refund{booking_suffix}",
        CATEGORY_WITHDRAWAL: "Withdrawal",
        CATEGORY_PAYOUT: "Payout",
        CATEGORY_ADJUSTMENT: "Wallet adjustment",
    }
    return labels.get(category, "Wallet transaction")


def is_completed(tx: Dict[str, Any]) -> bool:
    """Treat missing/None status as completed for backwards compat."""
    status = (tx.get("status") or "completed").lower()
    return status == "completed"


def compute_wallet_balance_from_tx(transactions: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Compute balances from a list of wallet_transactions rows.

    Returns:
      {
        "available_balance": float,  # SUM(credit) - SUM(debit) excluding escrow holds/releases
        "escrow_balance": float,     # net escrow movement (customer side)
        "total_credits": float,
        "total_debits": float,
      }

    Notes:
      * Only completed transactions count.
      * Available balance excludes ESCROW_HOLD (debit) and ESCROW_RELEASE (debit, customer side)
        because those just move funds within the same wallet (available <-> escrow).
      * For providers, ESCROW_RELEASE is a credit which directly hits available_balance.
    """
    available = 0.0
    escrow = 0.0
    total_credits = 0.0
    total_debits = 0.0

    for tx in transactions or []:
        if not is_completed(tx):
            continue
        try:
            amount = float(tx.get("amount") or 0)
        except (TypeError, ValueError):
            continue
        if amount <= 0:
            continue

        direction = (tx.get("direction") or "").lower()
        category = categorize_transaction(tx)

        if direction == "credit":
            total_credits += amount
            # Affects available balance unless the credit is purely an escrow internal move
            # For providers: ESCROW_RELEASE credit -> available
            # For customers: REFUND credit -> available
            # TOPUP -> available
            # ESCROW_HOLD credit shouldn't happen on the same wallet under our model
            available += amount
        elif direction == "debit":
            total_debits += amount
            if category == CATEGORY_ESCROW_HOLD:
                # Customer side: funds moved from available -> escrow
                available -= amount
                escrow += amount
            elif category == CATEGORY_ESCROW_RELEASE:
                # Customer side debit on release: funds leave escrow (to provider)
                escrow -= amount
            elif category == CATEGORY_REFUND:
                # Refund debit shouldn't happen, but for safety
                available -= amount
            else:
                # WITHDRAWAL, PAYOUT, ADJUSTMENT debit -> reduces available
                available -= amount

    # Never report negative escrow / available from history; clamp to 0
    return {
        "available_balance": round(max(0.0, available), 2),
        "escrow_balance": round(max(0.0, escrow), 2),
        "total_credits": round(total_credits, 2),
        "total_debits": round(total_debits, 2),
    }


def compute_provider_earnings(transactions: List[Dict[str, Any]]) -> float:
    """
    Sum of ESCROW_RELEASE credit transactions (completed only).
    This is the single source of truth for provider earnings.
    """
    total = 0.0
    for tx in transactions or []:
        if not is_completed(tx):
            continue
        if (tx.get("direction") or "").lower() != "credit":
            continue
        if categorize_transaction(tx) != CATEGORY_ESCROW_RELEASE:
            continue
        try:
            total += float(tx.get("amount") or 0)
        except (TypeError, ValueError):
            continue
    return round(total, 2)
