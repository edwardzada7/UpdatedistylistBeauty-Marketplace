import { supabase } from "@/lib/supabaseClient";
import api from "@/services/api";

/** Provider-side shop calls for the web app (mirrors the mobile provider shop). */
const BUCKET = "media";
const imagesOf = (p) => (Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls : p.image_url ? [p.image_url] : []);
const sellerName = (s) => s?.display_name || s?.business_name || s?.seller_name || s?.name || null;

export const providerShopApi = {
  async getSeller(authId) {
    const { data, error } = await supabase
      .from("shop_sellers")
      .select("id, seller_type, provider_auth_id")
      .eq("seller_type", "provider")
      .eq("provider_auth_id", authId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Products the provider sells: listings of other sellers' products plus products they created. */
  async getMyShop(authId) {
    const [seller, ownRes] = await Promise.all([
      this.getSeller(authId).catch(() => null),
      supabase.from("products").select("*").eq("stylist_auth_id", authId).order("created_at", { ascending: false }),
    ]);
    if (ownRes.error) throw ownRes.error;
    const own = (ownRes.data || []).map((p) => ({ ...p, image_urls: imagesOf(p), kind: "own" }));
    if (!seller) return { seller: null, items: own };

    const { data: listings } = await supabase
      .from("product_listings")
      .select("id, product_id, price, stock, status")
      .eq("seller_id", seller.id);
    const rows = listings || [];
    if (!rows.length) return { seller, items: own };
    const { data: prods } = await supabase.from("products").select("*").in("id", rows.map((l) => l.product_id));
    const byId = new Map((prods || []).map((p) => [Number(p.id), p]));
    const listed = rows.flatMap((l) => {
      const p = byId.get(Number(l.product_id));
      if (!p || p.stylist_auth_id === authId) return []; // own products come from the products table
      return [{ ...p, image_urls: imagesOf(p), price: Number(l.price), stock: Number(l.stock), seller_listing_id: l.id, listing_status: l.status, kind: "listing" }];
    });
    return { seller, items: [...listed, ...own] };
  },

  /** Everything buyers can see, plus what a provider needs to resell or buy it. */
  async getMarketplace(authId) {
    const [{ data: listings }, { data: sellers }, { data: prods }] = await Promise.all([
      supabase.from("product_listings").select("*").eq("status", "active"),
      supabase.from("shop_sellers").select("*"),
      supabase.from("products").select("*").eq("approved", true),
    ]);
    const sellerById = new Map((sellers || []).map((s) => [Number(s.id), s]));
    const prodById = new Map((prods || []).filter((p) => p.is_active !== false).map((p) => [Number(p.id), p]));
    const mine = (sellers || []).find((s) => s.seller_type === "provider" && s.provider_auth_id === authId);
    const mineProductIds = new Set((listings || []).filter((l) => mine && Number(l.seller_id) === Number(mine.id)).map((l) => Number(l.product_id)));
    return (listings || []).flatMap((l) => {
      const p = prodById.get(Number(l.product_id));
      const s = sellerById.get(Number(l.seller_id));
      if (!p || !s || Number(l.stock) <= 0) return [];
      if (mine && Number(l.seller_id) === Number(mine.id)) return [];
      if (p.stylist_auth_id === authId) return [];
      return [{
        ...p,
        image_urls: imagesOf(p),
        price: Number(l.price),
        stock: Number(l.stock),
        seller_listing_id: l.id,
        seller_name: sellerName(s),
        isOfficial: s.seller_type === "official" || s.seller_type === "platform",
        buyable: l.provider_purchase_enabled === true && l.provider_purchase_price != null,
        purchase_price: l.provider_purchase_price != null ? Number(l.provider_purchase_price) : null,
        alreadyListed: mineProductIds.has(Number(p.id)),
      }];
    });
  },

  async addToMyShop(authId, product) {
    const seller = await this.getSeller(authId);
    if (!seller) throw new Error("Your provider shop seller account is not set up yet. Please contact support.");
    const { data: existing } = await supabase.from("product_listings").select("id").eq("product_id", product.id).eq("seller_id", seller.id).maybeSingle();
    if (existing) return { added: false };
    const { error } = await supabase.from("product_listings").insert({ product_id: product.id, seller_id: seller.id, price: product.price, stock: product.stock });
    if (error) {
      if (error.code === "23505") return { added: false };
      throw error;
    }
    return { added: true };
  },

  async updateListing(listingId, { price, stock }) {
    const { error } = await supabase.from("product_listings").update({ price, stock }).eq("id", listingId);
    if (error) throw error;
  },
  async removeListing(listingId) {
    const { error } = await supabase.from("product_listings").delete().eq("id", listingId);
    if (error) throw error;
  },

  async uploadImage(file, authId) {
    const ext = (file.name?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${authId}/products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (error) throw new Error(error.message || "Upload failed");
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  },

  async createProduct(authId, input) {
    const payload = {
      name: input.name,
      description: input.description,
      price: input.price,
      stock: input.stock,
      image_urls: input.image_urls,
      stylist_auth_id: authId,
      approved: false,
      ...(input.category ? { category: input.category } : {}),
    };
    const { data, error } = await supabase.from("products").insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateProduct(id, input) {
    const { error } = await supabase.from("products").update(input).eq("id", id);
    if (error) throw error;
  },
  async deleteProduct(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },

  async startPurchase({ listingId, quantity, email }) {
    const res = await api.post("/payments/paystack/provider-purchase/initialize", {
      listing_id: Number(listingId),
      quantity: Number(quantity),
      email,
      redirect_url: `${window.location.origin}/provider/shop/purchase-complete`,
    });
    const url = res.data?.authorization_url;
    if (!url) throw new Error(res.data?.message || "Could not start payment. Please try again.");
    return url;
  },
  async verifyPurchase(reference) {
    const res = await api.get("/payments/paystack/provider-purchase/verify", { params: { reference } });
    return res.data || {};
  },
  async getInventory() {
    const res = await api.get("/provider/inventory");
    return Array.isArray(res.data) ? res.data : [];
  },
  async listInventory({ inventoryId, quantity, price }) {
    const res = await api.post("/provider/inventory/list", { inventory_id: Number(inventoryId), quantity: Number(quantity), price: Number(price) });
    return res.data;
  },

  async updateOrderStatus(orderId, status) {
    const res = await api.patch(`/shop/orders/${orderId}`, { status });
    return res.data;
  },

  /** Orders for products this provider owns (shop_orders has no seller column, so go through the items). */
  async getOrders(authId) {
    const { data: itemRows } = await supabase
      .from("shop_order_items")
      .select("*, products!inner(name, image_urls, stylist_auth_id)")
      .eq("products.stylist_auth_id", authId);
    const items = (itemRows || []).map((i) => ({ ...i, price: i.unit_price ?? i.price }));
    const ids = [...new Set(items.map((i) => i.order_id))];
    if (!ids.length) return [];
    const { data: orders } = await supabase.from("shop_orders").select("*").in("id", ids).order("created_at", { ascending: false });
    return (orders || []).map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
  },
};
