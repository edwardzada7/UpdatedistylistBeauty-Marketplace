const ORDERS_KEY = "GUEST_SHOP_ORDERS";
const POPUP_KEY = "GUEST_SHOP_CHOICE";
const PENDING_KEY = "istylist_pending_guest_shop_order";

export const getGuestShopOrders = () => {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); } catch (_) { return []; }
};

export const saveGuestShopOrder = (order) => {
  try {
    const list = getGuestShopOrders().filter((o) => o.orderId !== order.orderId);
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...list].slice(0, 20)));
  } catch (_) { /* storage blocked */ }
};

/** Popup is shown once per visit (tab session). */
export const guestChoiceMade = () => {
  try { return sessionStorage.getItem(POPUP_KEY) === "1"; } catch (_) { return false; }
};
export const rememberGuestChoice = () => {
  try { sessionStorage.setItem(POPUP_KEY, "1"); } catch (_) { /* ignore */ }
};

export const setPendingGuestOrder = (v) => {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(v)); } catch (_) { /* ignore */ }
};
export const getPendingGuestOrder = () => {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); } catch (_) { return null; }
};
export const clearPendingGuestOrder = () => {
  try { localStorage.removeItem(PENDING_KEY); } catch (_) { /* ignore */ }
};
