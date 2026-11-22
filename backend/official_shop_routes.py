"""iStylist Official: admin-created feed posts, official shop seller/products, and the provider
'Buy for My Shop' inventory flow (Paystack purchase -> provider inventory -> provider listing).

Additive module (registered from server.py). Table columns this needs are added by
migrations/phase31_official_shop.sql, which is safe to re-run.
"""
from __future__ import annotations

import base64
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from consultation_routes import _admin_key, _current_auth_id

logger = logging.getLogger(__name__)

OFFICIAL_NAME = "iStylist Official"
# Stable placeholder id for products that belong to the platform, not a person.
OFFICIAL_AUTH_ID = "00000000-0000-4000-8000-000000000001"
OFFICIAL_LOGO_URL = os.environ.get("OFFICIAL_LOGO_URL", "https://app.istylist.online/logo192.png")


def official_provider_payload() -> Dict[str, Any]:
    """What feed clients get as `post.provider` for an official post."""
    return {
        "id": 0,
        "auth_id": None,
        "name": OFFICIAL_NAME,
        "business_name": OFFICIAL_NAME,
        "provider_type": "official",
        "photo_url": OFFICIAL_LOGO_URL,
        "city": None,
        "display_name": OFFICIAL_NAME,
        "is_verified": True,
        "is_official": True,
    }


class OfficialPostInput(BaseModel):
    caption: Optional[str] = Field(None, max_length=2000)
    image_urls: List[str] = Field(default_factory=list, max_length=5)
    video_url: Optional[str] = None
    video_duration_seconds: Optional[float] = None


class UploadInput(BaseModel):
    filename: str
    content_type: str
    data_base64: str


class OfficialProductInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    image_urls: List[str] = Field(default_factory=list, max_length=5)
    category: Optional[str] = None
    main_category: Optional[str] = None
    subcategory: Optional[str] = None
    provider_purchase_enabled: bool = False
    provider_purchase_price: Optional[float] = Field(default=None, gt=0)


class OfficialListingUpdate(BaseModel):
    price: Optional[float] = Field(default=None, gt=0)
    stock: Optional[int] = Field(default=None, ge=0)
    status: Optional[str] = None
    provider_purchase_enabled: Optional[bool] = None
    provider_purchase_price: Optional[float] = Field(default=None, gt=0)


class PurchaseInit(BaseModel):
    listing_id: int
    quantity: int = Field(ge=1)
    email: str
    redirect_url: str


class ListInventoryInput(BaseModel):
    inventory_id: int
    quantity: int = Field(ge=1)
    price: float = Field(gt=0)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _paystack_headers() -> Optional[Dict[str, str]]:
    key = os.environ.get("PAYSTACK_SECRET_KEY")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"} if key else None


def _notify(auth_id: str, kind: str, title: str, message: str, metadata: Optional[dict] = None) -> None:
    try:
        from push_and_public import notify_user_sync

        notify_user_sync(auth_id, kind, title, message, metadata)
    except Exception as exc:  # noqa: BLE001 - notifications are best effort
        logger.warning("notify failed: %s", exc)


def register_official_routes(api_router: APIRouter, supabase: Any) -> None:
    # ------------------------------------------------------------------ helpers
    def first(query) -> Optional[dict]:
        data = query.limit(1).execute().data or []
        return data[0] if data else None

    def ensure_official_seller() -> dict:
        """The platform's own seller row. Created on first use; tolerant of column differences."""
        try:
            existing = first(supabase.table("shop_sellers").select("*").eq("seller_type", "official"))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"shop_sellers table unavailable: {exc}")
        if existing:
            return existing
        attempts = [
            {"seller_type": "official", "display_name": OFFICIAL_NAME, "business_name": OFFICIAL_NAME, "status": "active", "is_active": True},
            {"seller_type": "official", "display_name": OFFICIAL_NAME, "status": "active", "is_active": True},
            {"seller_type": "official", "name": OFFICIAL_NAME},
            {"seller_type": "official"},
        ]
        last_error = None
        for payload in attempts:
            try:
                row = supabase.table("shop_sellers").insert(payload).execute().data
                if row:
                    return row[0]
            except Exception as exc:  # noqa: BLE001
                last_error = exc
        raise HTTPException(status_code=500, detail=f"Could not create the official seller: {last_error}")

    def ensure_provider_seller(auth_id: str) -> dict:
        existing = first(supabase.table("shop_sellers").select("*").eq("seller_type", "provider").eq("provider_auth_id", auth_id))
        if existing:
            return existing
        user = first(supabase.table("users").select("name").eq("auth_id", auth_id)) or {}
        name = user.get("name") or "Provider"
        attempts = [
            {"seller_type": "provider", "provider_auth_id": auth_id, "display_name": name, "status": "active", "is_active": True},
            {"seller_type": "provider", "provider_auth_id": auth_id, "name": name},
            {"seller_type": "provider", "provider_auth_id": auth_id},
        ]
        last_error = None
        for payload in attempts:
            try:
                row = supabase.table("shop_sellers").insert(payload).execute().data
                if row:
                    return row[0]
            except Exception as exc:  # noqa: BLE001
                last_error = exc
        raise HTTPException(status_code=500, detail=f"Could not set up your seller account: {last_error}")

    def is_provider(auth_id: str) -> bool:
        user = first(supabase.table("users").select("role").eq("auth_id", auth_id))
        return bool(user) and user.get("role") in ("stylist", "provider")

    # ------------------------------------------------------------ admin: uploads
    @api_router.post("/admin/official/upload", dependencies=[Depends(_admin_key)])
    def admin_official_upload(payload: UploadInput):
        """Admin photo upload (service role) -> public URL in the `media` bucket."""
        if not payload.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image uploads are supported here")
        try:
            raw = base64.b64decode(payload.data_base64.split(",")[-1], validate=False)
        except Exception:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="Invalid image data")
        if not raw or len(raw) > 8 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image must be under 8 MB")
        ext = (payload.filename.rsplit(".", 1)[-1] if "." in payload.filename else "jpg").lower()[:5]
        path = f"official/{uuid.uuid4().hex}.{ext}"
        base = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        res = requests.post(
            f"{base}/storage/v1/object/media/{path}",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": payload.content_type, "x-upsert": "true"},
            data=raw,
            timeout=60,
        )
        if res.status_code not in (200, 201):
            logger.warning("official upload failed: %s", res.text[:300])
            raise HTTPException(status_code=502, detail="Upload failed. Is the `media` storage bucket created (phase30)?")
        return {"url": f"{base}/storage/v1/object/public/media/{path}"}

    # ------------------------------------------------------- admin: official feed
    @api_router.post("/admin/official/feed-posts", status_code=201, dependencies=[Depends(_admin_key)])
    def admin_create_official_post(payload: OfficialPostInput):
        urls = [u.strip() for u in payload.image_urls if u and u.strip()][:5]
        if not urls and not payload.video_url:
            raise HTTPException(status_code=422, detail="Add at least one photo")
        if payload.video_url and (payload.video_duration_seconds is None or not 0 < payload.video_duration_seconds <= 10):
            raise HTTPException(status_code=422, detail="Feed videos must be between 1 and 10 seconds")
        row = {
            "provider_id": 0,
            "provider_auth_id": None,
            "caption": (payload.caption or "").strip() or None,
            "image_url": urls[0] if urls else "",
            "image_urls": urls,
            "video_url": payload.video_url,
            "media_type": "video" if payload.video_url else "photo",
            "video_duration_seconds": payload.video_duration_seconds,
            "likes_count": 0,
            "comments_count": 0,
            "is_active": True,
            "is_official": True,
        }
        try:
            res = supabase.table("provider_posts").insert(row).execute()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Official posts need the latest database update (phase31): {exc}")
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create the post")
        post = dict(res.data[0])
        post["provider"] = official_provider_payload()
        return post

    # ------------------------------------------------- admin: official seller/shop
    @api_router.get("/admin/official/seller", dependencies=[Depends(_admin_key)])
    def admin_official_seller():
        return ensure_official_seller()

    @api_router.get("/admin/official/products", dependencies=[Depends(_admin_key)])
    def admin_official_products():
        seller = ensure_official_seller()
        listings = supabase.table("product_listings").select("*").eq("seller_id", seller["id"]).order("id", desc=True).execute().data or []
        ids = [l["product_id"] for l in listings]
        products = {}
        if ids:
            for p in supabase.table("products").select("*").in_("id", ids).execute().data or []:
                products[p["id"]] = p
        return {"seller": seller, "items": [{"listing": l, "product": products.get(l["product_id"])} for l in listings]}

    @api_router.post("/admin/official/products", status_code=201, dependencies=[Depends(_admin_key)])
    def admin_create_official_product(payload: OfficialProductInput):
        if payload.provider_purchase_enabled and not payload.provider_purchase_price:
            raise HTTPException(status_code=422, detail="Set the provider purchase price")
        seller = ensure_official_seller()
        base = {
            "name": payload.name.strip(),
            "description": (payload.description or "").strip() or None,
            "price": payload.price,
            "stock": payload.stock,
            "image_urls": payload.image_urls,
            "approved": True,
        }
        for key in ("category", "main_category", "subcategory"):
            if getattr(payload, key):
                base[key] = getattr(payload, key)
        product, last_error = None, None
        # Official products have no human owner; fall back to the placeholder id if the column is NOT NULL.
        for owner in (None, OFFICIAL_AUTH_ID):
            for drop in ((), ("main_category", "subcategory")):
                row = {k: v for k, v in base.items() if k not in drop}
                row["stylist_auth_id"] = owner
                try:
                    res = supabase.table("products").insert(row).execute()
                    if res.data:
                        product = res.data[0]
                        break
                except Exception as exc:  # noqa: BLE001
                    last_error = exc
            if product:
                break
        if not product:
            raise HTTPException(status_code=500, detail=f"Could not create the product: {last_error}")
        listing = {
            "product_id": product["id"],
            "seller_id": seller["id"],
            "price": payload.price,
            "stock": payload.stock,
            "status": "active",
            "provider_purchase_enabled": payload.provider_purchase_enabled,
            "provider_purchase_price": payload.provider_purchase_price,
        }
        try:
            lres = supabase.table("product_listings").insert(listing).execute()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Product created but listing failed (run phase31): {exc}")
        return {"product": product, "listing": (lres.data or [None])[0]}

    @api_router.put("/admin/official/listings/{listing_id}", dependencies=[Depends(_admin_key)])
    def admin_update_official_listing(listing_id: int, payload: OfficialListingUpdate):
        seller = ensure_official_seller()
        listing = first(supabase.table("product_listings").select("*").eq("id", listing_id).eq("seller_id", seller["id"]))
        if not listing:
            raise HTTPException(status_code=404, detail="Official listing not found")
        update = {k: v for k, v in payload.dict().items() if v is not None}
        if not update:
            raise HTTPException(status_code=400, detail="Nothing to update")
        res = supabase.table("product_listings").update(update).eq("id", listing_id).execute()
        return (res.data or [listing])[0]

    # ------------------------------------------------ provider: Buy for My Shop
    @api_router.post("/payments/paystack/provider-purchase/initialize")
    def provider_purchase_initialize(payload: PurchaseInit, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        if not is_provider(auth_id):
            raise HTTPException(status_code=403, detail="Only providers can buy inventory")
        headers = _paystack_headers()
        if not headers:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        listing = first(supabase.table("product_listings").select("*").eq("id", payload.listing_id))
        if not listing or str(listing.get("status") or "active").lower() != "active":
            raise HTTPException(status_code=404, detail="This product is not available")
        if not listing.get("provider_purchase_enabled") or not listing.get("provider_purchase_price"):
            raise HTTPException(status_code=400, detail="This product can't be bought for your shop")
        if int(listing.get("stock") or 0) < payload.quantity:
            raise HTTPException(status_code=400, detail="Not enough stock available")
        unit = float(listing["provider_purchase_price"])
        total = round(unit * payload.quantity, 2)
        reference = f"istylist_provbuy_{uuid.uuid4().hex[:14]}"
        res = requests.post(
            "https://api.paystack.co/transaction/initialize",
            json={
                "email": payload.email,
                "amount": int(round(total * 100)),
                "reference": reference,
                "callback_url": payload.redirect_url,
                "metadata": {"purpose": "provider_purchase", "listing_id": payload.listing_id, "quantity": payload.quantity},
            },
            headers=headers,
            timeout=30,
        )
        body = res.json() if res.content else {}
        if res.status_code != 200 or not body.get("status"):
            logger.error("provider purchase init failed: %s", res.text[:300])
            raise HTTPException(status_code=502, detail="Could not start the payment")
        try:
            supabase.table("provider_purchases").insert({
                "reference": reference,
                "provider_auth_id": auth_id,
                "listing_id": payload.listing_id,
                "product_id": listing["product_id"],
                "quantity": payload.quantity,
                "unit_price": unit,
                "total_amount": total,
                "status": "pending",
                "processed": False,
            }).execute()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"Purchases need the latest database update (phase31): {exc}")
        return {"status": True, "authorization_url": body["data"].get("authorization_url"), "reference": reference, "amount": total}

    @api_router.get("/payments/paystack/provider-purchase/verify")
    def provider_purchase_verify(reference: str = Query(...), authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        purchase = first(supabase.table("provider_purchases").select("*").eq("reference", reference))
        if not purchase or purchase.get("provider_auth_id") != auth_id:
            raise HTTPException(status_code=404, detail="Purchase not found")
        if purchase.get("processed") and purchase.get("status") == "success":
            return {"status": "success", "message": "Already processed", "reference": reference}
        headers = _paystack_headers()
        if not headers:
            raise HTTPException(status_code=503, detail="Payment gateway not configured")
        res = requests.get(f"https://api.paystack.co/transaction/verify/{reference}", headers=headers, timeout=30)
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not verify the payment")
        tx = (res.json() or {}).get("data") or {}
        status = tx.get("status")
        if status != "success":
            supabase.table("provider_purchases").update({"status": status or "failed"}).eq("reference", reference).execute()
            return {"status": status or "failed", "message": f"Payment {status or 'not completed'}", "reference": reference}
        if abs(float(tx.get("amount", 0)) / 100 - float(purchase["total_amount"])) > 0.01:
            raise HTTPException(status_code=400, detail="Paid amount does not match the order")
        # Claim the purchase exactly once so a double verify can't add stock twice.
        claimed = supabase.table("provider_purchases").update({"processed": True, "status": "success", "processed_at": _now()}).eq("reference", reference).eq("processed", False).execute().data
        if not claimed:
            return {"status": "success", "message": "Already processed", "reference": reference}
        qty = int(purchase["quantity"])
        listing = first(supabase.table("product_listings").select("*").eq("id", purchase["listing_id"])) or {}
        if listing:
            supabase.table("product_listings").update({"stock": max(0, int(listing.get("stock") or 0) - qty)}).eq("id", listing["id"]).execute()
        inv = first(supabase.table("provider_inventory").select("*").eq("provider_auth_id", auth_id).eq("product_id", purchase["product_id"]).eq("source_listing_id", purchase["listing_id"]))
        if inv:
            supabase.table("provider_inventory").update({"quantity": int(inv.get("quantity") or 0) + qty, "updated_at": _now()}).eq("id", inv["id"]).execute()
        else:
            supabase.table("provider_inventory").insert({
                "provider_auth_id": auth_id,
                "product_id": purchase["product_id"],
                "source_listing_id": purchase["listing_id"],
                "quantity": qty,
                "reserved_quantity": 0,
                "quantity_allocated_to_listings": 0,
            }).execute()
        _notify(auth_id, "shop_purchase", "Inventory purchased", f"{qty} item(s) were added to your inventory. List them in My Shop to start selling.", {"reference": reference})
        return {"status": "success", "message": "Payment verified", "reference": reference, "quantity": qty}

    @api_router.get("/provider/inventory")
    def provider_inventory(authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        rows = supabase.table("provider_inventory").select("*").eq("provider_auth_id", auth_id).order("id", desc=True).execute().data or []
        ids = list({r["product_id"] for r in rows})
        products = {}
        if ids:
            for p in supabase.table("products").select("id,name,image_urls").in_("id", ids).execute().data or []:
                products[p["id"]] = {"name": p.get("name"), "image_urls": p.get("image_urls")}
        return [{**r, "products": products.get(r["product_id"])} for r in rows]

    @api_router.post("/provider/inventory/list")
    def provider_inventory_list(payload: ListInventoryInput, authorization: Optional[str] = Header(None)):
        auth_id = _current_auth_id(authorization)
        inv = first(supabase.table("provider_inventory").select("*").eq("id", payload.inventory_id).eq("provider_auth_id", auth_id))
        if not inv:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        available = int(inv.get("quantity") or 0) - int(inv.get("reserved_quantity") or 0) - int(inv.get("quantity_allocated_to_listings") or 0)
        if payload.quantity > available:
            raise HTTPException(status_code=400, detail=f"Only {max(available, 0)} available to list")
        seller = ensure_provider_seller(auth_id)
        existing = first(supabase.table("product_listings").select("*").eq("product_id", inv["product_id"]).eq("seller_id", seller["id"]))
        if existing:
            listing = supabase.table("product_listings").update({"stock": int(existing.get("stock") or 0) + payload.quantity, "price": payload.price, "status": "active"}).eq("id", existing["id"]).execute().data[0]
        else:
            listing = supabase.table("product_listings").insert({"product_id": inv["product_id"], "seller_id": seller["id"], "price": payload.price, "stock": payload.quantity, "status": "active"}).execute().data[0]
        supabase.table("provider_inventory").update({"quantity_allocated_to_listings": int(inv.get("quantity_allocated_to_listings") or 0) + payload.quantity, "updated_at": _now()}).eq("id", inv["id"]).execute()
        return {"listing": listing, "inventory_id": inv["id"], "listed": payload.quantity}
