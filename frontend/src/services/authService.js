import { supabase, createFreshSupabaseClient } from "@/lib/supabaseClient";

/* ===============================
   AUTH HELPERS - Supabase Client
================================ */

/**
 * Safely extract error message from any error type
 */
function getErrorMessage(error, fallback = "An error occurred") {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.message && typeof error.message === 'string') return error.message;
  if (error.error_description) return error.error_description;
  if (error.msg) return error.msg;
  return fallback;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail({ email, password, phone, fullName, role }) {
  try {
    // Use a fresh client to avoid potential body stream issues
    const freshClient = createFreshSupabaseClient();
    
    const { data, error } = await freshClient.auth.signUp({
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
      // Extract error message safely without accessing response body
      const errorMsg = error.message || error.error_description || "Failed to sign up";
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    // Avoid re-throwing objects that might have consumed body streams
    if (err instanceof Error) {
      throw err;
    }
    const msg = typeof err === 'string' ? err : (err?.message || "Failed to sign up");
    throw new Error(msg);
  }
}

/**
 * Login with email and password
 */
export async function loginWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(getErrorMessage(error, "Failed to login"));
    }
    return data;
  } catch (err) {
    throw err instanceof Error ? err : new Error(getErrorMessage(err, "Failed to login"));
  }
}

/**
 * Send OTP to phone number
 * Uses fresh client to avoid body stream issues
 */
export async function sendSignUpOTP(phone) {
  console.log("[authService] Sending OTP to:", phone);
  
  try {
    // Use fresh client to avoid stream issues
    const freshClient = createFreshSupabaseClient();
    
    const { data, error } = await freshClient.auth.signInWithOtp({
      phone: phone,
    });

    if (error) {
      console.error("[authService] sendSignUpOTP Supabase error:", error);
      const msg = getErrorMessage(error, "Failed to send OTP");
      throw new Error(msg);
    }
    
    console.log("[authService] OTP sent successfully");
    return true;
  } catch (err) {
    console.error("[authService] sendSignUpOTP error:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(getErrorMessage(err, "Failed to send OTP"));
  }
}

/**
 * Send OTP for login
 */
export async function sendLoginOTP(phone) {
  console.log("[authService] Sending login OTP to:", phone);
  
  try {
    const freshClient = createFreshSupabaseClient();
    
    const { data, error } = await freshClient.auth.signInWithOtp({
      phone: phone,
    });

    if (error) {
      console.error("[authService] sendLoginOTP error:", error);
      throw new Error(getErrorMessage(error, "Failed to send OTP"));
    }
    
    return true;
  } catch (err) {
    console.error("[authService] sendLoginOTP error:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(getErrorMessage(err, "Failed to send OTP"));
  }
}

/**
 * Verify phone OTP code
 */
export async function verifyPhoneOTP(phone, token) {
  console.log("[authService] Verifying OTP for:", phone);
  
  try {
    // Use main client for verification to maintain session
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: "sms",
    });

    if (error) {
      console.error("[authService] verifyPhoneOTP error:", error);
      throw new Error(getErrorMessage(error, "Invalid OTP code"));
    }
    
    console.log("[authService] OTP verified successfully");
    return data;
  } catch (err) {
    console.error("[authService] verifyPhoneOTP error:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(getErrorMessage(err, "Failed to verify OTP"));
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    
    if (error) {
      throw new Error(getErrorMessage(error, "Failed to send reset email"));
    }
    return true;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(getErrorMessage(err, "Failed to send reset email"));
  }
}

/**
 * Get current authenticated user and their profile data
 */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      if (!error.message?.includes('session missing')) {
        console.error("[authService] getUser error:", error);
      }
      return null;
    }
    
    const user = data?.user ?? null;
    if (!user) return null;
    
    // Fetch user profile from backend
    try {
      const API_BASE = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${API_BASE}/api/users/by-auth/${user.id}`);
      
      if (response.ok) {
        const userData = await response.json();
        return { user, userData };
      }
      return { user, userData: null };
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
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Sign out current user
 */
export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[authService] signOut error:", err);
  }
}

/**
 * Update user phone number
 */
export async function updateUserPhone(phone) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      phone: phone,
    });

    if (error) {
      throw new Error(getErrorMessage(error, "Failed to update phone"));
    }
    return data;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(getErrorMessage(err, "Failed to update phone"));
  }
}
