import { supabase } from '@/lib/supabaseClient';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL + '/api';

export const authService = {
  // Unified Sign Up: Send OTP first
  sendSignUpOTP: async (phone) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone,
    });
    if (error) throw error;
    return data;
  },

  // Verify OTP and create complete user account
  verifyOTPAndCreateAccount: async (phone, otp, userData) => {
    // Step 1: Verify OTP with Supabase
    const { data: authData, error: otpError } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (otpError) throw otpError;
    if (!authData.user) throw new Error('OTP verification failed');

    // Step 2: Update Supabase Auth user with email/password if provided
    if (userData.email && userData.password) {
      const { error: updateError } = await supabase.auth.updateUser({
        email: userData.email,
        password: userData.password,
      });
      if (updateError) console.warn('Email update warning:', updateError);
    }

    // Step 3: Create user record in database (single call)
    const userPayload = {
      auth_id: authData.user.id,
      name: userData.name,
      email: userData.email || `${phone.replace(/\D/g, '')}@phone.user`,
      phone: phone,
      role: userData.role,
      phone_verified: true,
    };

    const response = await axios.post(`${API_BASE}/users`, userPayload);
    return {
      user: authData.user,
      userData: response.data,
      session: authData.session,
    };
  },

  // Login with phone (send OTP)
  sendLoginOTP: async (phone) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone,
    });
    if (error) throw error;
    return data;
  },

  // Verify login OTP
  verifyLoginOTP: async (phone, otp) => {
    const { data: authData, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) throw error;
    if (!authData.user) throw new Error('OTP verification failed');

    // Fetch user data from database
    const response = await axios.get(`${API_BASE}/users/by-auth/${authData.user.id}`);
    
    // Update phone_verified if not already
    if (!response.data.phone_verified) {
      await axios.put(`${API_BASE}/users/${response.data.id}`, {
        phone_verified: true,
        phone: phone,
      });
      response.data.phone_verified = true;
    }

    return {
      user: authData.user,
      userData: response.data,
      session: authData.session,
    };
  },

  // Login with email + password
  loginWithEmail: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Invalid credentials');

    // Fetch user data
    const response = await axios.get(`${API_BASE}/users/by-auth/${data.user.id}`);

    return {
      user: data.user,
      userData: response.data,
      session: data.session,
      requiresPhoneVerification: !response.data.phone_verified,
    };
  },

  // Send verification OTP for existing user
  sendVerificationOTP: async (phone) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone,
    });
    if (error) throw error;
    return data;
  },

  // Verify phone for existing user
  verifyPhone: async (phone, otp, userId) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) throw error;

    // Update user record
    await axios.put(`${API_BASE}/users/${userId}`, {
      phone: phone,
      phone_verified: true,
    });

    return data;
  },

  // Get current user
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) return null;

    const response = await axios.get(`${API_BASE}/users/by-auth/${user.id}`);
    return {
      user,
      userData: response.data,
    };
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Listen to auth changes
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  },

  // Reset password
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },
};
