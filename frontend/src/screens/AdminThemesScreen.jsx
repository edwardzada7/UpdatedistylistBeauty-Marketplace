import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";
import { adminThemesAPI } from "@/services/themesApi";

function ThemeCard({ theme, adminKey, onSaved }) {
  const [form, setForm] = useState({
    start: theme.start, end: theme.end, banner_title: theme.banner_title, banner_text: theme.banner_text,
  });
  const [busy, setBusy] = useState(false);

  const save = async (patch) => {
    setBusy(true);
    try {
      const list = await adminThemesAPI.update(adminKey, theme.key, patch);
      toast.success("Saved");
      onSaved(list);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3" data-testid={`theme-${theme.key}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{theme.emoji} {theme.name}</p>
          <p className="text-xs text-gray-500">{theme.yearly ? "Repeats every year (MM-DD)" : "One-off dates (YYYY-MM-DD). Update each year."}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {theme.live_now ? <Badge className="bg-green-100 text-green-700">Live now</Badge> : <Badge variant="outline">Not live</Badge>}
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor={`en-${theme.key}`}>Enabled</Label>
            <Switch id={`en-${theme.key}`} checked={theme.enabled} disabled={busy} onCheckedChange={(v) => save({ enabled: v })} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Starts</Label>
          <Input value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} placeholder={theme.yearly ? "12-01" : "2027-03-22"} />
        </div>
        <div>
          <Label className="text-xs">Ends</Label>
          <Input value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} placeholder={theme.yearly ? "01-02" : "2027-03-29"} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Banner title</Label>
        <Input value={form.banner_title} maxLength={200} onChange={(e) => setForm({ ...form, banner_title: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Banner message</Label>
        <Input value={form.banner_text} maxLength={200} onChange={(e) => setForm({ ...form, banner_text: e.target.value })} />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Label htmlFor={`force-${theme.key}`}>Show now (ignore dates)</Label>
          <Switch id={`force-${theme.key}`} checked={theme.force_active} disabled={busy} onCheckedChange={(v) => save({ force_active: v })} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Label htmlFor={`fx-${theme.key}`}>Animations</Label>
          <Switch id={`fx-${theme.key}`} checked={theme.effects} disabled={busy} onCheckedChange={(v) => save({ effects: v })} />
        </div>
        <Button size="sm" disabled={busy} onClick={() => save(form)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminThemesScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [themes, setThemes] = useState(null);

  const load = useCallback(async (key) => {
    try {
      setThemes(await adminThemesAPI.list(key));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load themes");
      setThemes([]);
    }
  }, []);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) { navigate("/admin", { replace: true }); return; }
    setAdminKey(key);
    load(key);
  }, [navigate, load]);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="font-semibold">Seasonal themes</h1>
      </div>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <p className="text-sm text-gray-600">
          Themes switch on automatically between their dates. Users can still choose Default or another theme in Profile.
          Use "Show now" to preview a theme or run a surprise campaign. Moving feasts (Easter, Ramadan/Eid) need new dates each year.
        </p>
        {themes === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : themes.map((t) => <ThemeCard key={t.key} theme={t} adminKey={adminKey} onSaved={setThemes} />)}
      </div>
    </div>
  );
}
