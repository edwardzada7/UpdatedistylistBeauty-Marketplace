import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Loader2, RefreshCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { referralAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const money = (value, currency = "NGN") => `${currency === "NGN" ? "₦" : currency} ${Number(value || 0).toLocaleString()}`;
const date = (value) => value ? new Date(value).toLocaleDateString() : "-";
const referralName = (value) => ({ provider_shop: "Provider Shop Referral", provider_service: "Provider Service Referral", user_referral: "User Referral" }[value] || value || "-");

export default function AdminReferralEarningsScreen() {
  const navigate = useNavigate();
  const [adminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || "");
  const [earnings, setEarnings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ referral_type: "", recipient_type: "", status_filter: "", start_date: "", end_date: "", recipient: "", order_booking_id: "" });

  const load = useCallback(async () => {
    if (!adminKey) return;
    try {
      setLoading(true);
      const response = await referralAPI.earnings(adminKey, filters);
      setEarnings(response.data?.earnings || []);
      setSelected(null);
    } catch (error) {
      if (error?.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        navigate("/admin", { replace: true });
        return;
      }
      toast.error(error?.response?.data?.detail || "Failed to load referral earnings");
    } finally {
      setLoading(false);
    }
  }, [adminKey, filters, navigate]);

  useEffect(() => {
    if (!adminKey) navigate("/admin", { replace: true });
    else load();
  }, [adminKey, load, navigate]);

  const showDetail = async (earning) => {
    try {
      const response = await referralAPI.earning(adminKey, earning.id);
      setSelected(response.data?.earning || earning);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to load earning detail");
    }
  };

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return <div className="min-h-screen bg-gray-50">
    <header className="bg-white border-b"><div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}><ArrowLeft className="h-4 w-4" /></Button><Shield className="h-5 w-5 text-amber-600" /><div><h1 className="text-xl font-bold">Platform Referrals</h1><p className="text-sm text-gray-500">Referral Earnings</p></div></div><div className="flex gap-2"><Button variant="outline" onClick={() => navigate("/admin/referrals/settings")}>Referral Settings</Button><Button variant="outline" onClick={load} disabled={loading}><RefreshCcw className="h-4 w-4 mr-2" />Refresh</Button></div></div></header>
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-5"><h2 className="text-2xl font-semibold">Referral Earnings</h2><p className="text-sm text-gray-600 mt-1">Liabilities owed by iStylist to referral recipients. These do not contribute to Platform Earnings.</p></div>
      <Card className="mb-5"><CardContent className="pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select aria-label="Referral type" value={filters.referral_type} onChange={(event) => setFilter("referral_type", event.target.value)} className="h-10 rounded-md border px-3 text-sm"><option value="">All referral types</option><option value="provider_shop">Provider Shop Referral</option><option value="provider_service">Provider Service Referral</option><option value="user_referral">User Referral</option></select>
        <select aria-label="Recipient type" value={filters.recipient_type} onChange={(event) => setFilter("recipient_type", event.target.value)} className="h-10 rounded-md border px-3 text-sm"><option value="">All recipients</option><option value="provider">Provider</option><option value="user">User</option></select>
        <select aria-label="Status" value={filters.status_filter} onChange={(event) => setFilter("status_filter", event.target.value)} className="h-10 rounded-md border px-3 text-sm"><option value="">All statuses</option>{["pending", "available", "paid", "cancelled", "reversed"].map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <Input placeholder="Recipient auth ID" value={filters.recipient} onChange={(event) => setFilter("recipient", event.target.value)} />
        <Input type="date" aria-label="Start date" value={filters.start_date} onChange={(event) => setFilter("start_date", event.target.value)} />
        <Input type="date" aria-label="End date" value={filters.end_date} onChange={(event) => setFilter("end_date", event.target.value)} />
        <Input placeholder="Order or booking ID" value={filters.order_booking_id} onChange={(event) => setFilter("order_booking_id", event.target.value)} />
        <Button variant="secondary" onClick={load}>Apply Filters</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Earning Records</CardTitle></CardHeader><CardContent>{loading ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Recipient</TableHead><TableHead>Recipient Type</TableHead><TableHead>Referral Type</TableHead><TableHead>Order/Booking</TableHead><TableHead>Product/Service</TableHead><TableHead>Sale Amount</TableHead><TableHead>Reward Rate/Value</TableHead><TableHead>Earning Amount</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Available</TableHead><TableHead>Paid</TableHead><TableHead /></TableRow></TableHeader><TableBody>{earnings.length === 0 ? <TableRow><TableCell colSpan={13} className="text-center py-8 text-gray-500">No referral earnings found.</TableCell></TableRow> : earnings.map((earning) => <TableRow key={earning.id}><TableCell className="font-mono text-xs">{earning.recipient_auth_id || "-"}</TableCell><TableCell className="capitalize">{earning.recipient_type || "-"}</TableCell><TableCell>{referralName(earning.referral_type)}</TableCell><TableCell>{earning.order_id ? `Order #${earning.order_id}` : earning.booking_id ? `Booking #${earning.booking_id}` : "-"}</TableCell><TableCell>{earning.product_id || earning.listing_id || "-"}</TableCell><TableCell>{money(earning.sale_amount, earning.currency)}</TableCell><TableCell>{earning.reward_type === "percentage" ? `${earning.reward_value}%` : money(earning.reward_value, earning.currency)}</TableCell><TableCell className="font-medium">{money(earning.earning_amount, earning.currency)}</TableCell><TableCell className="capitalize">{earning.status || "-"}</TableCell><TableCell>{date(earning.created_at)}</TableCell><TableCell>{date(earning.available_at)}</TableCell><TableCell>{date(earning.settled_at)}</TableCell><TableCell><Button variant="ghost" size="sm" aria-label="View earning detail" onClick={() => showDetail(earning)}><Eye className="h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
      {selected && <Card className="mt-5"><CardHeader><CardTitle className="text-base">Referral Earning Detail #{selected.id}</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm"><div><strong>Recipient:</strong> {selected.recipient_auth_id || "-"}</div><div><strong>Recipient Type:</strong> {selected.recipient_type || "-"}</div><div><strong>Referral Type:</strong> {referralName(selected.referral_type)}</div><div><strong>Provider:</strong> {selected.provider_auth_id || "Attribution unavailable"}</div><div><strong>Product:</strong> {selected.product_id || "-"}</div><div><strong>Listing:</strong> {selected.listing_id || "-"}</div><div><strong>Customer:</strong> {selected.customer_auth_id || "-"}</div><div><strong>Customer Order:</strong> {selected.order_id || "-"}</div><div><strong>Order Item:</strong> {selected.order_item_id || "-"}</div><div><strong>Sale Amount:</strong> {money(selected.sale_amount, selected.currency)}</div><div><strong>Referral Reward:</strong> {money(selected.earning_amount, selected.currency)}</div><div><strong>Reward Rate:</strong> {selected.reward_type === "percentage" ? `${selected.reward_value}%` : money(selected.reward_value, selected.currency)}</div><div><strong>Status:</strong> <span className="capitalize">{selected.status || "-"}</span></div><div><strong>Available Date:</strong> {date(selected.available_at)}</div><div><strong>Paid Date:</strong> {date(selected.settled_at)}</div><div><strong>Settlement Reference:</strong> {selected.settlement_reference || "-"}</div></div>{selected.referral_type === "provider_shop" && <div className="mt-5 rounded-md bg-amber-50 p-4 text-sm"><strong>Provider Shop Referral attribution:</strong> provider, product, listing, customer, order, order item, sale amount, referral reward, rate, and status are shown above. Provider ownership is resolved from the listing attribution chain.</div>}</CardContent></Card>}
    </main>
  </div>;
}
