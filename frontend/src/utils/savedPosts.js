// Saved posts live on this device (no account sync yet).
const KEY = "istylist_saved_posts";

export const getSavedPostIds = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

/** Toggles a post and returns the new saved state. */
export const toggleSavedPost = (id) => {
  const ids = getSavedPostIds();
  const key = String(id);
  const next = ids.includes(key) ? ids.filter((x) => x !== key) : [key, ...ids];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the tap just won't stick */
  }
  return next.includes(key);
};
