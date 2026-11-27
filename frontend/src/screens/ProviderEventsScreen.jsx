import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, ImagePlus, Loader2, Megaphone, Plus, ScanLine, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import DateTimeField from "@/components/DateTimeField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { providerEventsAPI, formatEventDate, EVENT_CATEGORIES } from "@/services/eventsApi";
import { providerShopApi } from "@/services/providerShopApi";
import { formatMoney } from "@/utils/money";

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (local) => (local ? new Date(local).toISOString() : null);
const blankType = () => ({ id: null, name: "General", description: "", price: "0", capacity: "", max_per_order: "10", sales_end: "", is_active: true });
const blankForm = () => ({ title: "", description: "", banner_url: "", venue: "", address: "", starts_at: "", ends_at: "", fee_mode: "add_on", ticket_types: [blankType()], is_free: false, category: "other" });
const fromEvent = (e) => ({
  title: e.title || "", description: e.description || "", banner_url: e.banner_url || "", venue: e.venue || "", address: e.address || "",
  starts_at: toLocalInput(e.starts_at), ends_at: toLocalInput(e.ends_at), fee_mode: e.fee_mode || "add_on",
  is_free: !!e.is_free, category: e.category || "other",
  ticket_types: e.ticket_types.map((t) => ({
    id: t.id, name: t.name, description: t.description || "", price: String(t.price), capacity: t.capacity ?? "",
    max_per_order: String(t.max_per_order), sales_end: toLocalInput(t.sales_end), is_active: t.is_active, sold: t.sold,
  })),
});

const STATUS = {
  draft: ["Draft", "bg-gray-200 text-gray-700"],
  pending_review: ["In review", "bg-amber-100 text-amber-800"],
  published: ["Live", "bg-green-100 text-green-800"],
  rejected: ["Not approved", "bg-red-100 text-red-700"],
  canceled: ["Canceled", "bg-red-100 text-red-700"],
};

function EventForm({ authId, initial, editing, trusted, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setType = (i, patch) => setForm((f) => ({ ...f, ticket_types: f.ticket_types.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) }));

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try { set({ banner_url: await providerShopApi.uploadImage(file, authId) }); }
    catch (err) { toast.error(err?.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const save = async (submit) => {
    if (form.title.trim().length < 2) return toast.error("Give the event a title");
    if (!form.starts_at) return toast.error("Choose a start date and time");
    if (!form.ticket_types.length) return toast.error("Add at least one ticket type");
    const body = {
      title: form.title.trim(), description: form.description.trim() || null, banner_url: form.banner_url || null,
      venue: form.venue.trim() || null, address: form.address.trim() || null,
      starts_at: toIso(form.starts_at), ends_at: toIso(form.ends_at), status: submit ? "published" : "draft", fee_mode: form.fee_mode,
      is_free: !!form.is_free, category: form.category || "other",
      ticket_types: form.ticket_types.map((t) => ({
        id: t.id, name: t.name.trim() || "Ticket", description: t.description.trim() || null, price: Number(t.price) || 0,
        capacity: t.capacity === "" ? null : Number(t.capacity), max_per_order: Number(t.max_per_order) || 10,
        sales_end: toIso(t.sales_end), is_active: t.is_active,
      })),
    };
    setBusy(true);
    try {
      const saved = editing ? await providerEventsAPI.update(editing, body) : await providerEventsAPI.create(body);
      if (submit) toast.success(saved.status === "published" ? "Your event is live" : "Submitted. We'll review it shortly and notify you.");
      else toast.success("Saved as draft");
      onSaved();
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Could not save the event");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>{trusted ? "Your events go live right away." : "New organisers' first events are reviewed before going live."}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Banner</Label>
            {form.banner_url ? (
              <div className="relative h-36 rounded-lg overflow-hidden border mt-1">
                <img src={form.banner_url} alt="" className="h-full w-full object-cover" />
                <Button type="button" size="sm" variant="secondary" className="absolute top-2 right-2" onClick={() => set({ banner_url: "" })}>Remove</Button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-1 w-full h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-sm text-gray-500">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}{uploading ? "Uploading..." : "Add banner image"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={160} /></div>
          <div><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            <p className="text-xs text-gray-500 mt-1">Phone numbers, social handles and outside links aren't allowed. Guests contact you through iStylist.</p></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Starts</Label><DateTimeField value={form.starts_at} onChange={(v) => set({ starts_at: v })} /></div>
            <div><Label>Ends (optional)</Label><DateTimeField optional value={form.ends_at} onChange={(v) => set({ ends_at: v })} /></div>
            <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => set({ venue: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => set({ address: e.target.value })} /></div>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Category</Label>
              <select className="w-full h-10 rounded-md border px-2 bg-white text-sm" value={form.category || "other"} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} data-testid="event-category">
                {EVENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" data-testid="free-event-toggle">
              <input type="checkbox" className="h-4 w-4" checked={!!form.is_free}
                onChange={(e) => setForm((f) => ({ ...f, is_free: e.target.checked, ticket_types: e.target.checked ? f.ticket_types.map((t) => ({ ...t, price: "0" })) : f.ticket_types }))} />
              This is a free event (no ticket payment)
            </label>
            <div className="flex items-center justify-between"><Label>Ticket types</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, ticket_types: [...f.ticket_types, { ...blankType(), name: "" }] }))}><Plus className="h-4 w-4 mr-1" />Add type</Button></div>
            <p className="text-xs text-gray-500">Price 0 makes a free "I'm attending" ticket. Leave capacity empty for unlimited. iStylist keeps a commission on paid tickets; your earnings are paid 24 hours after the event ends.</p>
            {form.ticket_types.map((t, i) => (
              <div key={t.id || `new-${i}`} className="border rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2"><Label className="text-xs">Name</Label><Input value={t.name} onChange={(e) => setType(i, { name: e.target.value })} placeholder="General, VIP..." /></div>
                  {form.is_free ? <div><Label className="text-xs">Price</Label><p className="h-10 flex items-center text-sm font-semibold text-green-700">Free</p></div> : <div><Label className="text-xs">Price (₦)</Label><Input type="number" min="0" value={t.price} onChange={(e) => setType(i, { price: e.target.value })} /></div>}
                  <div><Label className="text-xs">Capacity{t.sold ? ` (sold ${t.sold})` : ""}</Label><Input type="number" min="1" value={t.capacity} onChange={(e) => setType(i, { capacity: e.target.value })} placeholder="Unlimited" /></div>
                  <div><Label className="text-xs">Max per order</Label><Input type="number" min="1" max="50" value={t.max_per_order} onChange={(e) => setType(i, { max_per_order: e.target.value })} /></div>
                  <div><Label className="text-xs">Sales close (optional)</Label><DateTimeField optional value={t.sales_end} onChange={(v) => setType(i, { sales_end: v })} /></div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={t.is_active} onChange={(e) => setType(i, { is_active: e.target.checked })} /> On sale</label>
                  <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => setForm((f) => ({ ...f, ticket_types: f.ticket_types.filter((_, idx) => idx !== i) }))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
          <div><Label>Service fee</Label>
            <select className="w-full border rounded-md h-10 px-2 bg-white" value={form.fee_mode} onChange={(e) => set({ fee_mode: e.target.value })}>
              <option value="add_on">Added on top of the ticket price</option>
              <option value="absorbed">Included in the ticket price</option>
            </select></div>
        </div>
        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" disabled={busy} onClick={() => save(false)}>Save draft</Button>
          <Button disabled={busy} onClick={() => save(true)}>{busy ? "Saving..." : trusted ? "Publish" : "Submit for review"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttendeesDialog({ event, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { providerEventsAPI.attendees(event.id).then(setRows).catch(() => setRows([])); }, [event.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>Attendees · {event.title}</DialogTitle><DialogDescription>{rows ? `${rows.length} ticket(s)` : "Loading..."}</DialogDescription></DialogHeader>
        <div className="divide-y text-sm">
          {(rows || []).map((r) => (
            <div key={r.id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="font-medium truncate">{r.name}</p><p className="text-xs text-gray-500 truncate">{r.ticket_type} · PIN {r.pin}</p></div>
              <Badge className={r.status === "used" ? "bg-gray-200 text-gray-700" : r.status === "valid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>{r.status === "used" ? "Checked in" : r.status.replace("_", " ")}</Badge>
            </div>
          ))}
          {rows && !rows.length && <p className="py-6 text-center text-gray-500">No tickets yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScannersDialog({ event, onClose }) {
  const [rows, setRows] = useState([]);
  const [label, setLabel] = useState("");
  const load = useCallback(() => providerEventsAPI.scanners(event.id).then(setRows).catch(() => setRows([])), [event.id]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    try { await providerEventsAPI.addScanner(event.id, label.trim() || null); setLabel(""); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Could not create a code"); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>Door scanner codes</DialogTitle>
          <DialogDescription>Give each door staff member a code. They open {window.location.origin}/scanner, enter it and can only scan this event.</DialogDescription></DialogHeader>
        <div className="flex gap-2"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Main gate" /><Button onClick={add}>Create code</Button></div>
        <div className="divide-y">
          {rows.map((s) => (
            <div key={s.id} className="py-2 flex items-center justify-between gap-2">
              <div><p className="font-mono text-lg tracking-widest font-bold">{s.access_code}</p><p className="text-xs text-gray-500">{s.label || "Scanner"}</p></div>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { await providerEventsAPI.deleteScanner(event.id, s.id); load(); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {!rows.length && <p className="py-4 text-sm text-gray-500">No codes yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PromoteDialog({ event, tiers, email, onClose }) {
  const [days, setDays] = useState(tiers[0]?.days);
  const [feed, setFeed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    if (!email) return toast.error("Add an email to your profile first");
    setBusy(true);
    try {
      const r = await providerEventsAPI.promote(event.id, { days, email, redirect_url: `${window.location.origin}/provider/events`, announce_in_feed: feed });
      window.location.href = r.authorization_url;
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not start payment"); setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md p-4 sm:p-6">
        <DialogHeader><DialogTitle>Promote “{event.title}”</DialogTitle>
          <DialogDescription>Promoted events get a “Promoted” tag and appear first in the Events section.</DialogDescription></DialogHeader>
        <div className="space-y-2">
          {tiers.map((t) => (
            <label key={t.days} className={`flex items-center justify-between border rounded-xl p-3 cursor-pointer ${days === t.days ? "border-purple-600 bg-purple-50" : ""}`}>
              <span className="flex items-center gap-2"><input type="radio" checked={days === t.days} onChange={() => setDays(t.days)} /> {t.days} days</span>
              <span className="font-bold">{formatMoney(t.price)}</span>
            </label>
          ))}
          <label className="text-sm flex items-center gap-2 pt-1"><input type="checkbox" checked={feed} onChange={(e) => setFeed(e.target.checked)} /> Also announce it in the feed</label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={pay} disabled={busy}>{busy ? "Starting..." : "Pay with Paystack"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProviderEventsScreen() {
  const navigate = useNavigate();
  const { userData, user } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [attendees, setAttendees] = useState(null);
  const [scanners, setScanners] = useState(null);
  const [promote, setPromote] = useState(null);
  const ran = useRef(false);

  const load = useCallback(async () => {
    try { setData(await providerEventsAPI.mine()); }
    catch (e) { toast.error(e?.response?.data?.detail || "Could not load your events"); setData({ events: [], trusted: false, promo_tiers: [] }); }
  }, []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const ref = new URLSearchParams(window.location.search).get("reference") || new URLSearchParams(window.location.search).get("trxref");
    (async () => {
      if (ref && ref.startsWith("istylist_evpromo_")) {
        try {
          const r = await providerEventsAPI.verifyPromo(ref);
          if (r.status === "success") toast.success("Your event is now promoted");
          else toast.error(r.message || "Payment not completed");
        } catch (e) { toast.error(e?.response?.data?.detail || "Could not confirm the payment. Contact support if you were charged."); }
        window.history.replaceState({}, "", "/provider/events");
      }
      load();
    })();
  }, [load]);

  const cancelEvent = async (e) => {
    if (!window.confirm(`Cancel "${e.title}"? Every ticket buyer is notified and refunded automatically. This can't be undone.`)) return;
    try {
      const r = await providerEventsAPI.cancel(e.id);
      toast.success(`Canceled. ${r.refunded || 0} refunded${r.refund_pending ? `, ${r.refund_pending} will be refunded by support` : ""}.`);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Could not cancel"); }
  };

  const authId = userData?.auth_id;
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => navigate("/provider/dashboard")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="h-5 w-5 text-purple-600" /> My Events</h1></div>
          <Button onClick={() => setForm({ initial: blankForm(), id: null })} data-testid="new-event-btn"><Plus className="h-4 w-4 mr-1" />New event</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-4">
        {!data && <p className="text-center text-gray-500 py-10">Loading...</p>}
        {data && !data.events.length && <p className="text-center text-gray-500 py-10">You haven't posted an event yet. Masterclasses, pop-ups, launches: sell tickets or list free events.</p>}
        {(data?.events || []).map((e) => {
          const [label, cls] = STATUS[e.status] || STATUS.draft;
          const ended = e.starts_at && new Date(e.ends_at || e.starts_at) < new Date();
          return (
            <div key={e.id} className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold break-words">{e.title}</p><p className="text-sm text-purple-700">{formatEventDate(e.starts_at)}</p>{e.venue && <p className="text-xs text-gray-500 break-words">{e.venue}</p>}</div>
                <div className="flex gap-1">{e.is_promoted && <Badge className="bg-purple-100 text-purple-800">Promoted</Badge>}<Badge className={e.is_free ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>{e.is_free ? "Free" : "Paid"}</Badge><Badge className={cls}>{label}</Badge></div>
              </div>
              {e.status === "rejected" && e.rejection_reason && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-2">Not approved: {e.rejection_reason}. Edit and submit again.</p>}
              {e.status === "pending_review" && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-2">We're reviewing this event. You'll get a notification when it's live.</p>}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["Tickets", e.stats?.tickets_issued ?? 0], ["Checked in", e.stats?.checked_in ?? 0], ["Sales", formatMoney(e.stats?.revenue ?? 0)]].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg py-2"><p className="text-xs text-gray-500">{k}</p><p className="font-bold">{v}</p></div>
                ))}
              </div>
              {e.status === "published" && (e.stats?.organizer_payout_due || 0) > 0 && (
                <p className="text-xs text-gray-600">Your earnings: <b>{formatMoney(e.stats.organizer_payout_due)}</b> {e.payout_status === "paid" ? "(paid)" : `· paid out after ${formatEventDate(e.payout_due_at)}`}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {!["canceled"].includes(e.status) && !ended && <Button size="sm" variant="outline" onClick={() => setForm({ initial: fromEvent(e), id: e.id })}>Edit</Button>}
                {e.status === "published" && !ended && <Button size="sm" onClick={() => setPromote(e)}><Megaphone className="h-4 w-4 mr-1" />Promote</Button>}
                <Button size="sm" variant="outline" onClick={() => setAttendees(e)}><Users className="h-4 w-4 mr-1" />Attendees</Button>
                {e.status === "published" && <Button size="sm" variant="outline" onClick={() => setScanners(e)}><ScanLine className="h-4 w-4 mr-1" />Door codes</Button>}
                {["published", "pending_review"].includes(e.status) && !ended && <Button size="sm" variant="outline" className="text-red-600" onClick={() => cancelEvent(e)}>Cancel event</Button>}
              </div>
            </div>
          );
        })}
      </main>
      {form && authId && <EventForm authId={authId} initial={form.initial} editing={form.id} trusted={!!data?.trusted} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {attendees && <AttendeesDialog event={attendees} onClose={() => setAttendees(null)} />}
      {scanners && <ScannersDialog event={scanners} onClose={() => setScanners(null)} />}
      {promote && <PromoteDialog event={promote} tiers={data?.promo_tiers || []} email={userData?.email || user?.email} onClose={() => setPromote(null)} />}
    </div>
  );
}
