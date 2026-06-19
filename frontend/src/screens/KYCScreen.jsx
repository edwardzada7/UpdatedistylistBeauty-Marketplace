import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { kycAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Upload, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import KYCStatusBadge from "@/components/KYCStatusBadge";

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      const idx = result.indexOf(",");
      resolve({ mime: file.type, data: idx >= 0 ? result.slice(idx + 1) : result });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const FileField = ({ label, onChange, fileName, required, testid }) => (
  <div>
    <Label>{label}{required ? " *" : ""}</Label>
    <label className="flex items-center gap-2 mt-1 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:border-purple-400">
      <Upload className="h-4 w-4 text-gray-500" />
      <span className="text-sm text-gray-600 truncate" data-testid={`${testid}-name`}>
        {fileName || "Choose file (image or PDF, max 5MB)"}
      </span>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onChange}
        data-testid={testid}
      />
    </label>
  </div>
);

export default function KYCScreen() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const authId = userData?.auth_id;
  const accountType = userData?.account_type || "individual";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("not_submitted");
  const [existing, setExisting] = useState(null);

  // Individual form state
  const [ind, setInd] = useState({
    full_name: "", phone_number: "", date_of_birth: "",
    id_type: "national_id", id_number: "",
  });
  const [selfieFile, setSelfieFile] = useState(null);
  const [idDocFile, setIdDocFile] = useState(null);

  // Business form state
  const [biz, setBiz] = useState({
    business_name: "", registration_number: "", business_address: "",
    contact_person: "", contact_phone: "",
  });
  const [cacFile, setCacFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!authId) return;
    try {
      setLoading(true);
      const res = await kycAPI.getMe(authId);
      setStatus(res.data?.status || "not_submitted");
      setExisting(res.data?.submission || null);
      const s = res.data?.submission;
      if (s) {
        if (s.account_type === "individual") {
          setInd({
            full_name: s.full_name || "",
            phone_number: s.phone_number || "",
            date_of_birth: s.date_of_birth || "",
            id_type: s.id_type || "national_id",
            id_number: s.id_number || "",
          });
        } else {
          setBiz({
            business_name: s.business_name || "",
            registration_number: s.registration_number || "",
            business_address: s.business_address || "",
            contact_person: s.contact_person || "",
            contact_phone: s.contact_phone || "",
          });
        }
      }
    } catch (e) {
      setStatus("not_submitted");
    } finally {
      setLoading(false);
    }
  }, [authId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleFile = (setter) => (e) => {
    const f = e.target.files?.[0];
    if (f && f.size > 5 * 1024 * 1024) {
      toast.error("File exceeds 5MB limit");
      return;
    }
    setter(f || null);
  };

  const submit = async () => {
    if (!authId) {
      toast.error("Please log in to submit KYC");
      return;
    }
    try {
      setSubmitting(true);
      const payload = { auth_id: authId, account_type: accountType };

      if (accountType === "individual") {
        if (!ind.full_name || !ind.phone_number || !ind.date_of_birth || !ind.id_type || !ind.id_number) {
          toast.error("Please complete all required fields");
          return;
        }
        payload.individual = {
          ...ind,
          selfie: selfieFile ? await fileToBase64(selfieFile) : undefined,
          id_doc: idDocFile ? await fileToBase64(idDocFile) : undefined,
        };
      } else {
        if (!biz.business_name || !biz.registration_number || !biz.business_address || !biz.contact_person || !biz.contact_phone) {
          toast.error("Please complete all required fields");
          return;
        }
        payload.business = {
          ...biz,
          cac_doc: cacFile ? await fileToBase64(cacFile) : undefined,
          logo: logoFile ? await fileToBase64(logoFile) : undefined,
        };
      }

      await kycAPI.submit(payload);
      toast.success("KYC submitted. Awaiting review.");
      await loadStatus();
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || "Failed to submit";
      toast.error(`Failed to submit KYC: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!authId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full m-4">
          <CardContent className="p-6 text-center">
            <p className="mb-4">Please log in to access KYC.</p>
            <Button onClick={() => navigate("/login")}>Log In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const readOnly = status === "pending" || status === "verified";

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
          data-testid="kyc-back-btn"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-500" />
              KYC Verification
            </CardTitle>
            <KYCStatusBadge status={status} />
          </CardHeader>

          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              </div>
            ) : (
              <>
                {status === "rejected" && existing?.rejection_reason && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-700">Rejected</p>
                      <p className="text-red-600">{existing.rejection_reason}</p>
                      <p className="text-red-600 mt-1">You may update your details and resubmit below.</p>
                    </div>
                  </div>
                )}

                {status === "verified" && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                    Your account is verified. Thank you.
                  </div>
                )}

                {status === "pending" && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
                    Your submission is under review. We&apos;ll notify you once a decision is made.
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  Account type: <strong className="capitalize">{accountType}</strong>
                </p>

                {accountType === "individual" ? (
                  <div className="space-y-3" data-testid="kyc-individual-form">
                    <div>
                      <Label>Full Name *</Label>
                      <Input value={ind.full_name} disabled={readOnly}
                        onChange={(e) => setInd({ ...ind, full_name: e.target.value })}
                        data-testid="kyc-full-name" />
                    </div>
                    <div>
                      <Label>Phone Number *</Label>
                      <Input value={ind.phone_number} disabled={readOnly}
                        onChange={(e) => setInd({ ...ind, phone_number: e.target.value })}
                        data-testid="kyc-phone" />
                    </div>
                    <div>
                      <Label>Date of Birth *</Label>
                      <Input type="date" value={ind.date_of_birth} disabled={readOnly}
                        onChange={(e) => setInd({ ...ind, date_of_birth: e.target.value })}
                        data-testid="kyc-dob" />
                    </div>
                    <div>
                      <Label>Government ID Type *</Label>
                      <select
                        value={ind.id_type} disabled={readOnly}
                        onChange={(e) => setInd({ ...ind, id_type: e.target.value })}
                        className="w-full h-10 px-3 border rounded-md bg-white"
                        data-testid="kyc-id-type"
                      >
                        <option value="national_id">National ID (NIN)</option>
                        <option value="drivers_license">Driver&apos;s License</option>
                        <option value="passport">International Passport</option>
                        <option value="voters_card">Voter&apos;s Card</option>
                      </select>
                    </div>
                    <div>
                      <Label>Government ID Number *</Label>
                      <Input value={ind.id_number} disabled={readOnly}
                        onChange={(e) => setInd({ ...ind, id_number: e.target.value })}
                        data-testid="kyc-id-number" />
                    </div>

                    {!readOnly && (
                      <>
                        <FileField label="Selfie Upload" required={!existing?.selfie_url}
                          onChange={handleFile(setSelfieFile)} fileName={selfieFile?.name}
                          testid="kyc-selfie" />
                        <FileField label="ID Document Upload" required={!existing?.id_doc_url}
                          onChange={handleFile(setIdDocFile)} fileName={idDocFile?.name}
                          testid="kyc-id-doc" />
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3" data-testid="kyc-business-form">
                    <div>
                      <Label>Business Name *</Label>
                      <Input value={biz.business_name} disabled={readOnly}
                        onChange={(e) => setBiz({ ...biz, business_name: e.target.value })}
                        data-testid="kyc-business-name" />
                    </div>
                    <div>
                      <Label>Registration Number *</Label>
                      <Input value={biz.registration_number} disabled={readOnly}
                        onChange={(e) => setBiz({ ...biz, registration_number: e.target.value })}
                        data-testid="kyc-reg-number" />
                    </div>
                    <div>
                      <Label>Business Address *</Label>
                      <Input value={biz.business_address} disabled={readOnly}
                        onChange={(e) => setBiz({ ...biz, business_address: e.target.value })}
                        data-testid="kyc-business-address" />
                    </div>
                    <div>
                      <Label>Contact Person *</Label>
                      <Input value={biz.contact_person} disabled={readOnly}
                        onChange={(e) => setBiz({ ...biz, contact_person: e.target.value })}
                        data-testid="kyc-contact-person" />
                    </div>
                    <div>
                      <Label>Contact Phone *</Label>
                      <Input value={biz.contact_phone} disabled={readOnly}
                        onChange={(e) => setBiz({ ...biz, contact_phone: e.target.value })}
                        data-testid="kyc-contact-phone" />
                    </div>

                    {!readOnly && (
                      <>
                        <FileField label="CAC / Business Certificate" required={!existing?.cac_doc_url}
                          onChange={handleFile(setCacFile)} fileName={cacFile?.name}
                          testid="kyc-cac" />
                        <FileField label="Business Logo" required={false}
                          onChange={handleFile(setLogoFile)} fileName={logoFile?.name}
                          testid="kyc-logo" />
                      </>
                    )}
                  </div>
                )}

                {!readOnly && (
                  <Button
                    onClick={submit}
                    disabled={submitting}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    data-testid="kyc-submit-btn"
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                    ) : (
                      status === "rejected" ? "Resubmit KYC" : "Submit KYC"
                    )}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
