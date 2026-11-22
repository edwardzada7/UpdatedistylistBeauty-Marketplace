import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shopApi } from "@/services/shopApi";
import { useCart } from "@/contexts/CartContext";
import { PENDING_ORDER_KEY } from "@/screens/CartScreen";

/** Paystack returns the buyer here; we verify the payment with the backend before showing success. */
export default function ShopOrderCompleteScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { clear } = useCart();
  const [state, setState] = useState("verifying"); // verifying | success | failed
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) {
      setState("failed");
      setMessage("Payment was cancelled. No charge was made.");
      return;
    }
    let orderId;
    try {
      orderId = Number(localStorage.getItem(PENDING_ORDER_KEY)) || undefined;
    } catch {
      orderId = undefined;
    }
    shopApi
      .verifyPayment(reference, orderId)
      .then((res) => {
        if (res.status === "success") {
          clear();
          try {
            localStorage.removeItem(PENDING_ORDER_KEY);
          } catch {
            /* ignore */
          }
          setState("success");
        } else {
          setState("failed");
          setMessage(res.message || "Payment could not be verified. If you were charged, please contact support.");
        }
      })
      .catch((err) => {
        setState("failed");
        setMessage(err?.response?.data?.detail || "Could not verify your payment. If you were charged, please contact support with your reference: " + reference);
      });
  }, [params, clear]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 px-4">
      <div className="bg-white rounded-2xl border shadow-sm p-8 max-w-md w-full text-center">
        {state === "verifying" && (
          <>
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-pink-600" />
            <p className="mt-4 text-gray-600">Confirming your payment...</p>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-600" />
            <h1 className="text-2xl font-bold mt-4">Order placed!</h1>
            <p className="text-gray-600 mt-2">Your payment was successful. The seller has been notified.</p>
            <div className="flex flex-col gap-2 mt-6">
              <Button className="bg-pink-600 hover:bg-pink-700" onClick={() => navigate("/shop/orders")}>View my orders</Button>
              <Button variant="outline" onClick={() => navigate("/shop")}>Keep shopping</Button>
            </div>
          </>
        )}
        {state === "failed" && (
          <>
            <XCircle className="h-14 w-14 mx-auto text-red-500" />
            <h1 className="text-2xl font-bold mt-4">Payment not completed</h1>
            <p className="text-gray-600 mt-2">{message}</p>
            <div className="flex flex-col gap-2 mt-6">
              <Button className="bg-pink-600 hover:bg-pink-700" onClick={() => navigate("/shop/cart")}>Back to cart</Button>
              <Button variant="outline" onClick={() => navigate("/support")}>Contact support</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
