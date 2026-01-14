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
  USER: "user",
  PROVIDER: "provider",
  CUSTOMER: "customer",
  STYLIST: "stylist",
};

// Service Modes
export const SERVICE_MODES = {
  IN_STORE: "in_store",
  HOME_SERVICE: "home_service",
  TRAVEL_SERVICE: "travel_service",
};

// ==================== COMPREHENSIVE SERVICE CATALOG ====================

export const SERVICE_CATALOG = {
  "beauty-grooming": {
    id: "beauty-grooming",
    name: "Beauty & Grooming",
    icon: "✨",
    color: "from-pink-500 to-rose-500",
    services: {
      "barbers": {
        id: "barbers",
        name: "Barbers",
        icon: "✂️",
        subServices: [
          { id: "haircut", name: "Haircut", defaultDuration: 30, defaultPrice: 2000 },
          { id: "beard-trim", name: "Beard Trim", defaultDuration: 15, defaultPrice: 1000 },
          { id: "hair-shave", name: "Hair Shave", defaultDuration: 20, defaultPrice: 1500 },
          { id: "line-up-shape-up", name: "Line Up / Shape Up", defaultDuration: 15, defaultPrice: 1000 },
          { id: "hair-coloring-highlights", name: "Hair Coloring / Highlights", defaultDuration: 60, defaultPrice: 5000 },
          { id: "kids-haircut", name: "Kids' Haircut", defaultDuration: 20, defaultPrice: 1500 },
        ]
      },
      "hair-braiders": {
        id: "hair-braiders",
        name: "Hair Braiders",
        icon: "🧵",
        subServices: [
          { id: "box-braids", name: "Box Braids", defaultDuration: 240, defaultPrice: 15000 },
          { id: "cornrows", name: "Cornrows", defaultDuration: 120, defaultPrice: 8000 },
          { id: "twists", name: "Twists", defaultDuration: 180, defaultPrice: 12000 },
          { id: "senegalese-twists", name: "Senegalese Twists", defaultDuration: 240, defaultPrice: 15000 },
          { id: "feed-in-braids", name: "Feed-in Braids", defaultDuration: 180, defaultPrice: 12000 },
          { id: "knotless-braids", name: "Knotless Braids", defaultDuration: 300, defaultPrice: 20000 },
        ]
      },
      "dreadlocks": {
        id: "dreadlocks",
        name: "Dreadlocks",
        icon: "🔒",
        subServices: [
          { id: "dreadlock-installation", name: "Dreadlock Installation", defaultDuration: 300, defaultPrice: 25000 },
          { id: "dreadlock-maintenance", name: "Dreadlock Maintenance / Retwist", defaultDuration: 120, defaultPrice: 8000 },
          { id: "dreadlock-removal", name: "Dreadlock Removal", defaultDuration: 180, defaultPrice: 15000 },
        ]
      },
      "hairdressers": {
        id: "hairdressers",
        name: "Hairdressers",
        icon: "💇",
        subServices: [
          { id: "hair-styling", name: "Hair Styling", defaultDuration: 60, defaultPrice: 5000 },
          { id: "hair-coloring", name: "Hair Coloring / Highlights", defaultDuration: 90, defaultPrice: 8000 },
          { id: "blowouts", name: "Blowouts", defaultDuration: 45, defaultPrice: 4000 },
          { id: "hair-treatment", name: "Hair Treatment / Deep Conditioning", defaultDuration: 60, defaultPrice: 6000 },
        ]
      },
      "wig-specialists": {
        id: "wig-specialists",
        name: "Wig Specialists",
        icon: "👩",
        subServices: [
          { id: "wig-installation", name: "Wig Installation", defaultDuration: 60, defaultPrice: 10000 },
          { id: "wig-styling", name: "Wig Styling / Cutting", defaultDuration: 45, defaultPrice: 5000 },
          { id: "wig-maintenance", name: "Wig Maintenance / Cleaning", defaultDuration: 60, defaultPrice: 4000 },
        ]
      },
      "makeup-artists": {
        id: "makeup-artists",
        name: "Makeup Artists",
        icon: "💄",
        subServices: [
          { id: "bridal-makeup", name: "Bridal Makeup", defaultDuration: 120, defaultPrice: 30000 },
          { id: "party-event-makeup", name: "Party / Event Makeup", defaultDuration: 60, defaultPrice: 15000 },
          { id: "photoshoot-makeup", name: "Photoshoot Makeup", defaultDuration: 90, defaultPrice: 20000 },
          { id: "natural-everyday-makeup", name: "Natural / Everyday Makeup", defaultDuration: 45, defaultPrice: 8000 },
        ]
      },
      "nail-technicians": {
        id: "nail-technicians",
        name: "Nail Technicians",
        icon: "💅",
        subServices: [
          { id: "manicure", name: "Manicure", defaultDuration: 45, defaultPrice: 3000 },
          { id: "pedicure", name: "Pedicure", defaultDuration: 60, defaultPrice: 4000 },
          { id: "gel-nails", name: "Gel Nails", defaultDuration: 75, defaultPrice: 8000 },
          { id: "acrylic-nails", name: "Acrylic Nails", defaultDuration: 90, defaultPrice: 12000 },
          { id: "nail-art", name: "Nail Art", defaultDuration: 30, defaultPrice: 2000 },
        ]
      },
      "eyelash-technicians": {
        id: "eyelash-technicians",
        name: "Eyelash Technicians",
        icon: "👁️",
        subServices: [
          { id: "lash-extensions", name: "Lash Extensions", defaultDuration: 90, defaultPrice: 15000 },
          { id: "lash-lifts", name: "Lash Lifts", defaultDuration: 60, defaultPrice: 8000 },
          { id: "brow-lamination", name: "Brow Lamination", defaultDuration: 45, defaultPrice: 6000 },
          { id: "microblading", name: "Microblading", defaultDuration: 120, defaultPrice: 50000 },
          { id: "microshading", name: "Microshading", defaultDuration: 120, defaultPrice: 45000 },
          { id: "brow-tinting", name: "Brow Tinting", defaultDuration: 30, defaultPrice: 3000 },
        ]
      },
      "facials": {
        id: "facials",
        name: "Facials (Estheticians)",
        icon: "🧖",
        subServices: [
          { id: "basic-facial", name: "Basic Facial", defaultDuration: 45, defaultPrice: 5000 },
          { id: "deep-cleansing-facial", name: "Deep Cleansing Facial", defaultDuration: 60, defaultPrice: 8000 },
          { id: "anti-aging-facial", name: "Anti-Aging Facial", defaultDuration: 75, defaultPrice: 12000 },
          { id: "acne-treatment", name: "Acne Treatment", defaultDuration: 60, defaultPrice: 10000 },
        ]
      },
      "cosmetologists": {
        id: "cosmetologists",
        name: "Cosmetologists",
        icon: "🌸",
        subServices: [
          { id: "skin-treatment", name: "Skin Treatment / Care", defaultDuration: 60, defaultPrice: 8000 },
          { id: "body-treatments", name: "Body Treatments", defaultDuration: 90, defaultPrice: 15000 },
          { id: "non-surgical-beauty", name: "Non-surgical Beauty Procedures", defaultDuration: 60, defaultPrice: 20000 },
        ]
      },
    }
  },
  "body-aesthetics": {
    id: "body-aesthetics",
    name: "Body & Aesthetics",
    icon: "💎",
    color: "from-purple-500 to-indigo-500",
    notice: "Verified & Regulated Providers Only",
    services: {
      "non-surgical-body": {
        id: "non-surgical-body",
        name: "Non-Surgical Body Enhancement",
        icon: "💉",
        requiresVerification: true,
        subServices: [
          { id: "lip-fillers", name: "Lip Fillers", defaultDuration: 60, defaultPrice: 80000 },
          { id: "botox", name: "Botox / Wrinkle Treatments", defaultDuration: 45, defaultPrice: 100000 },
          { id: "skin-tightening", name: "Skin Tightening", defaultDuration: 60, defaultPrice: 50000 },
          { id: "fat-reduction", name: "Fat Reduction (Non-surgical)", defaultDuration: 90, defaultPrice: 150000 },
        ]
      },
      "tattoo-artists": {
        id: "tattoo-artists",
        name: "Tattoo Artists",
        icon: "🎨",
        subServices: [
          { id: "small-tattoos", name: "Small / Minimalist Tattoos", defaultDuration: 60, defaultPrice: 15000 },
          { id: "large-tattoos", name: "Large / Full Body Tattoos", defaultDuration: 300, defaultPrice: 100000 },
          { id: "custom-designs", name: "Custom Designs", defaultDuration: 180, defaultPrice: 50000 },
          { id: "portrait-tattoos", name: "Portrait Tattoos", defaultDuration: 240, defaultPrice: 80000 },
          { id: "coverup-tattoos", name: "Cover-up Tattoos", defaultDuration: 180, defaultPrice: 60000 },
          { id: "black-grey-tattoos", name: "Black & Grey Tattoos", defaultDuration: 120, defaultPrice: 40000 },
          { id: "color-tattoos", name: "Color Tattoos", defaultDuration: 150, defaultPrice: 50000 },
          { id: "tattoo-touchups", name: "Tattoo Touch ups", defaultDuration: 60, defaultPrice: 20000 },
          { id: "tattoo-removal", name: "Tattoo Removal", defaultDuration: 60, defaultPrice: 30000 },
        ]
      },
      "body-piercing": {
        id: "body-piercing",
        name: "Body Piercing",
        icon: "💎",
        subServices: [
          { id: "ear-piercing", name: "Ear Piercing", defaultDuration: 15, defaultPrice: 3000 },
          { id: "nose-piercing", name: "Nose Piercing", defaultDuration: 15, defaultPrice: 5000 },
          { id: "body-piercing-general", name: "Body Piercing", defaultDuration: 30, defaultPrice: 8000 },
        ]
      },
      "medical-surgical": {
        id: "medical-surgical",
        name: "Medical / Surgical (Verified Only)",
        icon: "🏥",
        requiresVerification: true,
        subServices: [
          { id: "teeth-whitening", name: "Teeth Whitening", defaultDuration: 60, defaultPrice: 50000 },
          { id: "hair-transplant", name: "Hair Transplant", defaultDuration: 480, defaultPrice: 500000 },
          { id: "cosmetic-surgery", name: "Cosmetic Surgery", defaultDuration: 240, defaultPrice: 1000000 },
        ]
      },
    }
  },
  "wellness-care": {
    id: "wellness-care",
    name: "Wellness & Care",
    icon: "🧘",
    color: "from-green-500 to-teal-500",
    services: {
      "spa-services": {
        id: "spa-services",
        name: "Spa Services",
        icon: "🧖‍♀️",
        subServices: [
          { id: "full-body-massage", name: "Full Body Massage", defaultDuration: 90, defaultPrice: 15000 },
          { id: "head-neck-massage", name: "Head & Neck Massage", defaultDuration: 30, defaultPrice: 5000 },
          { id: "aromatherapy", name: "Aromatherapy", defaultDuration: 60, defaultPrice: 12000 },
          { id: "massage-therapy", name: "Massage Therapy", defaultDuration: 60, defaultPrice: 10000 },
          { id: "deep-tissue-massage", name: "Deep Tissue Massage", defaultDuration: 75, defaultPrice: 18000 },
          { id: "sports-massage", name: "Sports Massage", defaultDuration: 60, defaultPrice: 15000 },
          { id: "reflexology", name: "Reflexology", defaultDuration: 45, defaultPrice: 8000 },
        ]
      },
      "body-therapy": {
        id: "body-therapy",
        name: "Body Therapy",
        icon: "🌿",
        subServices: [
          { id: "body-scrubs", name: "Body Scrubs / Exfoliation", defaultDuration: 60, defaultPrice: 10000 },
          { id: "body-wraps", name: "Body Wraps", defaultDuration: 75, defaultPrice: 15000 },
        ]
      },
      "wellness-treatments": {
        id: "wellness-treatments",
        name: "Wellness Treatments",
        icon: "🍃",
        subServices: [
          { id: "yoga", name: "Yoga", defaultDuration: 60, defaultPrice: 5000 },
          { id: "meditation", name: "Meditation", defaultDuration: 45, defaultPrice: 4000 },
          { id: "fitness-coaching", name: "Fitness Coaching", defaultDuration: 60, defaultPrice: 8000 },
        ]
      },
    }
  },
  "fashion-bridal": {
    id: "fashion-bridal",
    name: "Fashion & Bridal",
    icon: "👗",
    color: "from-amber-500 to-orange-500",
    services: {
      "fashion-designers": {
        id: "fashion-designers",
        name: "Fashion Designers",
        icon: "🎨",
        subServices: [
          { id: "custom-clothing", name: "Custom Clothing Design", defaultDuration: 120, defaultPrice: 50000 },
          { id: "outfit-styling", name: "Outfit Styling", defaultDuration: 90, defaultPrice: 20000 },
          { id: "fittings-alterations", name: "Fittings & Alterations", defaultDuration: 60, defaultPrice: 10000 },
        ]
      },
      "bridal-designers": {
        id: "bridal-designers",
        name: "Bridal Designers",
        icon: "👰",
        subServices: [
          { id: "wedding-dress", name: "Wedding Dress Design", defaultDuration: 180, defaultPrice: 150000 },
          { id: "bridal-accessories", name: "Bridal Accessories", defaultDuration: 60, defaultPrice: 30000 },
          { id: "bridal-fittings", name: "Fittings & Alterations", defaultDuration: 90, defaultPrice: 20000 },
        ]
      },
      "models": {
        id: "models",
        name: "Models",
        icon: "🚶",
        subServices: [
          { id: "runway-modeling", name: "Runway Modeling", defaultDuration: 120, defaultPrice: 50000 },
          { id: "photoshoot-modeling", name: "Photoshoot Modeling", defaultDuration: 180, defaultPrice: 40000 },
          { id: "promotional-events", name: "Promotional Events", defaultDuration: 240, defaultPrice: 30000 },
        ]
      },
    }
  },
  "events-entertainment": {
    id: "events-entertainment",
    name: "Events & Entertainment",
    icon: "🎉",
    color: "from-blue-500 to-cyan-500",
    services: {
      "event-planners": {
        id: "event-planners",
        name: "Event Planners",
        icon: "📋",
        subServices: [
          { id: "weddings", name: "Weddings", defaultDuration: 480, defaultPrice: 200000 },
          { id: "birthday-parties", name: "Birthday Parties", defaultDuration: 240, defaultPrice: 50000 },
          { id: "corporate-events", name: "Corporate Events", defaultDuration: 360, defaultPrice: 150000 },
        ]
      },
      "mcs": {
        id: "mcs",
        name: "MCs",
        icon: "🎤",
        subServices: [
          { id: "event-hosting", name: "Event Hosting", defaultDuration: 240, defaultPrice: 100000 },
          { id: "public-speaking", name: "Public Speaking", defaultDuration: 60, defaultPrice: 50000 },
        ]
      },
      "djs": {
        id: "djs",
        name: "DJs",
        icon: "🎧",
        subServices: [
          { id: "music-mixing", name: "Music Mixing / DJing", defaultDuration: 300, defaultPrice: 80000 },
        ]
      },
      "hype-men": {
        id: "hype-men",
        name: "Hype Men / Performers",
        icon: "📢",
        subServices: [
          { id: "live-performances", name: "Live Performances", defaultDuration: 120, defaultPrice: 50000 },
          { id: "crowd-engagement", name: "Crowd Engagement", defaultDuration: 180, defaultPrice: 40000 },
        ]
      },
      "artists": {
        id: "artists",
        name: "Artists",
        icon: "🎭",
        subServices: [
          { id: "singing-music", name: "Singing / Music Performances", defaultDuration: 120, defaultPrice: 100000 },
          { id: "acting-theater", name: "Acting / Theater", defaultDuration: 180, defaultPrice: 80000 },
        ]
      },
      "food-vendors": {
        id: "food-vendors",
        name: "Food Vendors",
        icon: "🍽️",
        subServices: [
          { id: "catering", name: "Catering", defaultDuration: 300, defaultPrice: 100000 },
          { id: "snacks-drinks", name: "Snacks & Drinks", defaultDuration: 180, defaultPrice: 30000 },
        ]
      },
    }
  },
  "classes-learning": {
    id: "classes-learning",
    name: "Classes & Learning",
    icon: "📚",
    color: "from-violet-500 to-purple-500",
    services: {
      "beauty-classes": {
        id: "beauty-classes",
        name: "Beauty Classes",
        icon: "🎓",
        subServices: [
          { id: "makeup-training", name: "Makeup Training", defaultDuration: 240, defaultPrice: 50000 },
          { id: "hair-styling-training", name: "Hair Styling Training", defaultDuration: 240, defaultPrice: 40000 },
          { id: "nail-lash-training", name: "Nail & Lash Training", defaultDuration: 180, defaultPrice: 35000 },
          { id: "tattoo-body-art-training", name: "Tattoo & Body Art Training", defaultDuration: 300, defaultPrice: 80000 },
        ]
      },
      "wellness-training": {
        id: "wellness-training",
        name: "Wellness Training",
        icon: "🧘",
        subServices: [
          { id: "massage-therapy-training", name: "Massage Therapy Training", defaultDuration: 240, defaultPrice: 60000 },
          { id: "fitness-yoga-training", name: "Fitness / Yoga Training", defaultDuration: 180, defaultPrice: 30000 },
        ]
      },
    }
  },
};

// Helper functions
export const getServiceCategories = () => {
  return Object.values(SERVICE_CATALOG).map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    notice: cat.notice,
    serviceCount: Object.keys(cat.services).length
  }));
};

export const getServicesByCategory = (categoryId) => {
  const category = SERVICE_CATALOG[categoryId];
  if (!category) return [];
  return Object.values(category.services);
};

export const getSubServices = (categoryId, serviceId) => {
  const category = SERVICE_CATALOG[categoryId];
  if (!category) return [];
  const service = category.services[serviceId];
  if (!service) return [];
  return service.subServices || [];
};

export const getAllSubServices = () => {
  const subServices = [];
  Object.values(SERVICE_CATALOG).forEach(cat => {
    Object.values(cat.services).forEach(svc => {
      (svc.subServices || []).forEach(sub => {
        subServices.push({
          ...sub,
          serviceId: svc.id,
          serviceName: svc.name,
          serviceIcon: svc.icon,
          categoryId: cat.id,
          categoryName: cat.name,
          requiresVerification: svc.requiresVerification || false
        });
      });
    });
  });
  return subServices;
};

export const findSubService = (subServiceId) => {
  for (const cat of Object.values(SERVICE_CATALOG)) {
    for (const svc of Object.values(cat.services)) {
      const found = (svc.subServices || []).find(sub => sub.id === subServiceId);
      if (found) {
        return {
          ...found,
          serviceId: svc.id,
          serviceName: svc.name,
          serviceIcon: svc.icon,
          categoryId: cat.id,
          categoryName: cat.name,
          requiresVerification: svc.requiresVerification || false
        };
      }
    }
  }
  return null;
};

// Legacy SERVICE_CATEGORIES for backward compatibility
export const SERVICE_CATEGORIES = Object.values(SERVICE_CATALOG).map(cat => ({
  id: cat.id,
  name: cat.name,
  icon: cat.icon,
  color: cat.color,
  notice: cat.notice,
  services: Object.values(cat.services).map(svc => ({
    id: svc.id,
    name: svc.name,
    icon: svc.icon,
    requiresVerification: svc.requiresVerification
  }))
}));

// Legacy STYLIST_SERVICES for backward compatibility
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
  SERVICES_SAVED: "Services saved successfully!",
  SERVICES_SAVE_FAILED: "Failed to save services",
};

// Breakpoints (Tailwind)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
};
