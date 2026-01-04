import { createContext, useContext, useEffect, useState } from "react";
import {
  getCurrentUser,
  onAuthStateChange,
  signOut as authSignOut,
} from "@/services/authService";
import LoadingSpinner from "@/components/LoadingSpinner";

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const result = await getCurrentUser();

      if (result?.user) {
        setUser(result.user);
        setUserData(result.userData || null);
      } else {
        setUser(null);
        setUserData(null);
      }
    } catch (e) {
      console.error("Auth load error:", e);
      setUser(null);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();

    const { data: listener } = onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await authSignOut();
    setUser(null);
    setUserData(null);
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        signOut,
        isAuthenticated: !!user,

        // 🔕 PHONE VERIFICATION FULLY BYPASSED
        needsPhoneVerification: false,
        isPhoneVerified: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
