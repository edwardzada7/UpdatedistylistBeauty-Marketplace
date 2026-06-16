"""Flutterwave payment endpoint smoke tests (Phase 4.x).

These tests do NOT trigger actual payments. They only verify:
  - Initialize correctly rejects unsupported `purpose` values.
  - Initialize correctly rejects bad input (zero amount, missing email).
  - Initialize returns a real Flutterwave authorization_url for a wallet_topup.
  - Verify rejects requests with no identifier.
  - Webhook rejects calls with missing / wrong `verif-hash`.
  - Paystack endpoints still exist (dormant fallback for rollback).
"""

import os
import re
import requests


def _api_base():
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    with open(env_path, "r", encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r"^\s*REACT_APP_BACKEND_URL\s*=\s*['\"]?([^'\"\n]+)['\"]?\s*$", line)
            if m:
                return m.group(1).rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found in frontend/.env")


API = _api_base()


# ---------------- INITIALIZE ----------------

def test_flw_init_rejects_non_wallet_topup_purpose():
    r = requests.post(
        f"{API}/api/payments/flutterwave/initialize",
        json={"amount": 100, "email": "test@example.com", "purpose": "booking_escrow"},
        timeout=20,
    )
    assert r.status_code == 400, r.text
    assert "wallet" in r.text.lower()


def test_flw_init_rejects_invalid_email():
    r = requests.post(
        f"{API}/api/payments/flutterwave/initialize",
        json={"amount": 100, "email": "not-an-email", "purpose": "wallet_topup"},
        timeout=20,
    )
    # Pydantic EmailStr validation
    assert r.status_code in (400, 422), r.text


def test_flw_init_rejects_zero_amount():
    r = requests.post(
        f"{API}/api/payments/flutterwave/initialize",
        json={"amount": 0, "email": "test@example.com", "purpose": "wallet_topup"},
        timeout=20,
    )
    assert r.status_code == 400, r.text


def test_flw_init_returns_authorization_url():
    """Real call to Flutterwave LIVE API for a tiny 100 NGN top-up init.
    Does NOT complete payment; only confirms a checkout link is generated.
    Skipped if FLW_SECRET_KEY is not configured."""
    if not os.environ.get("FLW_SECRET_KEY"):
        return
    r = requests.post(
        f"{API}/api/payments/flutterwave/initialize",
        json={
            "amount": 100,
            "email": "smoketest@istylist.test",
            "purpose": "wallet_topup",
            "name": "Smoke Test",
            "redirect_url": "https://example.com/wallet",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") is True
    assert data.get("provider") == "flutterwave"
    url = data.get("authorization_url") or ""
    assert url.startswith("https://"), url
    assert "flutterwave" in url.lower() or "checkout" in url.lower(), url
    ref = data.get("reference") or ""
    assert ref.startswith("istylist_wallet_topup_flw_"), ref


# ---------------- VERIFY ----------------

def test_flw_verify_requires_identifier():
    r = requests.get(f"{API}/api/payments/flutterwave/verify", timeout=20)
    assert r.status_code == 400, r.text


def test_flw_verify_unknown_tx_ref_fails():
    """Unknown reference should NOT silently succeed; Flutterwave returns
    a failure shape which we map to 400/502."""
    r = requests.get(
        f"{API}/api/payments/flutterwave/verify",
        params={"reference": "istylist_wallet_topup_flw_doesnotexist_x9z"},
        timeout=30,
    )
    assert r.status_code in (400, 502), r.text


# ---------------- WEBHOOK ----------------

def test_flw_webhook_rejects_missing_signature():
    r = requests.post(
        f"{API}/api/webhooks/flutterwave",
        json={"event": "charge.completed", "data": {}},
        timeout=15,
    )
    assert r.status_code == 401, r.text


def test_flw_webhook_rejects_wrong_signature():
    r = requests.post(
        f"{API}/api/webhooks/flutterwave",
        headers={"verif-hash": "totally-wrong-secret"},
        json={"event": "charge.completed", "data": {}},
        timeout=15,
    )
    assert r.status_code == 401, r.text


def test_flw_webhook_accepts_valid_signature_unknown_event():
    secret = os.environ.get("FLW_WEBHOOK_SECRET")
    if not secret:
        return
    r = requests.post(
        f"{API}/api/webhooks/flutterwave",
        headers={"verif-hash": secret},
        json={"event": "some.other.event", "data": {}},
        timeout=15,
    )
    # Valid signature, no settle action - should return 200 ok
    assert r.status_code == 200, r.text


# ---------------- ROLLBACK FALLBACK: Paystack endpoints must still exist ----------------

def test_paystack_endpoints_still_dormant():
    """Critical: rollback path requires the Paystack endpoints to still respond
    (we just don't point the frontend at them). They should be reachable, even
    if they error out for missing keys."""
    # Initialize endpoint should exist (400 or 503, NOT 404)
    r = requests.post(
        f"{API}/api/payments/paystack/initialize",
        json={"amount": 100, "email": "x@y.com", "purpose": "wallet_topup"},
        timeout=15,
    )
    assert r.status_code != 404, "Paystack endpoint was removed - rollback broken"

    # Verify endpoint should exist
    r = requests.get(
        f"{API}/api/payments/paystack/verify",
        params={"reference": "doesnotexist"},
        timeout=15,
    )
    assert r.status_code != 404, "Paystack verify endpoint was removed - rollback broken"
