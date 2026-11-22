// Shared profile helpers so photos, verified status and locations look the same everywhere
// (and match the mobile app).

const AVATAR_COLORS = ["#7c5cfc", "#f43fa5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

/** First usable photo URL from any of the shapes the API/Supabase return. */
export const avatarOf = (p) =>
  (p &&
    (p.avatarUrl ||
      p.avatar_url ||
      p.profile_image_url ||
      p.profileImage ||
      p.profile_image ||
      p.provider_image_url ||
      p.photo_url ||
      p.avatar ||
      p.user?.profile_image_url ||
      p.user?.avatarUrl)) ||
  null;

export const isVerifiedProfile = (p) =>
  !!p &&
  (p.is_verified === true ||
    p.isVerified === true ||
    p.isKycVerified === true ||
    p.verified === true ||
    p.kyc_status === "verified");

/** Location text, or null when it is empty / "not set". */
export const locationOf = (p) => {
  const loc = p && (p.location || p.location_address || p.city);
  return typeof loc === "string" && loc.trim() && !/not set/i.test(loc) ? loc.trim() : null;
};

export const initialsOf = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w));
  if (!parts.length) return "";
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
};

export const avatarColorFor = (name) => {
  let hash = 0;
  for (const ch of String(name || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};
