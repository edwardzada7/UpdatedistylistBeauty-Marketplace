const KEY = "POST_LOGIN_RETURN_TO";

/** Remember where a signed-out visitor was heading (e.g. an event page) so login can send them back. */
export const setReturnTo = (path) => {
  try { sessionStorage.setItem(KEY, path); } catch (_) { /* storage blocked */ }
};

export const takeReturnTo = () => {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && path.startsWith("/") ? path : null;
  } catch (_) {
    return null;
  }
};
