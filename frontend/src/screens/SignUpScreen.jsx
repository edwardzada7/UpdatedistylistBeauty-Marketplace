import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [step, setStep] = useState("form"); // "form" or "otp"
  
  // Single form for all data
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: USER_ROLES.CUSTOMER,
  });

  // Step 1: Collect all details and send OTP
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name.trim()) {
      setError("Full name is required");
      return;
    }

    if (!formData.phone) {
      setError("Phone number is required");
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Send OTP to phone number
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

  // Step 2: Verify OTP and create complete account
  const handleVerifyOTP = async (otp) => {
    setError("");
    setLoading(true);

    try {
      // Single call to create user after OTP verification
      await authService.verifyPhoneAndCreateUser(
        formData.phone,
        otp,
        formData.name,
        formData.role,
        formData.email,
        formData.password
      );
      
      toast.success("Account created successfully!");
      // Reload to trigger auth state update
      window.location.href = "/";
    } catch (error) {
      console.error("Verification error:", error);
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

  // OTP Verification Step
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

  // Sign Up Form
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" data-testid="error-alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert className="bg-purple-50 border-purple-200">
              <Shield className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-800 text-sm">
                <strong>Phone verification required:</strong> You'll receive an OTP to verify your number
              </AlertDescription>
            </Alert>

            {/* Full Name */}
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

            {/* Phone Number - Required */}
            <div>
              <Label htmlFor="phone">
                Phone Number * <span className="text-xs text-purple-600">(Will be verified)</span>
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
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  className="pl-10"
                  required
                  data-testid="email-input"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="password">Password *</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="pl-10"
                  required
                  minLength={6}
                  data-testid="password-input"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>

            {/* Role */}
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
                  Continue to Verification
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
