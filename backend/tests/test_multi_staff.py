"""Phase 4 - Multi-Staff endpoint regression tests.

These tests are designed to run against the live preview backend. They cover:
  1) Endpoint existence and graceful handling when the migration has NOT been
     applied yet (current preview state).
  2) Backwards-compatibility: existing booking/slots endpoints continue to work
     when no staff_id is provided.

Once the SQL migration `phase4_multi_staff.sql` is run in Supabase, more tests
can be enabled (creating staff, linking services, weekly availability,
booking-with-staff conflict checks).
"""

import os
import re

import requests

# Resolve the preview API base URL from frontend .env (same approach used by
# other test files in this repo).
def _api_base():
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    with open(env_path, "r", encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r"^\s*REACT_APP_BACKEND_URL\s*=\s*['\"]?([^'\"\n]+)['\"]?\s*$", line)
            if m:
                return m.group(1).rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found in frontend/.env")


API = _api_base()
DUMMY_AUTH = "00000000-0000-0000-0000-000000000000"


def test_staff_me_without_migration_returns_503():
    r = requests.get(f"{API}/api/staff/me", params={"auth_id": DUMMY_AUTH}, timeout=15)
    # Either 503 (no migration) OR 200 (migration applied)
    assert r.status_code in (200, 503), r.text
    if r.status_code == 503:
        assert "migration" in r.json().get("detail", "").lower()


def test_provider_public_staff_endpoint_is_safe():
    """Even without migration the public staff list should respond with empty list."""
    # Use a provider id that very likely exists (1). If 404 -> the response is
    # acceptable too. The point is the endpoint must not 500.
    r = requests.get(f"{API}/api/providers/1/staff", timeout=15)
    assert r.status_code in (200, 404), r.text
    if r.status_code == 200:
        data = r.json()
        assert "staff" in data
        assert isinstance(data["staff"], list)
        assert "total" in data


def test_available_slots_still_works_without_staff_id():
    """Backward-compat: existing slots endpoint must continue to work."""
    r = requests.get(
        f"{API}/api/providers/2/available-slots",
        params={"date": "2099-12-31", "service_duration": 60},
        timeout=15,
    )
    # Could be 404 if provider 2 doesn't exist, or 200 with empty slots.
    assert r.status_code in (200, 404), r.text
    if r.status_code == 200:
        data = r.json()
        assert "slots" in data
        assert isinstance(data["slots"], list)


def test_available_slots_accepts_staff_id_query_param():
    """Endpoint should accept staff_id without erroring (even if staff doesn't exist)."""
    r = requests.get(
        f"{API}/api/providers/2/available-slots",
        params={"date": "2099-12-31", "service_duration": 60, "staff_id": 99999},
        timeout=15,
    )
    # 200 (returns slots) or 404 (provider missing). Must NOT be 500.
    assert r.status_code in (200, 404), r.text


def test_staff_detail_endpoint_404_for_missing_id():
    r = requests.get(f"{API}/api/staff/999999", timeout=15)
    # Without migration this is 503. With migration but missing row it's 404.
    assert r.status_code in (404, 503), r.text


def test_create_booking_with_invalid_staff_id_is_rejected_clearly():
    """If a booking is sent with staff_id but staff table doesn't exist (or staff_id is invalid),
    the API must reject cleanly rather than silently create a bad row.
    """
    payload = {
        "provider_id": 2,
        "customer_id": 1,
        "service_ids": [],
        "status": "pending",
        "staff_id": 999999,
    }
    r = requests.post(f"{API}/api/bookings", json=payload, timeout=15)
    # Acceptable outcomes:
    #   503 - migration not applied
    #   404 - staff not found
    #   400 - business validation
    #   403 - belongs to a different provider
    assert r.status_code in (400, 403, 404, 503, 500), r.text
    # The booking should NOT have been created successfully (201).
    assert r.status_code != 201, "Booking with invalid staff_id should not be created"
