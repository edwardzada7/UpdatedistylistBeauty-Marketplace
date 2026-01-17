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
  getTransactions: (authId, limit = 50) => api.get(`/wallet/transactions?auth_id=${authId}&limit=${limit}`),
};

// ==================== PAYMENTS API (Phase 2.2 - Paystack) ====================

export const paymentsAPI = {
  // Initialize a Paystack payment
  initialize: (data) => api.post("/payments/paystack/initialize", data),
  
  // Verify a payment by reference
  verify: (reference) => api.get(`/payments/paystack/verify?reference=${reference}`),
};

// ==================== UTILITY API ====================

export const utilityAPI = {
  testConnection: () => api.get("/test-connection"),
  getInfo: () => api.get("/"),
};

export default api;
