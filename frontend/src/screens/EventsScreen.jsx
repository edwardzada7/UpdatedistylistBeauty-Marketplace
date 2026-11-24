import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { eventsAPI, formatEventDate } from "@/services/eventsApi";
import { formatMoney } from "@/utils/money";

export default function EventsScreen() {
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    eventsAPI.list().then(setEvents).catch(() => { setError("Could not load events."); setEvents([]); });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="text-xl font-bold truncate">Events</h1>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/tickets")}><Ticket className="h-4 w-4 mr-1" /> My Tickets</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-5 max-w-2xl space-y-4">
        {events === null && <p className="text-center text-gray-500 py-10">Loading events...</p>}
        {error && <p className="text-center text-red-600">{error}</p>}
        {events && !events.length && !error && (
          <div className="text-center py-16 text-gray-500"><CalendarDays className="h-10 w-10 mx-auto mb-2 text-gray-300" />No upcoming events yet. Check back soon.</div>
        )}
        {(events || []).map((e) => (
          <button key={e.id} type="button" onClick={() => navigate(`/events/${e.id}`)} className="w-full text-left bg-white rounded-2xl border overflow-hidden hover:shadow-md transition" data-testid={`event-card-${e.id}`}>
            <div className="h-44 bg-gradient-to-br from-purple-500 to-pink-500">
              {e.banner_url && <img src={e.banner_url} alt={e.title} className="h-full w-full object-cover" />}
            </div>
            <div className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {e.is_featured && <Badge className="bg-amber-100 text-amber-800">Featured</Badge>}
                {e.is_official && <span className="text-xs text-gray-600 flex items-center gap-1">{e.organizer_name} <VerifiedBadge verified size={14} /></span>}
                {e.my_ticket_count > 0 && <Badge className="bg-green-100 text-green-800">{e.my_ticket_count} ticket{e.my_ticket_count > 1 ? "s" : ""}</Badge>}
              </div>
              <h2 className="text-lg font-bold leading-tight break-words">{e.title}</h2>
              <p className="text-sm text-purple-700 font-medium">{formatEventDate(e.starts_at)}</p>
              {e.venue && <p className="text-sm text-gray-600 flex items-start gap-1"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span className="break-words">{e.venue}</span></p>}
              <p className="font-bold">{e.is_free ? "Free" : `From ${formatMoney(e.min_price)}`}{e.ticket_types.every((t) => t.sold_out) && e.ticket_types.length > 0 && <span className="ml-2 text-red-600 text-sm">Sold out</span>}</p>
            </div>
          </button>
        ))}
      </main>
    </div>
  );
}
