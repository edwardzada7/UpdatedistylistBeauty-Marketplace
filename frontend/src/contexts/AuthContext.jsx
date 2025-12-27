import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUser, signOut as authSignOut, onAuthStateChange } from '@/services/authService';
import LoadingSpinner from '@/components/LoadingSpinner';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  // Function to check and update user data
  const checkUser = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      if (current) {
        setUser(current.user);
        setUserData(current.userData);
      } else {
        setUser(null);
        setUserData(null);
      }
    } catch (error) {
      console.error('Check user error:', error);
      setUser(null);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Expose refreshUser for manual refresh after login
  const refreshUser = useCallback(async () => {
    await checkUser();
  }, [checkUser]);

  useEffect(() => {
    // Initial check
    checkUser();

    // Listen for auth state changes
    const { data: authListener } = onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      setSession(session);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // User signed in - refresh user data
        await checkUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => authListener?.subscription?.unsubscribe();
  }, [checkUser]);

  const signOut = async () => {
    await authSignOut();
    setUser(null);
    setUserData(null);
    setSession(null);
  };

  // Show loading spinner while checking auth
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Compute phone verification status
  // If userData exists and has phone_verified field, use it
  // Otherwise, for testing purposes, consider verified if no userData (new user)
  const isPhoneVerified = userData?.phone_verified ?? true; // Default to true for testing

  const value = {
    user,
    userData,
    session,
    loading,
    signOut,
    refreshUser,
    isAuthenticated: !!user,
    isPhoneVerified,
    // Helper to check if user needs phone verification
    needsPhoneVerification: !!user && userData && !userData.phone_verified,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
