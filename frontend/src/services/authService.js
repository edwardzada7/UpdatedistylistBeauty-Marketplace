import { supabase } from '@/lib/supabaseClient';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL + '/api';

export const authService = {
  // SIGN UP: Send OTP to phone
  sendSignUpOTP: async (phone) => {
    const { data, error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
    return data;
  },

  // SIGN UP: Verify OTP and create account
  completeSignUp: async (phone, otp, name, email, password, role) => {
    // Verify OTP
    const { data: authData, error: otpError } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (otpError) throw otpError;
    if (!authData.user) throw new Error('OTP verification failed');

    // Update auth user with email/password
    if (email && password) {
      await supabase.auth.updateUser({ email, password });
    }

    // Create user in database
    const userPayload = {
      auth_id: authData.user.id,
      name,
      email: email || `${phone.replace(/\D/g, '')}@phone.user`,
      phone,
      role,
      phone_verified: true,
    };

    const response = await axios.post(`${API_BASE}/users`, userPayload);
    return {
      user: authData.user,
      userData: response.data,
      session: authData.session,
    };
  },

  // LOGIN: Email + Password
  loginWithEmail: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Login failed');

    const response = await axios.get(`${API_BASE}/users/by-auth/${data.user.id}`);
    return {
      user: data.user,
      userData: response.data,
      session: data.session,
      requiresPhoneVerification: !response.data.phone_verified,
    };
  },

  // LOGIN: Phone - Send OTP
  sendLoginOTP: async (phone) => {
    const { data, error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
    return data;
  },

  // LOGIN: Phone - Verify OTP
  verifyLoginOTP: async (phone, otp) => {
    const { data: authData, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) throw error;
    if (!authData.user) throw new Error('OTP verification failed');

    const response = await axios.get(`${API_BASE}/users/by-auth/${authData.user.id}`);
    
    // Update verification status if needed
    if (!response.data.phone_verified) {
      await axios.put(`${API_BASE}/users/${response.data.id}`, { phone_verified: true, phone });
      response.data.phone_verified = true;
    }

    return {
      user: authData.user,
      userData: response.data,
      session: authData.session,
    };
  },

  // Verify phone for existing user
  verifyExistingUserPhone: async (phone, otp, userId) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) throw error;

    await axios.put(`${API_BASE}/users/${userId}`, { phone, phone_verified: true });
    return data;
  },

  // Get current user
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) return null;

    const response = await axios.get(`${API_BASE}/users/by-auth/${user.id}`);
    return { user, userData: response.data };
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Auth state listener
  onAuthStateChange: (callback) => supabase.auth.onAuthStateChange(callback),

  // Reset password
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },
};
