import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  LogOut,
  RefreshCcw,
  Users,
  Calendar,
  Banknote,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Loader2,
  Star,
  Search,
  ChevronRight,
  Gavel,
} from "lucide-react";
import { toast } from "sonner";
import { adminAPI, noShowAPI } from "@/services/api";
import { timeAgoShort } from "@/utils/timeAgo";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const CURRENCY = "₦";

/**
 * AdminDashboardScreen - Phase 4 Admin Foundation
 *
 * Lightweight operational admin. Reuses the existing X-ADMIN-KEY session auth
 * (set by AdminLoginScreen).
 */
export default function AdminDashboardScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentNoShows, setRecentNoShows] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [providers, setProviders] = useState([]);
  const [providerSearch, setProviderSearch] = useState("");
  // Phase 6 - soft-deleted users
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  
  // Phase 10 - No-show dispute resolution
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [resolution, setResolution] = useState("favor_customer");
  const [adminNotes, setAdminNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  // Pull admin key on mount; bounce to /admin if missing.
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

  const loadAll = useCallback(
    async (key) => {
      if (!key) return;
      try {
        setRefreshing(true);
        const [s, b, p, ns, prov] = await Promise.all([
          adminAPI.stats(key),
          adminAPI.recentBookings(key, 10),
          adminAPI.recentPayments(key, 10).catch((e) => ({ data: { payments: [] } })),
          adminAPI.reportedNoShows(key, 10).catch((e) => ({ data: { items: [] } })),
          adminAPI.providers(key, 25, 0, ""),
        ]);
        setStats(s.data || null);
        setRecentBookings(b.data?.bookings || []);
        setRecentPayments(p.data?.payments || []);
        setRecentNoShows(ns.data?.items || []);
        setProviders(prov.data?.providers || []);
      } catch (e) {
        if (e?.response?.status === 401) {
          handleUnauthorized();
          return;
        }
        toast.error(e?.response?.data?.detail || "Failed to load admin data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [handleUnauthorized]
  );

  useEffect(() => {
    if (adminKey) loadAll(adminKey);
  }, [adminKey, loadAll]);

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    toast.success("Logged out");
    navigate("/admin", { replace: true });
  };

  const handleProviderSearch = async () => {
    if (!adminKey) return;
    try {
      const res = await adminAPI.providers(adminKey, 25, 0, providerSearch.trim());
      setProviders(res.data?.providers || []);
    } catch (e) {
      if (e?.response?.status === 401) handleUnauthorized();
      else toast.error("Search failed");
    }
  };

  // Phase 10 - Dispute Resolution Handler
  const handleResolveDispute = useCallback(async () => {
    if (!selectedDispute || !adminKey) return;
    
    try {
      setResolving(true);
      await noShowAPI.adminResolve(adminKey, {
        booking_id: selectedDispute.id,
        resolution,
        admin_notes: adminNotes || undefined,
      });
      
      toast.success("Dispute resolved successfully");
      setDisputeDialogOpen(false);
      setSelectedDispute(null);
      setResolution("favor_customer");
      setAdminNotes("");
      
      // Refresh dashboard
      loadAll(adminKey);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to resolve dispute");
    } finally {
      setResolving(false);
    }
  }, [selectedDispute, adminKey, resolution, adminNotes, loadAll]);

  // Phase 6 - load deleted users on demand
  const loadDeletedUsers = useCallback(async () => {
    if (!adminKey) return;
    setLoadingDeleted(true);
    try {
      const res = await adminAPI.deletedUsers(adminKey, 100, 0);
      setDeletedUsers(res.data?.users || []);
    } catch (e) {
      if (e?.response?.status === 401) handleUnauthorized();
      else if (e?.response?.status === 503) {
        toast.error("Run phase6_account_deletion.sql migration in Supabase first.");
      } else {
        toast.error(e?.response?.data?.detail || "Failed to load deleted users");
      }
    } finally {
      setLoadingDeleted(false);
    }
  }, [adminKey, handleUnauthorized]);

  const fmtMoney = (n) => {
    if (n === null || n === undefined) return `${CURRENCY}0`;
    return `${CURRENCY}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  const statusBadge = (s) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      canceled: "bg-gray-200 text-gray-700",
      declined: "bg-red-100 text-red-700",
      pending_payment: "bg-orange-100 text-orange-700",
      no_show_pending: "bg-amber-100 text-amber-800",
      user_no_show: "bg-red-100 text-red-700",
      provider_no_show: "bg-red-100 text-red-700",
      disputed: "bg-purple-100 text-purple-800",
    };
    return (
      <Badge className={`${colors[s] || "bg-gray-100 text-gray-700"} font-normal`}>
        {s || "-"}
      </Badge>
    );
  };

  const filteredProviders = useMemo(() => providers, [providers]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto" />
          <p className="mt-3 text-gray-500">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Operational overview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAll(adminKey)}
              disabled={refreshing}
              data-testid="admin-refresh-btn"
            >
              <RefreshCcw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/withdrawals")}
              data-testid="goto-withdrawals-btn"
            >
              <Banknote className="h-4 w-4 mr-1" />
              Withdrawals
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="admin-logout-btn"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={<Users className="h-5 w-5 text-blue-600" />}
            label="Users"
            value={stats?.users?.total ?? 0}
            sub={`${stats?.users?.providers ?? 0} providers`}
          />
          <StatCard
            icon={<Calendar className="h-5 w-5 text-indigo-600" />}
            label="Bookings"
            value={stats?.bookings?.total ?? 0}
            sub={`${stats?.bookings?.completed ?? 0} completed`}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            label="Pending"
            value={stats?.bookings?.pending ?? 0}
            sub={`${stats?.bookings?.confirmed ?? 0} confirmed`}
          />
          <StatCard
            icon={<Banknote className="h-5 w-5 text-amber-600" />}
            label="Total Escrow"
            value={fmtMoney(stats?.wallets?.total_escrow)}
            sub={`${fmtMoney(stats?.wallets?.total_available)} available`}
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            label="Pending Payouts"
            value={stats?.withdrawals?.pending_count ?? 0}
            sub={fmtMoney(stats?.withdrawals?.pending_amount)}
            highlight={(stats?.withdrawals?.pending_count ?? 0) > 0}
            onClick={() => navigate("/admin/withdrawals")}
          />
          <StatCard
            icon={<Sparkles className="h-5 w-5 text-pink-600" />}
            label="Feed Posts"
            value={stats?.feed?.total_active_posts ?? 0}
            sub={`${stats?.reviews?.total ?? 0} reviews`}
          />
        </div>

        {/* Phase 5 - quick admin action: KYC review */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/admin/kyc")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-sm font-medium"
            data-testid="admin-kyc-link"
          >
            Review KYC Submissions →
          </button>
          {/* Phase 7 - quick admin action: financial settings */}
          <button
            onClick={() => navigate("/admin/settings")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 text-sm font-medium"
            data-testid="admin-financial-settings-link"
          >
            Financial Settings →
          </button>
          {/* Phase 8 - quick admin action: reports moderation */}
          <button
            onClick={() => navigate("/admin/reports")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
            data-testid="admin-reports-link"
          >
            Reports Moderation →
          </button>
          <button
            onClick={() => navigate("/admin/feed-moderation")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 text-sm font-medium"
            data-testid="admin-feed-moderation-link"
          >
            Feed Moderation →
          </button>
          <button
            onClick={() => navigate("/admin/shop-moderation")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800 text-sm font-medium"
            data-testid="admin-shop-moderation-link"
          >
            Shop Moderation →
          </button>
          {/* Phase 9 - Platform Earnings */}
          <button
            onClick={() => navigate("/admin/earnings")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium"
          >
            Platform Earnings →
          </button>
          {/* Phase 9 - Support Tickets */}
          <button
            onClick={() => navigate("/admin/support")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
          >
            Support Tickets →
          </button>
          {/* Phase 9 - Copyright */}
          <button
            onClick={() => navigate("/admin/copyright")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 text-sm font-medium"
          >
            Copyright →
          </button>
          {/* Phase 9 - Legal Editor */}
          <button
            onClick={() => navigate("/admin/legal-editor")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium"
          >
            Legal Editor →
          </button>
        </div>

        <Tabs defaultValue="bookings" className="w-full" onValueChange={(v) => { if (v === "deleted") loadDeletedUsers(); }}>
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="bookings" data-testid="tab-bookings">
              Recent Bookings
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">
              Payments
            </TabsTrigger>
            <TabsTrigger value="noshows" data-testid="tab-noshows">
              No-Shows
            </TabsTrigger>
            <TabsTrigger value="providers" data-testid="tab-providers">
              Providers
            </TabsTrigger>
            <TabsTrigger value="deleted" data-testid="tab-deleted-users">
              Deleted Users
            </TabsTrigger>
          </TabsList>

          {/* Recent Bookings */}
          <TabsContent value="bookings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Bookings</CardTitle>
                <CardDescription>
                  Latest 10 bookings across the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentBookings.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">No bookings yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentBookings.map((b) => (
                          <TableRow key={b.id} data-testid={`admin-booking-row-${b.id}`}>
                            <TableCell className="font-mono text-xs">{b.id}</TableCell>
                            <TableCell>{b.customer_name || "—"}</TableCell>
                            <TableCell>{b.provider_name || "—"}</TableCell>
                            <TableCell className="text-xs">
                              {b.booking_date || "—"} {b.booking_time?.slice?.(0, 5) || ""}
                            </TableCell>
                            <TableCell>{statusBadge(b.status)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {fmtMoney(b.total_amount || b.service_price)}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {timeAgoShort(b.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Payments</CardTitle>
                <CardDescription>
                  Wallet top-ups and booking payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentPayments.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    No payments yet (or payments table not present).
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Purpose</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentPayments.map((p) => (
                          <TableRow key={p.id} data-testid={`admin-payment-row-${p.id}`}>
                            <TableCell className="font-mono text-xs">{p.reference || p.id}</TableCell>
                            <TableCell>{p.purpose || "—"}</TableCell>
                            <TableCell className="text-xs">
                              {p.user_auth_id ? `${p.user_auth_id.slice(0, 8)}…` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {fmtMoney(p.amount)}
                            </TableCell>
                            <TableCell>{statusBadge(p.status || (p.processed ? "completed" : "pending"))}</TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {timeAgoShort(p.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* No-shows */}
          <TabsContent value="noshows" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reported No-Shows / Disputes</CardTitle>
                <CardDescription>
                  Bookings in dispute or marked no-show
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentNoShows.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    No reported no-shows.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Booking</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentNoShows.map((b) => {
                          const isDisputed = b.status === "disputed" || b.dispute_opened;
                          return (
                            <TableRow 
                              key={b.id} 
                              data-testid={`admin-noshow-row-${b.id}`}
                              onClick={() => {
                                if (isDisputed) {
                                  setSelectedDispute(b);
                                  setResolution("favor_customer");
                                  setAdminNotes("");
                                  setDisputeDialogOpen(true);
                                }
                              }}
                              className={isDisputed ? "cursor-pointer hover:bg-purple-50" : ""}
                            >
                              <TableCell className="font-mono text-xs">
                                {b.id}
                                {isDisputed && <Gavel className="inline h-3 w-3 ml-1 text-orange-600" />}
                              </TableCell>
                              <TableCell>{b.customer_name || "—"}</TableCell>
                              <TableCell>{b.provider_name || "—"}</TableCell>
                              <TableCell>{statusBadge(b.status)}</TableCell>
                              <TableCell className="text-xs text-gray-500">
                                {timeAgoShort(b.updated_at || b.created_at)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Providers */}
          <TabsContent value="providers" className="mt-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:space-y-0">
                <div>
                  <CardTitle className="text-base">Providers</CardTitle>
                  <CardDescription>All providers in the platform</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name"
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleProviderSearch();
                      }}
                      className="pl-9 w-56"
                      data-testid="admin-provider-search"
                    />
                  </div>
                  <Button onClick={handleProviderSearch} data-testid="admin-provider-search-btn">
                    Search
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredProviders.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">No providers found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Verified</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProviders.map((p) => (
                          <TableRow key={p.id} data-testid={`admin-provider-row-${p.id}`}>
                            <TableCell className="font-medium">
                              {p.business_name || p.name || "—"}
                            </TableCell>
                            <TableCell className="text-xs capitalize">
                              {p.provider_type || "individual"}
                            </TableCell>
                            <TableCell className="text-xs">{p.city || "—"}</TableCell>
                            <TableCell className="text-xs text-gray-600">
                              {p.email || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {p.hourly_rate ? fmtMoney(p.hourly_rate) : "—"}
                            </TableCell>
                            <TableCell>
                              {p.rating ? (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  {Number(p.rating).toFixed(1)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {p.is_verified ? (
                                <Badge className="bg-green-100 text-green-700">Verified</Badge>
                              ) : (
                                <span className="text-xs text-gray-400">No</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Phase 6 - Deleted Users */}
          <TabsContent value="deleted" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Deleted Users</CardTitle>
                    <CardDescription>
                      Soft-deleted accounts. Bookings, wallet history & payouts are preserved.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={loadDeletedUsers}
                    variant="outline"
                    size="sm"
                    disabled={loadingDeleted}
                    data-testid="refresh-deleted-users-btn"
                  >
                    {loadingDeleted ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDeleted ? (
                  <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
                ) : deletedUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center" data-testid="no-deleted-users">
                    No deleted users.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Account Type</TableHead>
                          <TableHead>Deleted</TableHead>
                          <TableHead>Auth ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedUsers.map((u) => (
                          <TableRow key={u.id} data-testid={`deleted-user-row-${u.id}`}>
                            <TableCell className="font-medium">{u.name || "—"}</TableCell>
                            <TableCell className="text-xs text-gray-600">{u.email || "—"}</TableCell>
                            <TableCell className="capitalize text-xs">{u.role || "—"}</TableCell>
                            <TableCell className="capitalize text-xs">{u.account_type || "—"}</TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {u.deleted_at ? timeAgoShort(u.deleted_at) : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-[10px] text-gray-400">
                              {u.auth_id ? `${u.auth_id.slice(0, 8)}…` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Phase 10 - Dispute Resolution Dialog */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Gavel className="h-5 w-5 mr-2 text-orange-600" />
              Resolve No-Show Dispute
            </DialogTitle>
            <DialogDescription>
              Review the booking details and choose a resolution. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDispute && (
            <div className="space-y-4">
              {/* Booking Details */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Booking ID</p>
                    <p className="font-mono font-semibold">#{selectedDispute.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Amount</p>
                    <p className="font-semibold">{CURRENCY}{selectedDispute.price?.toLocaleString() || "0"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Customer</p>
                    <p className="font-medium">{selectedDispute.customer_name || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Provider</p>
                    <p className="font-medium">{selectedDispute.provider_name || "Unknown"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs">Service</p>
                    <p className="font-medium">{selectedDispute.service_title || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs">Current Status</p>
                    <div>{statusBadge(selectedDispute.status)}</div>
                  </div>
                </div>
                
                {selectedDispute.dispute_reason && (
                  <div className="pt-2 mt-2 border-t border-gray-200">
                    <p className="text-gray-500 text-xs mb-1">Dispute Reason:</p>
                    <p className="text-sm text-gray-700">{selectedDispute.dispute_reason}</p>
                  </div>
                )}
              </div>

              {/* Resolution Options */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Choose Resolution</Label>
                <div className="space-y-2">
                  <button
                    onClick={() => setResolution("favor_customer")}
                    className={`w-full p-3 text-left rounded-lg border-2 transition-colors ${
                      resolution === "favor_customer"
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-sm">✅ Favor Customer (Refund)</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Provider no-showed. Refund escrow to customer.
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setResolution("favor_provider")}
                    className={`w-full p-3 text-left rounded-lg border-2 transition-colors ${
                      resolution === "favor_provider"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-sm">✅ Favor Provider (Pay)</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Customer no-showed. Release escrow to provider.
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setResolution("split")}
                    className={`w-full p-3 text-left rounded-lg border-2 transition-colors ${
                      resolution === "split"
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-sm">⚖️ Split 50/50</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Both parties partially at fault. Split escrow equally.
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setResolution("dismiss")}
                    className={`w-full p-3 text-left rounded-lg border-2 transition-colors ${
                      resolution === "dismiss"
                        ? "border-gray-500 bg-gray-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-sm">❌ Dismiss Dispute</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Dispute invalid. Close and restore to confirmed.
                    </div>
                  </button>
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <Label>Internal Notes (Optional)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about your resolution decision..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDisputeDialogOpen(false)} 
              disabled={resolving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResolveDispute} 
              disabled={resolving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {resolving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Gavel className="h-4 w-4 mr-2" />
                  Confirm Resolution
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value, sub, highlight, onClick }) {
  return (
    <Card
      className={`${highlight ? "ring-2 ring-red-200" : ""} ${
        onClick ? "cursor-pointer hover:shadow-md transition" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
          {icon}
        </div>
        <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1 truncate">{sub}</p>}
        {onClick && (
          <p className="text-xs text-purple-600 mt-1 flex items-center">
            View <ChevronRight className="h-3 w-3" />
          </p>
        )}
      </CardContent>
    </Card>
  );
}
