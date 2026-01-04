// API Configuration
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

// App Branding
export const APP_NAME = "iStylist";
export const APP_TAGLINE = "Book Beauty, Fashion & Event Services";

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

// Service Categories with full structure
export const SERVICE_CATEGORIES = [
  {
    id: "beauty-grooming",
    name: "Beauty & Grooming",
    icon: "✨",
    color: "from-pink-500 to-rose-500",
    services: [
      { id: "barbers", name: "Barbers", icon: "✂️" },
      { id: "braid-groomers", name: "Braid Groomers", icon: "🧵" },
      { id: "dreadlocks", name: "Dreadlocks", icon: "🔒" },
      { id: "hairdressers", name: "Hairdressers", icon: "💇" },
      { id: "wig-specialists", name: "Wig Specialists", icon: "👩" },
      { id: "makeup-artists", name: "Makeup Artists", icon: "💄" },
      { id: "nail-technicians", name: "Nail Technicians", icon: "💅" },
      { id: "manicure-pedicure", name: "Manicure & Pedicure", icon: "🦶" },
      { id: "eyelash-technicians", name: "Eyelash Technicians", icon: "👁️" },
      { id: "facials", name: "Facials (Estheticians)", icon: "🧖" },
      { id: "cosmetologists", name: "Cosmetologists", icon: "🌸" },
    ],
  },
  {
    id: "body-aesthetics",
    name: "Body & Aesthetics",
    icon: "💎",
    color: "from-purple-500 to-indigo-500",
    notice: "Verified & Regulated Providers Only",
    services: [
      { id: "non-surgical-aesthetics", name: "Non-Surgical Aesthetics", icon: "💉" },
      { id: "body-enhancement", name: "Non-Surgical Body Enhancement", icon: "✨" },
      { id: "teeth-whitening", name: "Teeth Whitening", icon: "🦷" },
      { id: "tattoo-removal", name: "Tattoo Removal", icon: "🔫" },
      { id: "hair-transplant", name: "Hair Transplant", icon: "🧑" },
      { id: "surgical-enhancement", name: "Surgical / Medical Body Enhancement", icon: "🏥" },
    ],
  },
  {
    id: "wellness-care",
    name: "Wellness & Care",
    icon: "🧘",
    color: "from-green-500 to-teal-500",
    services: [
      { id: "spa-services", name: "Spa Services", icon: "🧖‍♀️" },
      { id: "massage-therapy", name: "Massage Therapy", icon: "💆" },
      { id: "body-therapy", name: "Body Therapy", icon: "🌿" },
      { id: "wellness-treatments", name: "Wellness Treatments", icon: "🍃" },
      { id: "relaxation-recovery", name: "Relaxation & Recovery", icon: "😌" },
    ],
  },
  {
    id: "fashion-bridal",
    name: "Fashion & Bridal",
    icon: "👗",
    color: "from-amber-500 to-orange-500",
    services: [
      { id: "fashion-designers", name: "Fashion Designers", icon: "🎨" },
      { id: "bridal-designers", name: "Bridal Designers", icon: "👰" },
      { id: "models", name: "Models", icon: "🚶" },
    ],
  },
  {
    id: "events-entertainment",
    name: "Events & Entertainment",
    icon: "🎉",
    color: "from-blue-500 to-cyan-500",
    services: [
      { id: "event-planners", name: "Event Planners", icon: "📋" },
      { id: "mcs", name: "MCs", icon: "🎤" },
      { id: "djs", name: "DJs", icon: "🎧" },
      { id: "hype-men", name: "Hype Men", icon: "📢" },
      { id: "artists-performers", name: "Artists / Performers", icon: "🎭" },
      { id: "food-vendors", name: "Food Vendors", icon: "🍽️" },
    ],
  },
  {
    id: "classes-learning",
    name: "Classes & Learning",
    icon: "📚",
    color: "from-violet-500 to-purple-500",
    services: [
      { id: "beauty-classes", name: "Beauty Classes", icon: "🎓" },
    ],
  },
];

// Legacy services for backward compatibility
export const STYLIST_SERVICES = SERVICE_CATEGORIES.flatMap(cat => 
  cat.services.map(s => ({ ...s, category: cat.id }))
);

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
