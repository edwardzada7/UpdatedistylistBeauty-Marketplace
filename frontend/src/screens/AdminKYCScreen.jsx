import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { kycAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, Eye, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import KYCStatusBadge from "@/components/KYCStatusBadge";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

export default function AdminKYCScreen() {
  const navigate = useNavigate();
  const [adminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || "");
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [viewing, setViewing] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!adminKey) {
      navigate("/admin", { replace: true });
    }
  }, [adminKey, navigate]);

  const fetchSubmissions = useCallback(async (status) => {
    if (!adminKey) return;
    try {
      setLoading(true);
      const res = await kycAPI.listAdmin(adminKey, status);
      setSubmissions(res.data?.submissions || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        navigate("/admin", { replace: true });
        return;
      }
      const d = err?.response?.data?.detail || err?.message || "Failed to load";
      toast.error(typeof d === "string" ? d : JSON.stringify(d));
    } finally {
      setLoading(false);
    }
  }, [adminKey, navigate]);

  useEffect(() => { fetchSubmissions(activeTab); }, [activeTab, fetchSubmissions]);

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await kycAPI.review(adminKey, id, "approve");
      toast.success("KYC approved");
      setViewing(null);
      fetchSubmissions(activeTab);
    } catch (err) {
      const d = err?.response?.data?.detail || err?.message || "Failed to approve";
      toast.error(typeof d === "string" ? d : JSON.stringify(d));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setProcessingId(rejectingId);
    try {
      await kycAPI.review(adminKey, rejectingId, "reject", rejectReason.trim());
      toast.success("KYC rejected");
      setRejectingId(null);
      setRejectReason("");
      setViewing(null);
      fetchSubmissions(activeTab);
    } catch (err) {
      const d = err?.response?.data?.detail || err?.message || "Failed to reject";
      toast.error(typeof d === "string" ? d : JSON.stringify(d));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate("/admin/dashboard")}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
          data-testid="admin-kyc-back">
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </button>

        <Card>
          <CardHeader>
            <CardTitle>KYC Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="pending" data-testid="admin-kyc-tab-pending">Pending</TabsTrigger>
                <TabsTrigger value="verified" data-testid="admin-kyc-tab-verified">Verified</TabsTrigger>
                <TabsTrigger value="rejected" data-testid="admin-kyc-tab-rejected">Rejected</TabsTrigger>
              </TabsList>

              {["pending", "verified", "rejected"].map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-4">
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    </div>
                  ) : submissions.length === 0 ? (
                    <p className="text-center text-gray-500 py-12">No {tab} submissions</p>
                  ) : (
                    <div className="space-y-3">
                      {submissions.map((s) => (
                        <div key={s.id} className="border rounded-lg p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          data-testid={`admin-kyc-row-${s.id}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">
                                {s.account_type === "business" ? s.business_name : s.full_name}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 capitalize">
                                {s.account_type}
                              </span>
                              <KYCStatusBadge status={s.status} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Submitted {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "-"} •
                              user_auth_id={s.user_auth_id?.slice(0, 8)}...
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setViewing(s)}
                              data-testid={`admin-kyc-view-${s.id}`}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                            {s.status === "pending" && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApprove(s.id)} disabled={processingId === s.id}
                                  data-testid={`admin-kyc-approve-${s.id}`}>
                                  {processingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-1" /> Approve</>}
                                </Button>
                                <Button size="sm" variant="destructive"
                                  onClick={() => setRejectingId(s.id)} disabled={processingId === s.id}
                                  data-testid={`admin-kyc-reject-${s.id}`}>
                                  <XCircle className="h-4 w-4 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* View modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>KYC #{viewing.id} ({viewing.account_type})</CardTitle>
              <KYCStatusBadge status={viewing.status} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {viewing.account_type === "individual" ? (
                <>
                  <div><strong>Full Name:</strong> {viewing.full_name || "-"}</div>
                  <div><strong>Phone:</strong> {viewing.phone_number || "-"}</div>
                  <div><strong>DOB:</strong> {viewing.date_of_birth || "-"}</div>
                  <div><strong>ID Type:</strong> {viewing.id_type || "-"}</div>
                  <div><strong>ID Number:</strong> {viewing.id_number || "-"}</div>
                  {viewing.selfie_url && (
                    <div><strong>Selfie:</strong>{" "}
                      <a href={viewing.selfie_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open</a>
                    </div>
                  )}
                  {viewing.id_doc_url && (
                    <div><strong>ID Document:</strong>{" "}
                      <a href={viewing.id_doc_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open</a>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div><strong>Business Name:</strong> {viewing.business_name || "-"}</div>
                  <div><strong>Registration #:</strong> {viewing.registration_number || "-"}</div>
                  <div><strong>Address:</strong> {viewing.business_address || "-"}</div>
                  <div><strong>Contact Person:</strong> {viewing.contact_person || "-"}</div>
                  <div><strong>Contact Phone:</strong> {viewing.contact_phone || "-"}</div>
                  {viewing.cac_doc_url && (
                    <div><strong>CAC Certificate:</strong>{" "}
                      <a href={viewing.cac_doc_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open</a>
                    </div>
                  )}
                  {viewing.logo_url && (
                    <div><strong>Logo:</strong>{" "}
                      <a href={viewing.logo_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open</a>
                    </div>
                  )}
                </>
              )}
              {viewing.rejection_reason && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700">
                  <strong>Rejection reason:</strong> {viewing.rejection_reason}
                </div>
              )}
              <div className="pt-4 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setViewing(null)} data-testid="admin-kyc-close-view">Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Reject KYC #{rejectingId}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label>Rejection reason *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain what needs to be corrected..."
                rows={4}
                data-testid="admin-kyc-reject-reason"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setRejectingId(null); setRejectReason(""); }}
                  data-testid="admin-kyc-reject-cancel">Cancel</Button>
                <Button variant="destructive" onClick={handleReject} disabled={processingId === rejectingId}
                  data-testid="admin-kyc-reject-confirm">
                  {processingId === rejectingId ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                  ) : "Confirm Reject"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
