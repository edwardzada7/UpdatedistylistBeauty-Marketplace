"""Expo push notifications + public legal/support web pages."""
import html
import logging
import os
from typing import Optional

import requests
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "support@istylist.app")
_supabase = None


class PushRegister(BaseModel):
    auth_id: str
    token: str
    platform: Optional[str] = None


class PushUnregister(BaseModel):
    token: str


def send_push_sync(auth_id: str, title: str, body: str, data: Optional[dict] = None) -> None:
    """Best-effort push to every device of a user. Never raises."""
    try:
        if not _supabase or not auth_id:
            return
        rows = _supabase.table("push_tokens").select("token").eq("auth_id", auth_id).execute().data or []
        messages = [
            {"to": r["token"], "title": title, "body": body, "sound": "default",
             "channelId": "default", "data": data or {}}
            for r in rows if str(r.get("token", "")).startswith(("ExponentPushToken", "ExpoPushToken"))
        ]
        if not messages:
            return
        resp = requests.post(EXPO_PUSH_URL, json=messages, timeout=5)
        # Remove tokens Expo says are no longer valid.
        for msg, ticket in zip(messages, (resp.json().get("data") or [])):
            if ticket.get("status") == "error" and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                _supabase.table("push_tokens").delete().eq("token", msg["to"]).execute()
    except Exception as e:  # noqa: BLE001
        logging.warning("[push] send failed: %s", e)


def _page(title: str, body_html: str) -> HTMLResponse:
    return HTMLResponse(
        f"<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        f"<meta name='viewport' content='width=device-width,initial-scale=1'><title>{html.escape(title)} - iStylist</title>"
        "<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:24px;line-height:1.6;color:#1b1830}"
        "h1{color:#120F2A}pre{white-space:pre-wrap;font-family:inherit}a{color:#6b3fd4}</style></head>"
        f"<body><h1>{html.escape(title)}</h1>{body_html}"
        "<hr><p><a href='/privacy'>Privacy</a> · <a href='/terms'>Terms</a> · "
        "<a href='/delete-account'>Delete account</a> · <a href='/support'>Support</a></p></body></html>"
    )


def _legal(slug: str, title: str) -> HTMLResponse:
    try:
        rows = _supabase.table("legal_pages").select("content").eq("slug", slug).limit(1).execute().data
        content = (rows[0]["content"] if rows else "This page is not available yet.").replace("{{TODAY}}", "")
    except Exception as e:  # noqa: BLE001
        logging.warning("[public] legal %s failed: %s", slug, e)
        content = "This page is temporarily unavailable."
    return _page(title, f"<pre>{html.escape(content)}</pre>")


def register_push_and_public(app, api_router: APIRouter, supabase) -> None:
    global _supabase
    _supabase = supabase

    @api_router.post("/push/register")
    async def push_register(body: PushRegister):
        if not body.token.startswith(("ExponentPushToken", "ExpoPushToken")):
            raise HTTPException(status_code=400, detail="Invalid push token")
        try:
            supabase.table("push_tokens").upsert(
                {"auth_id": body.auth_id, "token": body.token, "platform": body.platform},
                on_conflict="token",
            ).execute()
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Could not save push token: {e}")
        return {"ok": True}

    @api_router.post("/push/unregister")
    async def push_unregister(body: PushUnregister):
        try:
            supabase.table("push_tokens").delete().eq("token", body.token).execute()
        except Exception as e:  # noqa: BLE001
            logging.warning("[push] unregister failed: %s", e)
        return {"ok": True}

    @app.get("/privacy", response_class=HTMLResponse)
    async def public_privacy():
        return _legal("privacy", "Privacy Policy")

    @app.get("/terms", response_class=HTMLResponse)
    async def public_terms():
        return _legal("terms", "Terms of Service")

    @app.get("/support", response_class=HTMLResponse)
    async def public_support():
        e = html.escape(SUPPORT_EMAIL)
        return _page("Support", f"<p>Need help? Email <a href='mailto:{e}'>{e}</a>. "
                                "To report abuse, use the Report option inside the app or email us.</p>")

    @app.get("/delete-account", response_class=HTMLResponse)
    async def public_delete():
        e = html.escape(SUPPORT_EMAIL)
        return _page("Delete your account", (
            "<p><b>In the app:</b> Settings → Account → Delete account. Your profile, posts and messages "
            "are removed or anonymised.</p>"
            "<p>Records we must keep (for example payment and dispute records) are retained as required by law. "
            "Withdraw any wallet balance before deleting.</p>"
            f"<p><b>Cannot open the app?</b> Email <a href='mailto:{e}'>{e}</a> from your account email "
            "with the subject “Delete my account”.</p>"))
