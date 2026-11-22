"""Admin announcements: one message to all users, customers only, or providers only.

Each recipient gets an in-app notification (type "announcement") and a device push (Expo).
Delivery runs in the background so the admin screen answers immediately.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

import requests
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from consultation_routes import _admin_key

logger = logging.getLogger(__name__)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
PROVIDER_ROLES = ("stylist", "provider")


class BroadcastInput(BaseModel):
    title: str = Field(min_length=1, max_length=65)
    message: str = Field(min_length=1, max_length=240)
    audience: Literal["all", "customers", "providers"] = "all"
    send_push: bool = True


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def register_broadcast_routes(api_router: APIRouter, supabase: Any) -> None:
    def audience_auth_ids(audience: str) -> List[str]:
        ids: List[str] = []
        start = 0
        while True:
            rows = supabase.table("users").select("auth_id, role").range(start, start + 999).execute().data or []
            for row in rows:
                if not row.get("auth_id"):
                    continue
                is_provider = row.get("role") in PROVIDER_ROLES
                if audience == "all" or (audience == "providers" and is_provider) or (audience == "customers" and not is_provider and row.get("role") != "admin"):
                    ids.append(row["auth_id"])
            if len(rows) < 1000:
                break
            start += 1000
        return ids

    def tokens_for(auth_ids: List[str]) -> List[str]:
        tokens: List[str] = []
        for i in range(0, len(auth_ids), 200):
            chunk = auth_ids[i : i + 200]
            for row in supabase.table("push_tokens").select("token").in_("auth_id", chunk).execute().data or []:
                if str(row.get("token", "")).startswith(("ExponentPushToken", "ExpoPushToken")):
                    tokens.append(row["token"])
        return tokens

    def deliver(broadcast_id: Optional[int], payload: BroadcastInput, auth_ids: List[str]) -> None:
        created = _now()
        saved = 0
        try:
            for i in range(0, len(auth_ids), 500):
                batch = [
                    {"auth_id": a, "type": "announcement", "title": payload.title, "message": payload.message, "read": False, "created_at": created, "metadata": {"broadcast_id": broadcast_id}}
                    for a in auth_ids[i : i + 500]
                ]
                try:
                    supabase.table("notifications").insert(batch).execute()
                except Exception:  # noqa: BLE001 - metadata column may not exist
                    supabase.table("notifications").insert([{k: v for k, v in r.items() if k != "metadata"} for r in batch]).execute()
                saved += len(batch)
        except Exception as exc:  # noqa: BLE001
            logger.error("[broadcast] saving notifications failed: %s", exc)

        pushed = 0
        if payload.send_push:
            try:
                tokens = tokens_for(auth_ids)
                for i in range(0, len(tokens), 100):
                    chunk = tokens[i : i + 100]
                    messages = [{"to": t, "title": payload.title, "body": payload.message, "sound": "default", "channelId": "default", "data": {"type": "announcement"}} for t in chunk]
                    resp = requests.post(EXPO_PUSH_URL, json=messages, timeout=15)
                    for msg, ticket in zip(messages, (resp.json().get("data") or [])):
                        if ticket.get("status") == "ok":
                            pushed += 1
                        elif (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                            supabase.table("push_tokens").delete().eq("token", msg["to"]).execute()
            except Exception as exc:  # noqa: BLE001
                logger.error("[broadcast] push failed: %s", exc)

        if broadcast_id:
            try:
                supabase.table("broadcasts").update({"in_app_sent": saved, "push_sent": pushed, "status": "sent"}).eq("id", broadcast_id).execute()
            except Exception:  # noqa: BLE001
                pass
        logger.info("[broadcast] %s: %s in-app, %s push", broadcast_id, saved, pushed)

    @api_router.get("/admin/broadcast/preview", dependencies=[Depends(_admin_key)])
    def broadcast_preview(audience: Literal["all", "customers", "providers"] = Query("all")):
        ids = audience_auth_ids(audience)
        return {"audience": audience, "recipients": len(ids), "devices": len(tokens_for(ids))}

    @api_router.post("/admin/broadcast", status_code=202, dependencies=[Depends(_admin_key)])
    def send_broadcast(payload: BroadcastInput, background: BackgroundTasks):
        ids = audience_auth_ids(payload.audience)
        if not ids:
            raise HTTPException(status_code=400, detail="No recipients for that audience")
        broadcast_id = None
        try:
            res = supabase.table("broadcasts").insert({"title": payload.title, "message": payload.message, "audience": payload.audience, "recipients": len(ids), "send_push": payload.send_push, "status": "sending"}).execute()
            broadcast_id = (res.data or [{}])[0].get("id")
        except Exception as exc:  # noqa: BLE001 - history is optional until phase32 is run
            logger.warning("[broadcast] history table unavailable: %s", exc)
        background.add_task(deliver, broadcast_id, payload, ids)
        return {"status": "sending", "broadcast_id": broadcast_id, "recipients": len(ids)}

    @api_router.get("/admin/broadcasts", dependencies=[Depends(_admin_key)])
    def list_broadcasts(limit: int = Query(30, ge=1, le=100)):
        try:
            rows = supabase.table("broadcasts").select("*").order("created_at", desc=True).limit(limit).execute().data or []
        except Exception:  # noqa: BLE001
            rows = []
        return {"items": rows}
