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
   * Create user in backend if doesn't exist
   */
  const ensureUserExists = async (authUser) => {
    if (!authUser) return null;
    
    try {
      // Try to get existing user
      const response = await usersAPI.getByAuthId(authUser.id);
      return response.data;
    } catch (error) {
      // User doesn't exist, create one
      if (error.response?.status === 404) {
        const newUserData = {
          auth_id: authUser.id,
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          email: authUser.email,
          phone: authUser.user_metadata?.phone || null,
          role: authUser.user_metadata?.role || 'user',
          phone_verified: false,
        };
        
        try {
          const createResponse = await usersAPI.create(newUserData);
          console.log("[AuthContext] Created new user:", createResponse.data);
          return createResponse.data;
        } catch (createError) {
          console.error("[AuthContext] Failed to create user:", createError);
          return null;
        }
      }
      console.error("[AuthContext] Error fetching user:", error);
      return null;
    }
  };

  /**
   * Ensure provider profile exists for stylist users
   */
  const ensureProviderExists = async (userRecord) => {
    if (!userRecord || (userRecord.role !== 'stylist' && userRecord.role !== 'provider')) {
      return null;
    }
    
    try {
      // Try to get existing provider profile
      const response = await stylistsAPI.getById(userRecord.id);
      return response.data;
    } catch (error) {
      // Provider profile doesn't exist, create one
      if (error.response?.status === 404) {
        try {
          const registerResponse = await stylistsAPI.register(userRecord.id, 0, null, null);
          console.log("[AuthContext] Created provider profile:", registerResponse.data);
          return registerResponse.data?.provider || null;
        } catch (regError) {
          console.error("[AuthContext] Failed to create provider:", regError);
          return null;
        }
      }
      console.error("[AuthContext] Error fetching provider:", error);
      return null;
    }
  };

  /**
   * Load user and related data
   */
  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCurrentUser();

      if (result?.user) {
        setUser(result.user);
        
        // Ensure user exists in backend and get/create their record
        let userRecord = result.userData;
        if (!userRecord) {
          userRecord = await ensureUserExists(result.user);
        }
        setUserData(userRecord);
        
        // If user is a provider, ensure provider profile exists
        if (userRecord && (userRecord.role === "stylist" || userRecord.role === "provider")) {
          const provider = await ensureProviderExists(userRecord);
          setProviderData(provider);
        } else {
          setProviderData(null);
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
        
        // Phone verification bypassed
        needsPhoneVerification: false,
        isPhoneVerified: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
