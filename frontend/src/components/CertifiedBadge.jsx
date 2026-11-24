import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import api from "@/services/api";

/** "Certified" pill for providers whose professional certificate has been approved. */
export default function CertifiedBadge({ certified, size = "sm", className = "" }) {
  if (!certified) return null;
  const compact = size === "sm";
  return (
    <span
      data-testid="certified-badge"
      aria-label="Certified professional"
      className={`inline-flex items-center gap-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 font-semibold align-middle ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${className}`}
    >
      <BadgeCheck className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      Certified
    </span>
  );
}

/** Whether the signed-in provider has an approved, unexpired certificate. */
export function useOwnCertified(authId, enabled = true) {
  const [certified, setCertified] = useState(false);
  useEffect(() => {
    if (!authId || !enabled) return undefined;
    let cancelled = false;
    api
      .get(`/providers/${authId}/certification`)
      .then((res) => {
        const c = res.data?.certification;
        const approved = c && (c.status === "approved" || c.verification_status === "approved") && c.is_active !== false;
        const exp = c?.expiry_date || c?.expires_at;
        const expired = exp && new Date(exp) < new Date(new Date().toDateString());
        if (!cancelled) setCertified(!!approved && !expired);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authId, enabled]);
  return certified;
}
