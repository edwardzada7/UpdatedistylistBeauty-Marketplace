import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Loader2, MapPin, Minus, Plus, Share2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VerifiedBadge from "@/components/VerifiedBadge";
import ReportButton from "@/components/ReportButton";
import { useAuth } from "@/contexts/AuthContext";
import { eventsAPI, formatEventDate } from "@/services/eventsApi";
import { formatMoney } from "@/utils/money";
import { saveGuestOrder } from "@/utils/guestTickets";

export default function EventDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, userData, isAuthenticated } = useAuth();
  const [event, setEvent] = useState(null);
  const [missing, setMissing] = useState(false);
  const [typeId, setTypeId] = useState(null);
  const [qty, setQty] = useState(1);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });
  const [emailSent, setEmailSent] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await eventsAPI.get(id);
      setEvent(data);
      setTypeId((cur) => cur ?? data.ticket_types.find((t) => t.on_sale)?.id ?? null);
    } catch (e) {
      setMissing(true);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const selected = event?.ticket_types.find((t) => t.id === typeId) || null;

  useEffect(() => {
    if (!selected || event?.status !== "published") { setQuote(null); return undefined; }
    let cancelled = false;
    eventsAPI.quote(id, selected.id, qty).then((q) => { if (!cancelled) setQuote(q); }).catch(() => { if (!cancelled) setQuote(null); });
    return () => { cancelled = true; };
  }, [id, selected, qty, event?.status]);

  const maxQty = selected ? Math.min(selected.max_per_order, selected.remaining ?? selected.max_per_order) : 1;

  const buy = async () => {
    if (!isAuthenticated) {
      setGuestOpen(true);
      return;
    }
    const email = userData?.email || user?.email;
    if (!email) return toast.error("We need an email on your account to take payment");
    setBusy(true);
    try {
      const res = await eventsAPI.checkout(id, {
        ticket_type_id: selected.id,
        quantity: qty,
        email,
        redirect_url: `${window.location.origin}/events/purchase-complete`,
      });
      if (res.status === "free") {
        toast.success(`You're in! ${res.ticket_count} ticket${res.ticket_count > 1 ? "s" : ""} added to My Tickets`);
        navigate("/tickets");
      } else if (res.authorization_url) {
        window.location.href = res.authorization_url;
        return;
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not start checkout");
    } finally {
      setBusy(false);
    }
  };

  const guestBuy = async () => {
    if (guest.name.trim().length < 2) return toast.error("Enter your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(guest.email.trim())) return toast.error("Enter a valid email address");
    setBusy(true);
    try {
      const res = await eventsAPI.guestCheckout(id, {
        ticket_type_id: selected.id,
        quantity: qty,
        name: guest.name.trim(),
        email: guest.email.trim(),
        phone: guest.phone.trim() || null,
        redirect_url: `${window.location.origin}/events/guest-tickets`,
      });
      if (res.status === "free") {
        setGuestOpen(false);
        if (res.emailed) { setEmailSent(res.email); return; }
        saveGuestOrder({ reference: res.reference, token: res.access_token, title: event.title });
        navigate(`/events/guest-tickets?reference=${res.reference}&t=${res.access_token}`);
      } else if (res.authorization_url) {
        window.location.href = res.authorization_url;
        return;
      }
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not start checkout");
    } finally {
      setBusy(false);
    }
  };

  const goAuth = (path) => {
    try { sessionStorage.setItem("POST_LOGIN_REDIRECT", `/events/${id}`); } catch (_) { /* storage unavailable */ }
    navigate(path);
  };

  const share = async () => {
    const url = `${window.location.origin}/events/${id}`;
    try {
      if (navigator.share) await navigator.share({ title: event.title, text: `${event.title} on iStylist`, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch (_) { /* share dismissed */ }
  };

  if (missing) return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><p>This event isn't available.</p><Button onClick={() => navigate("/events")}>Back to events</Button></div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>;

  const canceled = event.status === "canceled";
  const free = selected && selected.price === 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/events"))} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-lg font-bold truncate flex-1">Event details</h1>
          {event && <Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4 mr-1" />Share</Button>}
        </div>
      </header>
      <main className="container mx-auto max-w-2xl">
        <div className="h-52 sm:h-64 bg-gradient-to-br from-purple-500 to-pink-500">
          {event.banner_url && <img src={event.banner_url} alt={event.title} className="h-full w-full object-cover" />}
        </div>
        <div className="px-4 py-5 space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {event.is_official && <span className="text-sm text-gray-600 flex items-center gap-1">{event.organizer_name} <VerifiedBadge verified size={15} /></span>}
              {!event.is_official && <span className="text-sm text-gray-600">By {event.organizer_name}</span>}
              {event.is_promoted && <Badge className="bg-purple-100 text-purple-800">Promoted</Badge>}
              {event.category_label && event.category !== "other" && <Badge className="bg-gray-100 text-gray-700">{event.category_label}</Badge>}
              <Badge className={event.is_free ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>{event.is_free ? "Free" : "Paid"}</Badge>
              {!event.is_official && <ReportButton targetType="event" targetId={event.id} label="Report event" />}
              {canceled && <Badge className="bg-red-100 text-red-700">Canceled</Badge>}
              {event.my_ticket_count > 0 && <Badge className="bg-green-100 text-green-800">You have {event.my_ticket_count} ticket{event.my_ticket_count > 1 ? "s" : ""}</Badge>}
            </div>
            <h2 className="text-2xl font-bold break-words">{event.title}</h2>
            <p className="flex items-start gap-2 text-gray-700"><CalendarDays className="h-5 w-5 mt-0.5 shrink-0 text-purple-600" />
              <span>{formatEventDate(event.starts_at)}{event.ends_at ? ` – ${formatEventDate(event.ends_at)}` : ""}</span></p>
            {(event.venue || event.address) && (
              <p className="flex items-start gap-2 text-gray-700"><MapPin className="h-5 w-5 mt-0.5 shrink-0 text-purple-600" />
                <span className="break-words">{[event.venue, event.address].filter(Boolean).join(", ")}</span></p>
            )}
          </div>

          {event.description && <p className="text-gray-700 whitespace-pre-wrap break-words">{event.description}</p>}

          {!canceled && (
            <div className="bg-white rounded-2xl border p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Ticket className="h-5 w-5 text-purple-600" /> Tickets</h3>
              {event.ticket_types.filter((t) => t.is_active).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!t.on_sale}
                  onClick={() => { setTypeId(t.id); setQty(1); }}
                  className={`w-full text-left rounded-xl border p-3 flex items-center justify-between gap-3 ${typeId === t.id ? "border-purple-500 bg-purple-50" : "border-gray-200"} ${!t.on_sale ? "opacity-50" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-500 break-words">{t.description}</p>}
                    <p className="text-xs text-gray-500">{t.sold_out ? "Sold out" : !t.on_sale ? "Sales closed" : t.remaining !== null && t.remaining <= 10 ? `Only ${t.remaining} left` : ""}</p>
                  </div>
                  <p className="font-bold shrink-0">{t.price === 0 ? "Free" : formatMoney(t.price)}</p>
                </button>
              ))}

              {selected?.on_sale && (
                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Quantity</span>
                    <div className="flex items-center gap-3">
                      <Button type="button" size="icon" variant="outline" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Fewer"><Minus className="h-4 w-4" /></Button>
                      <span className="w-6 text-center font-semibold">{qty}</span>
                      <Button type="button" size="icon" variant="outline" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="More"><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {quote && !free && (
                    <div className="text-sm space-y-1 border-t pt-3">
                      <div className="flex justify-between"><span>{qty} × {formatMoney(quote.unit_price)}</span><span>{formatMoney(quote.subtotal)}</span></div>
                      {quote.service_fee > 0 && <div className="flex justify-between text-gray-600"><span>Service fee</span><span>{formatMoney(quote.service_fee)}</span></div>}
                      <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span>{formatMoney(quote.total)}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Dialog open={guestOpen} onOpenChange={setGuestOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{free ? "Get your free ticket" : "Get your tickets"}</DialogTitle>
            <DialogDescription>No account needed. We'll email your tickets (QR code + PIN) to you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} autoComplete="name" /></div>
            <div><Label>Email</Label><Input type="email" inputMode="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} autoComplete="email" placeholder="Your tickets will be sent here" /></div>
            <div><Label>Phone (optional)</Label><Input type="tel" inputMode="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} autoComplete="tel" /></div>
            {quote && !free && <p className="text-sm text-gray-600">Total to pay: <b>{formatMoney(quote.total)}</b> via Paystack</p>}
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button className="w-full" onClick={guestBuy} disabled={busy}>{busy ? "Please wait..." : free ? "Get my ticket" : "Continue to payment"}</Button>
            <p className="text-xs text-center text-gray-500">
              Want more? <button type="button" className="text-purple-700 font-medium underline" onClick={() => goAuth("/signup")}>Sign up</button> or <button type="button" className="text-purple-700 font-medium underline" onClick={() => goAuth("/login")}>sign in</button> to keep your tickets in the app and book stylists.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!emailSent} onOpenChange={(o) => !o && setEmailSent("")}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md p-4 sm:p-6">
          <DialogHeader><DialogTitle>Check your email</DialogTitle><DialogDescription>We sent your ticket(s) to {emailSent}. Open the link in that email to see your QR code and PIN.</DialogDescription></DialogHeader>
          <DialogFooter><Button onClick={() => setEmailSent("")}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {!canceled && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-20">
          <div className="container mx-auto max-w-2xl">
            <Button className="w-full h-12 text-base" disabled={busy || !selected?.on_sale} onClick={buy} data-testid="event-buy-btn">
              {busy ? "Please wait..." : !selected ? (event.ticket_types.some((t) => t.sold_out) ? "Sold out" : "Tickets not available yet") : free ? "I'm attending" : `Buy ${qty > 1 ? `${qty} tickets` : "ticket"}${quote ? ` · ${formatMoney(quote.total)}` : ""}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
