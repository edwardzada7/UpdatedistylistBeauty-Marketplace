import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";
import { formatNaira } from "@/screens/ShopScreen";
import { formatMoney, currencySymbol } from "@/utils/money";

function PlanRow({ plan, onSave }) {
  const [price, setPrice] = useState(String(plan.price));
  const [days, setDays] = useState(String(plan.days));
  const [discount, setDiscount] = useState(String(plan.perks?.boost_discount_pct ?? ""));
  const [freeDays, setFreeDays] = useState(String(plan.perks?.free_boost_days ?? ""));
  const isSub = plan.kind === "subscription";
  const save = (extra = {}) => {
    const body = { price: Number(price), days: Number(days), ...extra };
    if (isSub) body.perks = { ...(plan.perks || {}), boost_discount_pct: Number(discount || 0), free_boost_days: Number(freeDays || 0) };
    onSave(plan.id, body);
  };
  return (
    <div className="bg-white rounded-lg border p-3 flex flex-wrap items-end gap-3">
      <div className="min-w-[10rem] flex-1"><p className="font-medium text-sm">{plan.name}</p><p className="text-xs text-gray-500">{plan.kind}</p></div>
      <label className="text-xs">Price {currencySymbol()}<Input className="w-24 h-8" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      <label className="text-xs">Days<Input className="w-16 h-8" value={days} onChange={(e) => setDays(e.target.value)} /></label>
      {isSub && (<><label className="text-xs">Boost % off<Input className="w-16 h-8" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label><label className="text-xs">Free boost days<Input className="w-16 h-8" value={freeDays} onChange={(e) => setFreeDays(e.target.value)} /></label></>)}
      <Button size="sm" onClick={() => save()}>Save</Button>
      <Button size="sm" variant="outline" onClick={() => save({ active: !plan.active })}>{plan.active ? "Turn off" : "Turn on"}</Button>
    </div>
  );
}

export default function AdminPromotionsScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) navigate("/admin", { replace: true });
    else setAdminKey(key);
  }, [navigate]);

  const load = useCallback(async () => {
    if (!adminKey) return;
    try {
      setData((await adminAPI.promo.overview(adminKey)).data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load promotions (run the phase33 SQL first)");
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const savePlan = async (id, body) => {
    try {
      await adminAPI.promo.updatePlan(adminKey, id, body);
      toast.success("Saved");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save");
    }
  };
  const stop = async (id) => {
    if (!window.confirm("Stop this boost now? No refund is issued automatically.")) return;
    try {
      await adminAPI.promo.cancel(adminKey, id);
      toast.success("Boost stopped");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not stop it");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">Promotions &amp; Pro</h1>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {!data ? <p className="text-gray-500">Loading...</p> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[["Revenue this month", formatNaira(data.revenue_month)], ["Revenue total", formatNaira(data.revenue_total)], ["Live boosts", data.live_promotions.length], ["Active Pro", data.active_subscriptions]].map(([l, v]) => (
                <div key={l} className="bg-white rounded-lg border p-3"><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-bold">{v}</p></div>
              ))}
            </div>
            <section><h2 className="font-semibold mb-2">Prices and plans</h2><div className="space-y-2">{data.plans.map((p) => <PlanRow key={`${p.id}-${p.price}-${p.active}`} plan={p} onSave={savePlan} />)}</div></section>
            <section>
              <h2 className="font-semibold mb-2">Live boosts</h2>
              {data.live_promotions.length === 0 ? <p className="text-sm text-gray-500">None running.</p> : (
                <div className="space-y-2">
                  {data.live_promotions.map((p) => (
                    <div key={p.id} className="bg-white rounded-lg border p-3 flex items-center justify-between gap-2">
                      <div><p className="text-sm font-medium">{p.provider_name || "Provider"} · {p.target_type} #{p.target_id}</p><p className="text-xs text-gray-500">until {new Date(p.ends_at).toLocaleString()} · {p.source === "pro_credit" ? "free Pro boost" : formatNaira(p.amount)}</p></div>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => stop(p.id)}>Stop</Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="font-semibold mb-2">Recent payments</h2>
              {data.recent_payments.length === 0 ? <p className="text-sm text-gray-500">No payments yet.</p> : (
                <div className="bg-white rounded-lg border divide-y">{data.recent_payments.map((p) => <div key={p.reference} className="p-3 flex justify-between text-sm"><span>{p.purpose} · {new Date(p.created_at).toLocaleDateString()}</span><b>{formatNaira(p.amount)}</b></div>)}</div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
