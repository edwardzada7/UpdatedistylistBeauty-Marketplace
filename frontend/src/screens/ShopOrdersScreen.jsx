import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageOff, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shopApi } from "@/services/shopApi";
import { useAuth } from "@/contexts/AuthContext";
import { formatNaira } from "@/screens/ShopScreen";
import ShopHeader from "@/components/ShopHeader";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";

const STATUS_STYLE = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  canceled: "bg-red-100 text-red-800",
};

export default function ShopOrdersScreen() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userData?.auth_id) return;
    shopApi
      .getMyOrders(userData.auth_id)
      .then(setOrders)
      .catch((err) => {
        console.error("[shop] orders failed", err);
        setError("Could not load your orders.");
      })
      .finally(() => setLoading(false));
  }, [userData?.auth_id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      <ShopHeader title="My orders" backTo="/shop" />
      <div className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-3xl">
        {loading ? (
          <LoadingSpinner message="Loading orders..." />
        ) : error ? (
          <p className="text-center text-gray-600 py-16">{error}</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-14 w-14 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-4">You haven't ordered anything yet.</p>
            <Button onClick={() => navigate("/shop")}>Browse the shop</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl border p-4" data-testid="order-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Order #{o.id}</p>
                    <p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                  <Badge className={STATUS_STYLE[String(o.status).toLowerCase()] || "bg-gray-100 text-gray-800"}>{String(o.status || "pending").replace(/_/g, " ")}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {o.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {it.products?.image_urls?.[0] ? <img src={it.products.image_urls[0]} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-5 w-5 text-gray-300" />}
                      </div>
                      <p className="flex-1 text-sm truncate">{it.products?.name || "Product"} × {it.quantity}</p>
                      <p className="text-sm font-medium">{formatNaira(it.total_price ?? Number(it.unit_price) * it.quantity)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t mt-3 pt-3 font-bold">
                  <span>Total</span>
                  <span>{formatNaira(o.total_amount)}</span>
                </div>
                {o.shipping_address && <p className="text-xs text-gray-500 mt-2">Deliver to: {typeof o.shipping_address === "string" ? o.shipping_address : JSON.stringify(o.shipping_address)}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
}
