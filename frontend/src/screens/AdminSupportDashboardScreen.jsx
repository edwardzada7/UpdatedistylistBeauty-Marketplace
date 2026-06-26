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
import { Shield, LogOut, RefreshCcw, MessageSquare, Search, Loader2, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { supportAPI } from "@/services/api";
import { timeAgoShort } from "@/utils/timeAgo";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";
import { useAuth } from "@/contexts/AuthContext";

/**
 * AdminSupportDashboardScreen - Phase 9 Support Ticket Management
 * 
 * Manage support tickets with tabs: Open, Pending, Resolved, Closed
 * Admin can reply, add notes, and change status
 */
export default function AdminSupportDashboardScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("open");

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
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

  const loadTickets = useCallback(
    async (key, status = null) => {
      if (!key) return;
      try {
        setRefreshing(true);
        const resp = await supportAPI.adminList(key, status);
        setTickets(resp.data?.tickets || []);
        setFilteredTickets(resp.data?.tickets || []);
      } catch (e) {
        if (e?.response?.status === 401) {
          handleUnauthorized();
        } else {
          toast.error("Failed to load tickets");
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
      // Load based on active tab
      const statusMap = {
        open: "open",
        pending: "pending",
        resolved: "resolved",
        closed: "closed",
      };
      loadTickets(adminKey, statusMap[activeTab] || null);
    }
  }, [adminKey, activeTab, loadTickets]);

  // Search filter
  useEffect(() => {
    if (!searchTerm) {
      setFilteredTickets(tickets);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredTickets(
        tickets.filter(
          (t) =>
            t.subject?.toLowerCase().includes(term) ||
            t.email?.toLowerCase().includes(term) ||
            t.name?.toLowerCase().includes(term) ||
            t.category?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, tickets]);

  const handleOpenReplyDialog = useCallback((ticket) => {
    setSelectedTicket(ticket);
    setReplyText(ticket.admin_reply || "");
    setAdminNotes(ticket.admin_notes || "");
    setNewStatus(ticket.status);
    setReplyDialogOpen(true);
  }, []);

  const handleSubmitReply = useCallback(async () => {
    if (!selectedTicket || !user?.auth_id) return;
    
    try {
      setSubmitting(true);
      const payload = {
        status: newStatus !== selectedTicket.status ? newStatus : undefined,
        admin_reply: replyText || undefined,
        admin_notes: adminNotes || undefined,
      };

      await supportAPI.adminUpdate(adminKey, selectedTicket.id, user.auth_id, payload);
      toast.success("Ticket updated successfully");
      setReplyDialogOpen(false);
      loadTickets(adminKey, activeTab === "all" ? null : activeTab);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update ticket");
    } finally {
      setSubmitting(false);
    }
  }, [selectedTicket, user, adminKey, replyText, adminNotes, newStatus, activeTab, loadTickets]);

  const statusBadge = (status) => {
    const variants = {
      open: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      resolved: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    };
    return (
      <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
        {status}
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
                <h1 className="text-xl font-bold text-gray-900">Support Tickets</h1>
                <p className="text-xs text-gray-500">{filteredTickets.length} tickets</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadTickets(adminKey, activeTab === "all" ? null : activeTab)}
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
              placeholder="Search by subject, email, name, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredTickets.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">No tickets found.</p>
                ) : (
                  <div className="space-y-4">
                    {filteredTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleOpenReplyDialog(ticket)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{ticket.subject}</h3>
                            <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                              <span className="flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {ticket.email}
                              </span>
                              {ticket.name && (
                                <span className="flex items-center">
                                  <User className="h-3 w-3 mr-1" />
                                  {ticket.name}
                                </span>
                              )}
                              <span>{ticket.category}</span>
                              <span>{timeAgoShort(ticket.created_at)}</span>
                            </div>
                          </div>
                          {statusBadge(ticket.status)}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{ticket.message}</p>
                        {ticket.admin_reply && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-medium text-purple-600 mb-1">Admin Reply:</p>
                            <p className="text-sm text-gray-700 line-clamp-1">{ticket.admin_reply}</p>
                          </div>
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

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Support Ticket #{selectedTicket?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-4">
              {/* Ticket Details */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">{selectedTicket.subject}</h4>
                  {statusBadge(selectedTicket.status)}
                </div>
                <div className="text-sm text-gray-600">
                  <p><strong>From:</strong> {selectedTicket.name || "Anonymous"} ({selectedTicket.email})</p>
                  <p><strong>Category:</strong> {selectedTicket.category}</p>
                  <p><strong>Submitted:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</p>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-700">{selectedTicket.message}</p>
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
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Admin Reply */}
              <div>
                <Label>Reply to Customer</Label>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here... (will be sent via email)"
                  className="mt-1"
                  rows={6}
                />
              </div>

              {/* Admin Notes */}
              <div>
                <Label>Internal Notes (not visible to customer)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReply} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              Update Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
