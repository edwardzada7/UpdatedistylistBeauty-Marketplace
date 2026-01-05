import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  getCurrentUser,
  onAuthStateChange,
  signOut as authSignOut,
} from "@/services/authService";
import { usersAPI, stylistsAPI } from "@/services/api";
import LoadingSpinner from "@/components/LoadingSpinner";

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);           // Supabase auth user
  const [userData, setUserData] = useState(null);   // User data from our backend
  const [providerData, setProviderData] = useState(null); // Provider/stylist profile if exists
  const [loading, setLoading] = useState(true);

  /**
   * Get display name from userData or user metadata
   */
  const getDisplayName = useCallback(() => {
    // Try userData first
    if (userData?.name) return userData.name;
    // Try Supabase user metadata
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    // Try email prefix
    if (userData?.email) return userData.email.split('@')[0];
    if (user?.email) return user.email.split('@')[0];
    return "User";
  }, [user, userData]);

  /**
   * Get user role (user or stylist)
   */
  const getRole = useCallback(() => {
    // Check userData first
    if (userData?.role) return userData.role;
    // Check user metadata
    if (user?.user_metadata?.role) return user.user_metadata.role;
    return "user";
  }, [user, userData]);

  /**
   * Check if user is a provider (stylist)
   */
  const isProvider = useCallback(() => {
    const role = getRole();
    return role === "stylist" || role === "provider";
  }, [getRole]);

  /**
   * Load user and related data
   */
  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCurrentUser();

      if (result?.user) {
        setUser(result.user);
        setUserData(result.userData || null);
        
        // If user is a provider, try to load their provider profile
        if (result.userData?.role === "stylist" || result.userData?.role === "provider") {
          try {
            const providerResponse = await stylistsAPI.getById(result.userData.id);
            setProviderData(providerResponse.data);
          } catch (e) {
            // Provider profile might not exist yet
            console.log("No provider profile found:", e.message);
            setProviderData(null);
          }
        }
      } else {
        setUser(null);
        setUserData(null);
        setProviderData(null);
      }
    } catch (e) {
      console.error("Auth load error:", e);
      setUser(null);
      setUserData(null);
      setProviderData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh user data
   */
  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadUser();

    const { data: listener } = onAuthStateChange((event) => {
      console.log("[AuthContext] Auth state changed:", event);
      loadUser();
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, [loadUser]);

  const signOut = async () => {
    await authSignOut();
    setUser(null);
    setUserData(null);
    setProviderData(null);
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading your profile..." />;
  }

  const displayName = getDisplayName();
  const role = getRole();

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        providerData,
        signOut,
        refreshUser,
        isAuthenticated: !!user,
        loading,
        
        // Display helpers
        displayName,
        role,
        isProvider: isProvider(),
        
        // 🔕 PHONE VERIFICATION FULLY BYPASSED
        needsPhoneVerification: false,
        isPhoneVerified: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
