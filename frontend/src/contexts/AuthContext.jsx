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
      console.log('[AuthContext] Checking user...');
      const current = await getCurrentUser();
      
      if (current) {
        console.log('[AuthContext] User found:', current.user?.email);
        console.log('[AuthContext] User data:', current.userData);
        setUser(current.user);
        setUserData(current.userData);
      } else {
        console.log('[AuthContext] No user found');
        setUser(null);
        setUserData(null);
      }
    } catch (error) {
      console.error('[AuthContext] Check user error:', error);
      setUser(null);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Expose refreshUser for manual refresh after login
  const refreshUser = useCallback(async () => {
    console.log('[AuthContext] Refreshing user data...');
    setLoading(true);
    await checkUser();
  }, [checkUser]);

  useEffect(() => {
    // Initial check
    checkUser();

    // Listen for auth state changes
    const { data: authListener } = onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth state changed:', event);
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
    console.log('[AuthContext] Signing out...');
    await authSignOut();
    setUser(null);
    setUserData(null);
    setSession(null);
  };

  // Show loading spinner while checking auth
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // IMPORTANT: Phone verification check
  // - If userData exists, check phone_verified field (defaults to false for enforcement)
  // - If userData is null but user exists, user needs to be created in backend first
  const isPhoneVerified = userData?.phone_verified === true;
  
  // User needs phone verification if:
  // - User is authenticated AND
  // - Either userData is null (new user) OR phone_verified is explicitly false
  const needsPhoneVerification = !!user && (!userData || userData.phone_verified === false);

  const value = {
    user,
    userData,
    session,
    loading,
    signOut,
    refreshUser,
    isAuthenticated: !!user,
    isPhoneVerified,
    needsPhoneVerification,
  };

  console.log('[AuthContext] Current state:', {
    isAuthenticated: !!user,
    hasUserData: !!userData,
    isPhoneVerified,
    needsPhoneVerification,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
