import { BadgeCheck } from "lucide-react";

/** Blue verified tick shown next to verified providers/users everywhere (same as the mobile app). */
export default function VerifiedBadge({ verified, size = 16, className = "" }) {
  if (!verified) return null;
  return (
    <BadgeCheck
      className={`inline-block flex-shrink-0 text-sky-500 ${className}`}
      style={{ width: size, height: size }}
      aria-label="Verified"
      data-testid="verified-badge"
    />
  );
}
