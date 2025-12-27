import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Auth Screens
import SignUpScreen from "@/screens/SignUpScreen";
import LoginScreen from "@/screens/LoginScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import VerifyOTPScreen from "@/screens/VerifyOTPScreen";
import VerifyPhoneScreen from "@/screens/VerifyPhoneScreen";

// App Screens
import HomeScreen from "@/screens/HomeScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import StylistsListScreen from "@/screens/StylistsListScreen";
import StylistProfileScreen from "@/screens/StylistProfileScreen";
import WalletScreen from "@/screens/WalletScreen";

// LoadingSpinner for route transitions
import LoadingSpinner from "@/components/LoadingSpinner";

/**
 * ProtectedRoute - Requires authentication and phone verification
 * Redirects to /login if not authenticated
 * Redirects to /verify-phone if phone not verified
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, needsPhoneVerification } = useAuth();

  // Show nothing while loading - AuthContext shows spinner
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Not authenticated -> redirect to login
  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // Authenticated but needs phone verification -> redirect to verify-phone
  if (needsPhoneVerification) {
    console.log('[ProtectedRoute] Needs phone verification, redirecting to /verify-phone');
    return <Navigate to="/verify-phone" replace />;
  }

  // Authenticated and verified -> render children
  return children;
};

/**
 * PublicRoute - Only accessible when NOT authenticated
 * Redirects to home if already authenticated
 */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, needsPhoneVerification } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // If authenticated, redirect appropriately
  if (isAuthenticated) {
    if (needsPhoneVerification) {
      return <Navigate to="/verify-phone" replace />;
    }
    return <Navigate to="/home" replace />;
  }

  return children;
};

/**
 * PhoneVerificationRoute - For the /verify-phone screen
 * Only accessible when authenticated but NOT phone verified
 */
const PhoneVerificationRoute = ({ children }) => {
  const { isAuthenticated, loading, needsPhoneVerification, isPhoneVerified } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Not authenticated -> redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Already verified -> redirect to home
  if (isPhoneVerified && !needsPhoneVerification) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

function AppRoutes() {
  const { userData, isAuthenticated, needsPhoneVerification } = useAuth();

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
      
      {/* OTP Verification for phone login - semi-public route */}
      <Route path="/verify-otp" element={<VerifyOTPScreen />} />

      {/* Phone Verification Route - For users who need to verify phone */}
      <Route
        path="/verify-phone"
        element={
          <PhoneVerificationRoute>
            <VerifyPhoneScreen />
          </PhoneVerificationRoute>
        }
      />

      {/* Protected Routes - Require authentication AND phone verification */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomeScreen currentUser={userData} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomeScreen currentUser={userData} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfileScreen currentUser={userData} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stylists"
        element={
          <ProtectedRoute>
            <StylistsListScreen currentUser={userData} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stylists/:userId"
        element={
          <ProtectedRoute>
            <StylistProfileScreen currentUser={userData} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <WalletScreen currentUser={userData} />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect based on auth state */}
      <Route
        path="*"
        element={
          isAuthenticated 
            ? (needsPhoneVerification ? <Navigate to="/verify-phone" replace /> : <Navigate to="/home" replace />)
            : <Navigate to="/login" replace />
        }
      />
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
