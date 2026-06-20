import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Flag, Loader2, RefreshCcw, CheckCircle, XCircle, Eye, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { reportsAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const TABS = [
  { value: "pending",      label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "resolved",     label: "Resolved" },
  { value: "dismissed",    label: "Dismissed" },
];

const TARGET_FILTERS = [
  { value: "", label: "All types" },
  { value: "provider", label: "Providers" },
  { value: "customer", label: "Customers" },
  { value: "post",     label: "Feed Posts" },
  { value: "review",   label: "Reviews" },
  { value: "chat",     label: "Chat Messages" },
];

function statusBadge(s) {
  const map = {
    pending:      "bg-amber-100 text-amber-800",
    under_review: "bg-blue-100 text-blue-800",
    resolved:     "bg-green-100 text-green-800",
    dismissed:    "bg-gray-100 text-gray-700",
  };
  return <span className={`px-2 py-0.5 text-xs rounded-full ${map[s] || "bg-gray-100 text-gray-700"}`}>{s}</span>;
}

export default function AdminReportsScreen() {
  const navigate = useNavigate();
  const [adminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || "");
  const [tab, setTab] = useState("pending");
  const [targetType, setTargetType] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!adminKey) navigate("/admin", { replace: true });
  }, [adminKey, navigate]);

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await reportsAPI.adminList(adminKey, tab, targetType || null, 100, 0);
      setReports(res.data?.reports || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        navigate("/admin", { replace: true });
        return;
      }
      if (err?.response?.status === 503) {
        toast.error("Run phase8_lean_trust_safety.sql migration in Supabase first.");
      } else {
        toast.error(err?.response?.data?.detail || "Failed to load reports");
      }
    } finally {
      setLoading(false);
    }
  }, [adminKey, tab, targetType, navigate]);

  useEffect(() => { load(); }, [load]);

  const openReport = (r) => {
    setViewing(r);
    setNotes(r.admin_notes || "");
  };

  const updateStatus = async (newStatus) => {
    if (!viewing) return;
    setUpdating(true);
    try {
      await reportsAPI.adminUpdate(adminKey, viewing.id, {
        status: newStatus,
        admin_notes: notes.trim() || null,
      });
      toast.success(`Report marked ${newStatus}`);
      setViewing(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update report");
    } finally {
      setUpdating(false);
    }
  };

  const saveNotesOnly = async () => {
    if (!viewing) return;
    setUpdating(true);
    try {
      await reportsAPI.adminUpdate(adminKey, viewing.id, {
        admin_notes: notes.trim() || null,
      });
      toast.success("Notes saved");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save notes");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")} data-testid="reports-back-btn">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Flag className="h-5 w-5 text-red-600" />
            <h1 className="text-xl font-bold">Reports Moderation</h1>
          </div>
          <Button variant="outline" size="sm" onClick={load} data-testid="reports-refresh-btn">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">User-reported content</CardTitle>
                <CardDescription>
                  Reports submitted by users across providers, customers, feed posts, reviews, and chat.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="filter-target" className="text-xs">Target:</Label>
                <select
                  id="filter-target"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm bg-white"
                  data-testid="reports-target-filter"
                >
                  {TARGET_FILTERS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid grid-cols-4 max-w-2xl">
                {TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} data-testid={`reports-tab-${t.value}`}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {TABS.map((t) => (
                <TabsContent key={t.value} value={t.value} className="mt-4">
                  {loading ? (
                    <div className="py-12 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                    </div>
                  ) : reports.length === 0 ? (
                    <p className="text-sm text-gray-500 py-12 text-center" data-testid={`no-reports-${t.value}`}>
                      No {t.label.toLowerCase()} reports.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Reporter</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>When</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reports.map((r) => (
                            <TableRow key={r.id} data-testid={`report-row-${r.id}`}>
                              <TableCell className="font-mono text-xs">#{r.id}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">{r.target_type}</Badge>
                                <span className="ml-2 font-mono text-xs text-gray-500">
                                  {String(r.target_id).slice(0, 10)}{String(r.target_id).length > 10 ? "…" : ""}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs">{r.reason?.replace(/_/g, " ")}</TableCell>
                              <TableCell className="font-mono text-[10px] text-gray-500">
                                {r.reporter_auth_id?.slice(0, 8)}…
                              </TableCell>
                              <TableCell>{statusBadge(r.status)}</TableCell>
                              <TableCell className="text-xs text-gray-500">
                                {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => openReport(r)} data-testid={`view-report-${r.id}`}>
                                  <Eye className="h-4 w-4 mr-1" /> Review
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!viewing} onOpenChange={(o) => !updating && !o && setViewing(null)}>
        <DialogContent data-testid="report-detail-dialog">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Report #{viewing.id} — <span className="capitalize">{viewing.target_type}</span>
                </DialogTitle>
                <DialogDescription>
                  Target ID: <span className="font-mono">{viewing.target_id}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Reason: </span>
                  <span className="font-medium capitalize">{viewing.reason?.replace(/_/g, " ")}</span>
                </div>
                {viewing.description && (
                  <div className="rounded-md border bg-gray-50 p-3 whitespace-pre-wrap">
                    {viewing.description}
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Reporter: </span>
                  <span className="font-mono text-xs">{viewing.reporter_auth_id}</span>
                </div>
                <div>
                  <Label htmlFor="admin-notes">Admin notes</Label>
                  <Textarea
                    id="admin-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-2"
                    placeholder="Internal moderation notes (not visible to user)…"
                    data-testid="report-notes-input"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
                <Button variant="outline" onClick={saveNotesOnly} disabled={updating} data-testid="report-save-notes-btn">
                  Save notes
                </Button>
                <Button variant="outline" onClick={() => updateStatus("under_review")} disabled={updating} data-testid="report-mark-review-btn">
                  Mark Under Review
                </Button>
                <Button
                  className="bg-gray-700 hover:bg-gray-800 text-white"
                  onClick={() => updateStatus("dismissed")}
                  disabled={updating}
                  data-testid="report-dismiss-btn"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Dismiss
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateStatus("resolved")}
                  disabled={updating}
                  data-testid="report-resolve-btn"
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Resolve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
