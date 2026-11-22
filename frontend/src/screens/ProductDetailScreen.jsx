import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ImageOff, Minus, Plus, ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shopApi } from "@/services/shopApi";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatNaira } from "@/screens/ShopScreen";
import ShopHeader from "@/components/ShopHeader";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";

export default function ProductDetailScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { userData, isProvider } = useAuth();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState({ reviews: [], count: 0, average: 0 });
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await shopApi.getProduct(id, params.get("listing"));
        if (cancelled) return;
        setProduct(p);
        if (p) shopApi.getReviews(p.id).then((r) => !cancelled && setReviews(r));
      } catch (err) {
        console.error("[shop] product load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, params]);

  const add = (goToCart) => {
    if (!product) return;
    if (isProvider) {
      toast.error("Provider accounts can't place customer orders. Use a customer account to shop.");
      return;
    }
    if (userData?.auth_id && product.stylist_auth_id === userData.auth_id) {
      toast.error("You can't buy your own product.");
      return;
    }
    addItem(
      {
        productId: product.id,
        sellerId: product.seller_id,
        sellerListingId: product.seller_listing_id,
        sellerName: product.seller_name,
        stylistAuthId: product.stylist_auth_id,
        name: product.name,
        price: Number(product.price),
        stock: Number(product.stock),
        image: product.image_urls?.[0] || null,
      },
      qty
    );
    if (goToCart) navigate("/shop/cart");
    else toast.success(`${product.name} added to cart`);
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading product..." />;

  if (!product)
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopHeader title="Product" backTo="/shop" />
        <div className="text-center py-20 text-gray-500">This product is no longer available.</div>
        <Button className="mx-auto block" onClick={() => navigate("/shop")}>Back to shop</Button>
      </div>
    );

  const images = product.image_urls || [];
  const stock = Number(product.stock) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      <ShopHeader title="Product" backTo="/shop" />
      <div className="container mx-auto px-4 py-6 pb-24 md:pb-8 grid md:grid-cols-2 gap-8 max-w-5xl">
        <div>
          <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
            {images[imageIndex] ? <img src={images[imageIndex]} alt={product.name} className="w-full h-full object-cover" /> : <ImageOff className="h-12 w-12 text-gray-300" />}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {images.map((src, i) => (
                <button key={src + i} onClick={() => setImageIndex(i)} className={`h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden border-2 ${i === imageIndex ? "border-pink-600" : "border-transparent"}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold" data-testid="product-name">{product.name}</h2>
          {product.seller_name && <p className="text-sm text-gray-500 mt-1">Sold by {product.seller_name}</p>}
          {reviews.count > 0 && (
            <p className="flex items-center gap-1 text-sm mt-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> {reviews.average.toFixed(1)} ({reviews.count} {reviews.count === 1 ? "review" : "reviews"})
            </p>
          )}
          <p className="text-3xl font-bold text-pink-600 mt-4">{formatNaira(product.price)}</p>
          <p className={`text-sm mt-1 ${stock <= 3 ? "text-orange-600" : "text-gray-500"}`}>{stock > 0 ? (stock <= 3 ? `Only ${stock} left` : `${stock} in stock`) : "Out of stock"}</p>

          {product.description && <p className="mt-4 text-gray-700 whitespace-pre-line">{product.description}</p>}

          {stock > 0 && (
            <div className="flex items-center gap-3 mt-6">
              <span className="text-sm text-gray-600">Quantity</span>
              <div className="flex items-center border rounded-lg bg-white">
                <Button variant="ghost" size="sm" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease"><Minus className="h-4 w-4" /></Button>
                <span className="w-8 text-center font-medium" data-testid="product-qty">{qty}</span>
                <Button variant="ghost" size="sm" onClick={() => setQty((q) => Math.min(stock, q + 1))} aria-label="Increase"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button variant="outline" className="flex-1" disabled={stock <= 0} onClick={() => add(false)} data-testid="add-to-cart">
              <ShoppingCart className="h-4 w-4 mr-2" /> Add to cart
            </Button>
            <Button className="flex-1 bg-pink-600 hover:bg-pink-700" disabled={stock <= 0} onClick={() => add(true)} data-testid="buy-now">
              Buy now
            </Button>
          </div>

          {reviews.reviews.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold mb-3">Reviews</h3>
              <div className="space-y-3">
                {reviews.reviews.slice(0, 10).map((r, i) => (
                  <div key={r.id || i} className="bg-white rounded-lg border p-3">
                    <div className="flex items-center gap-1 text-sm">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= Number(r.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                      ))}
                      <span className="ml-2 text-gray-500">{r.reviewer_name || r.user_name || r.name || ""}</span>
                    </div>
                    {r.comment && <p className="text-sm text-gray-700 mt-1">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
}
