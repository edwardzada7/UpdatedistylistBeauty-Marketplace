import api from "@/services/api";

const adminHeaders = (adminKey) => ({ headers: { "X-ADMIN-KEY": adminKey } });
const scannerHeaders = ({ scannerCode, adminKey }) => ({
  headers: scannerCode ? { "X-SCANNER-CODE": scannerCode } : { "X-ADMIN-KEY": adminKey },
});

export const eventsAPI = {
  list: async (includePast = false) => (await api.get("/events", { params: { include_past: includePast } })).data.events || [],
  get: async (id) => (await api.get(`/events/${id}`)).data,
  quote: async (id, ticketTypeId, quantity) => (await api.get(`/events/${id}/quote`, { params: { ticket_type_id: ticketTypeId, quantity } })).data,
  checkout: async (id, body) => (await api.post(`/events/${id}/checkout`, body)).data,
  verify: async (reference) => (await api.get("/events/orders/verify", { params: { reference } })).data,
  guestCheckout: async (id, body) => (await api.post(`/events/${id}/guest-checkout`, body)).data,
  guestVerify: async (reference, token) => (await api.get("/events/guest/verify", { params: { reference, t: token } })).data,
  guestTickets: async (reference, token) => (await api.get("/events/guest/tickets", { params: { reference, t: token } })).data.tickets || [],
  myTickets: async () => (await api.get("/events/my-tickets")).data.tickets || [],
};

export const adminEventsAPI = {
  list: async (adminKey) => (await api.get("/admin/events", adminHeaders(adminKey))).data,
  create: async (adminKey, body) => (await api.post("/admin/events", body, adminHeaders(adminKey))).data,
  update: async (adminKey, id, body) => (await api.put(`/admin/events/${id}`, body, adminHeaders(adminKey))).data,
  cancel: async (adminKey, id) => (await api.post(`/admin/events/${id}/cancel`, {}, adminHeaders(adminKey))).data,
  attendees: async (adminKey, id) => (await api.get(`/admin/events/${id}/attendees`, adminHeaders(adminKey))).data.attendees || [],
  saveSettings: async (adminKey, body) => (await api.put("/admin/events-settings", body, adminHeaders(adminKey))).data,
  scanners: async (adminKey, id) => (await api.get(`/admin/events/${id}/scanners`, adminHeaders(adminKey))).data.scanners || [],
  addScanner: async (adminKey, id, label) => (await api.post(`/admin/events/${id}/scanners`, { label }, adminHeaders(adminKey))).data,
  deleteScanner: async (adminKey, id, scannerId) => (await api.delete(`/admin/events/${id}/scanners/${scannerId}`, adminHeaders(adminKey))).data,
  upload: async (adminKey, payload) => (await api.post("/admin/official/upload", payload, adminHeaders(adminKey))).data,
};

export const providerEventsAPI = {
  mine: async () => (await api.get("/provider/events")).data,
  create: async (body) => (await api.post("/provider/events", body)).data,
  update: async (id, body) => (await api.put(`/provider/events/${id}`, body)).data,
  cancel: async (id) => (await api.post(`/provider/events/${id}/cancel`, {})).data,
  attendees: async (id) => (await api.get(`/provider/events/${id}/attendees`)).data.attendees || [],
  scanners: async (id) => (await api.get(`/provider/events/${id}/scanners`)).data.scanners || [],
  addScanner: async (id, label) => (await api.post(`/provider/events/${id}/scanners`, { label })).data,
  deleteScanner: async (id, scannerId) => (await api.delete(`/provider/events/${id}/scanners/${scannerId}`)).data,
  promote: async (id, body) => (await api.post(`/provider/events/${id}/promote`, body)).data,
  verifyPromo: async (reference) => (await api.get("/provider/events/promote/verify", { params: { reference } })).data,
};

Object.assign(adminEventsAPI, {
  approve: async (adminKey, id) => (await api.post(`/admin/events/${id}/approve`, {}, adminHeaders(adminKey))).data,
  reject: async (adminKey, id, reason) => (await api.post(`/admin/events/${id}/reject`, { reason }, adminHeaders(adminKey))).data,
  payouts: async (adminKey) => (await api.get("/admin/event-payouts", adminHeaders(adminKey))).data.payouts || [],
  markPaid: async (adminKey, id) => (await api.post(`/admin/event-payouts/${id}/mark-paid`, {}, adminHeaders(adminKey))).data,
  tiers: async (adminKey) => (await api.get("/admin/event-promo-tiers", adminHeaders(adminKey))).data.tiers || [],
  saveTiers: async (adminKey, tiers) => (await api.put("/admin/event-promo-tiers", { tiers }, adminHeaders(adminKey))).data,
});

export const scannerAPI = {
  login: async (accessCode) => (await api.post("/events/scanner/login", { access_code: accessCode })).data,
  scan: async (creds, code, eventId) => (await api.post("/events/scanner/scan", { code, event_id: eventId || null }, scannerHeaders(creds))).data,
};

export const formatEventDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

export const EVENT_CATEGORIES = [
  { key: "masterclass", label: "Masterclass & Workshop" },
  { key: "beauty_show", label: "Beauty & Hair Show" },
  { key: "fashion_show", label: "Fashion Show" },
  { key: "bridal", label: "Bridal & Wedding" },
  { key: "popup_market", label: "Pop-up & Market" },
  { key: "product_launch", label: "Product Launch" },
  { key: "party", label: "Party & Social" },
  { key: "networking", label: "Networking & Meetup" },
  { key: "training", label: "Training & Certification" },
  { key: "photoshoot", label: "Photoshoot & Creative" },
  { key: "cultural", label: "Cultural & Festival" },
  { key: "charity", label: "Charity & Community" },
  { key: "other", label: "Other" },
];
