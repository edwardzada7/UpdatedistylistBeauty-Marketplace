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
};

// ==================== UTILITY API ====================

export const utilityAPI = {
  testConnection: () => api.get("/test-connection"),
  getInfo: () => api.get("/"),
};

export default api;
