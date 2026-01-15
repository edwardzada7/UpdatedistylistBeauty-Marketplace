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

// Provider (Stylist) Screens
import StylistDashboard from "@/screens/StylistDashboard";
import ProviderServicesScreen from "@/screens/ProviderServicesScreen";

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
 * RoleBasedRedirect - Redirects based on user role
 */
const RoleBasedRedirect = () => {
  const { isAuthenticated, isProvider } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
      {/* ============================================= */}
      <Route
        path="/user/home"
        element={
          <ProtectedRoute>
            <HomeScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/services"
        element={
          <ProtectedRoute>
            <ServicesScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/providers"
        element={
          <ProtectedRoute>
            <ProvidersListScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/providers/:userId"
        element={
          <ProtectedRoute>
            <ProviderProfileScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/wallet"
        element={
          <ProtectedRoute>
            <WalletScreen />
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

      {/* ============================================= */}
      {/* SHARED ROUTES - Accessible by both roles */}
      {/* ============================================= */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfileScreen />
          </ProtectedRoute>
        }
      />

      {/* ============================================= */}
      {/* LEGACY ROUTES - Backward compatibility */}
      {/* ============================================= */}
      
      {/* USER (CUSTOMER) ROUTES */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomeScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <ServicesScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/providers"
        element={
          <ProtectedRoute>
            <ProvidersListScreen />
          </ProtectedRoute>
        }
      />
      {/* Legacy route for backward compatibility */}
      <Route
        path="/stylists"
        element={
          <ProtectedRoute>
            <ProvidersListScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/providers/:userId"
        element={
          <ProtectedRoute>
            <ProviderProfileScreen />
          </ProtectedRoute>
        }
      />
      {/* Legacy route */}
      <Route
        path="/stylists/:userId"
        element={
          <ProtectedRoute>
            <ProviderProfileScreen />
          </ProtectedRoute>
        }
      />
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

      {/* Catch all - redirect based on auth state and role */}
      <Route path="*" element={<RoleBasedRedirect />} />
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
