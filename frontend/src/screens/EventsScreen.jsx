import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { eventsAPI, formatEventDate } from "@/services/eventsApi";
import { formatMoney } from "@/utils/money";
import { APP_NAME } from "@/utils/constants";

/**
 * Public events page (/events). Anyone can browse without an account; guests get sign-up prompts,
 * which makes this page a way to bring people onto iStylist.
 */
function EventCard({ e, navigate }) {
  return (
    <button type="button" onClick={() => navigate(`/events/${e.id}`)} className="w-full text-left bg-white rounded-2xl border overflow-hidden hover:shadow-md transition" data-testid={`event-card-${e.id}`}>
      <div className="h-44 bg-gradient-to-br from-purple-500 to-pink-500">
        {e.banner_url && <img src={e.banner_url} alt={e.title} className="h-full w-full object-cover" />}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {e.is_promoted && <Badge className="bg-purple-100 text-purple-800">Promoted</Badge>}
          <Badge className={e.is_free ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>{e.is_free ? "Free" : "Paid"}</Badge>
          {e.category_label && e.category !== "other" && <Badge className="bg-gray-100 text-gray-700">{e.category_label}</Badge>}
          {e.is_featured && <Badge className="bg-amber-100 text-amber-800">Featured</Badge>}
          <span className="text-xs text-gray-600 flex items-center gap-1">{e.organizer_name} {e.is_official && <VerifiedBadge verified size={14} />}</span>
          {e.my_ticket_count > 0 && <Badge className="bg-green-100 text-green-800">{e.my_ticket_count} ticket{e.my_ticket_count > 1 ? "s" : ""}</Badge>}
        </div>
        <h2 className="text-lg font-bold leading-tight break-words">{e.title}</h2>
        <p className="text-sm text-purple-700 font-medium">{formatEventDate(e.starts_at)}</p>
        {e.venue && <p className="text-sm text-gray-600 flex items-start gap-1"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span className="break-words">{e.venue}</span></p>}
        <p className="font-bold">{e.is_free ? "Free" : `From ${formatMoney(e.min_price)}`}{e.ticket_types.length > 0 && e.ticket_types.every((t) => t.sold_out) && <span className="ml-2 text-red-600 text-sm">Sold out</span>}</p>
      </div>
    </button>
  );
}

function Section({ title, items, navigate, testId }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3" data-testid={testId}>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{items.map((e) => <EventCard key={e.id} e={e} navigate={navigate} />)}</div>
    </section>
  );
}

export default function EventsScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | free | <category key>

  useEffect(() => {
    eventsAPI.list().then(setEvents).catch(() => { setError("Could not load events."); setEvents([]); });
  }, []);

  const categories = useMemo(() => {
    const seen = new Map();
    (events || []).forEach((e) => { if (e.category && !seen.has(e.category)) seen.set(e.category, e.category_label || e.category); });
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [events]);

  const sections = useMemo(() => {
    const list = events || [];
    const weekEnd = Date.now() + 7 * 24 * 3600 * 1000;
    const promoted = list.filter((e) => e.is_promoted);
    const thisWeek = list.filter((e) => !e.is_promoted && new Date(e.starts_at).getTime() <= weekEnd);
    const free = list.filter((e) => e.is_free && !e.is_promoted && !thisWeek.includes(e));
    const shown = new Set([...promoted, ...thisWeek, ...free]);
    const more = list.filter((e) => !shown.has(e));
    return { promoted, thisWeek, free, more };
  }, [events]);

  const filtered = useMemo(() => {
    if (filter === "all") return null;
    const list = events || [];
    return filter === "free" ? list.filter((e) => e.is_free) : list.filter((e) => e.category === filter);
  }, [events, filter]);

  const back = () => (isAuthenticated ? navigate(-1) : navigate("/login"));

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2 max-w-3xl">
          <div className="flex items-center gap-2 min-w-0">
            {isAuthenticated && <Button variant="ghost" size="sm" onClick={back} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>}
            <h1 className="text-xl font-bold truncate">{isAuthenticated ? "Events" : `${APP_NAME} Events`}</h1>
          </div>
          {isAuthenticated ? (
            <Button size="sm" variant="outline" onClick={() => navigate("/tickets")}><Ticket className="h-4 w-4 mr-1" /> My Tickets</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate("/login")}>Sign in</Button>
              <Button size="sm" onClick={() => navigate("/signup")}>Join</Button>
            </div>
          )}
        </div>
      </header>

      {!isAuthenticated && (
        <section className="bg-gradient-to-br from-purple-600 to-pink-500 text-white">
          <div className="container mx-auto px-4 py-8 max-w-3xl text-center space-y-3">
            <h2 className="text-2xl font-extrabold">Beauty &amp; fashion events near you</h2>
            <p className="text-white/90">Masterclasses, pop-ups and launches from {APP_NAME}. Browse them all, then create a free account to get your tickets.</p>
            <Button className="bg-white text-purple-700 hover:bg-white/90" onClick={() => navigate("/signup")}>Create a free account</Button>
          </div>
        </section>
      )}

      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-4">
        {events === null && <p className="text-center text-gray-500 py-10">Loading events...</p>}
        {error && <p className="text-center text-red-600">{error}</p>}
        {events && !events.length && !error && (
          <div className="text-center py-16 text-gray-500"><CalendarDays className="h-10 w-10 mx-auto mb-2 text-gray-300" />No upcoming events yet. Check back soon.</div>
        )}
        {events && events.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" data-testid="event-category-chips">
            {[{ key: "all", label: "All" }, { key: "free", label: "Free" }, ...categories].map((c) => (
              <button key={c.key} type="button" onClick={() => setFilter(c.key)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${filter === c.key ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-700"}`}>
                {c.label}
              </button>
            ))}
          </div>
        )}
        {filtered ? (
          filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2">{filtered.map((e) => <EventCard key={e.id} e={e} navigate={navigate} />)}</div>
          ) : <p className="text-center text-gray-500 py-10">No events here yet.</p>
        ) : (
          <>
            <Section title="Promoted" items={sections.promoted} navigate={navigate} testId="events-promoted" />
            <Section title="Happening this week" items={sections.thisWeek} navigate={navigate} testId="events-this-week" />
            <Section title="Free events" items={sections.free} navigate={navigate} testId="events-free" />
            <Section title={sections.promoted.length || sections.thisWeek.length || sections.free.length ? "More upcoming events" : "Upcoming events"} items={sections.more} navigate={navigate} testId="events-more" />
          </>
        )}
        {!isAuthenticated && events && events.length > 0 && (
          <div className="bg-white border rounded-2xl p-5 text-center space-y-2">
            <p className="font-semibold">Want to book beauty pros too?</p>
            <p className="text-sm text-gray-600">Join {APP_NAME} to find verified stylists, book appointments and shop, all in one place.</p>
            <Button onClick={() => navigate("/signup")}>Join {APP_NAME}</Button>
          </div>
        )}
      </main>
    </div>
  );
}
