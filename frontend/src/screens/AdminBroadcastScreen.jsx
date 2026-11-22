import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { adminAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const AUDIENCES = [
  { value: "all", label: "Everyone" },
  { value: "customers", label: "Customers only" },
  { value: "providers", label: "Providers only" },
];

export default function AdminBroadcastScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [sendPush, setSendPush] = useState(true);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) {
      navigate("/admin", { replace: true });
      return;
    }
    setAdminKey(key);
  }, [navigate]);

  const loadHistory = useCallback(() => {
    if (adminKey) adminAPI.broadcast.history(adminKey).then((r) => setHistory(r.data?.items || [])).catch(() => undefined);
  }, [adminKey]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!adminKey) return;
    setPreview(null);
    adminAPI.broadcast.preview(adminKey, audience).then((r) => setPreview(r.data)).catch(() => setPreview(null));
  }, [adminKey, audience]);

  const send = async () => {
    if (!title.trim() || !message.trim()) return toast.error("Add a title and a message");
    const who = AUDIENCES.find((a) => a.value === audience).label.toLowerCase();
    const count = preview ? ` (${preview.recipients} people)` : "";
    if (!window.confirm(`Send "${title.trim()}" to ${who}${count}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await adminAPI.broadcast.send(adminKey, { title: title.trim(), message: message.trim(), audience, send_push: sendPush });
      toast.success(`Sending to ${res.data.recipients} people`);
      setTitle("");
      setMessage("");
      setTimeout(loadHistory, 3000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not send the announcement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">Announcements</h1>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6 max-w-5xl">
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div>
            <Label htmlFor="bc-title">Title <span className="text-xs text-gray-400">({title.length}/65)</span></Label>
            <Input id="bc-title" maxLength={65} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New: book consultations in the app" />
          </div>
          <div>
            <Label htmlFor="bc-message">Message <span className="text-xs text-gray-400">({message.length}/240)</span></Label>
            <Textarea id="bc-message" rows={4} maxLength={240} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div>
            <Label>Send to</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {AUDIENCES.map((a) => (
                <button key={a.value} onClick={() => setAudience(a.value)} className={`rounded-full px-3 py-1 text-sm border ${audience === a.value ? "bg-teal-600 text-white border-teal-600" : "bg-white"}`}>{a.label}</button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">{preview ? `${preview.recipients} people, ${preview.devices} phones with notifications on` : "Counting..."}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendPush} onChange={(e) => setSendPush(e.target.checked)} />
            Also send as a phone push notification (otherwise in-app only)
          </label>
          <Button onClick={send} disabled={busy} className="bg-teal-600 hover:bg-teal-700" data-testid="broadcast-send">{busy ? "Sending..." : "Send announcement"}</Button>
          <p className="text-xs text-gray-500">Everyone gets it in their in-app notifications. Use sparingly: too many pushes make people turn notifications off.</p>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Recent announcements</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing sent yet (or run the phase32 SQL to keep a history).</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="bg-white rounded-lg border p-3">
                  <p className="font-medium text-sm">{h.title}</p>
                  <p className="text-xs text-gray-600">{h.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(h.created_at).toLocaleString()} · {h.audience} · {h.in_app_sent}/{h.recipients} in-app · {h.push_sent} push · {h.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
