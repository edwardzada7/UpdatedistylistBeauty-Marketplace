// src/components/PhoneVerificationGate.jsx
import React, { useState, useEffect } from "react";
import { verifyPhoneOTP, sendSignUpOTP } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function PhoneVerificationGate({ user, onVerified }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user && !sent) {
      handleSendOTP();
    }
  }, [user]);

  const handleSendOTP = async () => {
    try {
      setLoading(true);
      await sendSignUpOTP(user.phone_number); // Send OTP to user's phone
      setSent(true);
      toast.success("OTP sent to your phone");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setLoading(true);
      await verifyPhoneOTP(user.phone_number, otp);
      toast.success("Phone verified successfully");
      onVerified(); // proceed to app
    } catch (err) {
      console.error(err);
      toast.error("Invalid OTP, try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 gap-4">
      <h2 className="text-xl font-semibold">Verify your phone number</h2>
      <p className="text-sm text-gray-600">
        Enter the OTP sent to {user?.phone_number}
      </p>
      <Input
        placeholder="Enter OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        className="max-w-xs"
      />
      <Button onClick={handleVerify} disabled={loading || !otp}>
        {loading ? "Verifying..." : "Verify OTP"}
      </Button>
      <Button variant="secondary" onClick={handleSendOTP} disabled={loading}>
        Resend OTP
      </Button>
    </div>
  );
}
