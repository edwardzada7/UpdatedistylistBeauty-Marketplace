import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shopApi } from "@/services/shopApi";
import { useCart } from "@/contexts/CartContext";
import { formatNaira } from "@/screens/ShopScreen";
import { saveGuestShopOrder, getGuestShopOrders, clearPendingGuestOrder } from "@/utils/guestShop";

/** Private guest order page (opened from Paystack return or the emailed link). Verifies payment, then shows status. */
export default function GuestShopOrderScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { clear } = useCart();
  const [state, setState] = useState("loading");
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const orderId = params.get("order");
    const token = params.get("t");
    const reference = params.get("reference") || params.get("trxref");
    if (!orderId || !token) { setState("failed"); setMessage("This order link is incomplete."); return; }
    (async () => {
      try {
        if (reference) {
          try { await shopApi.verifyPayment(reference, Number(orderId)); } catch (_) { /* tracking call below shows real state */ }
        }
        const o = await shopApi.getGuestOrder(orderId, token);
        setOrder(o);
        saveGuestShopOrder({ orderId, token, total: o.total_amount, at: Date.now() });
        if (o.paid) { clear(); clearPendingGuestOrder(); }
        setState("ok");
      } catch (err) {
        setState("failed");
        setMessage(err?.response?.data?.detail || "We couldn't load this order.");
      }
    })();
  }, [params, clear]);

  const others = getGuestShopOrders().filter((g) => String(g.orderId) !== String(params.get("order")));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 px-4 py-8">
      <div className="bg-white rounded-2xl border shadow-sm p-8 max-w-md w-full text-center">
        {state === "loading" && (<><Loader2 className="h-12 w-12 mx-auto animate-spin text-pink-600" /><p className="mt-4 text-gray-600">Loading your order...</p></>)}
        {state === "failed" && (
          <>
            <XCircle className="h-14 w-14 mx-auto text-red-500" />
            <h1 className="text-2xl font-bold mt-4">Order not available</h1>
            <p className="text-gray-600 mt-2">{message}</p>
            <Button className="mt-6 w-full" onClick={() => navigate("/shop/cart")}>Back to cart</Button>
          </>
        )}
        {state === "ok" && order && (
          <>
            {order.paid ? <CheckCircle2 className="h-14 w-14 mx-auto text-green-600" /> : <XCircle className="h-14 w-14 mx-auto text-amber-500" />}
            <h1 className="text-2xl font-bold mt-4">{order.paid ? "Order placed!" : "Payment not completed"}</h1>
            <p className="text-gray-600 mt-2">
              {order.paid ? "Your payment was successful. The seller has been notified and we've emailed you this order link." : "No payment was received for this order yet."}
            </p>
            <div className="text-left text-sm mt-5 border rounded-lg p-3 space-y-1">
              <p><span className="text-gray-500">Order #</span> {order.id}</p>
              <p><span className="text-gray-500">Status:</span> <span className="capitalize">{order.status}</span></p>
              <p><span className="text-gray-500">Deliver to:</span> {order.shipping_address}</p>
              {(order.items || []).map((i, k) => (
                <p key={k}>{i.quantity} × {i.name || "Item"}</p>
              ))}
              <p className="font-semibold pt-1">Total {formatNaira(order.total_amount)}</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">Bookmark this page or use the link in your email to check progress anytime.</p>
            <div className="flex flex-col gap-2 mt-5">
              <Button className="bg-pink-600 hover:bg-pink-700" onClick={() => navigate("/signup")}>Create an account</Button>
              <Button variant="outline" onClick={() => navigate("/shop")}>Keep shopping</Button>
            </div>
            {others.length > 0 && (
              <div className="mt-4 text-xs text-gray-500">
                Other orders on this device:{" "}
                {others.map((g) => (
                  <button key={g.orderId} className="underline mr-2" onClick={() => navigate(`/shop/guest-order?order=${g.orderId}&t=${g.token}`)}>#{g.orderId}</button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
