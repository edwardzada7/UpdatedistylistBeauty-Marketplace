// API Configuration
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

// Currency
export const CURRENCY = "₦";
export const CURRENCY_NAME = "NGN";

// Wallet
export const MIN_TOPUP_AMOUNT = 500;
export const QUICK_TOPUP_AMOUNTS = [1000, 5000, 10000, 20000];

// Stylist Filters
export const FILTER_OPTIONS = {
  ALL: "all",
  VERIFIED: "verified",
  PREMIUM: "premium",
};

export const SORT_OPTIONS = {
  RECOMMENDED: "premium",
  PRICE_LOW: "price-low",
  PRICE_HIGH: "price-high",
  HOURLY_RATE: "hourly_rate",
};

// User Roles
export const USER_ROLES = {
  CUSTOMER: "customer",
  STYLIST: "stylist",
};

// Services offered by stylists
export const STYLIST_SERVICES = [
  { name: "Hair Styling", icon: "✂️", id: "hair" },
  { name: "Makeup", icon: "💄", id: "makeup" },
  { name: "Manicure", icon: "💅", id: "manicure" },
  { name: "Pedicure", icon: "👣", id: "pedicure" },
  { name: "Braiding", icon: "🧵", id: "braiding" },
  { name: "Facial", icon: "✨", id: "facial" },
];

// App Info
export const APP_NAME = "BeautyQ";
export const APP_TAGLINE = "Find Your Perfect Stylist";

// Phase Info
export const PHASE = 1;
export const PHASE_2_FEATURES = [
  "Booking System",
  "Chat Messaging",
  "Order Management",
  "Product Marketplace",
  "Reviews & Ratings",
  "Payment Gateway",
];

// Toast Messages
export const TOAST_MESSAGES = {
  PROFILE_UPDATED: "Profile updated successfully!",
  PROFILE_UPDATE_FAILED: "Failed to update profile",
  WALLET_TOPUP_SUCCESS: "Wallet topped up successfully!",
  WALLET_TOPUP_FAILED: "Failed to top up wallet",
  BOOKING_PHASE_2: "Booking feature coming in Phase 2!",
  LOAD_FAILED: "Failed to load data. Please try again.",
};

// Breakpoints (Tailwind)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
};
