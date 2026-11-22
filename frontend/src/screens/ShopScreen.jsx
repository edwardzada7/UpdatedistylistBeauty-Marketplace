import { useEffect, useMemo, useState } from "react";
import SponsoredStrip from "@/components/SponsoredStrip";
import { useNavigate } from "react-router-dom";
import { Search, ImageOff, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { shopApi } from "@/services/shopApi";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { CURRENCY } from "@/utils/constants";
import ShopHeader from "@/components/ShopHeader";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import Footer from "@/components/Footer";

export const formatNaira = (n) => `${CURRENCY}${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

export default function ShopScreen() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { userData, isProvider } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await shopApi.getProducts());
    } catch (err) {
      console.error("[shop] load failed", err);
      setError("Could not load the shop. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const names = Array.from(new Set(products.map((p) => p.category_label).filter(Boolean)));
    return ["all", ...names];
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "all" || p.category_label === category) &&
        (!q || `${p.name} ${p.description || ""} ${p.seller_name || ""}`.toLowerCase().includes(q))
    );
  }, [products, query, category]);

  const quickAdd = (e, p) => {
    e.stopPropagation();
    if (isProvider) {
      toast.error("Provider accounts can't place customer orders. Use a customer account to shop.");
      return;
    }
    if (userData?.auth_id && p.stylist_auth_id === userData.auth_id) {
      toast.error("You can't buy your own product.");
      return;
    }
    addItem({
      productId: p.id,
      sellerId: p.seller_id,
      sellerListingId: p.seller_listing_id,
      sellerName: p.seller_name,
      stylistAuthId: p.stylist_auth_id,
      name: p.name,
      price: Number(p.price),
      stock: Number(p.stock),
      image: p.image_urls?.[0] || null,
    });
    toast.success(`${p.name} added to cart`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      <ShopHeader title="Shop" subtitle="Beauty and fashion products">
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products..." className="pl-10" data-testid="shop-search" />
        </div>
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${category === c ? "bg-pink-600 text-white border-pink-600" : "bg-white text-gray-700 hover:border-pink-300"}`}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
        )}
      </ShopHeader>

      <div className="container mx-auto px-4 py-6 pb-24 md:pb-8">
        <div className="-mx-4"><SponsoredStrip types="product" title="Sponsored products" /></div>
        {loading ? (
          <LoadingSpinner message="Loading products..." />
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={load}>Try again</Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-gray-500">{products.length === 0 ? "No products are available yet." : "No products match your search."}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="shop-grid">
            {visible.map((p) => (
              <Card
                key={`${p.id}-${p.seller_listing_id || "legacy"}`}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/shop/${p.id}${p.seller_listing_id ? `?listing=${p.seller_listing_id}` : ""}`)}
                data-testid={`product-card-${p.id}`}
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                  {p.image_urls[0] ? (
                    <img src={p.image_urls[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                  {p.seller_name && <p className="text-xs text-gray-500 truncate">by {p.seller_name}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-pink-600">{formatNaira(p.price)}</span>
                    <Button size="sm" variant="outline" className="h-8 px-2" onClick={(e) => quickAdd(e, p)} aria-label={`Add ${p.name} to cart`}>
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  </div>
                  {Number(p.stock) <= 3 && <p className="text-xs text-orange-600 mt-1">Only {p.stock} left</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomNavSpacer />
      <Footer />
      <BottomNavigation />
    </div>
  );
}
