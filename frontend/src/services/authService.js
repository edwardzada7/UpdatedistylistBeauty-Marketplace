import { supabase } from "@/lib/supabaseClient";

/* ===============================
   AUTH HELPERS - Supabase Client
   All functions use Supabase JS client
   Error handling returns proper error messages
================================ */

/**
 * Sign up with email and password
 * @param {Object} params - { email, password, phone, fullName, role }
 * @returns {Object} Supabase auth data
 */
export async function signUpWithEmail({ email, password, phone, fullName, role }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
        phone,
      },
    },
  });

  if (error) {
    console.error("[authService] signUpWithEmail error:", error);
    throw new Error(error.message || "Failed to sign up");
  }
  return data;
}

/**
 * Login with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Object} Supabase auth data with session
 */
export async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[authService] loginWithEmail error:", error);
    throw new Error(error.message || "Failed to login");
  }
  return data;
}

/**
 * Send OTP to phone number for sign up / verification
 * Uses Supabase signInWithOtp for phone authentication
 * @param {string} phone - Phone number with country code (e.g., +234801234567)
 * @returns {boolean} true if OTP sent successfully
 */
export async function sendSignUpOTP(phone) {
  console.log("[authService] Sending OTP to:", phone);
  
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: phone,
  });

  if (error) {
    console.error("[authService] sendSignUpOTP error:", error);
    // Create a new Error with the message to avoid response body issues
    const errorMessage = typeof error === 'object' && error.message 
      ? error.message 
      : "Failed to send OTP";
    throw new Error(errorMessage);
  }
  
  console.log("[authService] OTP sent successfully");
  return true;
}

/**
 * Send OTP for login (same as signup OTP for Supabase)
 * @param {string} phone - Phone number with country code
 * @returns {boolean} true if OTP sent successfully
 */
export async function sendLoginOTP(phone) {
  console.log("[authService] Sending login OTP to:", phone);
  
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: phone,
  });

  if (error) {
    console.error("[authService] sendLoginOTP error:", error);
    const errorMessage = typeof error === 'object' && error.message 
      ? error.message 
      : "Failed to send OTP";
    throw new Error(errorMessage);
  }
  
  console.log("[authService] Login OTP sent successfully");
  return true;
}

/**
 * Verify phone OTP code
 * @param {string} phone - Phone number with country code
 * @param {string} token - 6-digit OTP code
 * @returns {Object} Supabase auth data with session
 */
export async function verifyPhoneOTP(phone, token) {
  console.log("[authService] Verifying OTP for:", phone);
  
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phone,
    token: token,
    type: "sms",
  });

  if (error) {
    console.error("[authService] verifyPhoneOTP error:", error);
    // Extract error message safely without reading response body
    const errorMessage = typeof error === 'object' && error.message 
      ? error.message 
      : "Invalid OTP code";
    throw new Error(errorMessage);
  }
  
  console.log("[authService] OTP verified successfully");
  return data;
}

/**
 * Send password reset email
 * @param {string} email 
 * @returns {boolean} true if email sent
 */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  
  if (error) {
    console.error("[authService] resetPassword error:", error);
    throw new Error(error.message || "Failed to send reset email");
  }
  return true;
}

/**
 * Get current authenticated user and their profile data
 * @returns {Object|null} { user, userData } or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error("[authService] getUser error:", error);
      return null;
    }
    
    const user = data?.user ?? null;
    
    if (!user) {
      return null;
    }
    
    // Fetch user profile data from backend
    try {
      const API_BASE = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${API_BASE}/api/users/by-auth/${user.id}`);
      
      if (response.ok) {
        const userData = await response.json();
        return { user, userData };
      } else {
        console.log("[authService] No user data in backend, returning user only");
        return { user, userData: null };
      }
    } catch (fetchError) {
      console.error("[authService] Error fetching user data:", fetchError);
      return { user, userData: null };
    }
  } catch (err) {
    console.error("[authService] getCurrentUser error:", err);
    return null;
  }
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called with (event, session)
 * @returns {Object} Supabase subscription object
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("[authService] signOut error:", error);
  }
}

/**
 * Update user phone number in Supabase Auth
 * @param {string} phone - New phone number
 * @returns {Object} Updated user data
 */
export async function updateUserPhone(phone) {
  const { data, error } = await supabase.auth.updateUser({
    phone: phone,
  });

  if (error) {
    console.error("[authService] updateUserPhone error:", error);
    throw new Error(error.message || "Failed to update phone");
  }
  return data;
}
