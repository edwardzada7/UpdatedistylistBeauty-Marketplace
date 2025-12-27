// src/screens/VerifyPhoneScreen.jsx
// Screen for mandatory phone verification after signup/login
import React, { useState, useEffect } from "react";
import { sendSignUpOTP, verifyPhoneOTP } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function VerifyPhoneScreen() {
  const navigate = useNavigate();
  const { user, userData, refreshUser, signOut } = useAuth();
  
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Get phone number from user data or metadata
  useEffect(() => {
    const userPhone = 
      userData?.phone_number ||
      userData?.phone ||
      user?.user_metadata?.phone ||
      "";
    
    if (userPhone) {
      setPhone(userPhone.replace(/\s+/g, ""));
    }
  }, [user, userData]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Handle sending OTP
  const handleSendOTP = async () => {
    if (!phone) {
      toast.error("Please enter your phone number");
      return;
    }

    // Ensure phone has country code
    const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    
    setLoading(true);
    
    try {
      console.log("[VerifyPhoneScreen] Sending OTP to:", formattedPhone);
      await sendSignUpOTP(formattedPhone);
      
      setOtpSent(true);
      setCountdown(60);
      toast.success(`OTP sent to ${formattedPhone}`);
    } catch (err) {
      console.error("[VerifyPhoneScreen] Send OTP error:", err);
      // err.message is guaranteed to be a string from authService
      const errorMsg = err && err.message ? String(err.message) : "Failed to send OTP";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      toast.error("Please enter a valid OTP");
      return;
    }

    const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    setLoading(true);
    
    try {
      console.log("[VerifyPhoneScreen] Verifying OTP for:", formattedPhone);
      await verifyPhoneOTP(formattedPhone, otp);
      
      toast.success("Phone verified successfully!");
      
      if (refreshUser) {
        await refreshUser();
      }
      
      navigate("/home", { replace: true });
    } catch (err) {
      console.error("[VerifyPhoneScreen] Verify OTP error:", err);
      const errorMsg = err && err.message ? String(err.message) : "Invalid OTP. Please try again.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("[VerifyPhoneScreen] Sign out error:", err);
      toast.error("Failed to sign out");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="App Logo" className="h-16 w-16 object-contain" />
        </div>

        {/* Header */}
        <h2 className="text-2xl font-bold text-center mb-2">Verify Your Phone</h2>
        <p className="text-sm text-gray-600 text-center mb-6">
          {otpSent 
            ? `Enter the OTP sent to ${phone}`
            : "Phone verification is required to access the app"
          }
        </p>

        <div className="space-y-4">
          {/* Phone Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number (with country code)
            </label>
            <Input
              type="tel"
              placeholder="+234 801 234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
              disabled={otpSent}
              className={otpSent ? "bg-gray-100" : ""}
            />
          </div>

          {/* OTP Section */}
          {otpSent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter OTP
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-lg tracking-widest"
                maxLength={6}
                autoFocus
              />
            </div>
          )}

          {/* Action Buttons */}
          {!otpSent ? (
            <Button 
              onClick={handleSendOTP} 
              className="w-full" 
              disabled={loading || !phone}
            >
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleVerifyOTP} 
                className="w-full" 
                disabled={loading || !otp || otp.length < 4}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleSendOTP} 
                className="w-full"
                disabled={loading || countdown > 0}
              >
                {countdown > 0 ? `Resend OTP (${countdown}s)` : "Resend OTP"}
              </Button>
            </>
          )}

          {/* Sign out option */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500 text-center mb-2">
              Having trouble? You can sign out and try again.
            </p>
            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
