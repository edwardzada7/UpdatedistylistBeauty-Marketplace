import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsAPI, reviewsAPI } from "@/services/api";

const POLL_MS = 60000;
const dismissKey = (it) => `BK_PROMPT_${it.type}_${it.booking_id}`;

const store = (it) => (it.type === "review" ? localStorage : sessionStorage);
const isDismissed = (it) => {
  try { return store(it).getItem(dismissKey(it)) === "1"; } catch { return false; }
};
const setDismissed = (it) => {
  try { store(it).setItem(dismissKey(it), "1"); } catch { /* ignore */ }
};

/**
 * Global popup for the booking lifecycle: "Was your service completed?", provider "completed / no-show",
 * "file a no-show" and "review this service". Polls quietly in the background (no page reloads).
 */
export default function BookingPrompts() {
  const navigate = useNavigate();
  const { userData, isAuthenticated, isProvider } = useAuth();
  const authId = userData?.auth_id;
  const role = isProvider ? "provider" : "customer";

  const [item, setItem] = useState(null);
  const [mode, setMode] = useState("main"); // main | reason
  const [pendingAnswer, setPendingAnswer] = useState(null); // 'no' | 'noshow'
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (!authId || busyRef.current) return;
    try {
      const res = await bookingsAPI.pendingActions(authId, role);
      const next = (res.data?.items || []).find((i) => !isDismissed(i)) || null;
      setItem((cur) => {
        if (cur && next && cur.booking_id === next.booking_id && cur.type === next.type) return cur;
        if (cur && !next) return null;
        if (cur && next) return cur; // never swap a popup the user is reading
        return next;
      });
    } catch {
      /* silent: prompts are best-effort */
    }
  }, [authId, role]);

  useEffect(() => {
    if (!isAuthenticated || !authId) { setItem(null); return undefined; }
    load();
    const t = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [isAuthenticated, authId, load]);

  const close = (dismiss = true) => {
    if (item && (dismiss || item.type === "review")) setDismissed(item);
    // review popup: remember on the server too so it never comes back for this booking (any device)
    if (item && item.type === "review") bookingsAPI.dismissReviewPrompt(authId, item.booking_id).catch(() => {});
    setItem(null); setMode("main"); setPendingAnswer(null); setReason(""); setComment(""); setRating(5);
    setTimeout(load, 400);
  };

  const run = async (fn) => {
    setBusy(true); busyRef.current = true;
    try { await fn(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Something went wrong. Please try again."); }
    finally { setBusy(false); busyRef.current = false; }
  };

  if (!item) return null;

  const id = item.booking_id;

  const yes = () => run(async () => {
    const r = await bookingsAPI.customerConfirm(id, authId, true);
    toast.success(r.data?.message || "Thanks! Payment released.");
    close(false);
  });
  const submitNo = () => run(async () => {
    const r = await bookingsAPI.customerConfirm(id, authId, false, reason.trim() || null);
    toast.info(r.data?.message || "Payment is on hold.");
    close(false);
  });
  const providerCompleted = () => run(async () => {
    await bookingsAPI.updateStatus(id, "completed", "provider", authId);
    toast.success("Marked completed. Payment is released once the customer confirms (or automatically after 24 hours).");
    close(false);
  });
  const reportNoShow = () => run(async () => {
    await bookingsAPI.reportNoShow(id, authId, reason.trim() || null);
    toast.success("No-show reported. The other side has a short time to respond or dispute.");
    close(false);
  });
  const submitReview = () => run(async () => {
    await reviewsAPI.create(authId, { booking_id: id, rating, comment: comment.trim() || null });
    toast.success("Thank you for your review!");
    close(false);
  });

  const reasonBox = (placeholder) => (
    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} rows={3} maxLength={300} />
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) close(true); }}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)]" data-testid="booking-prompt">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>{item.message}</DialogDescription>
        </DialogHeader>
        {item.reason && <p className="text-xs text-gray-500 bg-gray-50 rounded-md p-3">{item.reason}</p>}

        {item.type === "customer_confirm" && mode === "main" && (
          <div className="flex flex-col gap-2">
            <Button onClick={yes} disabled={busy} data-testid="prompt-yes">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, completed. Release payment"}
            </Button>
            <Button variant="outline" onClick={() => { setMode("reason"); setPendingAnswer("no"); }} disabled={busy}>
              No, it did not happen
            </Button>
            <Button variant="ghost" onClick={() => close(true)} disabled={busy}>Answer later</Button>
          </div>
        )}
        {item.type === "customer_confirm" && mode === "reason" && (
          <div className="space-y-2">
            {reasonBox("What happened? (optional)")}
            <p className="text-xs text-amber-700">Your payment will stay on hold until a no-show is resolved. It will not be auto-released.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("main")} disabled={busy}>Back</Button>
              <Button onClick={submitNo} disabled={busy} className="flex-1">Confirm: service did not happen</Button>
            </div>
          </div>
        )}

        {item.type === "provider_mark" && mode === "main" && (
          <div className="flex flex-col gap-2">
            <Button onClick={providerCompleted} disabled={busy} data-testid="prompt-provider-complete">Completed</Button>
            <Button variant="outline" onClick={() => { setMode("reason"); setPendingAnswer("noshow"); }} disabled={busy}>
              Customer did not show (No-show)
            </Button>
            <Button variant="ghost" onClick={() => close(true)} disabled={busy}>Later</Button>
          </div>
        )}

        {item.type === "file_no_show" && mode === "main" && (
          <div className="flex flex-col gap-2">
            <Button onClick={() => { setMode("reason"); setPendingAnswer("noshow"); }} disabled={busy}>File a no-show</Button>
            <Button variant="outline" onClick={() => { close(true); navigate(`/bookings/${id}`); }}>Open booking</Button>
            <Button variant="ghost" onClick={() => close(true)}>Later</Button>
          </div>
        )}

        {mode === "reason" && pendingAnswer === "noshow" && (
          <div className="space-y-2">
            {reasonBox("Short reason (optional)")}
            <p className="text-xs text-amber-700">The other side can confirm or dispute. False reports can lead to account penalties.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("main")} disabled={busy}>Back</Button>
              <Button onClick={reportNoShow} disabled={busy} className="flex-1">Submit no-show</Button>
            </div>
          </div>
        )}

        {item.type === "review" && (
          <div className="space-y-3">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                  <Star className={`h-8 w-8 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell others about your experience (optional)" rows={3} />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => close(true)} disabled={busy}>Not now</Button>
              <Button onClick={submitReview} disabled={busy} className="flex-1">Submit review</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
