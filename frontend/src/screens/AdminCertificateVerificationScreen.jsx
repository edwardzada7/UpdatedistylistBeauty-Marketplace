import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, ExternalLink, Eye, FileCheck, Loader2, LogOut, RefreshCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { professionalAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const statuses = ["pending", "approved", "rejected", "expired"];

const recordsFrom = (data, key) => {
  if (Array.isArray(data)) return data;
  return data?.[key] || data?.items || data?.records || [];
};

const value = (record, names, fallback = "-") => {
  for (const name of names) {
    if (record?.[name] !== undefined && record?.[name] !== null && record?.[name] !== "") return record[name];
  }
  return fallback;
};

const providerName = (record) => value(record, ["provider_name", "full_name", "name", "provider?.name"]);
const providerEmail = (record) => value(record, ["provider_email", "email"]);
const providerSpecialty = (record) => value(record, ["specialty", "provider_specialty", "category"]);
const certificationName = (record) => value(record, ["certification_name", "name", "title"]);
const statusOf = (record) => String(value(record, ["verification_status", "status"], "-")).toLowerCase();
const dateValue = (record, names) => {
  const date = value(record, names, "-");
  return date === "-" ? date : new Date(date).toLocaleDateString();
};

function StatusBadge({ status }) {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    expired: "bg-gray-100 text-gray-700",
  };
  return <Badge className={colors[status] || "bg-gray-100 text-gray-700"}>{status || "-"}</Badge>;
}

export default function AdminCertificateVerificationScreen() {
  const navigate = useNavigate();
  const [adminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || "");
  const [activeStatus, setActiveStatus] = useState("pending");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const expireSession = useCallback(() => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    toast.error("Session expired");
    navigate("/admin", { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    if (!adminKey) return;
    try {
      setLoading(true);
      const response = await professionalAPI.certifications.list(adminKey);
      setRecords(recordsFrom(response.data, "certifications"));
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) expireSession();
      else toast.error(error?.response?.data?.detail || "Failed to load certifications");
    } finally {
      setLoading(false);
    }
  }, [adminKey, expireSession]);

  useEffect(() => {
    if (!adminKey) navigate("/admin", { replace: true });
    else load();
  }, [adminKey, load, navigate]);

  const openDetail = async (record) => {
    const id = value(record, ["id", "certification_id"]);
    if (id === "-") return;
    setSelected(record);
    try {
      setDetailLoading(true);
      const response = await professionalAPI.certifications.get(adminKey, id);
      setSelected(response.data?.certification || response.data);
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) expireSession();
      else toast.error(error?.response?.data?.detail || "Failed to load certificate details");
    } finally {
      setDetailLoading(false);
    }
  };

  const moderate = async (action) => {
    const id = value(selected, ["id", "certification_id"]);
    if (id === "-") return;
    if (action === "reject" && !reason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    if (!window.confirm(`Confirm ${action} certificate?`)) return;
    try {
      setProcessing(true);
      if (action === "approve") await professionalAPI.certifications.approve(adminKey, id);
      else await professionalAPI.certifications.reject(adminKey, id, reason.trim());
      toast.success(`Certificate ${action === "approve" ? "approved" : "rejected"}`);
      setRejecting(false);
      setReason("");
      setSelected(null);
      await load();
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) expireSession();
      else toast.error(error?.response?.data?.detail || `Failed to ${action} certificate`);
    } finally {
      setProcessing(false);
    }
  };

  const visible = records.filter((record) => statusOf(record) === activeStatus);
  const canModerate = statusOf(selected) === "pending";

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}><ArrowLeft className="h-4 w-4 mr-1" />Back to Admin</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
            <Button variant="ghost" size="sm" onClick={() => { sessionStorage.removeItem(ADMIN_KEY_STORAGE); navigate("/admin"); }}><LogOut className="h-4 w-4 mr-1" />Logout</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-teal-600" />Certificate Verification</CardTitle></CardHeader>
          <CardContent>
            <Tabs value={activeStatus} onValueChange={setActiveStatus}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {statuses.map((status) => <TabsTrigger key={status} value={status} className="capitalize">{status}</TabsTrigger>)}
              </TabsList>
              {statuses.map((status) => (
                <TabsContent key={status} value={status} className="mt-4">
                  {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div> : visible.length === 0 ? <p className="text-center text-gray-500 py-12">No {status} certificates.</p> : (
                    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Email</TableHead><TableHead>Specialty</TableHead><TableHead>Certification</TableHead><TableHead>Status</TableHead><TableHead>Expiry</TableHead><TableHead>Submitted / Updated</TableHead><TableHead>Document</TableHead><TableHead /></TableRow></TableHeader><TableBody>
                      {visible.map((record) => <TableRow key={value(record, ["id", "certification_id"])}>
                        <TableCell className="font-medium">{providerName(record)}</TableCell><TableCell className="text-xs">{providerEmail(record)}</TableCell><TableCell>{providerSpecialty(record)}</TableCell><TableCell>{certificationName(record)}</TableCell><TableCell><StatusBadge status={statusOf(record)} /></TableCell><TableCell>{dateValue(record, ["expiry_date", "expires_at", "certification_expiry"])}</TableCell><TableCell className="text-xs">{dateValue(record, ["updated_at", "submitted_at", "created_at"])}</TableCell><TableCell>{value(record, ["certificate_url", "document_url", "certificate_document_url"], "-") !== "-" ? "Available" : "-"}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => openDetail(record)}><Eye className="h-4 w-4 mr-1" />View</Button></TableCell>
                      </TableRow>)}
                    </TableBody></Table></div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Certificate Details</DialogTitle></DialogHeader>
          {detailLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : selected && <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><Label>Provider</Label><p>{providerName(selected)}</p><p className="text-gray-500">{providerEmail(selected)}</p></div><div><Label>Specialty</Label><p>{providerSpecialty(selected)}</p></div>
            <div><Label>Certification</Label><p>{certificationName(selected)}</p></div><div><Label>Status</Label><p><StatusBadge status={statusOf(selected)} /></p></div>
            <div><Label>Expiry date</Label><p>{dateValue(selected, ["expiry_date", "expires_at", "certification_expiry"])}</p></div><div><Label>Submitted</Label><p>{dateValue(selected, ["submitted_at", "created_at"])}</p></div>
            <div><Label>Updated</Label><p>{dateValue(selected, ["updated_at", "reviewed_at"])}</p></div><div><Label>Rejection reason</Label><p>{value(selected, ["rejection_reason", "rejectionReason"])}</p></div>
            <div className="sm:col-span-2">{value(selected, ["certificate_url", "document_url", "certificate_document_url"], "-") !== "-" && <a className="inline-flex items-center text-blue-600 hover:underline" href={value(selected, ["certificate_url", "document_url", "certificate_document_url"])} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" />View Certificate</a>}</div>
          </div>}
          <DialogFooter>{canModerate && <><Button className="bg-green-600 hover:bg-green-700" onClick={() => moderate("approve")} disabled={processing}><CheckCircle className="h-4 w-4 mr-1" />Approve</Button><Button variant="destructive" onClick={() => setRejecting(true)} disabled={processing}><XCircle className="h-4 w-4 mr-1" />Reject</Button></>}<Button variant="outline" onClick={() => setSelected(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting} onOpenChange={setRejecting}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Reject Certificate</DialogTitle></DialogHeader><div><Label htmlFor="certificate-reason">Rejection reason *</Label><Textarea id="certificate-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-1" /></div><DialogFooter><Button variant="outline" onClick={() => { setRejecting(false); setReason(""); }} disabled={processing}>Cancel</Button><Button variant="destructive" onClick={() => moderate("reject")} disabled={processing || !reason.trim()}>{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Reject"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
