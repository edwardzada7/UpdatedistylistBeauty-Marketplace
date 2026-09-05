import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Eye, Loader2, LogOut, MessageCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { professionalAPI } from "@/services/api";
import { ADMIN_KEY_STORAGE } from "@/constants/adminAuth";

const recordsFrom = (data) => Array.isArray(data) ? data : data?.consultations || data?.items || data?.records || [];
const value = (record, names, fallback = "-") => {
  for (const name of names) {
    if (record?.[name] !== undefined && record?.[name] !== null && record?.[name] !== "") return record[name];
  }
  return fallback;
};
const providerName = (record) => value(record, ["provider_name", "full_name", "name"]);
const providerId = (record) => value(record, ["provider_auth_id", "auth_id", "user_auth_id"]);
const certificationName = (record) => value(record, ["certification_name", "name", "title"]);
const dateValue = (record) => {
  const date = value(record, ["certification_expiry", "expiry_date", "expires_at"]);
  return date === "-" ? date : new Date(date).toLocaleDateString();
};
const display = (record, names) => {
  const item = value(record, names);
  if (typeof item === "boolean") return item ? "Yes" : "No";
  return item;
};

function StateBadge({ value: state }) {
  const text = typeof state === "boolean" ? (state ? "Yes" : "No") : String(state || "-");
  const positive = ["approved", "active", "eligible", "yes", "true"].includes(text.toLowerCase());
  return <Badge className={positive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>{text}</Badge>;
}

export default function AdminProfessionalConsultationScreen() {
  const navigate = useNavigate();
  const [adminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || "");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const expireSession = useCallback(() => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    toast.error("Session expired");
    navigate("/admin", { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    if (!adminKey) return;
    try {
      setLoading(true);
      const response = await professionalAPI.consultations.list(adminKey);
      setRecords(recordsFrom(response.data));
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) expireSession();
      else toast.error(error?.response?.data?.detail || "Failed to load consultations");
    } finally {
      setLoading(false);
    }
  }, [adminKey, expireSession]);

  useEffect(() => {
    if (!adminKey) navigate("/admin", { replace: true });
    else load();
  }, [adminKey, load, navigate]);

  const openDetail = async (record) => {
    const id = providerId(record);
    if (id === "-") return;
    setSelected(record);
    try {
      setDetailLoading(true);
      const response = await professionalAPI.consultations.get(adminKey, id);
      setSelected(response.data?.consultation || response.data);
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) expireSession();
      else toast.error(error?.response?.data?.detail || "Failed to load consultation details");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4"><Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}><ArrowLeft className="h-4 w-4 mr-1" />Back to Admin</Button><div className="flex gap-2"><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh</Button><Button variant="ghost" size="sm" onClick={() => { sessionStorage.removeItem(ADMIN_KEY_STORAGE); navigate("/admin"); }}><LogOut className="h-4 w-4 mr-1" />Logout</Button></div></div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-cyan-700" />Professional Consultation</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-700" /></div> : records.length === 0 ? <p className="text-center text-gray-500 py-12">No consultation records.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Specialty</TableHead><TableHead>Certification</TableHead><TableHead>Certification status</TableHead><TableHead>Expiry</TableHead><TableHead>Consultation</TableHead><TableHead>Fee</TableHead><TableHead>Description</TableHead><TableHead>Eligibility</TableHead><TableHead /></TableRow></TableHeader><TableBody>{records.map((record) => <TableRow key={providerId(record)}><TableCell className="font-medium">{providerName(record)}</TableCell><TableCell>{value(record, ["specialty", "provider_specialty", "category"])}</TableCell><TableCell>{certificationName(record)}</TableCell><TableCell><StateBadge value={value(record, ["certification_status", "verification_status", "status"])} /></TableCell><TableCell>{dateValue(record)}</TableCell><TableCell><StateBadge value={value(record, ["consultation_enabled", "enabled"])} /></TableCell><TableCell>{value(record, ["consultation_fee", "fee", "price"])} {value(record, ["currency"], "")}</TableCell><TableCell className="max-w-xs truncate">{value(record, ["description", "consultation_description"])}</TableCell><TableCell><StateBadge value={value(record, ["eligible", "is_eligible", "eligibility"])} /></TableCell><TableCell><Button size="sm" variant="outline" onClick={() => openDetail(record)}><Eye className="h-4 w-4 mr-1" />View</Button></TableCell></TableRow>)}</TableBody></Table></div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Professional Consultation Details</DialogTitle></DialogHeader>{detailLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : selected && <div className="grid sm:grid-cols-2 gap-4 text-sm"><div><strong>Provider</strong><p>{providerName(selected)}</p></div><div><strong>Specialty</strong><p>{value(selected, ["specialty", "provider_specialty", "category"])}</p></div><div><strong>Certification</strong><p>{certificationName(selected)}</p></div><div><strong>Certification status</strong><p><StateBadge value={value(selected, ["certification_status", "verification_status", "status"])} /></p></div><div><strong>Certification expiry</strong><p>{dateValue(selected)}</p></div><div><strong>Consultation enabled</strong><p><StateBadge value={value(selected, ["consultation_enabled", "enabled"])} /></p></div><div><strong>Consultation fee</strong><p>{value(selected, ["consultation_fee", "fee", "price"])} {value(selected, ["currency"], "")}</p></div><div><strong>Eligibility</strong><p><StateBadge value={value(selected, ["eligible", "is_eligible", "eligibility"])} /></p></div><div className="sm:col-span-2"><strong>Description</strong><p className="whitespace-pre-wrap">{value(selected, ["description", "consultation_description"])}</p></div></div>}<DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Close</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
