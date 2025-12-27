import { supabase } from "@/lib/supabaseClient";

/* ===============================
   AUTH HELPERS - Supabase Client
   All functions use Supabase JS client
   Error handling returns proper error messages
================================ */

/**
 * Safely extract error message from any error type
 * Prevents "body stream already read" errors
 */
function getErrorMessage(error, fallback = "An error occurred") {
  if (!error) return fallback;
  
  // If it's already a string, return it
  if (typeof error === 'string') return error;
  
  // If it has a message property, use it
  if (error.message && typeof error.message === 'string') {
    return error.message;
  }
  
  // If it has an error_description (Supabase format)
  if (error.error_description && typeof error.error_description === 'string') {
    return error.error_description;
  }
  
  // If it has a msg property
  if (error.msg && typeof error.msg === 'string') {
    return error.msg;
  }
  
  // Try to get name if available
  if (error.name && typeof error.name === 'string') {
    return error.name;
  }
  
  return fallback;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail({ email, password, phone, fullName, role }) {
  try {
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
      throw new Error(getErrorMessage(error, "Failed to sign up"));
    }
    return data;
  } catch (err) {
    console.error("[authService] signUpWithEmail caught:", err);
    throw err instanceof Error ? err : new Error(getErrorMessage(err, "Failed to sign up"));
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
      console.error("[authService] loginWithEmail error:", error);
      throw new Error(getErrorMessage(error, "Failed to login"));
    }
    return data;
  } catch (err) {
    console.error("[authService] loginWithEmail caught:", err);
    throw err instanceof Error ? err : new Error(getErrorMessage(err, "Failed to login"));
  }
}

/**
 * Send OTP to phone number for sign up / verification
 */
export async function sendSignUpOTP(phone) {
  console.log("[authService] Sending OTP to:", phone);
  
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone,
    });

    if (error) {
      console.error("[authService] sendSignUpOTP error object:", error);
      // Extract message immediately and create new Error
      const msg = getErrorMessage(error, "Failed to send OTP");
      throw new Error(msg);
    }
    
    console.log("[authService] OTP sent successfully, data:", data);
    return true;
  } catch (err) {
    console.error("[authService] sendSignUpOTP caught:", err);
    // Ensure we always throw a proper Error with string message
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
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone,
    });

    if (error) {
      console.error("[authService] sendLoginOTP error:", error);
      const msg = getErrorMessage(error, "Failed to send OTP");
      throw new Error(msg);
    }
    
    console.log("[authService] Login OTP sent successfully");
    return true;
  } catch (err) {
    console.error("[authService] sendLoginOTP caught:", err);
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
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: "sms",
    });

    if (error) {
      console.error("[authService] verifyPhoneOTP error:", error);
      const msg = getErrorMessage(error, "Invalid OTP code");
      throw new Error(msg);
    }
    
    console.log("[authService] OTP verified successfully");
    return data;
  } catch (err) {
    console.error("[authService] verifyPhoneOTP caught:", err);
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
      console.error("[authService] resetPassword error:", error);
      throw new Error(getErrorMessage(error, "Failed to send reset email"));
    }
    return true;
  } catch (err) {
    console.error("[authService] resetPassword caught:", err);
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
      // Don't log "Auth session missing" as error - it's expected when not logged in
      if (!error.message?.includes('session missing')) {
        console.error("[authService] getUser error:", error);
      }
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
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Sign out current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[authService] signOut error:", error);
    }
  } catch (err) {
    console.error("[authService] signOut caught:", err);
  }
}

/**
 * Update user phone number in Supabase Auth
 */
export async function updateUserPhone(phone) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      phone: phone,
    });

    if (error) {
      console.error("[authService] updateUserPhone error:", error);
      throw new Error(getErrorMessage(error, "Failed to update phone"));
    }
    return data;
  } catch (err) {
    console.error("[authService] updateUserPhone caught:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(getErrorMessage(err, "Failed to update phone"));
  }
}
