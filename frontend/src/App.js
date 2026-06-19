import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

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

// Shared Screens
import BookingDetailsScreen from "@/screens/BookingDetailsScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import BookingChatScreen from "@/screens/BookingChatScreen";

// Admin Screens
import AdminLoginScreen from "@/screens/AdminLoginScreen";
import AdminWithdrawalsScreen from "@/screens/AdminWithdrawalsScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";

// Phase 4 - Social Feed
import FeedScreen from "@/screens/FeedScreen";

// Phase 5 - KYC
import KYCScreen from "@/screens/KYCScreen";
import AdminKYCScreen from "@/screens/AdminKYCScreen";

// Components
import LoadingSpinner from "@/components/LoadingSpinner";

/**
 * ProtectedRoute - Requires authentication
 * Redirects to /login if not authenticated
 */
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

      {/* Root redirect based on role */}
      <Route path="/" element={<RoleBasedRedirect />} />

      {/* ============================================= */}
      {/* USER (CUSTOMER) ROUTES - New /user/* structure */}
      {/* Browsing routes are PUBLIC (guest-accessible).            */}
      {/* Transactional routes (wallet, bookings) remain protected. */}
      {/* ============================================= */}
      <Route path="/user/home" element={<HomeScreen />} />
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

      {/* Catch all - redirect based on auth state and role */}
      <Route path="*" element={<RoleBasedRedirect />} />

      {/* ============================================= */}
      {/* ADMIN ROUTES - Separate from user auth */}
      {/* ============================================= */}
      <Route path="/admin" element={<AdminLoginScreen />} />
      <Route path="/admin/dashboard" element={<AdminDashboardScreen />} />
      <Route path="/admin/withdrawals" element={<AdminWithdrawalsScreen />} />
      {/* Phase 5 - Admin KYC review */}
      <Route path="/admin/kyc" element={<AdminKYCScreen />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-gray-50">
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-center" />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
