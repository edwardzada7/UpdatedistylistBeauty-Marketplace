import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Shield, LogOut, RefreshCcw, AlertTriangle, Search, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { copyrightAPI } from "@/services/api";
import { timeAgoShort } from "@/utils/timeAgo";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";
import { useAuth } from "@/contexts/AuthContext";

/**
 * AdminCopyrightScreen - Phase 9 Copyright Complaint Management
 * 
 * Review and manage copyright/DMCA complaints
 */
export default function AdminCopyrightScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    toast.error("Session expired");
    navigate("/admin", { replace: true });
  }, [navigate]);

  const loadComplaints = useCallback(
    async (key, status = null) => {
      if (!key) return;
      try {
        setRefreshing(true);
        const resp = await copyrightAPI.adminList(key, status);
        setComplaints(resp.data?.complaints || []);
        setFilteredComplaints(resp.data?.complaints || []);
      } catch (e) {
        if (e?.response?.status === 401) {
          handleUnauthorized();
        } else {
          toast.error("Failed to load complaints");
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
      const statusMap = {
        pending: "pending",
        under_review: "under_review",
        action_taken: "action_taken",
        dismissed: "dismissed",
      };
      loadComplaints(adminKey, statusMap[activeTab] || null);
    }
  }, [adminKey, activeTab, loadComplaints]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredComplaints(complaints);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredComplaints(
        complaints.filter(
          (c) =>
            c.complainant_name?.toLowerCase().includes(term) ||
            c.complainant_email?.toLowerCase().includes(term) ||
            c.target_type?.toLowerCase().includes(term) ||
            c.target_id?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, complaints]);

  const handleOpenReviewDialog = useCallback((complaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status);
    setAdminNotes(complaint.admin_notes || "");
    setActionTaken(complaint.action_taken || "");
    setReviewDialogOpen(true);
  }, []);

  const handleSubmitReview = useCallback(async () => {
    if (!selectedComplaint || !user?.auth_id) return;
    
    try {
      setSubmitting(true);
      const payload = {
        status: newStatus !== selectedComplaint.status ? newStatus : undefined,
        admin_notes: adminNotes || undefined,
        action_taken: actionTaken || undefined,
      };

      await copyrightAPI.adminUpdate(adminKey, selectedComplaint.id, user.auth_id, payload);
      toast.success("Complaint updated successfully");
      setReviewDialogOpen(false);
      loadComplaints(adminKey, activeTab === "all" ? null : activeTab);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update complaint");
    } finally {
      setSubmitting(false);
    }
  }, [selectedComplaint, user, adminKey, newStatus, adminNotes, actionTaken, activeTab, loadComplaints]);

  const statusBadge = (status) => {
    const variants = {
      pending: "bg-yellow-100 text-yellow-800",
      under_review: "bg-blue-100 text-blue-800",
      action_taken: "bg-green-100 text-green-800",
      dismissed: "bg-gray-100 text-gray-800",
      escalated: "bg-red-100 text-red-800",
    };
    return (
      <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
        {status?.replace("_", " ")}
      </Badge>
    );
  };

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
                <h1 className="text-xl font-bold text-gray-900">Copyright Complaints</h1>
                <p className="text-xs text-gray-500">{filteredComplaints.length} complaints</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadComplaints(adminKey, activeTab === "all" ? null : activeTab)}
                disabled={refreshing}
              >
                <RefreshCcw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}>
                Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
                  navigate("/admin");
                }}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by complainant, email, target type, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="under_review">Under Review</TabsTrigger>
            <TabsTrigger value="action_taken">Action Taken</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
                  {activeTab.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Complaints
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredComplaints.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">No complaints found.</p>
                ) : (
                  <div className="space-y-4">
                    {filteredComplaints.map((complaint) => (
                      <div
                        key={complaint.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleOpenReviewDialog(complaint)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">
                              {complaint.complaint_type} - {complaint.target_type} #{complaint.target_id}
                            </h3>
                            <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                              <span>{complaint.complainant_name}</span>
                              <span>{complaint.complainant_email}</span>
                              <span>{timeAgoShort(complaint.created_at)}</span>
                            </div>
                          </div>
                          {statusBadge(complaint.status)}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          <strong>Claim:</strong> {complaint.infringing_content_description}
                        </p>
                        {complaint.target_url && (
                          <a
                            href={complaint.target_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-600 hover:underline flex items-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View reported content
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Copyright Complaint #{selectedComplaint?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedComplaint && (
            <div className="space-y-4">
              {/* Complaint Details */}
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-red-900 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    DMCA Complaint
                  </h4>
                  {statusBadge(selectedComplaint.status)}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-red-700 font-medium">Complainant:</p>
                    <p className="text-red-900">{selectedComplaint.complainant_name}</p>
                    <p className="text-red-700 text-xs">{selectedComplaint.complainant_email}</p>
                  </div>
                  <div>
                    <p className="text-red-700 font-medium">Target:</p>
                    <p className="text-red-900">{selectedComplaint.complaint_type} - {selectedComplaint.target_type}</p>
                    <p className="text-red-700 text-xs">ID: {selectedComplaint.target_id}</p>
                  </div>
                </div>

                <div>
                  <p className="text-red-700 font-medium mb-1">Infringing Content Description:</p>
                  <p className="text-sm text-red-900">{selectedComplaint.infringing_content_description}</p>
                </div>

                <div>
                  <p className="text-red-700 font-medium mb-1">Original Work Description:</p>
                  <p className="text-sm text-red-900">{selectedComplaint.original_work_description}</p>
                </div>

                {selectedComplaint.proof_of_ownership && (
                  <div>
                    <p className="text-red-700 font-medium mb-1">Proof of Ownership:</p>
                    <p className="text-sm text-red-900">{selectedComplaint.proof_of_ownership}</p>
                  </div>
                )}

                {selectedComplaint.target_url && (
                  <div>
                    <a
                      href={selectedComplaint.target_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-red-600 hover:underline flex items-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View reported content
                    </a>
                  </div>
                )}

                <div className="pt-2 border-t border-red-300 text-xs text-red-700">
                  <p><strong>Submitted:</strong> {new Date(selectedComplaint.created_at).toLocaleString()}</p>
                  <p><strong>Signature:</strong> {selectedComplaint.electronic_signature}</p>
                </div>
              </div>

              {/* Status */}
              <div>
                <Label>Status</Label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="action_taken">Action Taken</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>

              {/* Action Taken */}
              <div>
                <Label>Action Taken</Label>
                <Textarea
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="Describe what action was taken (e.g., content removed, warning issued, etc.)"
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Admin Notes */}
              <div>
                <Label>Internal Notes</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this case..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Update Complaint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
