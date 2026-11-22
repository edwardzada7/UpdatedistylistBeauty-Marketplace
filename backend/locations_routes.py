"""Structured locations: the list of areas people pick from, GPS -> nearest area, and a one-off backfill
that matches the typed locations people already saved. Tables: migrations/phase34_locations.sql."""
from __future__ import annotations

import logging
import math
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from consultation_routes import _admin_key

logger = logging.getLogger(__name__)
MAX_AREA_DISTANCE_KM = 60.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class ResolveInput(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    country_code: Optional[str] = "NG"


def _norm(text: Any) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", str(text or "").lower()).strip()


def match_area(text: Any, areas: List[dict]) -> Optional[dict]:
    """Best area for a typed location: the longest alias/name found as whole words in the text."""
    haystack = f" {_norm(text)} "
    if haystack.strip() == "":
        return None
    best, best_len = None, 0
    for area in areas:
        for token in [area["name"], *(area.get("aliases") or [])]:
            t = _norm(token)
            if t and f" {t} " in haystack and len(t) > best_len:
                best, best_len = area, len(t)
    return best


def register_location_routes(api_router: APIRouter, supabase: Any) -> None:
    def load_areas(country_code: str = "NG", region: Optional[str] = None) -> List[dict]:
        q = supabase.table("service_areas").select("*").eq("country_code", country_code).eq("active", True)
        if region:
            q = q.eq("region", region)
        return q.order("sort_order").execute().data or []

    @api_router.get("/locations/areas")
    def list_areas(country_code: str = "NG", region: Optional[str] = None):
        return {"areas": load_areas(country_code, region)}

    @api_router.post("/locations/resolve")
    def resolve(payload: ResolveInput):
        """Turn a GPS point into the nearest supported area (no map service needed)."""
        areas = load_areas(payload.country_code or "NG")
        if not areas:
            return {"area": None, "outside_service_area": True, "distance_km": None}
        best = min(areas, key=lambda a: haversine_km(payload.latitude, payload.longitude, a["latitude"], a["longitude"]))
        dist = haversine_km(payload.latitude, payload.longitude, best["latitude"], best["longitude"])
        return {"area": best if dist <= MAX_AREA_DISTANCE_KM else None, "nearest": best, "distance_km": round(dist, 1), "outside_service_area": dist > MAX_AREA_DISTANCE_KM}

    @api_router.post("/admin/locations/backfill", dependencies=[Depends(_admin_key)])
    def backfill(apply: bool = Query(False, description="false = preview only")):
        """Match people's typed locations to areas. Preview first, then apply=true. Never overwrites an area already set."""
        areas = load_areas("NG", None)
        matched, unmatched = [], []
        users = supabase.table("users").select("id, name, role, city, location_address, area_id, latitude, longitude").execute().data or []
        stylists = {s["user_id"]: s for s in (supabase.table("stylists").select("user_id, location").execute().data or [])}
        for u in users:
            if u.get("area_id"):
                continue
            text = " ".join(str(x) for x in [stylists.get(u["id"], {}).get("location"), u.get("location_address"), u.get("city")] if x)
            if not text.strip():
                continue
            area = match_area(text, areas)
            row = {"user_id": u["id"], "name": u.get("name"), "role": u.get("role"), "text": text[:120]}
            if not area:
                unmatched.append(row)
                continue
            row["area"] = area["name"]
            matched.append(row)
            if apply:
                update: Dict[str, Any] = {"area_id": area["id"], "country_code": area["country_code"], "region": area["region"], "city": u.get("city") or area["city"]}
                if u.get("latitude") is None or u.get("longitude") is None:
                    update.update({"latitude": area["latitude"], "longitude": area["longitude"]})
                supabase.table("users").update(update).eq("id", u["id"]).execute()
        return {"applied": apply, "matched": len(matched), "unmatched": len(unmatched), "matched_rows": matched[:200], "unmatched_rows": unmatched[:200]}
