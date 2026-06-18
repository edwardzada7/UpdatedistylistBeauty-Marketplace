/**
 * Format a Date/timestamp as a short relative string:
 *   "Just now", "2m ago", "1h ago", "3d ago", "Mar 12".
 *
 * Phase 4 helper, used by FeedScreen and PostCard.
 */
export function timeAgoShort(input) {
  if (!input) return "";
  // Defensive UTC parsing: legacy timestamps from the backend may lack a
  // timezone marker. JS treats naive ISO strings as LOCAL, which created
  // a 1-hour offset for WAT users. Append 'Z' if no offset is present.
  let normalized = input;
  if (typeof input === "string" && !/Z$|[+-]\d{2}:?\d{2}$/.test(input)) {
    normalized = input + "Z";
  }
  const d = normalized instanceof Date ? normalized : new Date(normalized);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "Just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  // Older posts: just a short date
  try {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}
