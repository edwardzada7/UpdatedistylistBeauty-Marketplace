import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, User, Mail, Lock, AlertCircle, Smartphone } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { APP_NAME, USER_ROLES } from "@/utils/constants";
import OTPVerification from "@/components/OTPVerification";
import "react-phone-number-input/style.css";
import "@/styles/phoneInput.css";

const SignUpScreen = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authMethod, setAuthMethod] = useState("email");
  const [showOTP, setShowOTP] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");
  
  const [emailFormData, setEmailFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: USER_ROLES.CUSTOMER,
  });

  const [phoneFormData, setPhoneFormData] = useState({
    name: "",
    phone: "",
    role: USER_ROLES.CUSTOMER,
  });

  // Email Sign Up
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!emailFormData.name || !emailFormData.email || !emailFormData.password) {
      setError("All fields are required");
      return;
    }

    if (emailFormData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailFormData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      await signUp(emailFormData.email, emailFormData.password, emailFormData.name, emailFormData.role);
      toast.success("Account created successfully!");
      navigate("/");
    } catch (error) {
      console.error("Sign up error:", error);
      setError(error.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Phone Sign Up - Send OTP
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!phoneFormData.name || !phoneFormData.phone) {
      setError("Name and phone number are required");
      return;
    }

    setLoading(true);

    try {
      await authService.signUpWithPhone(phoneFormData.phone, phoneFormData.name, phoneFormData.role);
      setPendingPhone(phoneFormData.phone);
      setShowOTP(true);
      toast.success("OTP sent to your phone!");
    } catch (error) {
      console.error("Phone sign up error:", error);
      setError(error.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async (otp) => {
    setError("");
    setLoading(true);

    try {
      const result = await authService.verifyPhoneOTP(
        pendingPhone,
        otp,
        phoneFormData.name,
        phoneFormData.role
      );
      
      // Manually trigger auth state update
      window.location.reload();
      toast.success("Account created successfully!");
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
      await authService.signUpWithPhone(pendingPhone, phoneFormData.name, phoneFormData.role);
      toast.success("OTP resent!");
    } catch (error) {
      toast.error("Failed to resend OTP");
    }
  };

  if (showOTP) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <OTPVerification
            phone={pendingPhone}
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
            Join {APP_NAME} to book amazing stylists
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={authMethod} onValueChange={setAuthMethod} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="email" data-testid="email-tab">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </TabsTrigger>
              <TabsTrigger value="phone" data-testid="phone-tab">
                <Smartphone className="h-4 w-4 mr-2" />
                Phone
              </TabsTrigger>
            </TabsList>

            {/* Email Sign Up */}
            <TabsContent value="email">
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {error && authMethod === "email" && (
                  <Alert variant="destructive" data-testid="error-alert">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <div className="relative mt-2">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      type="text"
                      value={emailFormData.name}
                      onChange={(e) => setEmailFormData({ ...emailFormData, name: e.target.value })}
                      placeholder="Enter your full name"
                      className="pl-10"
                      required
                      data-testid="email-name-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={emailFormData.email}
                      onChange={(e) => setEmailFormData({ ...emailFormData, email: e.target.value })}
                      placeholder="your@email.com"
                      className="pl-10"
                      required
                      data-testid="email-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      value={emailFormData.password}
                      onChange={(e) => setEmailFormData({ ...emailFormData, password: e.target.value })}
                      placeholder="At least 6 characters"
                      className="pl-10"
                      required
                      minLength={6}
                      data-testid="password-input"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                </div>

                <div>
                  <Label htmlFor="email-role">I am a *</Label>
                  <Select
                    value={emailFormData.role}
                    onValueChange={(value) => setEmailFormData({ ...emailFormData, role: value })}
                  >
                    <SelectTrigger className="mt-2" data-testid="email-role-select">
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
                  data-testid="email-signup-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Sign Up with Email"
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Phone Sign Up */}
            <TabsContent value="phone">
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                {error && authMethod === "phone" && (
                  <Alert variant="destructive" data-testid="error-alert">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="phone-name">Full Name *</Label>
                  <div className="relative mt-2">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                    <Input
                      id="phone-name"
                      type="text"
                      value={phoneFormData.name}
                      onChange={(e) => setPhoneFormData({ ...phoneFormData, name: e.target.value })}
                      placeholder="Enter your full name"
                      className="pl-10"
                      required
                      data-testid="phone-name-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone-number">Phone Number *</Label>
                  <div className="mt-2">
                    <PhoneInput
                      international
                      defaultCountry="NG"
                      value={phoneFormData.phone}
                      onChange={(value) => setPhoneFormData({ ...phoneFormData, phone: value })}
                      placeholder="Enter phone number"
                      className="PhoneInput"
                      data-testid="phone-input"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Include country code</p>
                </div>

                <div>
                  <Label htmlFor="phone-role">I am a *</Label>
                  <Select
                    value={phoneFormData.role}
                    onValueChange={(value) => setPhoneFormData({ ...phoneFormData, role: value })}
                  >
                    <SelectTrigger className="mt-2" data-testid="phone-role-select">
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
                  data-testid="phone-signup-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <Smartphone className="mr-2 h-4 w-4" />
                      Sign Up with Phone
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="text-center text-sm mt-6">
            <span className="text-gray-600">Already have an account? </span>
            <Link to="/login" className="text-purple-600 hover:text-purple-700 font-medium">
              Log In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUpScreen;
