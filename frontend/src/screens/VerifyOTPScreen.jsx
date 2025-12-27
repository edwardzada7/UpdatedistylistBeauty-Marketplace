// src/screens/VerifyOTPScreen.jsx
// Screen for verifying OTP after phone login
import React, { useState, useEffect } from "react";
import { verifyPhoneOTP, sendLoginOTP } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function VerifyOTPScreen() {
  const navigate = useNavigate();
  const { refreshUser, isAuthenticated } = useAuth();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    // Get stored phone from session storage
    const pendingPhone = sessionStorage.getItem('pendingPhoneLogin');
    if (pendingPhone) {
      setPhone(pendingPhone);
    } else {
      // No pending phone login, redirect to login
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // If already authenticated, redirect to home
  useEffect(() => {
    if (isAuthenticated) {
      sessionStorage.removeItem('pendingPhoneLogin');
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleVerify = async () => {
    if (!otp || otp.length < 4) {
      toast.error("Please enter a valid OTP");
      return;
    }

    try {
      setLoading(true);
      await verifyPhoneOTP(phone, otp);
      toast.success("Phone verified successfully!");
      
      // Clear stored phone
      sessionStorage.removeItem('pendingPhoneLogin');
      
      // Refresh user data and navigate
      if (refreshUser) {
        await refreshUser();
      }
      navigate("/", { replace: true });
    } catch (error) {
      console.error("OTP verification error:", error);
      toast.error("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      await sendLoginOTP(phone);
      toast.success("OTP resent successfully!");
    } catch (error) {
      console.error("Resend OTP error:", error);
      toast.error("Failed to resend OTP");
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

        <h2 className="text-2xl font-bold text-center mb-4">Verify OTP</h2>
        
        <p className="text-sm text-gray-600 text-center mb-6">
          Enter the verification code sent to {phone}
        </p>

        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="text-center text-lg tracking-widest"
            maxLength={6}
          />
          
          <Button onClick={handleVerify} className="w-full" disabled={loading || !otp}>
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>

          <Button 
            variant="outline" 
            onClick={handleResendOTP} 
            className="w-full"
            disabled={loading}
          >
            Resend OTP
          </Button>
        </div>

        <p className="text-center mt-4">
          <span
            className="text-blue-500 cursor-pointer"
            onClick={() => {
              sessionStorage.removeItem('pendingPhoneLogin');
              navigate("/login");
            }}
          >
            Back to Login
          </span>
        </p>
      </div>
    </div>
  );
}
