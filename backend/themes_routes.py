"""
Seasonal themes (web + mobile).

Presets live in code; admins can change dates / on-off / banner text per theme without a migration
(stored in app_settings key 'seasonal_themes'). The active theme is picked by date in Africa/Lagos:
highest priority first, then the most recently started. Users may override on their device
(Auto / Default / a specific theme).
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Tailwind v3 colour scales (hex) used to re-map the app's purple / pink utility classes.
_RED = {"50": "#fef2f2", "100": "#fee2e2", "200": "#fecaca", "300": "#fca5a5", "400": "#f87171", "500": "#ef4444", "600": "#dc2626", "700": "#b91c1c", "800": "#991b1b", "900": "#7f1d1d"}
_GREEN = {"50": "#f0fdf4", "100": "#dcfce7", "200": "#bbf7d0", "300": "#86efac", "400": "#4ade80", "500": "#22c55e", "600": "#16a34a", "700": "#15803d", "800": "#166534", "900": "#14532d"}
_ROSE = {"50": "#fff1f2", "100": "#ffe4e6", "200": "#fecdd3", "300": "#fda4af", "400": "#fb7185", "500": "#f43f5e", "600": "#e11d48", "700": "#be123c", "800": "#9f1239", "900": "#881337"}
_PINK = {"50": "#fdf2f8", "100": "#fce7f3", "200": "#fbcfe8", "300": "#f9a8d4", "400": "#f472b6", "500": "#ec4899", "600": "#db2777", "700": "#be185d", "800": "#9d174d", "900": "#831843"}
_VIOLET = {"50": "#f5f3ff", "100": "#ede9fe", "200": "#ddd6fe", "300": "#c4b5fd", "400": "#a78bfa", "500": "#8b5cf6", "600": "#7c3aed", "700": "#6d28d9", "800": "#5b21b6", "900": "#4c1d95"}
_AMBER = {"50": "#fffbeb", "100": "#fef3c7", "200": "#fde68a", "300": "#fcd34d", "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706", "700": "#b45309", "800": "#92400e", "900": "#78350f"}
_EMERALD = {"50": "#ecfdf5", "100": "#d1fae5", "200": "#a7f3d0", "300": "#6ee7b7", "400": "#34d399", "500": "#10b981", "600": "#059669", "700": "#047857", "800": "#065f46", "900": "#064e3b"}
_LIME = {"50": "#f7fee7", "100": "#ecfccb", "200": "#d9f99d", "300": "#bef264", "400": "#a3e635", "500": "#84cc16", "600": "#65a30d", "700": "#4d7c0f", "800": "#3f6212", "900": "#365314"}

# start/end: "MM-DD" repeats every year; "YYYY-MM-DD" is a single window (moving feasts: admin updates yearly).
PRESETS: Dict[str, Dict[str, Any]] = {
    "christmas": {
        "name": "Christmas & festive season", "emoji": "🎄", "effect": "snow", "priority": 10,
        "start": "12-01", "end": "01-02",
        "primary": _RED, "secondary": _GREEN,
        "banner_title": "Season's greetings from iStylist 🎄",
        "banner_text": "Look your best this festive season. Book your Christmas glam today.",
    },
    "valentine": {
        "name": "Valentine's", "emoji": "💖", "effect": "hearts", "priority": 20,
        "start": "02-01", "end": "02-15",
        "primary": _ROSE, "secondary": _PINK,
        "banner_title": "Love is in the air 💖",
        "banner_text": "Treat yourself or someone special to a beauty session this Valentine's.",
    },
    "easter": {
        "name": "Easter", "emoji": "🐣", "effect": "confetti", "priority": 20,
        "start": "2027-03-22", "end": "2027-03-29",
        "primary": _VIOLET, "secondary": _AMBER,
        "banner_title": "Happy Easter 🐣",
        "banner_text": "Fresh look, fresh start. Book your Easter appointment now.",
    },
    "ramadan_eid": {
        "name": "Ramadan & Eid", "emoji": "🌙", "effect": "stars", "priority": 30,
        "start": "2027-02-08", "end": "2027-03-12",
        "primary": _EMERALD, "secondary": _AMBER,
        "banner_title": "Ramadan Kareem 🌙",
        "banner_text": "Wishing you a blessed season. Eid glam bookings are open.",
    },
    "independence": {
        "name": "Independence Day", "emoji": "🇳🇬", "effect": "confetti", "priority": 20,
        "start": "09-24", "end": "10-02",
        "primary": _GREEN, "secondary": _LIME,
        "banner_title": "Happy Independence Day 🇳🇬",
        "banner_text": "Celebrate in style. Book your appointment today.",
    },
}

SETTINGS_KEY = "seasonal_themes"


def _today_lagos() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=1)).date()


def _in_window(today: date, start: str, end: str) -> bool:
    try:
        if len(start) == 5:  # MM-DD, yearly (may wrap the new year)
            s = date(today.year, int(start[:2]), int(start[3:]))
            e = date(today.year, int(end[:2]), int(end[3:]))
            if s <= e:
                return s <= today <= e
            return today >= s or today <= e
        return date.fromisoformat(start) <= today <= date.fromisoformat(end)
    except Exception:
        return False


def _start_key(today: date, start: str) -> date:
    try:
        if len(start) == 5:
            d = date(today.year, int(start[:2]), int(start[3:]))
            return d if d <= today else date(today.year - 1, d.month, d.day)
        return date.fromisoformat(start)
    except Exception:
        return date.min


class ThemeIn(BaseModel):
    enabled: Optional[bool] = None
    start: Optional[str] = None
    end: Optional[str] = None
    banner_title: Optional[str] = None
    banner_text: Optional[str] = None
    force_active: Optional[bool] = None  # show now regardless of dates (preview / surprise campaign)
    effects: Optional[bool] = None


def register_themes_routes(api_router: APIRouter, supabase: Any, admin_dep) -> None:
    def load_overrides() -> Dict[str, Dict[str, Any]]:
        try:
            r = supabase.table("app_settings").select("value").eq("key", SETTINGS_KEY).limit(1).execute().data or []
            if r and isinstance(r[0].get("value"), dict):
                return r[0]["value"]
        except Exception as exc:  # noqa: BLE001
            logger.warning("themes: load failed: %s", exc)
        return {}

    def save_overrides(data: Dict[str, Any]) -> None:
        exists = supabase.table("app_settings").select("key").eq("key", SETTINGS_KEY).limit(1).execute().data
        if exists:
            supabase.table("app_settings").update({"value": data}).eq("key", SETTINGS_KEY).execute()
        else:
            supabase.table("app_settings").insert({"key": SETTINGS_KEY, "value": data}).execute()

    def merged(key: str, ov: Dict[str, Any]) -> Dict[str, Any]:
        p = dict(PRESETS[key])
        o = ov.get(key) or {}
        p["enabled"] = bool(o.get("enabled", True))
        p["force_active"] = bool(o.get("force_active", False))
        p["effects"] = bool(o.get("effects", True))
        for f in ("start", "end", "banner_title", "banner_text"):
            if o.get(f):
                p[f] = o[f]
        p["key"] = key
        return p

    def public_view(t: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "key": t["key"], "name": t["name"], "emoji": t["emoji"],
            "effect": t["effect"] if t.get("effects", True) else None,
            "primary": t["primary"], "secondary": t["secondary"],
            "banner_title": t["banner_title"], "banner_text": t["banner_text"],
        }

    @api_router.get("/themes/active")
    def active_theme():
        """Public. The theme to show right now, plus all enabled themes for the user's chooser."""
        ov = load_overrides()
        today = _today_lagos()
        all_t = [merged(k, ov) for k in PRESETS]
        enabled = [t for t in all_t if t["enabled"]]
        live = [t for t in enabled if t["force_active"] or _in_window(today, t["start"], t["end"])]
        live.sort(key=lambda t: (t["force_active"], t["priority"], _start_key(today, t["start"])), reverse=True)
        return {
            "active": public_view(live[0]) if live else None,
            "themes": [public_view(t) for t in enabled],
        }

    @api_router.get("/admin/themes", dependencies=[Depends(admin_dep)])
    def admin_list_themes():
        ov = load_overrides()
        today = _today_lagos()
        out: List[Dict[str, Any]] = []
        for k in PRESETS:
            t = merged(k, ov)
            out.append({
                "key": k, "name": t["name"], "emoji": t["emoji"], "enabled": t["enabled"],
                "start": t["start"], "end": t["end"], "banner_title": t["banner_title"], "banner_text": t["banner_text"],
                "force_active": t["force_active"], "effects": t["effects"],
                "live_now": t["enabled"] and (t["force_active"] or _in_window(today, t["start"], t["end"])),
                "yearly": len(t["start"]) == 5,
            })
        return out

    @api_router.put("/admin/themes/{key}", dependencies=[Depends(admin_dep)])
    def admin_update_theme(key: str, payload: ThemeIn):
        if key not in PRESETS:
            raise HTTPException(status_code=404, detail="Unknown theme")
        data = payload.dict(exclude_none=True)
        for f in ("start", "end"):
            if f in data:
                v = data[f].strip()
                ok = False
                try:
                    if len(v) == 5:
                        date(2000, int(v[:2]), int(v[3:])); ok = v[2] == "-"
                    else:
                        date.fromisoformat(v); ok = True
                except Exception:
                    ok = False
                if not ok:
                    raise HTTPException(status_code=400, detail=f"{f} must be YYYY-MM-DD (one year) or MM-DD (every year)")
                data[f] = v
        for f in ("banner_title", "banner_text"):
            if f in data:
                data[f] = data[f].strip()[:200]
        ov = load_overrides()
        ov[key] = {**(ov.get(key) or {}), **data}
        try:
            save_overrides(ov)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Could not save theme: {exc}")
        return admin_list_themes()
