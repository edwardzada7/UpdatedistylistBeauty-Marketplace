import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";
import { formatMoney } from "@/utils/money";

const STREAM_LABELS = {
  booking_commission: "Booking commission",
  shop_commission: "Shop commission",
  withdrawal_fees: "Withdrawal fees",
  promotions: "Promotions (boosts)",
  subscriptions: "Pro subscriptions",
};
const PURPOSE_LABELS = {
  wallet_topup: "Wallet top-ups",
  promotions_and_pro: "Promotions and Pro",
  shop: "Shop orders",
  booking_escrow: "Bookings",
};
const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All time" },
];

/** What the platform really earned, per stream, separate from customer and provider money it only holds. */
export default function AdminEarningsScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!key) navigate("/admin", { replace: true });
    else setAdminKey(key);
  }, [navigate]);

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await api.get("/admin/earnings", { params: { days }, headers: { "X-ADMIN-KEY": adminKey } });
      setData(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load earnings");
    } finally {
      setLoading(false);
    }
  }, [adminKey, days]);

  useEffect(() => {
    load();
  }, [load]);

  const periodKey = days === 0 ? "all_time" : "period";

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-lg font-bold truncate">Earnings ledger</h1>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {RANGES.map((r) => (
            <button key={r.days} type="button" onClick={() => setDays(r.days)} className={`px-3 py-1 rounded-full border text-sm ${days === r.days ? "bg-purple-600 text-white border-purple-600" : "bg-white"}`}>{r.label}</button>
          ))}
        </div>

        {data?.notes?.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-1" data-testid="earnings-notes">
            {data.notes.map((n) => (
              <p key={n} className="flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {n}</p>
            ))}
          </div>
        )}

        {data && (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Your revenue</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-700" data-testid="revenue-total">{formatMoney(data.revenue[periodKey])}</p>
                <p className="text-xs text-gray-500 mb-3">Money that belongs to the platform. All time: {formatMoney(data.revenue.all_time)}</p>
                <div className="divide-y">
                  {Object.entries(data.streams).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-2 text-sm">
                      <span>{STREAM_LABELS[k] || k}</span>
                      <b>{formatMoney(v[periodKey])}</b>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Money you hold for others</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><span>Wallet balances</span><b>{formatMoney(data.held_for_others.wallet_balances)}</b></div>
                <div className="flex justify-between"><span>In escrow (bookings in progress)</span><b>{formatMoney(data.held_for_others.escrow)}</b></div>
                <div className="flex justify-between"><span>Withdrawals waiting for approval</span><b>{formatMoney(data.held_for_others.pending_withdrawals)}</b></div>
                <p className="text-xs text-gray-500">{data.held_for_others.note} Do not withdraw this as profit.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Money in, by gateway</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {data.gateways.length === 0 ? (
                  <p className="text-gray-500">No successful payments yet.</p>
                ) : (
                  <div className="divide-y">
                    {data.gateways.map((g) => (
                      <div key={`${g.gateway}-${g.purpose}`} className="flex justify-between py-2 gap-2">
                        <span className="capitalize">{g.gateway} · {PURPOSE_LABELS[g.purpose] || g.purpose} <span className="text-gray-400">({g.count})</span></span>
                        <b>{formatMoney(days === 0 ? g.amount : g.amount_period)}</b>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">Flutterwave should only show wallet top-ups. Everything else goes through Paystack.</p>
                <div className="flex justify-between mt-3 pt-3 border-t"><span>Paid out to providers (net of fees)</span><b>{formatMoney(data.paid_out_to_providers)}</b></div>
                <div className="flex justify-between"><span>Shop sales total</span><b>{formatMoney(data.shop_sales_total)}</b></div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
