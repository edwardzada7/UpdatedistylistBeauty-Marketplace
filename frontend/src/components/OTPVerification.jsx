import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, AlertCircle, CheckCircle2 } from "lucide-react";

const OTPVerification = ({ 
  phone, 
  onVerify, 
  onResend, 
  loading = false,
  error = "",
  mode = "signup" // "signup" or "login"
}) => {
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (otp.length === 6) {
      onVerify(otp);
    }
  };

  const handleResend = async () => {
    setResending(true);
    await onResend();
    setResending(false);
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  return (
    <Card className="w-full" data-testid="otp-verification-card">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold">Verify OTP</CardTitle>
        <CardDescription>
          Enter the 6-digit code sent to<br />
          <strong>{phone}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" data-testid="error-alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="otp">Verification Code *</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={otp}
              onChange={handleOtpChange}
              placeholder="Enter 6-digit code"
              className="mt-2 text-center text-2xl tracking-widest font-mono"
              maxLength={6}
              required
              autoFocus
              data-testid="otp-input"
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              {otp.length}/6 digits
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            disabled={loading || otp.length !== 6}
            data-testid="verify-otp-btn"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Verify & Continue
              </>
            )}
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Didn't receive the code?</p>
            <Button
              type="button"
              variant="link"
              onClick={handleResend}
              disabled={resending || loading}
              className="text-purple-600 hover:text-purple-700"
              data-testid="resend-otp-btn"
            >
              {resending ? "Resending..." : "Resend OTP"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default OTPVerification;
