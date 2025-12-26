import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '@/services/authService';
import LoadingSpinner from '@/components/LoadingSpinner';
import PhoneVerificationGate from '@/components/PhoneVerificationGate';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Check active session on mount
    checkUser();

    // Listen for auth changes
    const { data: authListener } = authService.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        
        if (session?.user) {
          try {
            const currentUser = await authService.getCurrentUser();
            if (currentUser) {
              setUser(currentUser.user);
              setUserData(currentUser.userData);
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
            setUser(session.user);
            setUserData(null);
          }
        } else {
          setUser(null);
          setUserData(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser.user);
        setUserData(currentUser.userData);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneVerified = async () => {
    // Reload user data after phone verification
    await checkUser();
  };

  const value = {
    user,
    userData,
    session,
    loading,
    signOut: authService.signOut,
    isAuthenticated: !!user,
    isPhoneVerified: userData?.phone_verified || false,
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Show phone verification gate if user is authenticated but phone not verified
  if (user && userData && !userData.phone_verified) {
    return (
      <PhoneVerificationGate
        user={user}
        userData={userData}
        onVerified={handlePhoneVerified}
      />
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
