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
  const [sent, setSent] = useState(false);

  // Get phone number from userData or user metadata
  useEffect(() => {
    const phoneNumber = 
      userData?.phone_number || 
      userData?.phone || 
      user?.user_metadata?.phone ||
      user?.phone ||
      "";
    setPhone(phoneNumber);
  }, [user, userData]);

  useEffect(() => {
    // Auto-send OTP when component mounts and we have a phone number
    if (phone && !sent) {
      handleSendOTP();
    }
  }, [phone, sent]);

  const handleSendOTP = async () => {
    if (!phone) {
      toast.error("No phone number found. Please update your profile.");
      return;
    }

    try {
      setLoading(true);
      await sendSignUpOTP(phone);
      setSent(true);
      toast.success("OTP sent to your phone");
    } catch (err) {
      console.error("Send OTP error:", err);
      toast.error("Failed to send OTP: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otp || otp.length < 4) {
      toast.error("Please enter a valid OTP");
      return;
    }

    try {
      setLoading(true);
      await verifyPhoneOTP(phone, otp);
      toast.success("Phone verified successfully!");
      onVerified(); // Refresh user data and proceed to app
    } catch (err) {
      console.error("Verify OTP error:", err);
      toast.error("Invalid OTP. Please try again.");
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

        <h2 className="text-2xl font-bold text-center mb-4">Verify Your Phone</h2>
        
        <p className="text-sm text-gray-600 text-center mb-6">
          {phone 
            ? `Enter the OTP sent to ${phone}`
            : "Phone verification is required to continue"
          }
        </p>

        <div className="space-y-4">
          {!phone && (
            <Input
              type="tel"
              placeholder="+234 801 234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\s+/g, ""))}
            />
          )}

          <Input
            type="text"
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="text-center text-lg tracking-widest"
            maxLength={6}
          />
          
          <Button 
            onClick={handleVerify} 
            className="w-full" 
            disabled={loading || !otp || !phone}
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>

          <Button 
            variant="outline" 
            onClick={handleSendOTP} 
            className="w-full"
            disabled={loading || !phone}
          >
            {sent ? "Resend OTP" : "Send OTP"}
          </Button>
        </div>
      </div>
    </div>
  );
}
