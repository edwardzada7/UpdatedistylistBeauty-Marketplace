import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import TicketCard from "@/components/TicketCard";
import { eventsAPI, formatEventDate } from "@/services/eventsApi";

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
