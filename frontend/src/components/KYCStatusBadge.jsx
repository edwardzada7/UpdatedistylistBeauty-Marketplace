import React from "react";
import { Shield, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

/**
 * Phase 5 - KYC Status Badge
 * Displays the four KYC states with consistent color + icon.
 */
const STATUS_CONFIG = {
  not_submitted: {
    label: "Not Submitted",
    color: "bg-gray-100 text-gray-700 border-gray-300",
    Icon: ShieldQuestion,
  },
  pending: {
    label: "Pending Review",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    Icon: Shield,
  },
  verified: {
    label: "Verified",
    color: "bg-green-100 text-green-700 border-green-300",
    Icon: ShieldCheck,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-700 border-red-300",
    Icon: ShieldAlert,
  },
};

export default function KYCStatusBadge({ status, className = "" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_submitted;
  const { Icon } = cfg;
  return (
    <span
      data-testid={`kyc-badge-${status || "not_submitted"}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}
