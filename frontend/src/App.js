import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Auth Screens
import SignUpScreen from "@/screens/SignUpScreen";
import LoginScreen from "@/screens/LoginScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";

// App Screens
import HomeScreen from "@/screens/HomeScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import StylistsListScreen from "@/screens/StylistsListScreen";
import StylistProfileScreen from "@/screens/StylistProfileScreen";
import WalletScreen from "@/screens/WalletScreen";
import ServicesScreen from "@/screens/ServicesScreen";

// Components
import LoadingSpinner from "@/components/LoadingSpinner";

/**
 * ProtectedRoute - Requires authentication only
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
 * Redirects to home if already authenticated
 */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

function AppRoutes() {
  const { userData, isAuthenticated } = useAuth();

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

      {/* Protected Routes - Require authentication */}
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
        path="/services"
        element={
          <ProtectedRoute>
            <ServicesScreen currentUser={userData} />
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
            ? <Navigate to="/home" replace />
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
