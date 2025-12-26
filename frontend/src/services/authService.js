import { supabase } from '@/lib/supabaseClient';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL + '/api';

// ==================== SIGN UP ====================

export const sendSignUpOTP = async (phone) => {
  const { data, error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
  return data;
};

export const completeSignUp = async (phone, otp, name, email, password, role) => {
  // Step 1: Verify OTP
  const { data: authData, error: otpError } = await supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: 'sms',
  });
  if (otpError) throw otpError;
  if (!authData.user) throw new Error('OTP verification failed');

  // Step 2: Update with email/password
  if (email && password) {
    await supabase.auth.updateUser({ email, password });
  }

  // Step 3: Create user in database
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
};

// ==================== LOGIN ====================

export const loginWithEmail = async (email, password) => {
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
};

export const sendLoginOTP = async (phone) => {
  const { data, error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
  return data;
};

export const verifyLoginOTP = async (phone, otp) => {
  const { data: authData, error } = await supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: 'sms',
  });
  if (error) throw error;
  if (!authData.user) throw new Error('OTP verification failed');

  const response = await axios.get(`${API_BASE}/users/by-auth/${authData.user.id}`);
  
  if (!response.data.phone_verified) {
    await axios.put(`${API_BASE}/users/${response.data.id}`, { phone_verified: true, phone });
    response.data.phone_verified = true;
  }

  return {
    user: authData.user,
    userData: response.data,
    session: authData.session,
  };
};

// ==================== PHONE VERIFICATION ====================

export const sendVerificationOTP = async (phone) => {
  const { data, error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
  return data;
};

export const verifyPhone = async (phone, otp, userId) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: 'sms',
  });
  if (error) throw error;

  await axios.put(`${API_BASE}/users/${userId}`, { phone, phone_verified: true });
  return data;
};

// ==================== UTILITY ====================

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) return null;

  const response = await axios.get(`${API_BASE}/users/by-auth/${user.id}`);
  return { user, userData: response.data };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resetPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
};

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};
