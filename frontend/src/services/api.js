import axios from "axios";
import { API_BASE } from "@/utils/constants";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for auth (Phase 2)
api.interceptors.request.use(
  (config) => {
    // In Phase 2, add auth token here
    // const token = localStorage.getItem('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized (Phase 2)
      console.log("Unauthorized access");
    }
    return Promise.reject(error);
  }
);

// ==================== USERS API ====================

export const usersAPI = {
  getAll: () => api.get("/users"),
  getById: (id) => api.get(`/users/${id}`),
  getByAuthId: (authId) => api.get(`/users/by-auth/${authId}`),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  // Phase 6 - Soft-delete the authenticated user's account
  deleteAccount: (authId, confirmationPhrase) =>
    api.post(`/users/delete-account`, {
      auth_id: authId,
      confirmation_phrase: confirmationPhrase,
    }),
};

// ==================== STYLISTS API ====================

export const stylistsAPI = {
  getAll: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.verifiedOnly) queryParams.append("verified_only", "true");
    if (params.premiumOnly) queryParams.append("premium_only", "true");
    if (params.sortBy) queryParams.append("sort_by", params.sortBy);
    
    return api.get(`/stylists${queryParams.toString() ? `?${queryParams}` : ""}`);
  },
  getById: (userId) => api.get(`/stylists/${userId}`),
  create: (data) => api.post("/stylists", data),
  update: (userId, data) => api.put(`/stylists/${userId}`, data),
  delete: (userId) => api.delete(`/stylists/${userId}`),
  // Register a user as provider
  register: (userId, hourlyRate = 0, bio = null, location = null) => 
    api.post(`/providers/register?user_id=${userId}&hourly_rate=${hourlyRate}${bio ? `&bio=${encodeURIComponent(bio)}` : ''}${location ? `&location=${encodeURIComponent(location)}` : ''}`),
};

// ==================== PROVIDER SERVICES API (Enhanced Phase 1.3) ====================

export const providerServicesAPI = {
  // Get all services for a provider
  getByProviderId: (providerId, activeOnly = false) => 
    api.get(`/provider-services/${providerId}${activeOnly ? '?active_only=true' : ''}`),
  
  // Create/update a single service
  create: (data) => api.post("/provider-services", data),
  
  // Update a specific service
  update: (serviceId, data) => api.put(`/provider-services/${serviceId}`, data),
  
  // Bulk toggle services for a provider
  toggleServices: (providerId, services) => 
    api.post(`/provider-services/toggle/${providerId}`, { services }),
  
  // Delete a service
  delete: (serviceId) => api.delete(`/provider-services/${serviceId}`),
};

// ==================== SERVICE CATALOG API ====================

export const catalogAPI = {
  // Get all service categories
  getCategories: () => api.get("/catalog/categories"),
  
  // Get a specific category with services
  getCategory: (categoryId) => api.get(`/catalog/categories/${categoryId}`),
  
  // Get all services (parent-level)
  getServices: () => api.get("/catalog/services"),
  
  // Get a specific service with sub-services
  getService: (serviceId) => api.get(`/catalog/services/${serviceId}`),
  
  // Get all sub-services (flat list)
  getAllSubServices: () => api.get("/catalog/sub-services"),
  
  // Get sub-services by parent service
  getSubServicesByService: (serviceId) => api.get(`/catalog/sub-services/${serviceId}`),
};

// ==================== PROVIDERS API (Phase 1.4) ====================

export const providersAPI = {
  // Get providers with active services (for user browsing)
  getWithServices: (filters = {}) => {
    const queryParams = new URLSearchParams();
    if (filters.categoryId) queryParams.append("category_id", filters.categoryId);
    if (filters.serviceId) queryParams.append("service_id", filters.serviceId);
    if (filters.city) queryParams.append("city", filters.city);
    if (filters.minPrice) queryParams.append("min_price", filters.minPrice);
    if (filters.maxPrice) queryParams.append("max_price", filters.maxPrice);
    
    return api.get(`/providers/with-services${queryParams.toString() ? `?${queryParams}` : ""}`);
  },
  
  // Get full provider profile for booking
  getFullProfile: (providerId) => api.get(`/providers/${providerId}/full-profile`),
  
  // Register as provider
  register: (userId, hourlyRate = 0, bio = null, location = null) => 
    api.post(`/providers/register?user_id=${userId}&hourly_rate=${hourlyRate}${bio ? `&bio=${encodeURIComponent(bio)}` : ''}${location ? `&location=${encodeURIComponent(location)}` : ''}`),
  
  // ==================== AVAILABILITY API (Phase 2.1) ====================
  
  // Get provider availability (weekly, exceptions, rules)
  getAvailability: (providerId) => api.get(`/providers/${providerId}/availability`),
  
  // Set weekly availability
  setWeeklyAvailability: (providerId, weekly) => 
    api.post(`/providers/${providerId}/availability`, { weekly }),
  
  // Set exceptions
  setExceptions: (providerId, exceptions) => 
    api.post(`/providers/${providerId}/exceptions`, { exceptions }),
  
  // Set booking rules
  setRules: (providerId, rules) => 
    api.post(`/providers/${providerId}/rules`, rules),
  
  // Get available slots for a date
  getAvailableSlots: (providerId, date, serviceDuration) => 
    api.get(`/providers/${providerId}/available-slots?date=${date}&service_duration=${serviceDuration}`),
  
  // Get provider dashboard metrics (wallet balances, earnings, transactions)
  getDashboardMetrics: (authId) => 
    api.get(`/providers/dashboard-metrics?auth_id=${authId}`),
};

// ==================== BOOKINGS API (Phase 2.1 + 2.2 + 2.3) ====================

export const bookingsAPI = {
  // Create a booking - now accepts customer_auth_id (UUID)
  create: (data) => api.post("/bookings", data),
  
  // Get bookings with filters (enhanced for Phase 2.2)
  list: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.role) queryParams.append("role", params.role);
    if (params.authId) queryParams.append("auth_id", params.authId);
    if (params.providerId) queryParams.append("provider_id", params.providerId);
    if (params.customerId) queryParams.append("customer_id", params.customerId);
    if (params.status) queryParams.append("status", params.status);
    if (params.date) queryParams.append("date", params.date);
    if (params.dateFrom) queryParams.append("date_from", params.dateFrom);
    if (params.dateTo) queryParams.append("date_to", params.dateTo);
    return api.get(`/bookings${queryParams.toString() ? `?${queryParams}` : ""}`);
  },
  
  // Legacy method for backward compatibility
  getAll: (filters = {}) => {
    const queryParams = new URLSearchParams();
    if (filters.providerId) queryParams.append("provider_id", filters.providerId);
    if (filters.customerId) queryParams.append("customer_id", filters.customerId);
    if (filters.status) queryParams.append("status", filters.status);
    if (filters.date) queryParams.append("date", filters.date);
    return api.get(`/bookings${queryParams.toString() ? `?${queryParams}` : ""}`);
  },
  
  // Get a single booking with full details
  getById: (bookingId, role = null) => {
    const queryParams = new URLSearchParams();
    if (role) queryParams.append("role", role);
    return api.get(`/bookings/${bookingId}${queryParams.toString() ? `?${queryParams}` : ""}`);
  },
  
  // Update booking status with role validation
  updateStatus: (bookingId, status, role = null, authId = null) => {
    const queryParams = new URLSearchParams();
    queryParams.append("status", status);
    if (role) queryParams.append("role", role);
    if (authId) queryParams.append("auth_id", authId);
    return api.put(`/bookings/${bookingId}?${queryParams}`);
  },
  
  // Get provider metrics (booking counts)
  getProviderMetrics: (authId) => api.get(`/providers/metrics?auth_id=${authId}`),
  
  // ==================== BOOKING CHAT API (Phase 2C) ====================
  
  // Get chat messages for a booking
  getChat: (bookingId, authId, limit = 50, offset = 0) => 
    api.get(`/bookings/${bookingId}/chat?auth_id=${authId}&limit=${limit}&offset=${offset}`),
  
  // Send a chat message
  sendChatMessage: (bookingId, authId, message) => 
    api.post(`/bookings/${bookingId}/chat`, { auth_id: authId, message }),
  
  // Mark chat messages as read
  markChatRead: (bookingId, authId) => 
    api.post(`/bookings/${bookingId}/chat/mark-read`, { auth_id: authId }),

  // ==================== NO-SHOW HYBRID FLOW ====================
  reportNoShow: (bookingId, authId, reason = null) =>
    api.post(`/bookings/${bookingId}/no-show/report`, { auth_id: authId, reason }),

  confirmNoShow: (bookingId, authId) =>
    api.post(`/bookings/${bookingId}/no-show/confirm`, { auth_id: authId }),

  disputeNoShow: (bookingId, authId, reason = null) =>
    api.post(`/bookings/${bookingId}/no-show/dispute`, { auth_id: authId, reason }),
};

// ==================== WALLETS API ====================

export const walletsAPI = {
  getAll: () => api.get("/wallets"),
  getById: (id) => api.get(`/wallets/${id}`),
  getByAuthId: (authId) => api.get(`/wallets/by-auth/${authId}`),
  create: (data) => api.post("/wallets", data),
  update: (id, data) => api.put(`/wallets/${id}`, data),
  topUp: (id, amount) => api.post(`/wallets/${id}/topup?amount=${amount}`),
  delete: (id) => api.delete(`/wallets/${id}`),
  // Phase 2.2 - Enhanced wallet endpoints
  getMyWallet: (authId) => api.get(`/wallet/me?auth_id=${authId}`),
  getTransactions: (authId, limit = 50, category = null) => {
    const qp = new URLSearchParams();
    qp.append("auth_id", authId);
    qp.append("limit", String(limit));
    if (category) qp.append("category", category);
    return api.get(`/wallet/transactions?${qp.toString()}`);
  },
  // Diagnostic: compare stored balance vs computed-from-transactions
  getMyWalletComputed: (authId) => api.get(`/wallet/me/computed?auth_id=${authId}`),
};

// ==================== WITHDRAWALS API (Phase A) ====================

export const withdrawalsAPI = {
  // Request a withdrawal
  request: (authId, data) => api.post(`/withdrawals/request?auth_id=${authId}`, data),
  
  // Get my withdrawal requests
  getMyRequests: (authId, limit = 50) => 
    api.get(`/withdrawals/me?auth_id=${authId}&limit=${limit}`),
};

// ==================== PAYMENTS API (Flutterwave for wallet top-up only) ====================
// Note: Paystack endpoints (/payments/paystack/initialize, /payments/paystack/verify)
// remain available on the backend as a dormant fallback. To roll back, change the
// two URLs below from /flutterwave/ to /paystack/ - no other change required.

export const paymentsAPI = {
  // Initialize a Flutterwave payment (ONLY for wallet top-up).
  // `data` shape: { amount, email, purpose: "wallet_topup", name?, phone?, redirect_url? }
  initialize: (data) => api.post("/payments/flutterwave/initialize", data),

  // Verify a payment by reference (our tx_ref).
  // Optionally accepts transactionId (Flutterwave's numeric id, also passed back
  // in the redirect query string as `transaction_id`).
  verify: (reference, transactionId = null) => {
    const qs = new URLSearchParams({ reference: reference || "" });
    if (transactionId) qs.set("transaction_id", transactionId);
    return api.get(`/payments/flutterwave/verify?${qs.toString()}`);
  },

  // Pay for a booking using wallet balance (wallet-based payment - unchanged)
  payWithWallet: (bookingId, authId) =>
    api.post(`/bookings/${bookingId}/pay-with-wallet?auth_id=${authId}`),
};

// ==================== NOTIFICATIONS API (Phase 2B) ====================

export const notificationsAPI = {
  // Get user's notifications
  getAll: (authId, unreadOnly = false, limit = 50, offset = 0) => 
    api.get(`/notifications/me?auth_id=${authId}&unread_only=${unreadOnly}&limit=${limit}&offset=${offset}`),
  
  // Get unread count
  getUnreadCount: (authId) => api.get(`/notifications/unread-count?auth_id=${authId}`),
  
  // Mark notifications as read
  markRead: (authId, ids) => api.post("/notifications/mark-read", { auth_id: authId, notification_ids: ids }),
  
  // Mark all as read
  markAllRead: (authId) => api.post("/notifications/mark-read", { auth_id: authId, mark_all: true }),
};

// ==================== CHAT API (Phase 2C) ====================

export const chatAPI = {
  // Get total unread chat count across all bookings
  getUnreadCount: (authId) => api.get(`/chat/unread-count?auth_id=${authId}`),
};

// ==================== REVIEWS API (Phase 3) ====================

export const reviewsAPI = {
  // Create a review for a booking
  create: (authId, data) => api.post(`/reviews?auth_id=${authId}`, data),
  
  // Get reviews for a provider with aggregates
  getProviderReviews: (providerAuthId, limit = 20, offset = 0) => 
    api.get(`/providers/${providerAuthId}/reviews?limit=${limit}&offset=${offset}`),
  
  // Get my reviews (as customer or provider)
  getMyReviews: (authId, role, limit = 50, offset = 0) => 
    api.get(`/reviews/me?auth_id=${authId}&role=${role}&limit=${limit}&offset=${offset}`),
  
  // Get review for a specific booking
  getByBooking: (bookingId, authId) => 
    api.get(`/reviews/by-booking/${bookingId}?auth_id=${authId}`),
  
  // Provider reply to a review
  reply: (reviewId, authId, data) => 
    api.post(`/reviews/${reviewId}/reply?auth_id=${authId}`, data),
};

// ==================== UTILITY API ====================

export const utilityAPI = {
  testConnection: () => api.get("/test-connection"),
  getInfo: () => api.get("/"),
};

// ==================== FEED API (Phase 4 - Social Feed Lite) ====================

export const feedAPI = {
  // Public listing (newest first). authId optional → enables liked_by_me flag.
  list: (authId, limit = 20, offset = 0) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (authId) qs.append("auth_id", authId);
    return api.get(`/feed/posts?${qs.toString()}`);
  },

  // Posts for a single provider (for portfolio section)
  listByProvider: (providerId, authId, limit = 20, offset = 0) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (authId) qs.append("auth_id", authId);
    return api.get(`/feed/posts/by-provider/${providerId}?${qs.toString()}`);
  },

  get: (postId, authId) =>
    api.get(`/feed/posts/${postId}${authId ? `?auth_id=${authId}` : ""}`),

  // Provider creates a post (image_url + optional caption)
  create: (authId, data) => api.post(`/feed/posts?auth_id=${authId}`, data),

  // Owner updates caption / soft-deletes
  update: (postId, authId, data) =>
    api.put(`/feed/posts/${postId}?auth_id=${authId}`, data),

  remove: (postId, authId, hard = false) =>
    api.delete(`/feed/posts/${postId}?auth_id=${authId}&hard=${hard}`),

  like: (postId, authId) =>
    api.post(`/feed/posts/${postId}/like?auth_id=${authId}`),

  unlike: (postId, authId) =>
    api.delete(`/feed/posts/${postId}/like?auth_id=${authId}`),
};

// ==================== ADMIN API (Phase 4 - Admin Dashboard) ====================
// All requests must include `X-ADMIN-KEY` header (read from sessionStorage in
// admin screens). We pass headers per-call so we never mutate the global axios.

const withAdminKey = (adminKey) => ({
  headers: { "X-ADMIN-KEY": adminKey },
});

export const adminAPI = {
  stats: (adminKey) => api.get("/admin/stats", withAdminKey(adminKey)),
  recentBookings: (adminKey, limit = 20, statusFilter = null) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (statusFilter) qs.append("status", statusFilter);
    return api.get(`/admin/recent-bookings?${qs.toString()}`, withAdminKey(adminKey));
  },
  recentPayments: (adminKey, limit = 20) =>
    api.get(`/admin/recent-payments?limit=${limit}`, withAdminKey(adminKey)),
  reportedNoShows: (adminKey, limit = 20) =>
    api.get(`/admin/reported-no-shows?limit=${limit}`, withAdminKey(adminKey)),
  providers: (adminKey, limit = 50, offset = 0, search = "") => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) qs.append("search", search);
    return api.get(`/admin/providers?${qs.toString()}`, withAdminKey(adminKey));
  },
  // Existing endpoint (kept for reuse from the new dashboard)
  withdrawals: (adminKey, statusFilter = null, limit = 50, offset = 0) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (statusFilter) qs.append("status", statusFilter);
    return api.get(`/admin/withdrawals?${qs.toString()}`, withAdminKey(adminKey));
  },
  // Phase 6 - list soft-deleted users
  deletedUsers: (adminKey, limit = 100, offset = 0) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return api.get(`/admin/users/deleted?${qs.toString()}`, withAdminKey(adminKey));
  },
};

// ==================== STAFF API (Phase 4 - Multi-Staff) ====================

export const staffAPI = {
  // Owner-side
  listMine: (authId, includeInactive = true) =>
    api.get(`/staff/me?auth_id=${authId}&include_inactive=${includeInactive}`),
  create: (authId, data) => api.post(`/staff?auth_id=${authId}`, data),
  update: (staffId, authId, data) => api.put(`/staff/${staffId}?auth_id=${authId}`, data),
  remove: (staffId, authId, hard = false) =>
    api.delete(`/staff/${staffId}?auth_id=${authId}&hard=${hard}`),
  setServices: (staffId, authId, serviceIds) =>
    api.put(`/staff/${staffId}/services?auth_id=${authId}`, { service_ids: serviceIds }),
  setAvailability: (staffId, authId, weekly) =>
    api.put(`/staff/${staffId}/availability?auth_id=${authId}`, { weekly }),
  // Detail (used by both owner UI and customer profile)
  get: (staffId) => api.get(`/staff/${staffId}`),
  // Public-facing
  listForProvider: (providerId, activeOnly = true) =>
    api.get(`/providers/${providerId}/staff?active_only=${activeOnly}`),
  getStaffSlots: (staffId, date, serviceDuration) =>
    api.get(`/staff/${staffId}/available-slots?date=${date}&service_duration=${serviceDuration}`),
};

// ==================== PHASE 5 - KYC API ====================

export const kycAPI = {
  // User-facing
  submit: (payload) => api.post(`/kyc/submit`, payload),
  getMe: (authId) => api.get(`/kyc/me?auth_id=${encodeURIComponent(authId)}`),

  // Admin-facing (caller must pass adminKey via headers)
  listAdmin: (adminKey, statusFilter) => {
    const qs = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : "";
    return api.get(`/admin/kyc${qs}`, { headers: { "X-ADMIN-KEY": adminKey } });
  },
  review: (adminKey, submissionId, action, rejectionReason, reviewerAuthId) =>
    api.put(
      `/admin/kyc/${submissionId}`,
      { action, rejection_reason: rejectionReason || null, reviewer_auth_id: reviewerAuthId || null },
      { headers: { "X-ADMIN-KEY": adminKey } }
    ),
};

export default api;
