import { supabase } from '@/lib/supabaseClient';
import { usersAPI } from '@/services/api';

export const authService = {
  // Sign up with email and password
  signUp: async (email, password, name, role = 'customer') => {
    try {
      // Step 1: Create auth user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Step 2: Create user record in users table
      const userData = {
        auth_id: authData.user.id,
        email: email,
        name: name,
        role: role,
      };

      const userResponse = await usersAPI.create(userData);

      return {
        user: authData.user,
        userData: userResponse.data,
        session: authData.session,
      };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  },

  // Sign in with email and password
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Invalid credentials');

      // Fetch user data from database
      const userResponse = await usersAPI.getByAuthId(data.user.id);

      return {
        user: data.user,
        userData: userResponse.data,
        session: data.session,
      };
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  },

  // Sign out
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  // Get current session
  getSession: async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) return null;

      // Fetch user data from database
      const userResponse = await usersAPI.getByAuthId(user.id);
      return {
        user,
        userData: userResponse.data,
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  // Reset password
  resetPassword: async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  },

  // Listen to auth state changes
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};
