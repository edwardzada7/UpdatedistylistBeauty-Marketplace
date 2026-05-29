"""Phase 4 - Admin Dashboard Foundation smoke tests."""

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
ADMIN_KEY = os.environ.get("ADMIN_DASH_KEY", "istylist_admin_secret_key_2026")


def test_admin_stats_requires_key():
    r = requests.get(f"{API}/api/admin/stats", timeout=15)
    assert r.status_code == 401, r.text


def test_admin_stats_wrong_key():
    r = requests.get(
        f"{API}/api/admin/stats",
        headers={"X-ADMIN-KEY": "wrong-key"},
        timeout=15,
    )
    assert r.status_code == 401


def test_admin_stats_shape():
    r = requests.get(
        f"{API}/api/admin/stats",
        headers={"X-ADMIN-KEY": ADMIN_KEY},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("users", "bookings", "wallets", "withdrawals", "feed", "reviews"):
        assert k in data, f"missing key {k} in stats: {data}"
    assert "total" in data["users"]
    assert "total" in data["bookings"]


def test_admin_recent_bookings():
    r = requests.get(
        f"{API}/api/admin/recent-bookings?limit=5",
        headers={"X-ADMIN-KEY": ADMIN_KEY},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "bookings" in data
    assert isinstance(data["bookings"], list)


def test_admin_providers():
    r = requests.get(
        f"{API}/api/admin/providers?limit=5",
        headers={"X-ADMIN-KEY": ADMIN_KEY},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "providers" in data
    assert isinstance(data["providers"], list)


def test_admin_reported_no_shows():
    r = requests.get(
        f"{API}/api/admin/reported-no-shows?limit=5",
        headers={"X-ADMIN-KEY": ADMIN_KEY},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data
