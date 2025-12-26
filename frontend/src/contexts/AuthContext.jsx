import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, signOut as authSignOut, onAuthStateChange } from '@/services/authService';
import LoadingSpinner from '@/components/LoadingSpinner';
import PhoneVerificationGate from '@/components/PhoneVerificationGate';

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

  useEffect(() => {
    checkUser();

    const { data: authListener } = onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        try {
          const current = await getCurrentUser();
          if (current) {
            setUser(current.user);
            setUserData(current.userData);
          }
        } catch (error) {
          console.error('Auth state error:', error);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => authListener?.subscription?.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const current = await getCurrentUser();
      if (current) {
        setUser(current.user);
        setUserData(current.userData);
      }
    } catch (error) {
      console.error('Check user error:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await authSignOut();
    setUser(null);
    setUserData(null);
    setSession(null);
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading..." />;

  if (user && userData && !userData.phone_verified) {
    return <PhoneVerificationGate user={user} userData={userData} onVerified={checkUser} />;
  }

  const value = {
    user,
    userData,
    session,
    loading,
    signOut,
    isAuthenticated: !!user,
    isPhoneVerified: userData?.phone_verified || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
