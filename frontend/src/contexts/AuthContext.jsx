import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '@/services/authService';
import LoadingSpinner from '@/components/LoadingSpinner';

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
    // Check active session
    checkUser();

    // Listen for auth changes
    const { data: authListener } = authService.onAuthStateChange(
      async (event, session) => {
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

  const signUp = async (email, password, name, role) => {
    const result = await authService.signUp(email, password, name, role);
    setUser(result.user);
    setUserData(result.userData);
    setSession(result.session);
    return result;
  };

  const signIn = async (email, password) => {
    const result = await authService.signIn(email, password);
    setUser(result.user);
    setUserData(result.userData);
    setSession(result.session);
    return result;
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setUserData(null);
    setSession(null);
  };

  const value = {
    user,
    userData,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
