"""Boosts (paid promotion of a profile, service, product or feed post) and the provider Pro subscription.

All purchases happen on the web (Paystack). The mobile apps only READ status (/promo/me) and the
sponsored lists (/promo/sponsored); they never sell anything. Tables: migrations/phase33_promotions.sql.
"""
from __future__ import annotations

import logging
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from consultation_routes import _admin_key, _current_auth_id

logger = logging.getLogger(__name__)
PROVIDER_ROLES = ("stylist", "provider")
TARGETS = ("profile", "service", "product", "post")


class CheckoutInput(BaseModel):
    purpose: Literal["boost", "subscription"]
    plan_id: int
    target_type: Optional[Literal["profile", "service", "product", "post"]] = None
    target_id: Optional[str] = Field(None, max_length=64)
    use_credit: bool = False
    email: Optional[str] = None
    redirect_url: str


class PlanUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=80)
    days: Optional[int] = Field(None, ge=1, le=365)
    price: Optional[float] = Field(None, ge=0)
    active: Optional[bool] = None
    perks: Optional[Dict[str, Any]] = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _paystack_headers() -> Optional[Dict[str, str]]:
    key = os.environ.get("PAYSTACK_SECRET_KEY")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"} if key else None


def _clean_service_name(raw: Any) -> Optional[str]:
    """services.name stores 'Name||description||modes:...'; show only the name."""
    return str(raw or "").split("||")[0].replace(" (disabled)", "").strip() or None


def _is_disabled(raw: Any) -> bool:
    return "(disabled)" in str(raw or "")


def _notify(auth_id: str, kind: str, title: str, message: str, metadata: Optional[dict] = None) -> None:
    try:
        from push_and_public import notify_user_sync

        notify_user_sync(auth_id, kind, title, message, metadata)
    except Exception as exc:  # noqa: BLE001
        logger.warning("notify failed: %s", exc)


def register_monetization_routes(api_router: APIRouter, supabase: Any) -> None:
    def first(query) -> Optional[dict]:
        data = query.limit(1).execute().data or []
        return data[0] if data else None

    def require_provider(auth_id: str) -> dict:
        user = first(supabase.table("users").select("id, name, role, auth_id").eq("auth_id", auth_id))
        if not user or user.get("role") not in PROVIDER_ROLES:
            raise HTTPException(status_code=403, detail="Only provider accounts can use promotions")
        return user

    def get_plan(plan_id: int, kind: str, active_only: bool = True) -> dict:
        plan = first(supabase.table("promo_plans").select("*").eq("id", plan_id))
        if not plan or plan.get("kind") != kind or (active_only and not plan.get("active")):
            raise HTTPException(status_code=404, detail="That plan is not available")
        return plan

    def active_subscription(auth_id: str) -> Optional[dict]:
        rows = (
            supabase.table("provider_subscriptions").select("*")
            .eq("provider_auth_id", auth_id).eq("status", "active")
            .gt("ends_at", _iso(_now())).order("ends_at", desc=True).limit(1).execute().data
            or []
        )
        if not rows:
            return None
        sub = rows[0]
        plan = first(supabase.table("promo_plans").select("*").eq("id", sub["plan_id"])) or {}
        sub["plan"] = plan
        return sub

    def credit_available(auth_id: str, sub: Optional[dict]) -> bool:
        """Pro includes one free boost per subscription period."""
        if not sub:
            return False
        days = int((sub.get("plan", {}).get("perks") or {}).get("free_boost_days") or 0)
        if days <= 0:
            return False
        used = (
            supabase.table("promotions").select("id")
            .eq("provider_auth_id", auth_id).eq("source", "pro_credit")
            .gte("created_at", sub["starts_at"]).limit(1).execute().data
        )
        return not used

    def validate_target(user: dict, target_type: str, target_id: str) -> None:
        auth_id = user["auth_id"]
        ok = False
        if target_type == "profile":
            ok = str(user["id"]) == str(target_id)
        elif target_type == "service":
            ok = bool(first(supabase.table("services").select("id").eq("id", target_id).eq("stylist_id", user["id"])))
        elif target_type == "product":
            ok = bool(first(supabase.table("products").select("id").eq("id", target_id).eq("stylist_auth_id", auth_id)))
        elif target_type == "post":
            ok = bool(first(supabase.table("provider_posts").select("id").eq("id", target_id).eq("provider_auth_id", auth_id)))
        if not ok:
            raise HTTPException(status_code=403, detail="You can only promote your own profile, services, products and posts")

    def create_promotion(auth_id: str, plan: dict, target_type: str, target_id: str, source: str, amount: float, reference: Optional[str]) -> dict:
        now = _now()
        latest = (
            supabase.table("promotions").select("ends_at")
            .eq("provider_auth_id", auth_id).eq("target_type", target_type).eq("target_id", str(target_id))
            .eq("status", "active").gt("ends_at", _iso(now)).order("ends_at", desc=True).limit(1).execute().data
            or []
        )
        start = max(now, _parse(latest[0]["ends_at"]) or now) if latest else now
        row = {
            "provider_auth_id": auth_id,
            "target_type": target_type,
            "target_id": str(target_id),
            "plan_id": plan["id"],
            "source": source,
            "amount": amount,
            "reference": reference,
            "status": "active",
            "starts_at": _iso(start),
            "ends_at": _iso(start + timedelta(days=int(plan["days"]))),
        }
        return supabase.table("promotions").insert(row).execute().data[0]

    def create_subscription(auth_id: str, plan: dict, amount: float, reference: Optional[str]) -> dict:
        now = _now()
        current = active_subscription(auth_id)
        start = max(now, _parse(current["ends_at"]) or now) if current else now
        row = {
            "provider_auth_id": auth_id,
            "plan_id": plan["id"],
            "amount": amount,
            "reference": reference,
            "status": "active",
            "starts_at": _iso(start),
            "ends_at": _iso(start + timedelta(days=int(plan["days"]))),
        }
        return supabase.table("provider_subscriptions").insert(row).execute().data[0]

    def settle(payment: dict) -> bool:
        """Verify one pending payment with Paystack and, if paid, grant it exactly once."""
        headers = _paystack_headers()
        if not headers:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        res = requests.get(f"https://api.paystack.co/transaction/verify/{payment['reference']}", headers=headers, timeout=30)
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not verify the payment")
        tx = (res.json() or {}).get("data") or {}
        status = tx.get("status")
        if status != "success":
            if status in ("failed", "abandoned", "reversed"):
                supabase.table("promo_payments").update({"status": status}).eq("reference", payment["reference"]).execute()
            return False
        if abs(float(tx.get("amount", 0)) / 100 - float(payment["amount"])) > 0.01:
            raise HTTPException(status_code=400, detail="Paid amount does not match the order")
        claimed = (
            supabase.table("promo_payments").update({"processed": True, "status": "success", "processed_at": _iso(_now())})
            .eq("reference", payment["reference"]).eq("processed", False).execute().data
        )
        if not claimed:
            return True  # someone else already granted it
        plan = first(supabase.table("promo_plans").select("*").eq("id", payment["plan_id"])) or {}
        auth_id = payment["auth_id"]
        if payment["purpose"] == "boost":
            promo = create_promotion(auth_id, plan, payment["target_type"], payment["target_id"], "paid", float(payment["amount"]), payment["reference"])
            _notify(auth_id, "promotion", "Your boost is live", f"{plan.get('name', 'Boost')} is running until {promo['ends_at'][:10]}.", {"promotion_id": promo["id"]})
        else:
            sub = create_subscription(auth_id, plan, float(payment["amount"]), payment["reference"])
            _notify(auth_id, "subscription", "iStylist Pro is active", f"Your plan runs until {sub['ends_at'][:10]}.", {"subscription_id": sub["id"]})
        return True

    def reconcile(auth_id: str) -> None:
        """Settle payments the person paid for but never returned from (closed the tab, lost signal)."""
        since = _iso(_now() - timedelta(days=2))
        pending = (
            supabase.table("promo_payments").select("*").eq("auth_id", auth_id)
            .eq("processed", False).eq("status", "pending").gte("created_at", since).limit(5).execute().data or []
        )
        for p in pending:
            try:
                settle(p)
            except Exception as exc:  # noqa: BLE001
                logger.info("reconcile skipped %s: %s", p.get("reference"), exc)

    # ------------------------------------------------------------------ public
    @api_router.get("/promo/plans")
    def promo_plans():
        rows = supabase.table("promo_plans").select("*").eq("active", True).order("sort_order").execute().data or []
        return {"boosts": [r for r in rows if r["kind"] == "boost"], "subscriptions": [r for r in rows if r["kind"] == "subscription"]}

    @api_router.get("/promo/sponsored")
    def promo_sponsored(
        city: Optional[str] = None,
        area_id: Optional[int] = None,
        types: str = Query("profile,service,product,post"),
        limit: int = Query(6, ge=1, le=20),
    ):
        """Live boosts, labelled 'Sponsored' by clients. Rotated randomly; the viewer's city goes first."""
        wanted = [t for t in types.split(",") if t in TARGETS]
        now = _iso(_now())
        rows = (
            supabase.table("promotions").select("*").eq("status", "active")
            .lte("starts_at", now).gt("ends_at", now).in_("target_type", wanted or list(TARGETS)).limit(200).execute().data or []
        )
        auth_ids = list({r["provider_auth_id"] for r in rows})
        users = {}
        if auth_ids:
            for u in supabase.table("users").select("*").in_("auth_id", auth_ids).execute().data or []:
                users[u["auth_id"]] = u
        area_city = {}
        try:
            area_ids = list({u["area_id"] for u in users.values() if u.get("area_id")})
            if area_ids:
                for a in supabase.table("service_areas").select("id, name, city").in_("id", area_ids).execute().data or []:
                    area_city[a["id"]] = a
        except Exception as exc:  # noqa: BLE001
            logger.warning("sponsored area lookup failed: %s", exc)
        items: List[dict] = []
        for r in rows:
            owner = users.get(r["provider_auth_id"])
            if not owner:
                continue
            item = {
                "promotion_id": r["id"],
                "type": r["target_type"],
                "target_id": r["target_id"],
                "provider_id": owner["id"],
                "provider_auth_id": owner["auth_id"],
                "provider_name": owner.get("name"),
                "city": (area_city.get(owner.get("area_id")) or {}).get("city"),
                "area": (area_city.get(owner.get("area_id")) or {}).get("name"),
                "ends_at": r["ends_at"],
            }
            try:
                if r["target_type"] == "profile":
                    st = first(supabase.table("stylists").select("business_name, profile_image_url, photo_url").eq("user_id", owner["id"])) or {}
                    item.update({
                        "title": st.get("business_name") or owner.get("name"),
                        "image": st.get("profile_image_url") or st.get("photo_url") or owner.get("profile_image_url") or owner.get("avatar_url") or owner.get("photo_url"),
                    })
                elif r["target_type"] == "service":
                    sv = first(supabase.table("services").select("id, name, price").eq("id", r["target_id"])) or {}
                    if not sv or _is_disabled(sv.get("name")):
                        continue
                    item.update({"title": _clean_service_name(sv.get("name")), "price": sv.get("price")})
                elif r["target_type"] == "product":
                    pr = first(supabase.table("products").select("*").eq("id", r["target_id"])) or {}
                    if not pr or pr.get("approved") is False:
                        continue
                    imgs = pr.get("image_urls") or []
                    item.update({"title": pr.get("name"), "price": pr.get("price"), "image": (imgs[0] if imgs else None) or pr.get("image_url")})
                elif r["target_type"] == "post":
                    po = first(supabase.table("provider_posts").select("*").eq("id", r["target_id"])) or {}
                    if not po or po.get("is_active") is False:
                        continue
                    imgs = po.get("image_urls") or []
                    item.update({"title": (po.get("caption") or "")[:80], "image": (imgs[0] if imgs else None) or po.get("image_url")})
            except Exception as exc:  # noqa: BLE001
                logger.warning("sponsored enrich failed: %s", exc)
                continue
            items.append(item)
        random.shuffle(items)
        viewer_city = (city or "").strip().lower()
        if area_id and not viewer_city:
            try:
                va = first(supabase.table("service_areas").select("city").eq("id", area_id))
                viewer_city = ((va or {}).get("city") or "").strip().lower()
            except Exception:  # noqa: BLE001
                viewer_city = ""
        owner_area = {u["auth_id"]: u.get("area_id") for u in users.values()}

        def nearness(i: dict) -> int:
            if area_id and owner_area.get(i["provider_auth_id"]) == area_id:
                return 0  # same area first
            if viewer_city and (i.get("city") or "").strip().lower() == viewer_city:
                return 1  # then same city
            return 2

        items.sort(key=nearness)
        return {"items": items[:limit]}

    # ---------------------------------------------------------------- provider
    @api_router.get("/promo/me")
    def promo_me(authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        require_provider(auth_id)
        reconcile(auth_id)
        sub = active_subscription(auth_id)
        now = _iso(_now())
        promos = (
            supabase.table("promotions").select("*").eq("provider_auth_id", auth_id)
            .order("created_at", desc=True).limit(50).execute().data or []
        )
        for p in promos:
            p["live"] = p["status"] == "active" and p["starts_at"] <= now < p["ends_at"]
        return {
            "subscription": ({"id": sub["id"], "plan_name": sub["plan"].get("name"), "ends_at": sub["ends_at"], "perks": sub["plan"].get("perks") or {}} if sub else None),
            "free_boost_available": credit_available(auth_id, sub),
            "promotions": promos,
        }

    @api_router.get("/promo/my-targets")
    def promo_my_targets(authorization: Optional[str] = Header(None)):
        """What this provider can promote."""
        auth_id = _current_auth_id(authorization)
        user = require_provider(auth_id)
        services = supabase.table("services").select("id, name, price").eq("stylist_id", user["id"]).limit(100).execute().data or []
        try:
            products = supabase.table("products").select("*").eq("stylist_auth_id", auth_id).limit(100).execute().data or []
        except Exception as exc:  # noqa: BLE001
            logger.warning("promo targets: products unavailable: %s", exc)
            products = []
        try:
            posts = supabase.table("provider_posts").select("*").eq("provider_auth_id", auth_id).order("created_at", desc=True).limit(30).execute().data or []
        except Exception as exc:  # noqa: BLE001
            logger.warning("promo targets: posts unavailable: %s", exc)
            posts = []
        return {
            "profile": {"id": str(user["id"]), "name": user.get("name")},
            "services": [{"id": str(s["id"]), "name": _clean_service_name(s.get("name")) or "Service", "price": s.get("price")} for s in services if not _is_disabled(s.get("name"))],
            "products": [{"id": str(p["id"]), "name": p.get("name"), "approved": p.get("approved")} for p in products],
            "posts": [{"id": str(p["id"]), "name": (p.get("caption") or "Post")[:50]} for p in posts],
        }

    @api_router.post("/promo/checkout")
    def promo_checkout(payload: CheckoutInput, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        user = require_provider(auth_id)
        sub = active_subscription(auth_id)
        if payload.purpose == "subscription":
            plan = get_plan(payload.plan_id, "subscription")
            amount = float(plan["price"])
            target_type = target_id = None
        else:
            plan = get_plan(payload.plan_id, "boost")
            if not payload.target_type or not payload.target_id:
                raise HTTPException(status_code=400, detail="Choose what to boost")
            validate_target(user, payload.target_type, payload.target_id)
            target_type, target_id = payload.target_type, str(payload.target_id)
            if payload.use_credit:
                if not credit_available(auth_id, sub):
                    raise HTTPException(status_code=400, detail="Your free Pro boost has already been used this period")
                if int(plan["days"]) > int((sub["plan"].get("perks") or {}).get("free_boost_days") or 0):
                    raise HTTPException(status_code=400, detail="The free boost covers a shorter duration than that")
                promo = create_promotion(auth_id, plan, target_type, target_id, "pro_credit", 0, None)
                return {"free": True, "promotion": promo}
            discount = float(((sub or {}).get("plan", {}).get("perks") or {}).get("boost_discount_pct") or 0)
            amount = round(float(plan["price"]) * (1 - min(max(discount, 0), 100) / 100), 2)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="This plan has no price set")
        headers = _paystack_headers()
        if not headers:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        email = payload.email or (first(supabase.table("users").select("email").eq("auth_id", auth_id)) or {}).get("email")
        if not email:
            raise HTTPException(status_code=400, detail="An email address is needed for the payment")
        reference = f"istylist_promo_{uuid.uuid4().hex[:14]}"
        res = requests.post(
            "https://api.paystack.co/transaction/initialize",
            json={"email": email, "amount": int(round(amount * 100)), "reference": reference, "callback_url": payload.redirect_url,
                  "metadata": {"purpose": f"promo_{payload.purpose}", "plan_id": plan["id"]}},
            headers=headers, timeout=30,
        )
        body = res.json() if res.content else {}
        if res.status_code != 200 or not body.get("status"):
            logger.error("promo init failed: %s", res.text[:300])
            raise HTTPException(status_code=502, detail="Could not start the payment")
        supabase.table("promo_payments").insert({
            "reference": reference, "auth_id": auth_id, "purpose": payload.purpose, "plan_id": plan["id"],
            "target_type": target_type, "target_id": target_id, "amount": amount, "status": "pending", "processed": False,
        }).execute()
        return {"free": False, "authorization_url": body["data"].get("authorization_url"), "reference": reference, "amount": amount}

    @api_router.get("/promo/verify")
    def promo_verify(reference: str = Query(...), authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        payment = first(supabase.table("promo_payments").select("*").eq("reference", reference))
        if not payment or payment.get("auth_id") != auth_id:
            raise HTTPException(status_code=404, detail="Payment not found")
        if payment.get("processed") and payment.get("status") == "success":
            return {"status": "success", "purpose": payment["purpose"], "message": "Already processed"}
        ok = settle(payment)
        return {"status": "success" if ok else "pending", "purpose": payment["purpose"],
                "message": "Payment confirmed" if ok else "We have not received this payment yet"}

    # -------------------------------------------------------------------- admin
    @api_router.get("/admin/promo/overview", dependencies=[Depends(_admin_key)])
    def admin_promo_overview():
        now = _iso(_now())
        plans = supabase.table("promo_plans").select("*").order("sort_order").execute().data or []
        live = supabase.table("promotions").select("*").eq("status", "active").gt("ends_at", now).order("ends_at").limit(200).execute().data or []
        subs = supabase.table("provider_subscriptions").select("*").eq("status", "active").gt("ends_at", now).limit(500).execute().data or []
        paid = supabase.table("promo_payments").select("amount, purpose, created_at, reference, auth_id, status").eq("status", "success").order("created_at", desc=True).limit(500).execute().data or []
        names = {}
        ids = list({r["provider_auth_id"] for r in live} | {s["provider_auth_id"] for s in subs})
        if ids:
            for u in supabase.table("users").select("auth_id, name").in_("auth_id", ids).execute().data or []:
                names[u["auth_id"]] = u.get("name")
        for r in live:
            r["provider_name"] = names.get(r["provider_auth_id"])
        month_start = _now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return {
            "plans": plans,
            "live_promotions": live,
            "active_subscriptions": len(subs),
            "revenue_total": round(sum(float(p["amount"]) for p in paid), 2),
            "revenue_month": round(sum(float(p["amount"]) for p in paid if (_parse(p["created_at"]) or month_start) >= month_start), 2),
            "recent_payments": paid[:15],
        }

    @api_router.put("/admin/promo/plans/{plan_id}", dependencies=[Depends(_admin_key)])
    def admin_update_plan(plan_id: int, payload: PlanUpdate):
        data = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not data:
            raise HTTPException(status_code=400, detail="Nothing to update")
        rows = supabase.table("promo_plans").update(data).eq("id", plan_id).execute().data
        if not rows:
            raise HTTPException(status_code=404, detail="Plan not found")
        return rows[0]

    @api_router.post("/admin/promo/promotions/{promotion_id}/cancel", dependencies=[Depends(_admin_key)])
    def admin_cancel_promotion(promotion_id: int):
        rows = supabase.table("promotions").update({"status": "cancelled"}).eq("id", promotion_id).execute().data
        if not rows:
            raise HTTPException(status_code=404, detail="Promotion not found")
        return rows[0]
