import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gavel, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { adminAPI, noShowAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";
import { formatMoney } from "@/utils/money";

const OPEN = ["no_show_pending", "disputed"];

const STATUS = {
  no_show_pending: { label: "Awaiting response", cls: "bg-yellow-100 text-yellow-800" },
  disputed: { label: "Disputed - needs a decision", cls: "bg-red-100 text-red-800" },
  user_no_show: { label: "Resolved: customer no-show", cls: "bg-gray-100 text-gray-800" },
  provider_no_show: { label: "Resolved: provider no-show", cls: "bg-gray-100 text-gray-800" },
};

const RESOLUTIONS = [
  { value: "favor_customer", title: "Refund the customer", desc: "The provider was the no-show. The payment goes back to the customer's wallet." },
  { value: "favor_provider", title: "Pay the provider", desc: "The customer was the no-show. The payment is released to the provider." },
  { value: "dismiss", title: "Dismiss the dispute", desc: "Neither side is penalised. The booking goes back to confirmed." },
];

export default function AdminNoShowsScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open");
  const [selected, setSelected] = useState(null);
  const [resolution, setResolution] = useState("favor_customer");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) {
      navigate("/admin", { replace: true });
      return;
    }
    setAdminKey(key);
  }, [navigate]);

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await adminAPI.reportedNoShows(adminKey, 100);
      setItems(res.data?.items || []);
    } catch (e) {
      if (e?.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        navigate("/admin", { replace: true });
        return;
      }
      toast.error(e?.response?.data?.detail || "Could not load no-show cases");
    } finally {
      setLoading(false);
    }
  }, [adminKey, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const open = items.filter((b) => OPEN.includes(b.status));
  const resolved = items.filter((b) => !OPEN.includes(b.status));
  const list = tab === "open" ? open : resolved;

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await noShowAPI.adminResolve(adminKey, { booking_id: selected.id, resolution, admin_notes: notes.trim() || null });
      toast.success("Resolved. Both parties have been notified.");
      setSelected(null);
      setNotes("");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not resolve this case");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold flex-1">No-Shows &amp; Disputes</h1>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex gap-2 mb-5">
          {[["open", `Needs action (${open.length})`], ["resolved", `Resolved (${resolved.length})`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`rounded-full px-4 py-1.5 text-sm border ${tab === key ? "bg-orange-600 text-white border-orange-600" : "bg-white"}`} data-testid={`noshow-tab-${key}`}>{label}</button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : list.length === 0 ? (
          <p className="text-center text-gray-500 py-16">{tab === "open" ? "No cases need action." : "No resolved cases yet."}</p>
        ) : (
          <div className="space-y-3">
            {list.map((b) => {
              const status = STATUS[b.status] || { label: b.status, cls: "bg-gray-100 text-gray-800" };
              const canResolve = OPEN.includes(b.status);
              return (
                <div key={b.id} className="bg-white rounded-xl border p-4" data-testid={`noshow-case-${b.id}`}>
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <p className="font-semibold">Booking #{b.id}{b.status === "disputed" && <Gavel className="inline h-4 w-4 ml-1 text-orange-600" />}</p>
                    <Badge className={status.cls}>{status.label}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {b.customer_name || "Customer"} with {b.provider_name || "Provider"}
                  </p>
                  <div className="text-sm mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                    <p><span className="text-gray-500">Appointment:</span> {[b.booking_date || b.date, b.booking_time || b.time].filter(Boolean).join(" ") || "-"}</p>
                    <p><span className="text-gray-500">Amount held:</span> {formatMoney(b.amount_held ?? b.total_amount ?? 0)}</p>
                    <p><span className="text-gray-500">Mode:</span> {b.service_mode === "home" ? "Home visit" : "At provider"}</p>
                    {b.no_show_reported_at && <p><span className="text-gray-500">Reported:</span> {new Date(b.no_show_reported_at).toLocaleString()}</p>}
                    {b.dispute_opened_at && <p><span className="text-gray-500">Disputed:</span> {new Date(b.dispute_opened_at).toLocaleString()}</p>}
                  </div>
                  {b.no_show_reporter_role && <p className="text-sm mt-2"><span className="text-gray-500">Reported by:</span> {b.no_show_reporter_role}</p>}
                  {b.no_show_reason && <p className="text-sm"><span className="text-gray-500">Reason:</span> {b.no_show_reason}</p>}
                  {b.dispute_reason && <p className="text-sm"><span className="text-gray-500">Dispute reason:</span> {b.dispute_reason}</p>}
                  {b.admin_notes && <p className="text-sm"><span className="text-gray-500">Admin notes:</span> {b.admin_notes}</p>}
                  {canResolve && (
                    <Button size="sm" className="mt-3 bg-orange-600 hover:bg-orange-700" onClick={() => { setSelected(b); setResolution("favor_customer"); setNotes(""); }} data-testid={`noshow-resolve-${b.id}`}>
                      Resolve
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve booking #{selected?.id}</DialogTitle>
            <DialogDescription>Both the customer and the provider get a notification with the outcome.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {RESOLUTIONS.map((r) => (
              <label key={r.value} className={`flex gap-3 rounded-lg border p-3 cursor-pointer ${resolution === r.value ? "border-orange-500 bg-orange-50" : ""}`}>
                <input type="radio" name="resolution" checked={resolution === r.value} onChange={() => setResolution(r.value)} className="mt-1" />
                <span><span className="font-medium block">{r.title}</span><span className="text-xs text-gray-600">{r.desc}</span></span>
              </label>
            ))}
            <Label htmlFor="resolve-notes">Admin notes (optional)</Label>
            <Textarea id="resolve-notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={submit} disabled={busy} className="bg-orange-600 hover:bg-orange-700" data-testid="noshow-confirm">{busy ? "Resolving..." : "Confirm decision"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
