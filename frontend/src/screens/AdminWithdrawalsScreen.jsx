import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  LogOut,
  RefreshCcw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Banknote,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const ADMIN_KEY_STORAGE = "ADMIN_KEY";
const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
const CURRENCY = "₦";

export default function AdminWithdrawalsScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState(null);
  
  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Check auth on mount
  useEffect(() => {
    const storedKey = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (!storedKey) {
      navigate("/admin", { replace: true });
      return;
    }
    setAdminKey(storedKey);
  }, [navigate]);

  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async (status = null) => {
    if (!adminKey) return;
    
    try {
      let url = `${API_BASE}/api/admin/withdrawals?limit=100`;
      if (status && status !== "all") {
        url += `&status=${status}`;
      }
      
      const response = await fetch(url, {
        headers: { "X-ADMIN-KEY": adminKey }
      });

      if (response.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        toast.error("Session expired. Please login again.");
        navigate("/admin", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch withdrawals");
      }

      const data = await response.json();
      setWithdrawals(data.withdrawals || []);
    } catch (err) {
      console.error("Fetch withdrawals error:", err);
      toast.error("Failed to load withdrawals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminKey, navigate]);

  // Fetch on tab change or initial load
  useEffect(() => {
    if (adminKey) {
      setLoading(true);
      fetchWithdrawals(activeTab);
    }
  }, [adminKey, activeTab, fetchWithdrawals]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWithdrawals(activeTab);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    toast.success("Logged out successfully");
    navigate("/admin", { replace: true });
  };

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      const response = await fetch(`${API_BASE}/api/admin/withdrawals/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-ADMIN-KEY": adminKey
        },
        body: JSON.stringify({ action: "approve" })
      });

      if (response.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        navigate("/admin", { replace: true });
        return;
      }

      const data = await response.json();

      if (response.ok && data.ok) {
        toast.success(`Withdrawal approved`);
        setShowApproveModal(false);
        setApprovingWithdrawal(null);
        fetchWithdrawals(activeTab);
      } else {
        toast.error(data.detail || "Failed to approve withdrawal");
      }
    } catch (err) {
      console.error("Approve error:", err);
      toast.error("Failed to approve withdrawal");
    } finally {
      setProcessingId(null);
    }
  };

  const openApproveModal = (withdrawal) => {
    setApprovingWithdrawal(withdrawal);
    setShowApproveModal(true);
  };

  const openRejectModal = (id) => {
    setRejectingId(id);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessingId(rejectingId);
    try {
      const response = await fetch(`${API_BASE}/api/admin/withdrawals/${rejectingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-ADMIN-KEY": adminKey
        },
        body: JSON.stringify({ action: "reject", note: rejectReason.trim() })
      });

      if (response.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        navigate("/admin", { replace: true });
        return;
      }

      const data = await response.json();

      if (response.ok && data.ok) {
        toast.success(`Withdrawal rejected`);
        setShowRejectModal(false);
        setRejectingId(null);
        setRejectReason("");
        fetchWithdrawals(activeTab);
      } else {
        toast.error(data.detail || "Failed to reject withdrawal");
      }
    } catch (err) {
      console.error("Reject error:", err);
      toast.error("Failed to reject withdrawal");
    } finally {
      setProcessingId(null);
    }
  };

  // Filter withdrawals by search query
  const filteredWithdrawals = withdrawals.filter((w) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      w.id.toString().includes(query) ||
      w.provider_auth_id?.toLowerCase().includes(query) ||
      w.bank_name?.toLowerCase().includes(query) ||
      w.account_name?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="h-3 w-3" /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">{status}</span>;
    }
  };

  const getCounts = () => {
    const all = withdrawals.length;
    // For "all" tab, we don't have filtered data, so we show all
    if (activeTab === "all") {
      return { pending: "-", approved: "-", rejected: "-", all };
    }
    return { 
      pending: activeTab === "pending" ? withdrawals.length : "-",
      approved: activeTab === "approved" ? withdrawals.length : "-", 
      rejected: activeTab === "rejected" ? withdrawals.length : "-",
      all: "-"
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading withdrawals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Withdrawal Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/dashboard")}
              data-testid="goto-admin-dashboard-btn"
            >
              ← Dashboard
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              data-testid="admin-refresh-btn"
            >
              <RefreshCcw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="text-red-600 border-red-200 hover:bg-red-50"
              data-testid="admin-logout-btn"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by ID, provider, bank, or account name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="admin-search-input"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending
            </TabsTrigger>
            <TabsTrigger value="approved" data-testid="tab-approved">
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" data-testid="tab-rejected">
              Rejected
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">
              All
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-purple-600" />
                  {activeTab === "all" ? "All" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Withdrawals
                  <span className="text-sm font-normal text-gray-500">
                    ({filteredWithdrawals.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredWithdrawals.length === 0 ? (
                  <div className="text-center py-12">
                    <Banknote className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No {activeTab !== "all" ? activeTab : ""} withdrawals found</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">ID</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Bank</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Request Date</TableHead>
                            <TableHead>Approval Date</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredWithdrawals.map((w) => (
                            <TableRow key={w.id} data-testid={`withdrawal-row-${w.id}`}>
                              <TableCell className="font-mono text-sm">#{w.id}</TableCell>
                              <TableCell className="font-mono text-xs text-gray-500 max-w-[150px] truncate">
                                {w.provider_auth_id?.slice(0, 8)}...
                              </TableCell>
                              <TableCell className="font-semibold">
                                {CURRENCY}{w.amount?.toLocaleString()}
                              </TableCell>
                              <TableCell>{w.bank_name}</TableCell>
                              <TableCell>
                                <div className="text-sm">{w.account_name}</div>
                                <div className="text-xs text-gray-500 font-mono" data-testid={`account-number-${w.id}`}>
                                  {w.account_number}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(w.status)}</TableCell>
                              <TableCell className="text-xs text-gray-500">
                                {formatDate(w.created_at)}
                              </TableCell>
                              <TableCell className="text-xs text-gray-500" data-testid={`approval-date-${w.id}`}>
                                {w.status !== "pending" ? formatDate(w.updated_at) : "-"}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate text-sm text-gray-500">
                                {w.note || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {w.status === "pending" && (
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      onClick={() => openApproveModal(w)}
                                      disabled={processingId === w.id}
                                      className="bg-green-600 hover:bg-green-700"
                                      data-testid={`approve-btn-${w.id}`}
                                    >
                                      {processingId === w.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <CheckCircle className="h-4 w-4 mr-1" />
                                          Approve
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openRejectModal(w.id)}
                                      disabled={processingId === w.id}
                                      className="text-red-600 border-red-200 hover:bg-red-50"
                                      data-testid={`reject-btn-${w.id}`}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-4">
                      {filteredWithdrawals.map((w) => (
                        <Card key={w.id} className="border" data-testid={`withdrawal-card-${w.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <span className="text-xs text-gray-500 font-mono">#{w.id}</span>
                                <p className="text-lg font-bold">
                                  {CURRENCY}{w.amount?.toLocaleString()}
                                </p>
                              </div>
                              {getStatusBadge(w.status)}
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Bank:</span>
                                <span>{w.bank_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Account:</span>
                                <span>{w.account_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Account #:</span>
                                <span className="font-mono" data-testid={`account-number-card-${w.id}`}>{w.account_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Request Date:</span>
                                <span className="text-xs">{formatDate(w.created_at)}</span>
                              </div>
                              {w.status !== "pending" && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Approval Date:</span>
                                  <span className="text-xs">{formatDate(w.updated_at)}</span>
                                </div>
                              )}
                              {w.note && (
                                <div className="pt-2 border-t">
                                  <span className="text-gray-500">Note: </span>
                                  <span className="text-gray-700">{w.note}</span>
                                </div>
                              )}
                            </div>

                            {w.status === "pending" && (
                              <div className="flex gap-2 mt-4">
                                <Button
                                  size="sm"
                                  onClick={() => openApproveModal(w)}
                                  disabled={processingId === w.id}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  {processingId === w.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Approve
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRejectModal(w.id)}
                                  disabled={processingId === w.id}
                                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveModal && approvingWithdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Approve Withdrawal #{approvingWithdrawal.id}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount:</span>
                  <span className="font-semibold">{CURRENCY}{approvingWithdrawal.amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Name:</span>
                  <span>{approvingWithdrawal.account_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bank:</span>
                  <span>{approvingWithdrawal.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account #:</span>
                  <span className="font-mono">{approvingWithdrawal.account_number}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Confirm the bank details above match the recipient. Once approved, the amount will be debited from the provider&apos;s wallet and this action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowApproveModal(false);
                    setApprovingWithdrawal(null);
                  }}
                  disabled={processingId === approvingWithdrawal.id}
                  data-testid="cancel-approve-btn"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(approvingWithdrawal.id)}
                  disabled={processingId === approvingWithdrawal.id}
                  data-testid="confirm-approve-btn"
                >
                  {processingId === approvingWithdrawal.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Approve
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Reject Withdrawal #{rejectingId}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Rejection Reason *</Label>
                <Input
                  id="reject-reason"
                  placeholder="Enter reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  data-testid="reject-reason-input"
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  This action cannot be undone. The provider will be notified of the rejection.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingId(null);
                    setRejectReason("");
                  }}
                  disabled={processingId === rejectingId}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleReject}
                  disabled={processingId === rejectingId || !rejectReason.trim()}
                  data-testid="confirm-reject-btn"
                >
                  {processingId === rejectingId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
