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

export const scannerAPI = {
  login: async (accessCode) => (await api.post("/events/scanner/login", { access_code: accessCode })).data,
  scan: async (creds, code, eventId) => (await api.post("/events/scanner/scan", { code, event_id: eventId || null }, scannerHeaders(creds))).data,
};

export const formatEventDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};
