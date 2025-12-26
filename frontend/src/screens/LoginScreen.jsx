import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, AlertCircle, LogIn, Smartphone } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import { toast } from 'sonner';
import { loginWithEmail, sendLoginOTP, verifyLoginOTP } from '@/services/authService';
import { APP_NAME } from '@/utils/constants';
import OTPVerification from '@/components/OTPVerification';
import 'react-phone-number-input/style.css';
import '@/styles/phoneInput.css';

const LoginScreen = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('phone');
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone) {
      setError('Phone number required');
      return;
    }
    setLoading(true);
    try {
      await sendLoginOTP(phone);
      setShowOTP(true);
      toast.success('OTP sent!');
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
      await verifyLoginOTP(phone, otp);
      toast.success('Welcome back!');
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      await sendLoginOTP(phone);
      toast.success('OTP resent!');
    } catch (err) {
      toast.error('Failed to resend');
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password required');
      return;
    }
    setLoading(true);
    try {
      const result = await loginWithEmail(email, password);
      if (result.requiresPhoneVerification) {
        toast.error('Phone verification required!');
        window.location.reload();
      } else {
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (err) {
      setError(err.message?.includes('Invalid') ? 'Invalid credentials' : err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (showOTP) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <OTPVerification
            phone={phone}
            onVerify={handleVerifyOTP}
            onResend={handleResendOTP}
            loading={loading}
            error={error}
            mode="login"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="login-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
            <LogIn className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Log in to {APP_NAME}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="phone" data-testid="phone-tab">
                <Smartphone className="h-4 w-4 mr-2" />Phone
              </TabsTrigger>
              <TabsTrigger value="email" data-testid="email-tab">
                <Mail className="h-4 w-4 mr-2" />Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="phone">
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                {error && tab === 'phone' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div>
                  <Label>Phone Number *</Label>
                  <div className="mt-2">
                    <PhoneInput
                      international
                      defaultCountry="NG"
                      value={phone}
                      onChange={setPhone}
                      placeholder="Phone number"
                      className="PhoneInput"
                      data-testid="phone-input"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600" disabled={loading} data-testid="phone-login-btn">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : 'Log In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                {error && tab === 'email' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div>
                  <Label>Email *</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="pl-10"
                      required
                      data-testid="email-input"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between">
                    <Label>Password *</Label>
                    <Link to="/forgot-password" className="text-xs text-purple-600">Forgot?</Link>
                  </div>
                  <div className="relative mt-2">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="pl-10"
                      required
                      data-testid="password-input"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600" disabled={loading} data-testid="email-login-btn">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging In...</> : 'Log In'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="text-center text-sm mt-6">
            <span className="text-gray-600">Don't have an account? </span>
            <Link to="/signup" className="text-purple-600 font-medium">Sign Up</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginScreen;
