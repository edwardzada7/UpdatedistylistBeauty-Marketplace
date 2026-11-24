import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventsAPI } from "@/services/eventsApi";

/** Paystack returns buyers here. The server confirms the payment, then issues the tickets. */
export default function EventPurchaseCompleteScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState("verifying");
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
    eventsAPI
      .verify(reference)
      .then((res) => {
        if (res.status === "success") setState("success");
        else { setState("failed"); setMessage(res.message || "Payment could not be verified. If you were charged, contact support."); }
      })
      .catch((e) => {
        setState("failed");
        setMessage(e?.response?.data?.detail || `Could not verify your payment. If you were charged, contact support with reference ${reference}.`);
      });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl border shadow-sm p-8 max-w-md w-full text-center">
        {state === "verifying" && (<><Loader2 className="h-12 w-12 mx-auto animate-spin text-purple-600" /><p className="mt-4 font-semibold">Confirming your payment...</p></>)}
        {state === "success" && (<><CheckCircle2 className="h-12 w-12 mx-auto text-green-600" /><h1 className="mt-4 text-xl font-bold">You're going!</h1><p className="text-gray-600 mt-1">Your tickets are ready, each with its own QR code and PIN.</p><Button className="mt-5" onClick={() => navigate("/tickets", { replace: true })}>View my tickets</Button></>)}
        {state === "failed" && (<><XCircle className="h-12 w-12 mx-auto text-red-600" /><h1 className="mt-4 text-xl font-bold">Payment not completed</h1><p className="text-gray-600 mt-1">{message}</p><Button className="mt-5" onClick={() => navigate("/events", { replace: true })}>Back to events</Button></>)}
      </div>
    </div>
  );
}
