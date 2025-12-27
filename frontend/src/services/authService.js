import { supabase } from "@/lib/supabaseClient";

/* ===============================
   AUTH HELPERS
================================ */

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

  if (error) throw error;
  return data;
}

export async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function sendSignUpOTP(phone) {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
  });

  if (error) throw error;
  return true;
}

export async function sendLoginOTP(phone) {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
  });

  if (error) throw error;
  return true;
}

export async function verifyPhoneOTP(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) throw error;
  return data;
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
  return true;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function signOut() {
  await supabase.auth.signOut();
}
