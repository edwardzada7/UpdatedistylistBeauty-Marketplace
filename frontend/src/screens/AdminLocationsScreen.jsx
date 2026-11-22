import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

/** One-off tool: match the free-text locations people already saved to the Lagos area list. Preview, then apply. */
export default function AdminLocationsScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) navigate("/admin", { replace: true });
    else setAdminKey(key);
  }, [navigate]);

  const run = async (apply) => {
    if (apply && !window.confirm("Save these matches to users? Existing areas are never overwritten.")) return;
    setBusy(true);
    try {
      const res = await api.post(`/admin/locations/backfill?apply=${apply}`, {}, { headers: { "X-ADMIN-KEY": adminKey } });
      setResult(res.data);
      toast.success(apply ? "Matches saved" : "Preview ready");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed (run the phase34 SQL first)");
    } finally {
      setBusy(false);
    }
  };

  const Rows = ({ rows, tone }) => (
    <div className="bg-white rounded-lg border divide-y max-h-80 overflow-y-auto">
      {rows.length === 0 ? <p className="p-3 text-sm text-gray-500">None</p> : rows.map((r) => (
        <div key={r.user_id} className="p-2 text-sm flex justify-between gap-2"><span className="truncate">{r.name || `#${r.user_id}`} ({r.role}) · "{r.text}"</span><b className={tone}>{r.area || "no match"}</b></div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b"><div className="container mx-auto px-4 py-3 flex items-center gap-3"><Button variant="ghost" size="sm" onClick={() => navigate("/admin")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button><h1 className="text-xl font-bold">Match locations to areas</h1></div></header>
      <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <p className="text-sm text-gray-600">Looks at each person's typed location and picks the Lagos area it mentions. Preview first. People it can't match are listed so you can ask them to choose an area.</p>
        <div className="flex gap-2"><Button onClick={() => run(false)} disabled={busy}>Preview</Button><Button variant="outline" onClick={() => run(true)} disabled={busy || !result}>Apply matches</Button></div>
        {result && (<>
          <p className="text-sm"><b>{result.matched}</b> matched, <b>{result.unmatched}</b> not matched{result.applied ? " (saved)" : " (preview only)"}.</p>
          <h2 className="font-semibold">Matched</h2><Rows rows={result.matched_rows} tone="text-green-700" />
          <h2 className="font-semibold">Not matched</h2><Rows rows={result.unmatched_rows} tone="text-red-600" />
        </>)}
      </div>
    </div>
  );
}
