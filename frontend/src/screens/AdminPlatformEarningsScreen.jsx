import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, LogOut, RefreshCcw, TrendingUp, Wallet, DollarSign, Clock, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { earningsAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const CURRENCY = "₦";

/**
 * AdminPlatformEarningsScreen - Phase 9 Platform Revenue Dashboard
 * 
 * Shows platform earnings metrics:
 * - Total revenue
 * - Today & this month revenue
 * - Booking fees vs withdrawal fees
 * - Pending vs completed payouts
 */
export default function AdminPlatformEarningsScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState(null);

  // Pull admin key on mount
  useEffect(() => {
    const k = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!k) {
      navigate("/admin", { replace: true });
      return;
    }
    setAdminKey(k);
  }, [navigate]);

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    toast.error("Session expired — please log in again");
    navigate("/admin", { replace: true });
  }, [navigate]);

  const loadEarnings = useCallback(
    async (key) => {
      if (!key) return;
      try {
        setRefreshing(true);
        const resp = await earningsAPI.adminGet(key);
        setEarnings(resp.data || null);
      } catch (e) {
        if (e?.response?.status === 401) {
          handleUnauthorized();
        } else {
          toast.error(e?.response?.data?.detail || "Failed to load earnings");
        }
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [handleUnauthorized]
  );

  useEffect(() => {
    if (adminKey) {
      loadEarnings(adminKey);
    }
  }, [adminKey, loadEarnings]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    toast.success("Logged out");
    navigate("/admin", { replace: true });
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    loadEarnings(adminKey);
  }, [adminKey, loadEarnings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-purple-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Platform Earnings</h1>
                <p className="text-xs text-gray-500">Revenue & Payouts Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCcw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}>
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Revenue Overview */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Revenue */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-gray-900">
                    {CURRENCY}{earnings?.total_revenue?.toLocaleString() || "0"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">All-time platform earnings</p>
              </CardContent>
            </Card>

            {/* Today's Revenue */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500">Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-green-600">
                    {CURRENCY}{earnings?.revenue_today?.toLocaleString() || "0"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Revenue earned today</p>
              </CardContent>
            </Card>

            {/* This Month */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500">This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-blue-600">
                    {CURRENCY}{earnings?.revenue_this_month?.toLocaleString() || "0"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Revenue this month</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Revenue Sources */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Booking Fees */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">Booking Fees</CardTitle>
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold text-gray-900">
                    {CURRENCY}{earnings?.booking_fees_earned?.toLocaleString() || "0"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Platform fee from bookings</p>
                {earnings?.booking_fees_earned === 0 && (
                  <p className="text-xs text-orange-600 mt-2">No booking fees configured yet</p>
                )}
              </CardContent>
            </Card>

            {/* Withdrawal Fees */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">Withdrawal Fees</CardTitle>
                  <Wallet className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold text-gray-900">
                    {CURRENCY}{earnings?.withdrawal_fees_earned?.toLocaleString() || "0"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Fees from provider withdrawals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">Shop Earnings</CardTitle>
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold text-gray-900">
                    {CURRENCY}{earnings?.shop_platform_earnings?.toLocaleString() || "0"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Recorded platform commission from shop orders</p>
                <p className="text-xs text-gray-600 mt-2">Shop order volume: {CURRENCY}{earnings?.shop_order_revenue?.toLocaleString() || "0"}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Payouts */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Provider Payouts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pending Payouts */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">Pending Payouts</CardTitle>
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold text-orange-600">
                    {CURRENCY}{earnings?.pending_payouts?.toLocaleString() || "0"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Awaiting admin approval</p>
              </CardContent>
            </Card>

            {/* Completed Payouts */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">Completed Payouts</CardTitle>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold text-gray-900">
                    {CURRENCY}{earnings?.completed_payouts?.toLocaleString() || "0"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Successfully paid out</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex justify-center space-x-4">
          <Button variant="outline" onClick={() => navigate("/admin/withdrawals")}>
            View Withdrawals
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/settings")}>
            Financial Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
