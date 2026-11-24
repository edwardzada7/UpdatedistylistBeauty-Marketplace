import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Loader2, MapPin, Minus, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { eventsAPI, formatEventDate } from "@/services/eventsApi";
import { formatMoney } from "@/utils/money";

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
      toast.info("Please sign in to get tickets");
      navigate("/login");
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

  if (missing) return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><p>This event isn't available.</p><Button onClick={() => navigate("/events")}>Back to events</Button></div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>;

  const canceled = event.status === "canceled";
  const free = selected && selected.price === 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-lg font-bold truncate">Event details</h1>
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

      {!canceled && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-20">
          <div className="container mx-auto max-w-2xl">
            <Button className="w-full h-12 text-base" disabled={busy || !selected?.on_sale} onClick={buy} data-testid="event-buy-btn">
              {busy ? "Please wait..." : !selected ? "Sold out" : free ? "I'm attending" : `Buy ${qty > 1 ? `${qty} tickets` : "ticket"}${quote ? ` · ${formatMoney(quote.total)}` : ""}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
