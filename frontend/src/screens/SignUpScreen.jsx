import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Mail, Lock, AlertCircle, Smartphone, Shield } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import { toast } from 'sonner';
import { sendSignUpOTP, completeSignUp } from '@/services/authService';
import { APP_NAME, USER_ROLES } from '@/utils/constants';
import OTPVerification from '@/components/OTPVerification';
import 'react-phone-number-input/style.css';
import '@/styles/phoneInput.css';

const SignUpScreen = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: USER_ROLES.CUSTOMER,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Full name is required');
      return;
    }
    if (!formData.phone) {
      setError('Phone number is required');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await sendSignUpOTP(formData.phone);
      setStep('otp');
      toast.success('OTP sent to your phone!');
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (otp) => {
    setError('');
    setLoading(true);
    try {
      await completeSignUp(
        formData.phone,
        otp,
        formData.name,
        formData.email,
        formData.password,
        formData.role
      );
      toast.success('Account created!');
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      await sendSignUpOTP(formData.phone);
      toast.success('OTP resent!');
    } catch (err) {
      toast.error('Failed to resend');
    }
  };

  if (step === 'otp') {
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
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Join {APP_NAME} - Phone verification required</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert className="bg-purple-50 border-purple-200">
              <Shield className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-sm text-purple-800">
                Phone verification required for security
              </AlertDescription>
            </Alert>

            <div>
              <Label>Full Name *</Label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your full name"
                  className="pl-10"
                  required
                  data-testid="name-input"
                />
              </div>
            </div>

            <div>
              <Label>Phone Number *</Label>
              <div className="mt-2">
                <PhoneInput
                  international
                  defaultCountry="NG"
                  value={formData.phone}
                  onChange={(value) => setFormData({ ...formData, phone: value })}
                  placeholder="Phone number"
                  className="PhoneInput"
                  data-testid="phone-input"
                />
              </div>
            </div>

            <div>
              <Label>Email *</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
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

            <div>
              <Label>Password *</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min. 6 characters"
                  className="pl-10"
                  required
                  minLength={6}
                  data-testid="password-input"
                />
              </div>
            </div>

            <div>
              <Label>I am a *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger className="mt-2" data-testid="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="stylist">Stylist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              disabled={loading}
              data-testid="signup-btn"
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP...</> : 'Sign Up'}
            </Button>

            <div className="text-center text-sm mt-4">
              <span className="text-gray-600">Already have an account? </span>
              <Link to="/login" className="text-purple-600 font-medium">Log In</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUpScreen;
