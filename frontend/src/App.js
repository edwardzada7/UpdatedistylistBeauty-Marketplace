import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import BookingPrompts from "@/components/BookingPrompts";
import { SeasonThemeProvider } from "@/contexts/SeasonThemeContext";
import SeasonEffects from "@/components/SeasonEffects";
import { CartProvider } from "@/contexts/CartContext";

// Auth Screens
import SignUpScreen from "@/screens/SignUpScreen";
import LoginScreen from "@/screens/LoginScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";

// User (Customer) Screens
import HomeScreen from "@/screens/HomeScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import ProvidersListScreen from "@/screens/ProvidersListScreen";
import ProviderProfileScreen from "@/screens/ProviderProfileScreen";
import WalletScreen from "@/screens/WalletScreen";
import ServicesScreen from "@/screens/ServicesScreen";
import CustomerBookingsScreen from "@/screens/CustomerBookingsScreen";

// Provider (Stylist) Screens
import StylistDashboard from "@/screens/StylistDashboard";
import ProviderServicesScreen from "@/screens/ProviderServicesScreen";
import ProviderAvailabilityScreen from "@/screens/ProviderAvailabilityScreen";
import ProviderBookingsScreen from "@/screens/ProviderBookingsScreen";
import ProviderStaffScreen from "@/screens/ProviderStaffScreen";

// Shop (customer)
import ShopScreen from "@/screens/ShopScreen";
import ProductDetailScreen from "@/screens/ProductDetailScreen";
import CartScreen from "@/screens/CartScreen";
import ShopOrderCompleteScreen from "@/screens/ShopOrderCompleteScreen";
import ShopOrdersScreen from "@/screens/ShopOrdersScreen";
import GuestShopOrderScreen from "@/screens/GuestShopOrderScreen";

// Shared Screens
import BookingDetailsScreen from "@/screens/BookingDetailsScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import BookingChatScreen from "@/screens/BookingChatScreen";

// Phase 4 - Social Feed
import FeedScreen from "@/screens/FeedScreen";

// Phase 5 - KYC
import KYCScreen from "@/screens/KYCScreen";

// Phase 8 Lean - Trust, Safety, Support, Reports
import LegalPageScreen from "@/screens/LegalPageScreen";
import SafetyCenterScreen from "@/screens/SafetyCenterScreen";
import SupportScreen from "@/screens/SupportScreen";

// Components
import LoadingSpinner from "@/components/LoadingSpinner";

// Phase 10 - Lazy load admin screens for better performance
const AdminLoginScreen = lazy(() => import("@/screens/AdminLoginScreen"));
const AdminDashboardScreen = lazy(() => import("@/screens/AdminDashboardScreen"));
const AdminWithdrawalsScreen = lazy(() => import("@/screens/AdminWithdrawalsScreen"));
const AdminKYCScreen = lazy(() => import("@/screens/AdminKYCScreen"));
const AdminFinancialSettingsScreen = lazy(() => import("@/screens/AdminFinancialSettingsScreen"));
const AdminReportsScreen = lazy(() => import("@/screens/AdminReportsScreen"));
const AdminFeedModerationScreen = lazy(() => import("@/screens/AdminFeedModerationScreen"));
const AdminShopModerationScreen = lazy(() => import("@/screens/AdminShopModerationScreen"));
const AdminOfficialScreen = lazy(() => import("@/screens/AdminOfficialScreen"));
const AdminThemesScreen = lazy(() => import("@/screens/AdminThemesScreen"));
const AdminEventsScreen = lazy(() => import("@/screens/AdminEventsScreen"));
const EventsScreen = lazy(() => import("@/screens/EventsScreen"));
const EventDetailScreen = lazy(() => import("@/screens/EventDetailScreen"));
const EventPurchaseCompleteScreen = lazy(() => import("@/screens/EventPurchaseCompleteScreen"));
const MyTicketsScreen = lazy(() => import("@/screens/MyTicketsScreen"));
const GuestTicketsScreen = lazy(() => import("@/screens/GuestTicketsScreen"));
const EventScannerScreen = lazy(() => import("@/screens/EventScannerScreen"));
const ProviderEventsScreen = lazy(() => import("@/screens/ProviderEventsScreen"));
const ProviderShopScreen = lazy(() => import("@/screens/ProviderShopScreen"));
const ProviderPurchaseCompleteScreen = lazy(() => import("@/screens/ProviderPurchaseCompleteScreen"));
const ProviderPromoteScreen = lazy(() => import("@/screens/ProviderPromoteScreen"));
const PromoCompleteScreen = lazy(() => import("@/screens/PromoCompleteScreen"));
const AdminPromotionsScreen = lazy(() => import("@/screens/AdminPromotionsScreen"));
const AdminLocationsScreen = lazy(() => import("@/screens/AdminLocationsScreen"));
const AdminEarningsScreen = lazy(() => import("@/screens/AdminEarningsScreen"));
const AdminNoShowsScreen = lazy(() => import("@/screens/AdminNoShowsScreen"));
const AdminBroadcastScreen = lazy(() => import("@/screens/AdminBroadcastScreen"));
const AdminPlatformEarningsScreen = lazy(() => import("@/screens/AdminPlatformEarningsScreen"));
const AdminSupportDashboardScreen = lazy(() => import("@/screens/AdminSupportDashboardScreen"));
const AdminCopyrightScreen = lazy(() => import("@/screens/AdminCopyrightScreen"));
const AdminLegalEditorScreen = lazy(() => import("@/screens/AdminLegalEditorScreen"));
const AdminCertificateVerificationScreen = lazy(() => import("@/screens/AdminCertificateVerificationScreen"));
const AdminProfessionalConsultationScreen = lazy(() => import("@/screens/AdminProfessionalConsultationScreen"));
const AdminReferralSettingsScreen = lazy(() => import("@/screens/AdminReferralSettingsScreen"));
const AdminReferralEarningsScreen = lazy(() => import("@/screens/AdminReferralEarningsScreen"));

/**
 * ProtectedRoute - Requires authentication
 * Redirects to /login if not authenticated
 */
// Signed-in users see their account tickets; guests see the tickets saved on this device.
const TicketsEntry = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen message="Loading..." />;
  if (!isAuthenticated) return <Navigate to="/events/guest-tickets" replace />;
  return <Suspense fallback={<LoadingSpinner fullScreen />}><MyTicketsScreen /></Suspense>;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * PublicRoute - Only accessible when NOT authenticated
 * Redirects based on user role
 */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, isProvider } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  if (isAuthenticated) {
    // Redirect based on role to new path structure
    return <Navigate to={isProvider ? "/provider/dashboard" : "/user/home"} replace />;
  }

  return children;
};

/**
 * RoleBasedRedirect - Redirects based on user role.
 * Guests (not logged in) are sent to the public home/browsing experience.
 */
const RoleBasedRedirect = () => {
  const { isAuthenticated, isProvider } = useAuth();
  
  if (!isAuthenticated) {
    // Guests land on the public home/marketplace, not the login screen
    return <Navigate to="/user/home" replace />;
  }
  
  // Redirect to new path structure
  return <Navigate to={isProvider ? "/provider/dashboard" : "/user/home"} replace />;
};

function AppRoutes() {
  const { userData, isProvider, displayName } = useAuth();

  return (
    <Routes>
      {/* Public Routes - Only accessible when NOT logged in */}
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignUpScreen />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginScreen />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordScreen />
          </PublicRoute>
        }
      />

      {/* Shop - browsing is public; checkout needs login (handled in the cart screen) */}
      <Route path="/shop" element={<ShopScreen />} />
      <Route path="/user/shop" element={<ShopScreen />} />
      <Route path="/shop/cart" element={<CartScreen />} />
      <Route path="/shop/order-complete" element={<ProtectedRoute><ShopOrderCompleteScreen /></ProtectedRoute>} />
      <Route path="/shop/guest-order" element={<GuestShopOrderScreen />} />
      <Route path="/shop/orders" element={<ProtectedRoute><ShopOrdersScreen /></ProtectedRoute>} />
      <Route path="/user/orders" element={<ProtectedRoute><ShopOrdersScreen /></ProtectedRoute>} />
      <Route path="/shop/:id" element={<ProductDetailScreen />} />

      {/* Root redirect based on role */}
      <Route path="/" element={<RoleBasedRedirect />} />

      {/* ============================================= */}
      {/* USER (CUSTOMER) ROUTES - New /user/* structure */}
      {/* Browsing routes are PUBLIC (guest-accessible).            */}
      {/* Transactional routes (wallet, bookings) remain protected. */}
      {/* ============================================= */}
      <Route path="/user/home" element={<HomeScreen />} />
      <Route path="/events" element={<Suspense fallback={<LoadingSpinner fullScreen />}><EventsScreen /></Suspense>} />
      <Route path="/events/purchase-complete" element={<ProtectedRoute><Suspense fallback={<LoadingSpinner fullScreen />}><EventPurchaseCompleteScreen /></Suspense></ProtectedRoute>} />
      <Route path="/events/:id" element={<Suspense fallback={<LoadingSpinner fullScreen />}><EventDetailScreen /></Suspense>} />
      <Route path="/tickets" element={<TicketsEntry />} />
      <Route path="/events/guest-tickets" element={<Suspense fallback={<LoadingSpinner fullScreen />}><GuestTicketsScreen /></Suspense>} />
      <Route path="/scanner" element={<Suspense fallback={<LoadingSpinner fullScreen />}><EventScannerScreen /></Suspense>} />
      <Route path="/user/services" element={<ServicesScreen />} />
      <Route path="/user/providers" element={<ProvidersListScreen />} />
      <Route path="/user/providers/:userId" element={<ProviderProfileScreen />} />
      <Route
        path="/user/wallet"
        element={
          <ProtectedRoute>
            <WalletScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/bookings"
        element={
          <ProtectedRoute>
            <CustomerBookingsScreen />
          </ProtectedRoute>
        }
      />
      {/* Legacy route for customer bookings */}
      <Route
        path="/bookings"
        element={
          <ProtectedRoute>
            <CustomerBookingsScreen />
          </ProtectedRoute>
        }
      />

      {/* ============================================= */}
      {/* PROVIDER (STYLIST) ROUTES - New /provider/* structure */}
      {/* ============================================= */}
      <Route
        path="/provider/dashboard"
        element={
          <ProtectedRoute>
            <StylistDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/promote"
        element={<ProtectedRoute><Suspense fallback={<LoadingSpinner fullScreen />}><ProviderPromoteScreen /></Suspense></ProtectedRoute>}
      />
      <Route
        path="/provider/promote/complete"
        element={<ProtectedRoute><Suspense fallback={<LoadingSpinner fullScreen />}><PromoCompleteScreen /></Suspense></ProtectedRoute>}
      />
      <Route
        path="/provider/events"
        element={<ProtectedRoute><Suspense fallback={<LoadingSpinner fullScreen />}><ProviderEventsScreen /></Suspense></ProtectedRoute>}
      />
      <Route
        path="/provider/shop"
        element={<ProtectedRoute><Suspense fallback={<LoadingSpinner fullScreen />}><ProviderShopScreen /></Suspense></ProtectedRoute>}
      />
      <Route
        path="/provider/shop/purchase-complete"
        element={<ProtectedRoute><Suspense fallback={<LoadingSpinner fullScreen />}><ProviderPurchaseCompleteScreen /></Suspense></ProtectedRoute>}
      />
      <Route
        path="/provider/services"
        element={
          <ProtectedRoute>
            <ProviderServicesScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/availability"
        element={
          <ProtectedRoute>
            <ProviderAvailabilityScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/bookings"
        element={
          <ProtectedRoute>
            <ProviderBookingsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/staff"
        element={
          <ProtectedRoute>
            <ProviderStaffScreen />
          </ProtectedRoute>
        }
      />

      {/* ============================================= */}
      {/* SHARED ROUTES - Accessible by both roles */}
      {/* ============================================= */}
      <Route
        path="/bookings/:id"
        element={
          <ProtectedRoute>
            <BookingDetailsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfileScreen />
          </ProtectedRoute>
        }
      />
      {/* Phase 5 - KYC */}
      <Route
        path="/profile/kyc"
        element={
          <ProtectedRoute>
            <KYCScreen />
          </ProtectedRoute>
        }
      />

      {/* ============================================= */}
      {/* LEGACY ROUTES - Backward compatibility */}
      {/* ============================================= */}
      
      {/* USER (CUSTOMER) ROUTES - legacy paths, public for browsing */}
      <Route path="/home" element={<HomeScreen />} />
      <Route path="/services" element={<ServicesScreen />} />
      <Route path="/providers" element={<ProvidersListScreen />} />
      {/* Legacy route for backward compatibility */}
      <Route path="/stylists" element={<ProvidersListScreen />} />
      <Route path="/providers/:userId" element={<ProviderProfileScreen />} />
      {/* Legacy route */}
      <Route path="/stylists/:userId" element={<ProviderProfileScreen />} />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <WalletScreen />
          </ProtectedRoute>
        }
      />

      {/* PROVIDER (STYLIST) ROUTES */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <StylistDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-services"
        element={
          <ProtectedRoute>
            <ProviderServicesScreen />
          </ProtectedRoute>
        }
      />

      {/* SHARED ROUTES */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsScreen />
          </ProtectedRoute>
        }
      />

      <Route
        path="/bookings/:id/chat"
        element={
          <ProtectedRoute>
            <BookingChatScreen />
          </ProtectedRoute>
        }
      />

      {/* Phase 4 - Social Feed Lite (public browsing) */}
      <Route path="/feed" element={<FeedScreen />} />
      <Route path="/user/feed" element={<FeedScreen />} />

      {/* Phase 8 Lean - public Trust & Safety routes (guest-accessible) */}
      <Route path="/privacy" element={<LegalPageScreen slug="privacy" />} />
      <Route path="/terms" element={<LegalPageScreen slug="terms" />} />
      <Route path="/community-guidelines" element={<LegalPageScreen slug="community-guidelines" />} />
      <Route path="/refund-policy" element={<LegalPageScreen slug="refund-policy" />} />
      <Route path="/safety" element={<SafetyCenterScreen />} />
      <Route path="/support" element={<SupportScreen />} />

      {/* Catch all - redirect based on auth state and role */}
      <Route path="*" element={<RoleBasedRedirect />} />

      {/* ============================================= */}
      {/* ADMIN ROUTES - Separate from user auth */}
      {/* Phase 10 - Lazy loaded with Suspense */}
      {/* ============================================= */}
      <Route path="/admin" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminLoginScreen /></Suspense>} />
      <Route path="/admin/dashboard" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminDashboardScreen /></Suspense>} />
      <Route path="/admin/withdrawals" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminWithdrawalsScreen /></Suspense>} />
      {/* Phase 5 - Admin KYC review */}
      <Route path="/admin/kyc" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminKYCScreen /></Suspense>} />
      {/* Phase 8 Lean - Admin reports moderation */}
      <Route path="/admin/reports" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminReportsScreen /></Suspense>} />
      <Route path="/admin/feed-moderation" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminFeedModerationScreen /></Suspense>} />
      <Route path="/admin/shop-moderation" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminShopModerationScreen /></Suspense>} />
      <Route path="/admin/themes" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminThemesScreen /></Suspense>} />
      <Route path="/admin/events" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminEventsScreen /></Suspense>} />
      <Route path="/admin/official" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminOfficialScreen /></Suspense>} />
      <Route path="/admin/promotions" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminPromotionsScreen /></Suspense>} />
      <Route path="/admin/earnings" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminEarningsScreen /></Suspense>} />
      <Route path="/admin/locations" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminLocationsScreen /></Suspense>} />
      <Route path="/admin/no-shows" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminNoShowsScreen /></Suspense>} />
      <Route path="/admin/broadcast" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminBroadcastScreen /></Suspense>} />
      {/* Phase 7 - Admin financial settings */}
      <Route path="/admin/settings" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminFinancialSettingsScreen /></Suspense>} />
      {/* Phase 9 - Pre-Launch Admin Features */}
      <Route path="/admin/earnings" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminPlatformEarningsScreen /></Suspense>} />
      <Route path="/admin/referrals/settings" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminReferralSettingsScreen /></Suspense>} />
      <Route path="/admin/referrals/earnings" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminReferralEarningsScreen /></Suspense>} />
      <Route path="/admin/support" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminSupportDashboardScreen /></Suspense>} />
      <Route path="/admin/copyright" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminCopyrightScreen /></Suspense>} />
      <Route path="/admin/legal-editor" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminLegalEditorScreen /></Suspense>} />
      <Route path="/admin/certifications" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminCertificateVerificationScreen /></Suspense>} />
      <Route path="/admin/consultations" element={<Suspense fallback={<LoadingSpinner fullScreen />}><AdminProfessionalConsultationScreen /></Suspense>} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-gray-50">
      <BrowserRouter>
        <AuthProvider>
          <SeasonThemeProvider>
          <CartProvider>
            <Toaster position="top-center" />
            <AppRoutes />
            <BookingPrompts />
            <SeasonEffects />
          </CartProvider>
          </SeasonThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
