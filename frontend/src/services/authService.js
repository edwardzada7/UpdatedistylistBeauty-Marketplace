import { supabase } from '@/lib/supabaseClient';
import { usersAPI } from '@/services/api';

export const authService = {
  // Sign up with phone (mandatory first step)
  signUpWithPhone: async (phone, name, role = 'customer') => {
    try {
      // Send OTP to phone
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: phone,
      });

      if (error) throw error;

      return {
        success: true,
        message: 'OTP sent to your phone',
        phone,
        name,
        role,
      };
    } catch (error) {
      console.error('Phone sign up error:', error);
      throw error;
    }
  },

  // Verify phone OTP and create user (with optional email/password)
  verifyPhoneAndCreateUser: async (phone, otp, name, role = 'customer', email = null, password = null) => {
    try {
      // Step 1: Verify OTP
      const { data: authData, error: authError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to verify OTP');

      // Step 2: If email/password provided, update auth user
      if (email && password) {
        const { error: updateError } = await supabase.auth.updateUser({
          email: email,
          password: password,
        });

        if (updateError && !updateError.message.includes('already registered')) {
          console.warn('Email update warning:', updateError);
        }
      }

      // Step 3: Create or update user record in database
      const userData = {
        auth_id: authData.user.id,
        email: email || `${phone.replace(/[^0-9]/g, '')}@phone.user`,
        name: name,
        phone: phone,
        role: role,
        phone_verified: true, // Mark as verified
      };

      try {
        // Check if user already exists
        const existingUser = await usersAPI.getByAuthId(authData.user.id);
        // Update existing user
        const userResponse = await usersAPI.update(existingUser.data.id, {
          phone_verified: true,
          phone: phone,
        });
        return {
          user: authData.user,
          userData: userResponse.data,
          session: authData.session,
        };
      } catch (error) {
        // User doesn't exist, create new
        const userResponse = await usersAPI.create(userData);
        return {
          user: authData.user,
          userData: userResponse.data,
          session: authData.session,
        };
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      throw error;
    }
  },

  // Sign in with phone (primary login method)
  signInWithPhone: async (phone) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: phone,
      });

      if (error) throw error;

      return {
        success: true,
        message: 'OTP sent to your phone',
        phone,
      };
    } catch (error) {
      console.error('Phone sign in error:', error);
      throw error;
    }
  },

  // Verify phone OTP for login
  verifyPhoneOTPLogin: async (phone, otp) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to verify OTP');

      // Fetch user data from database
      const userResponse = await usersAPI.getByAuthId(authData.user.id);
      const userData = userResponse.data;

      // Check if phone is verified
      if (!userData.phone_verified) {
        // Update phone verification status
        await usersAPI.update(userData.id, { phone_verified: true });
        userData.phone_verified = true;
      }

      return {
        user: authData.user,
        userData: userData,
        session: authData.session,
      };
    } catch (error) {
      console.error('OTP login verification error:', error);
      throw error;
    }
  },

  // Sign in with email and password (secondary method, requires phone verification)
  signInWithEmail: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Invalid credentials');

      // Fetch user data from database
      const userResponse = await usersAPI.getByAuthId(data.user.id);
      const userData = userResponse.data;

      // Check if phone is verified
      if (!userData.phone_verified) {
        return {
          user: data.user,
          userData: userData,
          session: data.session,
          requiresPhoneVerification: true,
        };
      }

      return {
        user: data.user,
        userData: userData,
        session: data.session,
        requiresPhoneVerification: false,
      };
    } catch (error) {
      console.error('Email sign in error:', error);
      throw error;
    }
  },

  // Request phone verification for existing user
  requestPhoneVerification: async (phone) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: phone,
      });

      if (error) throw error;

      return {
        success: true,
        message: 'OTP sent to your phone',
      };
    } catch (error) {
      console.error('Request phone verification error:', error);
      throw error;
    }
  },

  // Verify phone for existing user
  verifyExistingUserPhone: async (phone, otp, userId) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (authError) throw authError;

      // Update user phone verification status
      await usersAPI.update(userId, {
        phone: phone,
        phone_verified: true,
      });

      return {
        success: true,
        message: 'Phone verified successfully',
      };
    } catch (error) {
      console.error('Phone verification error:', error);
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
