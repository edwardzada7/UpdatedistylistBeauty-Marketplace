import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Smartphone, AlertCircle } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import { toast } from 'sonner';
import { sendVerificationOTP, verifyPhone } from '@/services/authService';
import OTPVerification from '@/components/OTPVerification';
import 'react-phone-number-input/style.css';
import '@/styles/phoneInput.css';

const PhoneVerificationGate = ({ user, userData, onVerified }) => {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState(userData?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    setError('');
    if (!phone) {
      setError('Phone number required');
      return;
    }
    setLoading(true);
    try {
      await sendVerificationOTP(phone);
      setStep('otp');
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
      await verifyPhone(phone, otp, userData.id);
      toast.success('Phone verified!');
      onVerified();
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      await sendVerificationOTP(phone);
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Phone Verification Required</CardTitle>
          <CardDescription>Verify your phone to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-amber-50 border-amber-200">
            <Smartphone className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              Phone verification is mandatory for bookings, wallet, and payouts
            </AlertDescription>
          </Alert>

          {error && (
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

          <Button
            onClick={handleSendOTP}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
            disabled={loading || !phone}
            data-testid="send-otp-btn"
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PhoneVerificationGate;
