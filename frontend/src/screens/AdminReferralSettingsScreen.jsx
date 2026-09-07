import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, RefreshCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { referralAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const PROGRAMS = [
  {
    type: "provider_shop",
    name: "Provider Shop Referral",
    recipient: "provider",
    description: "Reward paid to eligible providers when customers purchase eligible products through their Add to My Shop listings.",
  },
  {
    type: "provider_service",
    name: "Provider Service Referral",
    recipient: "provider",
    description: "Reward paid to eligible providers when a qualifying booking is generated through the provider referral system.",
  },
  {
    type: "user_referral",
    name: "User Referral",
    recipient: "user",
    description: "Prepared for future qualifying user referrals. Qualification logic is not configured here.",
  },
];

const emptySetting = (program) => ({
  referral_type: program.type,
  recipient_type: program.recipient,
  reward_type: "percentage",
  reward_value: 0,
  currency: "NGN",
  pending_days: 0,
  is_active: false,
});

export default function AdminReferralSettingsScreen() {
  const navigate = useNavigate();
  const [adminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || "");
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    if (!adminKey) return;
    try {
      setLoading(true);
      const response = await referralAPI.settings(adminKey);
      const next = {};
      PROGRAMS.forEach((program, index) => {
        next[program.type] = response.data?.settings?.[index] || emptySetting(program);
      });
      setSettings(next);
    } catch (error) {
      if (error?.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        navigate("/admin", { replace: true });
        return;
      }
      toast.error(error?.response?.data?.detail || "Failed to load referral settings");
    } finally {
      setLoading(false);
    }
  }, [adminKey, navigate]);

  useEffect(() => {
    if (!adminKey) navigate("/admin", { replace: true });
    else load();
  }, [adminKey, load, navigate]);

  const update = (type, key, value) => {
    setSettings((current) => ({ ...current, [type]: { ...current[type], [key]: value } }));
  };

  const save = async (program) => {
    const setting = settings[program.type];
    const reward = Number(setting.reward_value);
    const pendingDays = Number(setting.pending_days);
    if (!Number.isFinite(reward) || (setting.reward_type === "percentage" ? reward < 0 || reward > 100 : reward < 0)) {
      toast.error(setting.reward_type === "percentage" ? "Percentage reward must be between 0 and 100" : "Fixed reward must be 0 or greater");
      return;
    }
    if (!Number.isInteger(pendingDays) || pendingDays < 0) {
      toast.error("Pending days must be a whole number of 0 or greater");
      return;
    }
    try {
      setSaving(program.type);
      await referralAPI.updateSetting(adminKey, program.type, {
        ...setting,
        reward_value: reward,
        pending_days: pendingDays,
      });
      toast.success(`${program.name} saved`);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to save referral setting");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
            <Shield className="h-5 w-5 text-amber-600" />
            <div><h1 className="text-xl font-bold">Platform Referrals</h1><p className="text-sm text-gray-500">Referral Settings</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/referrals/earnings")}>Referral Earnings</Button>
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCcw className="h-4 w-4 mr-2" />Refresh</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6"><h2 className="text-2xl font-semibold">Referral Settings</h2><p className="text-sm text-gray-600 mt-1">These rewards are paid by iStylist to recipients and are separate from platform commissions.</p></div>
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div> : (
          <div className="space-y-5">
            {PROGRAMS.map((program) => {
              const setting = settings[program.type] || emptySetting(program);
              return <Card key={program.type}>
                <CardHeader>
                  <div className="flex flex-wrap justify-between gap-3"><div><CardTitle>{program.name}</CardTitle><CardDescription className="mt-1 max-w-3xl">{program.description}</CardDescription></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${setting.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{setting.is_active ? "Enabled" : "Disabled"}</span></div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div><Label>Recipient</Label><p className="mt-2 text-sm capitalize">{program.recipient}</p></div>
                  <div><Label htmlFor={`${program.type}-reward-type`}>Reward Type</Label><Select value={setting.reward_type} onValueChange={(value) => update(program.type, "reward_type", value)}><SelectTrigger id={`${program.type}-reward-type`} className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed">Fixed</SelectItem></SelectContent></Select></div>
                  <div><Label htmlFor={`${program.type}-reward-value`}>Reward Value{setting.reward_type === "percentage" ? " (%)" : ` (${setting.currency || "NGN"})`}</Label><Input id={`${program.type}-reward-value`} type="number" min="0" max={setting.reward_type === "percentage" ? "100" : undefined} step="0.01" value={setting.reward_value} onChange={(event) => update(program.type, "reward_value", event.target.value)} className="mt-2" /></div>
                  <div><Label htmlFor={`${program.type}-pending-days`}>Pending Days</Label><Input id={`${program.type}-pending-days`} type="number" min="0" step="1" value={setting.pending_days} onChange={(event) => update(program.type, "pending_days", event.target.value)} className="mt-2" /></div>
                  <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(setting.is_active)} onChange={(event) => update(program.type, "is_active", event.target.checked)} />Enabled</label><Button onClick={() => save(program)} disabled={saving === program.type}><Save className="h-4 w-4 mr-2" />{saving === program.type ? "Saving" : "Save"}</Button></div>
                  <div className="md:col-span-5 text-xs text-gray-500">Last Updated: {setting.updated_at ? new Date(setting.updated_at).toLocaleString() : "Never"}</div>
                </CardContent>
              </Card>;
            })}
          </div>
        )}
      </main>
    </div>
  );
}
