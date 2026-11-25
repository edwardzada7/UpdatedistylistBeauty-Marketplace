import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, Loader2, MapPin, Ticket, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import TicketCard from "@/components/TicketCard";
import { useAuth } from "@/contexts/AuthContext";
import { eventsAPI, formatEventDate } from "@/services/eventsApi";
import { getGuestOrders, saveGuestOrder } from "@/utils/guestTickets";

/** Tickets for people without an account: opened from the emailed link, the Paystack return, or saved on this device. */
export default function GuestTicketsScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const token = params.get("t");
  const [state, setState] = useState(reference && token ? "loading" : "saved");
  const [message, setMessage] = useState("");
  const [groups, setGroups] = useState([]); // [{ reference, tickets }]
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const load = async () => {
      if (reference && token) {
        try {
          const res = await eventsAPI.guestVerify(reference, token);
          if (res.status !== "success") {
            setState("failed");
            setMessage(res.message || "Payment was not completed. No ticket was issued.");
            return;
          }
          const tickets = res.tickets || [];
          if (tickets[0]) saveGuestOrder({ reference, token, title: tickets[0].event_title });
          setGroups([{ reference, tickets }]);
          setState("ready");
        } catch (e) {
          setState("failed");
          setMessage(e?.response?.data?.detail || "We couldn't open these tickets. Use the link in your email.");
        }
        return;
      }
      const saved = getGuestOrders();
      const loaded = [];
      for (const o of saved) {
        try { loaded.push({ reference: o.reference, tickets: await eventsAPI.guestTickets(o.reference, o.token) }); } catch (_) { /* skip */ }
      }
      setGroups(loaded);
      setState("saved");
    };
    load();
  }, [reference, token]);

  const goAuth = (path) => {
    try { sessionStorage.setItem("POST_LOGIN_REDIRECT", "/tickets"); } catch (_) { /* storage unavailable */ }
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold flex items-center gap-2"><Ticket className="h-5 w-5 text-purple-600" /> My Tickets</h1>
          <Button size="sm" variant="outline" onClick={() => navigate("/events")}>Events</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-5 max-w-md space-y-6">
        {state === "loading" && <div className="text-center py-16"><Loader2 className="h-10 w-10 mx-auto animate-spin text-purple-600" /><p className="mt-3 font-medium">Confirming your payment...</p></div>}
        {state === "failed" && (
          <div className="bg-white rounded-2xl border p-6 text-center space-y-3"><XCircle className="h-10 w-10 mx-auto text-red-600" /><p>{message}</p><Button onClick={() => navigate("/events")}>Back to events</Button></div>
        )}
        {state === "ready" && <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3"><CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" /><p className="text-sm text-green-900">You're going! Your tickets are below, and we've emailed you a link to them. Screenshot or keep this page open for the door.</p></div>}
        {(state === "ready" || state === "saved") && groups.map((g) => (
          <section key={g.reference} className="space-y-3">
            {g.tickets[0] && (
              <div>
                <h2 className="font-bold text-lg break-words">{g.tickets[0].event_title}</h2>
                <p className="text-sm text-purple-700 flex items-center gap-1"><CalendarDays className="h-4 w-4" />{formatEventDate(g.tickets[0].event_starts_at)}</p>
                {g.tickets[0].event_venue && <p className="text-sm text-gray-600 flex items-start gap-1"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span className="break-words">{g.tickets[0].event_venue}</span></p>}
              </div>
            )}
            {g.tickets.map((t) => <TicketCard key={t.id} t={t} />)}
          </section>
        ))}
        {state === "saved" && !groups.length && (
          <div className="text-center py-12 text-gray-500 space-y-3">
            <Ticket className="h-10 w-10 mx-auto text-gray-300" />
            <p>No tickets saved on this device. Bought tickets as a guest? Open the link we emailed you.</p>
            <Button onClick={() => navigate("/events")}>Browse events</Button>
          </div>
        )}
        {!isAuthenticated && state !== "loading" && (
          <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 text-white p-5 space-y-2">
            <h3 className="font-bold">Sign up or sign in for more</h3>
            <p className="text-sm text-white/90">Create a free account with the same email to keep your tickets in the app, and to book trusted stylists, makeup artists and more.</p>
            <div className="flex gap-2">
              <Button className="bg-white text-purple-700 hover:bg-white/90" onClick={() => goAuth("/signup")}>Sign up free</Button>
              <Button variant="outline" className="bg-transparent text-white border-white/70 hover:bg-white/10" onClick={() => goAuth("/login")}>Log in</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
