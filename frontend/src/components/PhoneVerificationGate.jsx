// src/components/PhoneVerificationGate.jsx
// Component to block access until phone is verified
import React, { useState, useEffect } from "react";
import { verifyPhoneOTP, sendSignUpOTP } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function PhoneVerificationGate({ user, userData, onVerified }) {
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Get phone number from userData or user metadata
  useEffect(() => {
    const phoneNumber = 
      userData?.phone_number || 
      userData?.phone || 
      user?.user_metadata?.phone ||
      user?.phone ||
      "";
    
    if (phoneNumber) {
      setPhone(phoneNumber.replace(/\s+/g, ""));
    }
  }, [user, userData]);

  // Countdown timer for resend button
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

    const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    setLoading(true);
    
    try {
      console.log("[PhoneVerificationGate] Sending OTP to:", formattedPhone);
      await sendSignUpOTP(formattedPhone);
      
      setOtpSent(true);
      setCountdown(60);
      toast.success(`OTP sent to ${formattedPhone}`);
    } catch (err) {
      console.error("[PhoneVerificationGate] Send OTP error:", err);
      // Safely get error message as string
      const errorMsg = err && err.message ? String(err.message) : "Failed to send OTP";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerify = async () => {
    if (!otp || otp.length < 4) {
      toast.error("Please enter a valid OTP (at least 4 digits)");
      return;
    }

    if (!phone) {
      toast.error("Phone number is required");
      return;
    }

    const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    setLoading(true);
    
    try {
      console.log("[PhoneVerificationGate] Verifying OTP for:", formattedPhone);
      await verifyPhoneOTP(formattedPhone, otp);
      
      toast.success("Phone verified successfully!");
      
      if (onVerified) {
        await onVerified();
      }
    } catch (err) {
      console.error("[PhoneVerificationGate] Verify OTP error:", err);
      // Safely get error message as string
      const errorMsg = err && err.message ? String(err.message) : "Invalid OTP. Please try again.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="App Logo" className="h-16 w-16 object-contain" />
        </div>

        <h2 className="text-2xl font-bold text-center mb-2">Verify Your Phone</h2>
        
        <p className="text-sm text-gray-600 text-center mb-6">
          {otpSent 
            ? `Enter the OTP sent to ${phone}`
            : "Phone verification is required to continue"
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

          {/* OTP Input */}
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
                onClick={handleVerify} 
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
        </div>
      </div>
    </div>
  );
}
