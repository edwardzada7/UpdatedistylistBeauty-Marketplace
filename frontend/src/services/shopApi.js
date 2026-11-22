import { supabase } from "@/lib/supabaseClient";
import api from "@/services/api";

/**
 * Customer shop API for the web app. Mirrors the mobile app: browsing reads Supabase directly
 * (products + seller listings), orders go through the backend, payment is Paystack.
 */

const normalizeProduct = (p) => ({
  ...p,
  image_urls: Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls : p.image_url ? [p.image_url] : [],
  category_label: p.main_category || p.category || null,
});

export const lineKey = (l) => `${l.productId}:${l.sellerListingId ?? l.sellerId ?? "legacy"}`;

export const shopApi = {
  /** Approved products as buyers see them: seller listings (price/stock per seller) plus legacy products. */
  async getProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("approved", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const products = (data || []).filter((p) => p.is_active !== false).map(normalizeProduct);

    try {
      const [{ data: listingRows, error: le }, { data: sellerRows, error: se }] = await Promise.all([
        supabase.from("product_listings").select("*"),
        supabase.from("shop_sellers").select("*"),
      ]);
      if (le) throw le;
      if (se) throw se;
      const sellersById = new Map((sellerRows || []).map((s) => [Number(s.id), s]));
      const productsById = new Map(products.map((p) => [Number(p.id), p]));
      const listedIds = new Set((listingRows || []).map((l) => Number(l.product_id)));

      const marketplace = (listingRows || []).flatMap((listing) => {
        const seller = sellersById.get(Number(listing.seller_id));
        const product = productsById.get(Number(listing.product_id));
        const sellerStatus = String(seller?.status || "").toLowerCase();
        if (!seller || !product || seller.is_active === false || ["inactive", "suspended"].includes(sellerStatus)) return [];
        if (String(listing.status || "").toLowerCase() !== "active" || Number(listing.stock) <= 0) return [];
        return [
          {
            ...product,
            price: Number(listing.price),
            stock: Number(listing.stock),
            seller_listing_id: Number(listing.id),
            seller_id: Number(listing.seller_id),
            seller_name: seller.display_name || seller.business_name || seller.seller_name || seller.name || null,
          },
        ];
      });
      const legacy = products.filter((p) => !listedIds.has(Number(p.id)) && Number(p.stock) > 0);
      return [...marketplace, ...legacy];
    } catch (err) {
      console.warn("[shop] seller listings unavailable; using legacy products", err);
      return products.filter((p) => Number(p.stock) > 0);
    }
  },

  async getProduct(id, listingId) {
    const all = await this.getProducts();
    return (
      all.find((p) => Number(p.id) === Number(id) && (!listingId || Number(p.seller_listing_id) === Number(listingId))) ||
      all.find((p) => Number(p.id) === Number(id)) ||
      null
    );
  },

  async getReviews(productId) {
    try {
      const res = await api.get(`/shop/products/${productId}/reviews`);
      const body = res.data || {};
      const reviews = Array.isArray(body) ? body : body.reviews || [];
      const count = body.count ?? body.total ?? reviews.length;
      const avg = body.average_rating ?? body.average ?? (reviews.length ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length : 0);
      return { reviews, count, average: Number(avg) || 0 };
    } catch {
      return { reviews: [], count: 0, average: 0 };
    }
  },

  async createOrder({ customerAuthId, lines, shippingAddress, note }) {
    const items = lines.map((l) => ({
      product_id: Number(l.productId),
      quantity: Number(l.quantity),
      ...(l.sellerListingId ? { listing_id: Number(l.sellerListingId) } : {}),
    }));
    const subtotal = lines.reduce((s, l) => s + Number(l.price) * Number(l.quantity), 0);
    const res = await api.post("/shop/orders", {
      customer_auth_id: customerAuthId,
      items,
      payment_status: "pending",
      order_status: "pending",
      subtotal,
      total_amount: subtotal,
      payment_method: "paystack",
      shipping_address: shippingAddress,
      delivery_address: shippingAddress,
      note: note || undefined,
      currency: "NGN",
    });
    const body = res.data || {};
    const orderId = body?.order?.id ?? body?.id ?? body?.order_id;
    if (!orderId) throw new Error("The order could not be created. Please try again.");
    return { orderId: Number(orderId), items, amount: subtotal };
  },

  async startPayment({ orderId, amount, email, items }) {
    const callback = `${window.location.origin}/shop/order-complete`;
    const res = await api.post("/payments/paystack/shop/initialize", {
      amount,
      email,
      order_id: Number(orderId),
      callback_url: callback,
      items,
    });
    const url = res.data?.authorization_url;
    if (!res.data?.status || !url) throw new Error(res.data?.message || "Could not start payment. Please try again.");
    return url;
  },

  async verifyPayment(reference, orderId) {
    const res = await api.get("/payments/paystack/shop/verify", { params: { reference, ...(orderId ? { order_id: orderId } : {}) } });
    return res.data || {};
  },

  async getMyOrders(authId) {
    const { data: orders, error } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("customer_auth_id", authId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!orders?.length) return [];
    const { data: items } = await supabase
      .from("shop_order_items")
      .select("*, products(name, image_urls)")
      .in("order_id", orders.map((o) => o.id));
    return orders.map((o) => ({ ...o, items: (items || []).filter((i) => i.order_id === o.id) }));
  },
};
