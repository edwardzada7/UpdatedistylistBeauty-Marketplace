import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { eventsAPI, formatEventDate } from "@/services/eventsApi";

const STATUS = {
  valid: { label: "Valid", cls: "bg-green-100 text-green-800" },
  used: { label: "Used", cls: "bg-gray-200 text-gray-700" },
  refund_due: { label: "Refund due", cls: "bg-amber-100 text-amber-800" },
  canceled: { label: "Canceled", cls: "bg-red-100 text-red-700" },
};

function TicketCard({ t }) {
  const st = STATUS[t.status] || STATUS.valid;
  const usable = t.status === "valid";
  return (
    <div className="bg-white rounded-2xl border overflow-hidden" data-testid={`ticket-${t.id}`}>
      <div className="p-4 flex items-center justify-between gap-2 border-b">
        <p className="font-semibold">{t.ticket_type || "Ticket"}</p>
        <Badge className={st.cls}>{st.label}</Badge>
      </div>
      <div className="p-4 flex flex-col items-center gap-3">
        {usable && t.qr_svg ? (
          <div className="w-56 max-w-full bg-white p-2 rounded-lg border [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: t.qr_svg }} />
        ) : (
          <div className="w-56 max-w-full aspect-square rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm text-center px-4">
            {t.status === "used" ? `Used${t.used_at ? ` ${new Date(t.used_at).toLocaleString()}` : ""}` : usable ? "QR code unavailable. Use the PIN below." : "This ticket can't be used"}
          </div>
        )}
        {usable && (
          <div className="text-center">
            <p className="text-xs text-gray-500">Or show this PIN at the door</p>
            <p className="text-3xl font-bold tracking-[0.3em] pl-[0.3em]" data-testid="ticket-pin">{t.pin}</p>
          </div>
        )}
        <p className="text-xs text-gray-500 text-center">One person per ticket. It works once, so don't share the QR code or PIN.</p>
      </div>
    </div>
  );
}

export default function MyTicketsScreen() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState(null);

  useEffect(() => {
    eventsAPI.myTickets().then(setTickets).catch(() => setTickets([]));
  }, []);

  const groups = [];
  (tickets || []).forEach((t) => {
    let g = groups.find((x) => x.event_id === t.event_id);
    if (!g) { g = { event_id: t.event_id, info: t, items: [] }; groups.push(g); }
    g.items.push(t);
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">My Tickets</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-5 max-w-md space-y-8">
        {tickets === null && <p className="text-center text-gray-500 py-10">Loading...</p>}
        {tickets && !tickets.length && (
          <div className="text-center py-16 text-gray-500">
            <Ticket className="h-10 w-10 mx-auto mb-2 text-gray-300" />You have no tickets yet.
            <div><Button className="mt-4" onClick={() => navigate("/events")}>Browse events</Button></div>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.event_id} className="space-y-3">
            <button type="button" onClick={() => navigate(`/events/${g.event_id}`)} className="text-left w-full">
              <h2 className="font-bold text-lg break-words">{g.info.event_title}</h2>
              <p className="text-sm text-purple-700 flex items-center gap-1"><CalendarDays className="h-4 w-4" />{formatEventDate(g.info.event_starts_at)}</p>
              {g.info.event_venue && <p className="text-sm text-gray-600 flex items-start gap-1"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span className="break-words">{g.info.event_venue}</span></p>}
            </button>
            {g.items.map((t) => <TicketCard key={t.id} t={t} />)}
          </section>
        ))}
      </main>
    </div>
  );
}
