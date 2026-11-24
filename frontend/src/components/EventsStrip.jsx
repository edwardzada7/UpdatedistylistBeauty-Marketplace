import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { eventsAPI, formatEventDate } from "@/services/eventsApi";
import { formatMoney } from "@/utils/money";

/** Upcoming events on the user and provider dashboards, with a My Tickets shortcut. */
export default function EventsStrip({ showTickets = true }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    eventsAPI.list().then((list) => { if (!cancelled) setEvents(list.slice(0, 6)); }).catch(() => {}).finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  if (!loaded) return null;

  return (
    <section className="mb-8" data-testid="events-strip">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="h-5 w-5 text-purple-600" /> Upcoming Events</h3>
        <div className="flex items-center gap-3 text-sm">
          {showTickets && (
            <button type="button" onClick={() => navigate("/tickets")} className="text-purple-700 font-medium flex items-center gap-1"><Ticket className="h-4 w-4" /> My Tickets</button>
          )}
          <button type="button" onClick={() => navigate("/events")} className="text-gray-700 font-medium">View all →</button>
        </div>
      </div>
      {!events.length && <p className="text-sm text-gray-500 bg-white border rounded-xl p-4">No upcoming events right now. Check back soon.</p>}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {events.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => navigate(`/events/${e.id}`)}
            className="snap-start shrink-0 w-64 text-left bg-white rounded-xl border overflow-hidden hover:shadow-md transition"
          >
            <div className="h-28 bg-gradient-to-br from-purple-500 to-pink-500">
              {e.banner_url && <img src={e.banner_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="p-3 space-y-1">
              <p className="font-semibold leading-tight line-clamp-2">{e.title}</p>
              <p className="text-xs text-purple-700">{formatEventDate(e.starts_at)}</p>
              {e.venue && <p className="text-xs text-gray-500 flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /><span className="line-clamp-1">{e.venue}</span></p>}
              <p className="text-sm font-bold text-gray-900">{e.is_free ? "Free" : `From ${formatMoney(e.min_price)}`}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
