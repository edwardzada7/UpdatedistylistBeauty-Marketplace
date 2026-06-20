import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Phase 8 - reusable Report button + modal.
 *
 * Props:
 *   targetType: 'provider' | 'customer' | 'post' | 'review' | 'chat'
 *   targetId:   string | number (the entity being reported)
 *   label?:     optional button label override
 *   compact?:   boolean - icon-only button when true
 */

const REPORT_REASONS = [
  { value: "spam",                  label: "Spam" },
  { value: "scam_fraud",            label: "Scam / Fraud" },
  { value: "harassment",            label: "Harassment" },
  { value: "impersonation",         label: "Impersonation" },
  { value: "hate_speech",           label: "Hate Speech" },
  { value: "inappropriate_content", label: "Inappropriate Content" },
  { value: "copyright_violation",   label: "Copyright Violation" },
  { value: "fake_profile",          label: "Fake Profile" },
  { value: "other",                 label: "Other" },
];

export default function ReportButton({ targetType, targetId, label, compact = false }) {
  const navigate = useNavigate();
  const { isAuthenticated, userData, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    if (!isAuthenticated) {
      toast.info("Please log in to submit a report.");
      navigate("/login");
      return;
    }
    setReason("");
    setDescription("");
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please choose a reason");
      return;
    }
    const authId = userData?.auth_id || user?.id;
    if (!authId) {
      toast.error("Login required");
      navigate("/login");
      return;
    }
    setSubmitting(true);
    try {
      await reportsAPI.create({
        reporter_auth_id: authId,
        target_type: targetType,
        target_id: String(targetId),
        reason,
        description: description.trim() || null,
      });
      toast.success("Thanks — your report has been submitted for review.");
      setOpen(false);
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        className="text-gray-500 hover:text-red-600"
        onClick={handleOpen}
        data-testid={`report-${targetType}-btn`}
        title={`Report this ${targetType}`}
      >
        <Flag className="h-4 w-4" />
        {!compact && <span className="ml-1">{label || "Report"}</span>}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent data-testid="report-dialog">
          <DialogHeader>
            <DialogTitle>Report this {targetType}</DialogTitle>
            <DialogDescription>
              Help us keep iStylist safe. Our moderation team reviews every report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="report-reason">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="report-reason" className="mt-2" data-testid="report-reason-select">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="report-desc">Additional context (optional)</Label>
              <Textarea
                id="report-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what happened…"
                rows={4}
                maxLength={1000}
                className="mt-2"
                data-testid="report-description-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleSubmit}
              disabled={submitting || !reason}
              data-testid="report-submit-btn"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</>
              ) : (
                <><Flag className="h-4 w-4 mr-2" />Submit Report</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
