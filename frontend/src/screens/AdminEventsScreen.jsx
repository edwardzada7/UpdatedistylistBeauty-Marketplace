import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, ImagePlus, Loader2, Plus, ScanLine, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import DateTimeField from "@/components/DateTimeField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";
import { adminEventsAPI, formatEventDate } from "@/services/eventsApi";
import { formatMoney } from "@/utils/money";

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (local) => (local ? new Date(local).toISOString() : null);
const blankType = () => ({ id: null, name: "General", description: "", price: "0", capacity: "", max_per_order: "10", sales_end: "", is_active: true });
const blankForm = () => ({
  title: "", description: "", banner_url: "", venue: "", address: "", starts_at: "", ends_at: "",
  status: "published", is_featured: false, fee_mode: "add_on", announce_in_feed: true, ticket_types: [blankType()], is_free: false,
});

const fromEvent = (e) => ({
  title: e.title || "", description: e.description || "", banner_url: e.banner_url || "", venue: e.venue || "", address: e.address || "",
  starts_at: toLocalInput(e.starts_at), ends_at: toLocalInput(e.ends_at), status: e.status === "canceled" ? "draft" : e.status,
  is_featured: !!e.is_featured, fee_mode: e.fee_mode || "add_on", announce_in_feed: false,
  is_free: !!e.is_free,
  ticket_types: e.ticket_types.map((t) => ({
    id: t.id, name: t.name, description: t.description || "", price: String(t.price), capacity: t.capacity ?? "",
    max_per_order: String(t.max_per_order), sales_end: toLocalInput(t.sales_end), is_active: t.is_active, sold: t.sold,
  })),
});

function EventForm({ adminKey, initial, editingId, onClose, onSaved }) {
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
    try {
      const res = await adminEventsAPI.upload(adminKey, { filename: file.name, content_type: file.type || "image/jpeg", data_base64: await toBase64(file) });
      set({ banner_url: res.url });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (form.title.trim().length < 2) return toast.error("Give the event a title");
    if (!form.starts_at) return toast.error("Choose a start date and time");
    if (form.status === "published" && !form.ticket_types.length) return toast.error("Add at least one ticket type");
    const body = {
      title: form.title.trim(), description: form.description.trim() || null, banner_url: form.banner_url || null,
      venue: form.venue.trim() || null, address: form.address.trim() || null,
      starts_at: toIso(form.starts_at), ends_at: toIso(form.ends_at), status: form.status,
      is_featured: form.is_featured, fee_mode: form.fee_mode, announce_in_feed: form.announce_in_feed,
      is_free: !!form.is_free,
      ticket_types: form.ticket_types.map((t) => ({
        id: t.id, name: t.name.trim() || "Ticket", description: t.description.trim() || null, price: Number(t.price) || 0,
        capacity: t.capacity === "" ? null : Number(t.capacity), max_per_order: Number(t.max_per_order) || 10,
        sales_end: toIso(t.sales_end), is_active: t.is_active,
      })),
    };
    setBusy(true);
    try {
      if (editingId) await adminEventsAPI.update(adminKey, editingId, body);
      else await adminEventsAPI.create(adminKey, body);
      toast.success(editingId ? "Event updated" : "Event created");
      onSaved();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not save the event");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>{editingId ? "Edit event" : "New event"}</DialogTitle><DialogDescription>Posted as iStylist Official.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Banner</Label>
            <div className="mt-1">
              {form.banner_url ? (
                <div className="relative h-36 rounded-lg overflow-hidden border">
                  <img src={form.banner_url} alt="" className="h-full w-full object-cover" />
                  <Button type="button" size="sm" variant="secondary" className="absolute top-2 right-2" onClick={() => set({ banner_url: "" })}>Remove</Button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-sm text-gray-500">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}{uploading ? "Uploading..." : "Add banner image"}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
            </div>
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={160} /></div>
          <div><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Starts</Label><DateTimeField value={form.starts_at} onChange={(v) => set({ starts_at: v })} /></div>
            <div><Label>Ends (optional)</Label><DateTimeField optional value={form.ends_at} onChange={(v) => set({ ends_at: v })} /></div>
            <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => set({ venue: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => set({ address: e.target.value })} /></div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" data-testid="free-event-toggle">
              <input type="checkbox" className="h-4 w-4" checked={!!form.is_free}
                onChange={(e) => setForm((f) => ({ ...f, is_free: e.target.checked, ticket_types: e.target.checked ? f.ticket_types.map((t) => ({ ...t, price: "0" })) : f.ticket_types }))} />
              This is a free event (no ticket payment)
            </label>
            <div className="flex items-center justify-between"><Label>Ticket types</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, ticket_types: [...f.ticket_types, { ...blankType(), name: "" }] }))}><Plus className="h-4 w-4 mr-1" />Add type</Button></div>
            <p className="text-xs text-gray-500">Price 0 makes it a free "I'm attending" ticket. Leave capacity empty for unlimited.</p>
            {form.ticket_types.map((t, i) => (
              <div key={t.id || `new-${i}`} className="border rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2"><Label className="text-xs">Name</Label><Input value={t.name} onChange={(e) => setType(i, { name: e.target.value })} placeholder="General, VIP..." /></div>
                  {form.is_free ? <div><Label className="text-xs">Price</Label><p className="h-10 flex items-center text-sm font-semibold text-green-700">Free</p></div> : <div><Label className="text-xs">Price (₦)</Label><Input type="number" min="0" value={t.price} onChange={(e) => setType(i, { price: e.target.value })} /></div>}
                  <div><Label className="text-xs">Capacity{t.sold ? ` (sold ${t.sold})` : ""}</Label><Input type="number" min="1" value={t.capacity} onChange={(e) => setType(i, { capacity: e.target.value })} placeholder="Unlimited" /></div>
                  <div><Label className="text-xs">Max per order</Label><Input type="number" min="1" max="50" value={t.max_per_order} onChange={(e) => setType(i, { max_per_order: e.target.value })} /></div>
                  <div><Label className="text-xs">Sales close (optional)</Label><DateTimeField optional value={t.sales_end} onChange={(v) => setType(i, { sales_end: v })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Short note (optional)</Label><Input value={t.description} onChange={(e) => setType(i, { description: e.target.value })} /></div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={t.is_active} onChange={(e) => setType(i, { is_active: e.target.checked })} /> On sale</label>
                  <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => setForm((f) => ({ ...f, ticket_types: f.ticket_types.filter((_, idx) => idx !== i) }))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Service fee</Label>
              <select className="w-full border rounded-md h-10 px-2 bg-white" value={form.fee_mode} onChange={(e) => set({ fee_mode: e.target.value })}>
                <option value="add_on">Added on top of the ticket price</option>
                <option value="absorbed">Included in the ticket price</option>
              </select></div>
            <div><Label>Status</Label>
              <select className="w-full border rounded-md h-10 px-2 bg-white" value={form.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="published">Published (visible to everyone)</option>
                <option value="draft">Draft (hidden)</option>
              </select></div>
          </div>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={(e) => set({ is_featured: e.target.checked })} /> Feature this event at the top</label>
          {form.status === "published" && !(editingId && !form.announce_in_feed && initial.status === "published") && (
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.announce_in_feed} onChange={(e) => set({ announce_in_feed: e.target.checked })} /> Also post it to the feed as iStylist Official</label>
          )}
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save event"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttendeesDialog({ adminKey, event, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { adminEventsAPI.attendees(adminKey, event.id).then(setRows).catch(() => setRows([])); }, [adminKey, event.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>Attendees · {event.title}</DialogTitle><DialogDescription>{rows ? `${rows.length} ticket(s)` : "Loading..."}</DialogDescription></DialogHeader>
        <div className="divide-y text-sm">
          {(rows || []).map((r) => (
            <div key={r.id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="font-medium truncate">{r.name}</p><p className="text-xs text-gray-500 truncate">{r.ticket_type} · PIN {r.pin}{r.email ? ` · ${r.email}` : ""}</p></div>
              <Badge className={r.status === "used" ? "bg-gray-200 text-gray-700" : r.status === "valid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>{r.status === "used" ? "Checked in" : r.status.replace("_", " ")}</Badge>
            </div>
          ))}
          {rows && !rows.length && <p className="py-6 text-center text-gray-500">No tickets yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScannersDialog({ adminKey, event, onClose }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [label, setLabel] = useState("");
  const load = useCallback(() => adminEventsAPI.scanners(adminKey, event.id).then(setRows).catch(() => setRows([])), [adminKey, event.id]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    try { await adminEventsAPI.addScanner(adminKey, event.id, label.trim() || null); setLabel(""); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Could not create a scanner code"); }
  };
  const remove = async (id) => { await adminEventsAPI.deleteScanner(adminKey, event.id, id); load(); };
  const link = `${window.location.origin}/scanner`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>Door scanners · {event.title}</DialogTitle>
          <DialogDescription>Give each door staff member a code. They open {link}, enter it, and can only scan this event.</DialogDescription></DialogHeader>
        <div className="flex gap-2"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Main gate" /><Button onClick={add}>Create code</Button></div>
        <div className="divide-y">
          {rows.map((s) => (
            <div key={s.id} className="py-2 flex items-center justify-between gap-2">
              <div><p className="font-mono text-lg tracking-widest font-bold">{s.access_code}</p><p className="text-xs text-gray-500">{s.label || "Scanner"}</p></div>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {!rows.length && <p className="py-4 text-sm text-gray-500">No scanner codes yet.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => navigate(`/scanner?event=${event.id}`)}><ScanLine className="h-4 w-4 mr-1" />Scan as admin</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsCard({ adminKey, settings, onSaved }) {
  const [pct, setPct] = useState(String(settings.service_fee_percentage ?? 0));
  const [flat, setFlat] = useState(String(settings.service_fee_flat ?? 0));
  const [commission, setCommission] = useState(String(settings.commission_percentage ?? 0));
  const [trust, setTrust] = useState(String(settings.provider_trust_after_approved ?? 3));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await adminEventsAPI.saveSettings(adminKey, { service_fee_percentage: Number(pct) || 0, service_fee_flat: Number(flat) || 0, commission_percentage: Number(commission) || 0, provider_trust_after_approved: Number(trust) || 0 });
      toast.success("Event fees saved");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div><p className="font-semibold">Ticket fees</p><p className="text-xs text-gray-500">Service fee applies to paid tickets (add-on or included, set per event). Commission is the platform cut of ticket sales on events run by providers; official events are 100% yours. Providers skip review after the number of approved events set here (0 = never review).</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div><Label className="text-xs">Trusted after (approved events)</Label><Input type="number" min="0" value={trust} onChange={(e) => setTrust(e.target.value)} /></div>
        <div><Label className="text-xs">Service fee (%)</Label><Input type="number" min="0" max="100" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} /></div>
        <div><Label className="text-xs">Flat fee per ticket (₦)</Label><Input type="number" min="0" value={flat} onChange={(e) => setFlat(e.target.value)} /></div>
        <div><Label className="text-xs">Commission on provider events (%)</Label><Input type="number" min="0" max="100" step="0.1" value={commission} onChange={(e) => setCommission(e.target.value)} /></div>
      </div>
      <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save fees"}</Button>
    </div>
  );
}

function TiersCard({ adminKey }) {
  const [tiers, setTiers] = useState(null);
  useEffect(() => { adminEventsAPI.tiers(adminKey).then((t) => setTiers(t.map((x) => ({ days: String(x.days), price: String(x.price) })))).catch(() => setTiers([])); }, [adminKey]);
  if (!tiers) return null;
  const save = async () => {
    try { await adminEventsAPI.saveTiers(adminKey, tiers.map((t) => ({ days: Number(t.days), price: Number(t.price) }))); toast.success("Promotion plans saved"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Could not save"); }
  };
  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div><p className="font-semibold">Event promotion plans</p><p className="text-xs text-gray-500">What providers pay to promote an event (tag + first in the Events section).</p></div>
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-5 gap-2 items-end">
          <div className="col-span-2"><Label className="text-xs">Days</Label><Input type="number" min="1" value={t.days} onChange={(e) => setTiers((a) => a.map((x, k) => (k === i ? { ...x, days: e.target.value } : x)))} /></div>
          <div className="col-span-2"><Label className="text-xs">Price (₦)</Label><Input type="number" min="0" value={t.price} onChange={(e) => setTiers((a) => a.map((x, k) => (k === i ? { ...x, price: e.target.value } : x)))} /></div>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setTiers((a) => a.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setTiers((a) => [...a, { days: "", price: "" }])}>Add plan</Button><Button size="sm" onClick={save}>Save plans</Button></div>
    </div>
  );
}

function PayoutsCard({ adminKey }) {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => adminEventsAPI.payouts(adminKey).then(setRows).catch(() => setRows([])), [adminKey]);
  useEffect(() => { load(); }, [load]);
  if (!rows || !rows.length) return null;
  const pay = async (r) => {
    if (!window.confirm(`Mark ${formatMoney(r.amount)} as paid to ${r.provider_name || "the provider"}? Send the transfer first.`)) return;
    try { await adminEventsAPI.markPaid(adminKey, r.event_id); toast.success("Marked as paid"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Could not update"); }
  };
  return (
    <div className="bg-white rounded-xl border p-4 space-y-3" data-testid="event-payouts">
      <div><p className="font-semibold">Provider event payouts</p><p className="text-xs text-gray-500">Money is held until 24 hours after the event ends. Pay manually, then mark as paid.</p></div>
      {rows.map((r) => (
        <div key={r.event_id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
          <div className="min-w-0"><p className="font-medium break-words">{r.title}</p><p className="text-xs text-gray-500">{r.provider_name || "Provider"}{r.provider_email ? ` · ${r.provider_email}` : ""}</p>
            <p className="text-xs text-gray-500">{r.payout_status === "paid" ? `Paid ${formatEventDate(r.paid_at)}` : r.is_due ? "Due now" : `On hold until ${formatEventDate(r.due_at)}`}</p></div>
          <div className="flex items-center gap-2"><b>{formatMoney(r.amount)}</b>
            {r.payout_status !== "paid" && <Button size="sm" disabled={!r.is_due} onClick={() => pay(r)}>Mark paid</Button>}</div>
        </div>
      ))}
    </div>
  );
}

export default function AdminEventsScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null); // { initial, id }
  const [attendees, setAttendees] = useState(null);
  const [scanners, setScanners] = useState(null);

  const load = useCallback(async (key) => {
    try { setData(await adminEventsAPI.list(key)); }
    catch (e) { toast.error(e?.response?.data?.detail || "Could not load events (has the phase 37 SQL been run?)"); setData({ events: [], settings: {} }); }
  }, []);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) { navigate("/admin", { replace: true }); return; }
    setAdminKey(key);
    load(key);
  }, [navigate, load]);

  const cancelEvent = async (e) => {
    if (!window.confirm(`Cancel "${e.title}"? Ticket holders are notified and their tickets are marked refund due.`)) return;
    try { const r = await adminEventsAPI.cancel(adminKey, e.id); toast.success(`Canceled. ${r.tickets_affected} ticket(s) marked refund due.`); load(adminKey); }
    catch (err) { toast.error(err?.response?.data?.detail || "Could not cancel"); }
  };

  const approve = async (e) => {
    try { await adminEventsAPI.approve(adminKey, e.id); toast.success("Approved and live"); load(adminKey); }
    catch (err) { toast.error(err?.response?.data?.detail || "Could not approve"); }
  };
  const reject = async (e) => {
    const reason = window.prompt("Reason shown to the provider (e.g. unclear venue, suspicious ticket price):");
    if (!reason || reason.trim().length < 3) return;
    try { await adminEventsAPI.reject(adminKey, e.id, reason.trim()); toast.success("Rejected"); load(adminKey); }
    catch (err) { toast.error(err?.response?.data?.detail || "Could not reject"); }
  };

  if (!adminKey) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => navigate("/admin")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="h-5 w-5 text-purple-600" /> Events</h1></div>
          <Button onClick={() => setForm({ initial: blankForm(), id: null })} data-testid="new-event-btn"><Plus className="h-4 w-4 mr-1" />New event</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-4">
        {data && <PayoutsCard adminKey={adminKey} />}
        {data && <TiersCard adminKey={adminKey} />}
        {data && <SettingsCard key={JSON.stringify(data.settings)} adminKey={adminKey} settings={data.settings || {}} onSaved={() => load(adminKey)} />}
        {!data && <p className="text-center text-gray-500 py-10">Loading...</p>}
        {data && !data.events.length && <p className="text-center text-gray-500 py-10">No events yet. Create the first one.</p>}
        {(data?.events || []).map((e) => (
          <div key={e.id} className="bg-white rounded-xl border p-4 space-y-3" data-testid={`admin-event-${e.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-semibold break-words">{e.title}</p><p className="text-sm text-purple-700">{formatEventDate(e.starts_at)}</p>{e.venue && <p className="text-xs text-gray-500 break-words">{e.venue}</p>}</div>
              <div className="flex gap-1 flex-wrap">{e.organizer_type === "provider" && <Badge className="bg-purple-100 text-purple-800">By {e.organizer_name}</Badge>}{e.is_promoted && <Badge className="bg-purple-100 text-purple-800">Promoted</Badge>}<Badge className={e.is_free ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>{e.is_free ? "Free" : "Paid"}</Badge><Badge className={e.status === "published" ? "bg-green-100 text-green-800" : e.status === "canceled" || e.status === "rejected" ? "bg-red-100 text-red-700" : e.status === "pending_review" ? "bg-amber-100 text-amber-800" : "bg-gray-200 text-gray-700"}>{e.status === "pending_review" ? "needs review" : e.status}</Badge></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[["Tickets", e.stats.tickets_issued], ["Checked in", e.stats.checked_in], ["Sales", formatMoney(e.stats.revenue)], ["Your earnings", formatMoney(e.stats.platform_earnings)]].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg py-2"><p className="text-xs text-gray-500">{k}</p><p className="font-bold">{v}</p></div>
              ))}
            </div>
            {e.stats.refund_due > 0 && <p className="text-sm text-amber-700">{e.stats.refund_due} ticket(s) need a refund. Pay them back manually.</p>}
            <div className="flex flex-wrap gap-2">
              {e.status === "pending_review" && <Button size="sm" onClick={() => approve(e)}>Approve</Button>}
              {e.status === "pending_review" && <Button size="sm" variant="outline" className="text-red-600" onClick={() => reject(e)}>Reject</Button>}
              {e.status !== "canceled" && e.organizer_type !== "provider" && <Button size="sm" variant="outline" onClick={() => setForm({ initial: fromEvent(e), id: e.id })}>Edit</Button>}
              <Button size="sm" variant="outline" onClick={() => setAttendees(e)}><Users className="h-4 w-4 mr-1" />Attendees</Button>
              {e.status !== "canceled" && <Button size="sm" variant="outline" onClick={() => setScanners(e)}><ScanLine className="h-4 w-4 mr-1" />Scanners</Button>}
              {e.status !== "canceled" && <Button size="sm" variant="outline" className="text-red-600" onClick={() => cancelEvent(e)}>Cancel event</Button>}
            </div>
          </div>
        ))}
      </main>
      {form && <EventForm adminKey={adminKey} initial={form.initial} editingId={form.id} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(adminKey); }} />}
      {attendees && <AttendeesDialog adminKey={adminKey} event={attendees} onClose={() => setAttendees(null)} />}
      {scanners && <ScannersDialog adminKey={adminKey} event={scanners} onClose={() => setScanners(null)} />}
    </div>
  );
}
