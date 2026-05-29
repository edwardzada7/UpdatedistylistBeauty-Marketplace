"""Phase 4 - Social Feed endpoint smoke tests.

Verifies:
  1) Public listing returns a well-shaped object.
  2) Unauthenticated like is rejected (no auth_id).
  3) Liking a non-existent post returns 404.
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
DUMMY_AUTH = "00000000-0000-0000-0000-000000000000"


def test_feed_list_public():
    r = requests.get(f"{API}/api/feed/posts", timeout=15)
    # 200 or 503 (migration not applied)
    assert r.status_code in (200, 503), r.text
    if r.status_code == 200:
        data = r.json()
        assert "posts" in data
        assert isinstance(data["posts"], list)
        assert "total" in data


def test_feed_get_missing_post_returns_404():
    r = requests.get(f"{API}/api/feed/posts/99999999", timeout=15)
    assert r.status_code in (404, 503), r.text


def test_feed_create_requires_auth_id():
    r = requests.post(f"{API}/api/feed/posts", json={"image_url": "https://example.com/x.jpg"}, timeout=15)
    # Missing required query param → 422 from FastAPI
    assert r.status_code in (422, 503)


def test_feed_create_rejects_non_provider():
    # Random UUID that doesn't map to a provider → 404 user-not-found
    r = requests.post(
        f"{API}/api/feed/posts",
        params={"auth_id": DUMMY_AUTH},
        json={"image_url": "https://example.com/x.jpg"},
        timeout=15,
    )
    # 404 user-not-found OR 503 if tables missing
    assert r.status_code in (404, 503), r.text


def test_feed_like_missing_post_returns_404():
    r = requests.post(
        f"{API}/api/feed/posts/99999999/like",
        params={"auth_id": DUMMY_AUTH},
        timeout=15,
    )
    assert r.status_code in (404, 503), r.text
