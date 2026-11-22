import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { promoAPI } from "@/services/api";
import { formatNaira } from "@/screens/ShopScreen";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";

const TYPE_LABEL = { profile: "Profile", service: "Service", product: "Product", post: "Post" };
const err = (e, f) => e?.response?.data?.detail || e?.message || f;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

export default function ProviderPromoteScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState({ boosts: [], subscriptions: [] });
  const [me, setMe] = useState({ subscription: null, free_boost_available: false, promotions: [] });
  const [targets, setTargets] = useState(null);
  const [type, setType] = useState("profile");
  const [targetId, setTargetId] = useState("");
  const [planId, setPlanId] = useState(null);
  const [useCredit, setUseCredit] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, m, t] = await Promise.allSettled([promoAPI.plans(), promoAPI.me(), promoAPI.targets()]);
    if (p.status === "fulfilled") {
      setPlans(p.value.data);
      setPlanId((cur) => cur || p.value.data.boosts?.[1]?.id || p.value.data.boosts?.[0]?.id || null);
    } else toast.error("Could not load plans. Run the phase33 SQL if this is new.");
    if (m.status === "fulfilled") setMe(m.value.data);
    else toast.error(err(m.reason, "Could not load your plan"));
    if (t.status === "fulfilled") setTargets(t.value.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const options = useMemo(() => {
    if (!targets) return [];
    if (type === "profile") return [{ id: targets.profile.id, name: targets.profile.name || "My profile" }];
    return targets[`${type}s`] || [];
  }, [targets, type]);

  useEffect(() => {
    setTargetId(options[0]?.id || "");
  }, [options]);

  const plan = plans.boosts.find((b) => b.id === planId);
  const perks = me.subscription?.perks || {};
  const discount = Number(perks.boost_discount_pct || 0);
  const price = plan ? Math.round(Number(plan.price) * (1 - discount / 100) * 100) / 100 : 0;
  const creditOk = me.free_boost_available && plan && plan.days <= Number(perks.free_boost_days || 0);

  const pay = async (payload) => {
    setBusy(true);
    try {
      const res = await promoAPI.checkout({ ...payload, redirect_url: `${window.location.origin}/provider/promote/complete` });
      if (res.data.free) {
        toast.success("Your free boost is live");
        setUseCredit(false);
        await load();
      } else {
        window.location.href = res.data.authorization_url;
        return;
      }
    } catch (e) {
      toast.error(err(e, "Could not start the payment"));
    }
    setBusy(false);
  };

  const boost = () => {
    if (!plan || !targetId) return toast.error("Choose what to boost and for how long");
    pay({ purpose: "boost", plan_id: plan.id, target_type: type, target_id: targetId, use_credit: !!(useCredit && creditOk) });
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading..." />;
  const live = me.promotions.filter((p) => p.live);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/provider/dashboard")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-lg font-bold">Promote &amp; Plan</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* Pro plan */}
        <section className="bg-white rounded-xl border p-4" data-testid="pro-card">
          <div className="flex items-center gap-2 mb-1"><Crown className="h-5 w-5 text-amber-500" /><h2 className="font-semibold">iStylist Pro</h2>{me.subscription && <Badge className="bg-green-100 text-green-800">Active</Badge>}</div>
          {me.subscription ? (
            <p className="text-sm text-gray-600">Your plan runs until <b>{fmtDate(me.subscription.ends_at)}</b>. {discount > 0 && `You get ${discount}% off every boost`}{perks.free_boost_days ? ` and one free ${perks.free_boost_days}-day boost each period (${me.free_boost_available ? "available" : "used"}).` : "."}</p>
          ) : (
            <p className="text-sm text-gray-600">{plans.subscriptions[0] ? `${discount ? "" : ""}Get ${Number(plans.subscriptions[0].perks?.boost_discount_pct || 0)}% off boosts and one free ${plans.subscriptions[0].perks?.free_boost_days || 7}-day boost every period.` : "Pro is not available right now."}</p>
          )}
          {plans.subscriptions.map((s) => (
            <Button key={s.id} className="mt-3" variant={me.subscription ? "outline" : "default"} disabled={busy} onClick={() => pay({ purpose: "subscription", plan_id: s.id })} data-testid="pro-buy">
              {me.subscription ? "Extend" : "Subscribe"} · {formatNaira(s.price)} / {s.days} days
            </Button>
          ))}
        </section>

        {/* Boost */}
        <section className="bg-white rounded-xl border p-4" data-testid="boost-card">
          <div className="flex items-center gap-2 mb-1"><Megaphone className="h-5 w-5 text-purple-600" /><h2 className="font-semibold">Boost something</h2></div>
          <p className="text-xs text-gray-500 mb-3">Boosted items appear in labelled "Sponsored" spots on Home and in the Shop, with people near you seen first.</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <button key={k} onClick={() => setType(k)} className={`rounded-full px-3 py-1 text-sm border ${type === k ? "bg-purple-600 text-white border-purple-600" : "bg-white"}`}>{l}</button>
            ))}
          </div>
          {options.length === 0 ? (
            <p className="text-sm text-gray-500 mb-3">You have no {TYPE_LABEL[type].toLowerCase()}s to boost yet.</p>
          ) : (
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-3" data-testid="boost-target">
              {options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.approved === false ? " (awaiting approval)" : ""}</option>)}
            </select>
          )}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {plans.boosts.map((b) => (
              <button key={b.id} onClick={() => setPlanId(b.id)} className={`rounded-lg border p-2 text-center ${planId === b.id ? "border-purple-600 bg-purple-50" : ""}`}>
                <p className="text-sm font-semibold">{b.days} days</p>
                <p className="text-xs text-gray-600">{formatNaira(Math.round(Number(b.price) * (1 - discount / 100)))}</p>
                {discount > 0 && <p className="text-[10px] text-green-700">Pro price</p>}
              </button>
            ))}
          </div>
          {creditOk && (
            <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} /> Use my free Pro boost</label>
          )}
          <Button className="w-full" disabled={busy || !targetId || !plan} onClick={boost} data-testid="boost-pay">
            {busy ? "Please wait..." : useCredit && creditOk ? "Start free boost" : `Pay ${formatNaira(price)} and boost`}
          </Button>
        </section>

        {/* Running + history */}
        <section>
          <h2 className="font-semibold mb-2">Your boosts</h2>
          {me.promotions.length === 0 ? (
            <p className="text-sm text-gray-500">No boosts yet.</p>
          ) : (
            <div className="space-y-2">
              {me.promotions.map((p) => (
                <div key={p.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
                  <div><p className="text-sm font-medium">{TYPE_LABEL[p.target_type]} #{p.target_id}</p><p className="text-xs text-gray-500">{fmtDate(p.starts_at)} to {fmtDate(p.ends_at)}{p.source === "pro_credit" ? " · free Pro boost" : ""}</p></div>
                  <Badge className={p.live ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>{p.status === "cancelled" ? "Stopped" : p.live ? "Live" : new Date(p.ends_at) < new Date() ? "Ended" : "Scheduled"}</Badge>
                </div>
              ))}
            </div>
          )}
          {live.length > 0 && <p className="text-xs text-gray-500 mt-2">{live.length} boost(s) running now.</p>}
        </section>
      </main>
      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
}
