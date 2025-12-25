import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Smartphone, AlertCircle } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import OTPVerification from "@/components/OTPVerification";
import "react-phone-number-input/style.css";
import "@/styles/phoneInput.css";

const PhoneVerificationGate = ({ user, userData, onVerified }) => {
  const [step, setStep] = useState("phone"); // "phone" or "otp"
  const [phone, setPhone] = useState(userData?.phone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = async () => {
    setError("");
    
    if (!phone) {
      setError("Phone number is required");
      return;
    }

    setLoading(true);

    try {
      await authService.requestPhoneVerification(phone);
      setStep("otp");
      toast.success("OTP sent to your phone!");
    } catch (error) {
      console.error("Send OTP error:", error);
      setError(error.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (otp) => {
    setError("");
    setLoading(true);

    try {
      await authService.verifyExistingUserPhone(phone, otp, userData.id);
      toast.success("Phone verified successfully!");
      onVerified();
    } catch (error) {
      console.error("Verify OTP error:", error);
      setError(error.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      await authService.requestPhoneVerification(phone);
      toast.success("OTP resent!");
    } catch (error) {
      toast.error("Failed to resend OTP");
    }
  };

  if (step === "otp") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <OTPVerification
            phone={phone}
            onVerify={handleVerifyOTP}
            onResend={handleResendOTP}
            loading={loading}
            error={error}
            mode="verify"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="phone-verification-gate">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Phone Verification Required</CardTitle>
          <CardDescription>
            Please verify your phone number to continue using the app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-amber-50 border-amber-200">
            <Smartphone className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Phone verification is mandatory for:
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Making bookings</li>
                <li>Using wallet</li>
                <li>Receiving payouts (stylists)</li>
                <li>Full app access</li>
              </ul>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">
              Phone Number *
            </label>
            <PhoneInput
              international
              defaultCountry="NG"
              value={phone}
              onChange={setPhone}
              placeholder="Enter phone number"
              className="PhoneInput"
              data-testid="phone-input"
            />
            <p className="text-xs text-gray-500 mt-2">
              We'll send you a verification code
            </p>
          </div>

          <Button
            onClick={handleSendOTP}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            disabled={loading || !phone}
            data-testid="send-verification-btn"
          >
            {loading ? "Sending..." : "Send Verification Code"}
          </Button>

          <div className="text-center text-xs text-gray-500">
            <p>Your account will remain limited until verification is complete</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PhoneVerificationGate;
