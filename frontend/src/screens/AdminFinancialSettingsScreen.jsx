import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Save, Settings as SettingsIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { settingsAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const CURRENCY = "₦";

export default function AdminFinancialSettingsScreen() {
  const navigate = useNavigate();
  const [adminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [feePercentage, setFeePercentage] = useState("0");
  const [minWithdrawal, setMinWithdrawal] = useState("0");
  const [maxWithdrawal, setMaxWithdrawal] = useState(""); // empty = no max

  useEffect(() => {
    if (!adminKey) {
      navigate("/admin", { replace: true });
    }
  }, [adminKey, navigate]);

  const load = useCallback(async () => {
    if (!adminKey) return;
    try {
      setLoading(true);
      const res = await settingsAPI.adminGetFinancial(adminKey);
      const wf = res.data?.withdrawal_fee || {};
      setFeePercentage(String(wf.fee_percentage ?? 0));
      setMinWithdrawal(String(wf.min_withdrawal ?? 0));
      setMaxWithdrawal(wf.max_withdrawal == null ? "" : String(wf.max_withdrawal));
    } catch (err) {
      if (err?.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        navigate("/admin", { replace: true });
        return;
      }
      toast.error(err?.response?.data?.detail || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [adminKey, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const feePct = parseFloat(feePercentage);
    const minW = parseFloat(minWithdrawal);
    const maxW = maxWithdrawal === "" ? 0 : parseFloat(maxWithdrawal);
    // Client-side validation
    if (isNaN(feePct) || feePct < 0 || feePct > 100) {
      toast.error("Fee percentage must be between 0 and 100");
      return;
    }
    if (isNaN(minW) || minW < 0) {
      toast.error("Minimum withdrawal must be 0 or greater");
      return;
    }
    if (maxWithdrawal !== "" && (isNaN(maxW) || maxW < 0)) {
      toast.error("Maximum withdrawal must be 0 or greater (leave blank for no limit)");
      return;
    }
    if (maxWithdrawal !== "" && maxW > 0 && maxW < minW) {
      toast.error("Maximum cannot be less than minimum");
      return;
    }

    setSaving(true);
    try {
      await settingsAPI.adminUpdateFinancial(adminKey, {
        fee_percentage: feePct,
        min_withdrawal: minW,
        max_withdrawal: maxW,
        enabled: true,
      });
      toast.success("Financial settings saved");
      await load();
    } catch (err) {
      if (err?.response?.status === 503) {
        toast.error("Run phase7_withdrawal_fees.sql migration in Supabase first.");
      } else {
        toast.error(err?.response?.data?.detail || "Failed to save settings");
      }
    } finally {
      setSaving(false);
    }
  };

  // Live preview using ₦10,000 as example
  const previewGross = 10000;
  const previewPct = Number(feePercentage) || 0;
  const previewFee = Math.round(previewGross * (previewPct / 100) * 100) / 100;
  const previewNet = previewGross - previewFee;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")} data-testid="back-to-admin-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-purple-600" />
            <h1 className="text-xl font-bold">Financial Settings</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card data-testid="financial-settings-card">
              <CardHeader>
                <CardTitle className="text-base">Withdrawal Fees</CardTitle>
                <CardDescription>
                  Configure how providers are charged on payout requests.
                  Changes apply to <strong>new</strong> withdrawal requests only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label htmlFor="fee-pct">Withdrawal Fee (%)</Label>
                  <Input
                    id="fee-pct"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={feePercentage}
                    onChange={(e) => setFeePercentage(e.target.value)}
                    className="mt-2"
                    data-testid="fee-percentage-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Applied to the gross withdrawal amount. 0% disables the fee.
                  </p>
                </div>

                <div>
                  <Label htmlFor="min-w">Minimum Withdrawal Amount ({CURRENCY})</Label>
                  <Input
                    id="min-w"
                    type="number"
                    step="100"
                    min="0"
                    value={minWithdrawal}
                    onChange={(e) => setMinWithdrawal(e.target.value)}
                    className="mt-2"
                    data-testid="min-withdrawal-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Requests below this amount are rejected. Set to 0 to disable.
                  </p>
                </div>

                <div>
                  <Label htmlFor="max-w">Maximum Withdrawal Amount ({CURRENCY}) — optional</Label>
                  <Input
                    id="max-w"
                    type="number"
                    step="100"
                    min="0"
                    value={maxWithdrawal}
                    placeholder="Leave blank for no maximum"
                    onChange={(e) => setMaxWithdrawal(e.target.value)}
                    className="mt-2"
                    data-testid="max-withdrawal-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cap individual withdrawal requests. Blank or 0 means no maximum.
                  </p>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>
                    These settings affect provider payouts.
                    They do <strong>not</strong> change existing wallet balances,
                    booking flows or Flutterwave funding.
                  </p>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  data-testid="save-financial-settings-btn"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="financial-preview-card">
              <CardHeader>
                <CardTitle className="text-base">Live Preview</CardTitle>
                <CardDescription>
                  Example breakdown for a {CURRENCY}10,000 withdrawal request.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Requested Amount:</span>
                  <span className="font-semibold">{CURRENCY}{previewGross.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform Fee ({previewPct}%):</span>
                  <span className="font-semibold text-amber-700">{CURRENCY}{previewFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-900 font-medium">Amount Provider Receives:</span>
                  <span className="font-bold text-purple-700">{CURRENCY}{previewNet.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
