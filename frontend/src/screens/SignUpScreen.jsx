import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, User, Mail, Lock, AlertCircle, Smartphone, Shield } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { APP_NAME, USER_ROLES } from "@/utils/constants";
import OTPVerification from "@/components/OTPVerification";
import "react-phone-number-input/style.css";
import "@/styles/phoneInput.css";

const SignUpScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("details"); // "details" or "otp"
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: USER_ROLES.CUSTOMER,
    useEmail: false,
  });

  // Step 1: Collect details and send OTP
  const handleSubmitDetails = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name || !formData.phone) {
      setError("Name and phone number are required");
      return;
    }

    if (formData.useEmail && !formData.email) {
      setError("Email is required when email option is selected");
      return;
    }

    if (formData.useEmail && formData.password && formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.useEmail && formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError("Please enter a valid email address");
        return;
      }
    }

    setLoading(true);

    try {
      await authService.signUpWithPhone(formData.phone, formData.name, formData.role);
      setStep("otp");
      toast.success("OTP sent to your phone!");
    } catch (error) {
      console.error("Send OTP error:", error);
      setError(error.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and create account
  const handleVerifyOTP = async (otp) => {
    setError("");
    setLoading(true);

    try {
      await authService.verifyPhoneAndCreateUser(
        formData.phone,
        otp,
        formData.name,
        formData.role,
        formData.useEmail ? formData.email : null,
        formData.useEmail && formData.password ? formData.password : null
      );
      
      toast.success("Account created successfully!");
      // Reload to trigger auth state update
      window.location.href = "/";
    } catch (error) {
      console.error("OTP verification error:", error);
      setError(error.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    try {
      await authService.signUpWithPhone(formData.phone, formData.name, formData.role);
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
            phone={formData.phone}
            onVerify={handleVerifyOTP}
            onResend={handleResendOTP}
            loading={loading}
            error={error}
            mode="signup"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="signup-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Join {APP_NAME} - Phone verification required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitDetails} className="space-y-4">
            {error && (
              <Alert variant="destructive" data-testid="error-alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Phone Number - Required */}
            <div>
              <Label htmlFor="phone">
                Phone Number * <span className="text-purple-600 text-xs">(Required for verification)</span>
              </Label>
              <div className="mt-2">
                <PhoneInput
                  international
                  defaultCountry="NG"
                  value={formData.phone}
                  onChange={(value) => setFormData({ ...formData, phone: value })}
                  placeholder="Enter phone number"
                  className="PhoneInput"
                  required
                  data-testid="phone-input"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                We'll send a verification code to this number
              </p>
            </div>

            {/* Name - Required */}
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="pl-10"
                  required
                  data-testid="name-input"
                />
              </div>
            </div>

            {/* Role - Required */}
            <div>
              <Label htmlFor="role">I am signing up as *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="mt-2" data-testid="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={USER_ROLES.CUSTOMER}>Customer</SelectItem>
                  <SelectItem value={USER_ROLES.STYLIST}>Stylist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Optional Email Section */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id="use-email"
                  checked={formData.useEmail}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, useEmail: checked })
                  }
                  data-testid="use-email-checkbox"
                />
                <Label htmlFor="use-email" className="text-sm cursor-pointer">
                  Add email & password (optional but recommended)
                </Label>
              </div>

              {formData.useEmail && (
                <div className="space-y-4 pl-6 border-l-2 border-purple-200">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="your@email.com"
                        className="pl-10"
                        data-testid="email-input"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-2">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="At least 6 characters"
                        className="pl-10"
                        minLength={6}
                        data-testid="password-input"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 text-xs">
                      Email allows password recovery and alternative login method
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              disabled={loading}
              data-testid="signup-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  <Smartphone className="mr-2 h-4 w-4" />
                  Continue with Phone Verification
                </>
              )}
            </Button>

            <div className="text-center text-sm mt-6">
              <span className="text-gray-600">Already have an account? </span>
              <Link to="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                Log In
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUpScreen;
