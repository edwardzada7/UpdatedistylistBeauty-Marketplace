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
      setPhone(userPhone);
    }
  }, [user, userData]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async () => {
    if (!phone) {
      toast.error("Please enter your phone number");
      return;
    }

    const formattedPhone = phone.replace(/\s+/g, "");
    
    try {
      setLoading(true);
      await sendSignUpOTP(formattedPhone);
      setOtpSent(true);
      setCountdown(60); // 60 second countdown for resend
      toast.success("OTP sent to " + formattedPhone);
    } catch (error) {
      console.error("Send OTP error:", error);
      toast.error("Failed to send OTP: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      toast.error("Please enter a valid OTP");
      return;
    }

    const formattedPhone = phone.replace(/\s+/g, "");

    try {
      setLoading(true);
      await verifyPhoneOTP(formattedPhone, otp);
      toast.success("Phone verified successfully!");
      
      // Refresh user data to get updated phone_verified status
      await refreshUser();
      
      // Navigate to home
      navigate("/home", { replace: true });
    } catch (error) {
      console.error("Verify OTP error:", error);
      toast.error("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
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
          Phone verification is required to access the app
        </p>

        <div className="space-y-4">
          {/* Phone Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <Input
              type="tel"
              placeholder="+234 801 234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={otpSent}
            />
          </div>

          {/* OTP Section - Only show after OTP is sent */}
          {otpSent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter OTP
              </label>
              <Input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-lg tracking-widest"
                maxLength={6}
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
                disabled={loading || !otp}
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
              className="w-full text-red-500 hover:text-red-600"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
