import { Crown } from "lucide-react";

/** Small "Pro" pill for providers with an active iStylist Pro plan. */
export default function ProBadge({ pro, size = "sm", className = "" }) {
  if (!pro) return null;
  const compact = size === "sm";
  return (
    <span
      data-testid="pro-badge"
      aria-label="iStylist Pro"
      className={`inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold align-middle ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${className}`}
    >
      <Crown className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      PRO
    </span>
  );
}
