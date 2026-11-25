const KEY = "GUEST_TICKET_ORDERS";

/** Guest ticket orders are remembered on this device so the buyer can reopen tickets without an account. */
export const getGuestOrders = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) { return []; }
};

export const saveGuestOrder = (order) => {
  try {
    const list = getGuestOrders().filter((o) => o.reference !== order.reference);
    localStorage.setItem(KEY, JSON.stringify([order, ...list].slice(0, 20)));
  } catch (_) { /* storage blocked */ }
};
