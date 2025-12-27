import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Auth Screens
import SignUpScreen from "@/screens/SignUpScreen";
import LoginScreen from "@/screens/LoginScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import VerifyOTPScreen from "@/screens/VerifyOTPScreen";

// App Screens
import HomeScreen from "@/screens/HomeScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import StylistsListScreen from "@/screens/StylistsListScreen";
import StylistProfileScreen from "@/screens/StylistProfileScreen";
import WalletScreen from "@/screens/WalletScreen";

// Phone Verification Component
import PhoneVerificationGate from "@/components/PhoneVerificationGate";

// Protected Route Component - requires authentication
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, needsPhoneVerification, user, userData, refreshUser } = useAuth();

  if (loading) {
    return null; // AuthContext handles loading state
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user needs phone verification, show the gate
  if (needsPhoneVerification) {
    return (
      <PhoneVerificationGate 
        user={user} 
        userData={userData} 
        onVerified={refreshUser} 
      />
    );
  }

  return children;
};

// Public Route Component (redirect to home if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  const { userData, isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
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
      {/* OTP Verification for phone login - public route */}
      <Route
        path="/verify-otp"
        element={<VerifyOTPScreen />}
      />

      {/* Protected Routes */}
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

      {/* Catch all - redirect to home if authenticated, login if not */}
      <Route
        path="*"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Navigate to="/login" replace />
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
