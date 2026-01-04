import React, { useState } from "react";
import { resetPassword } from '@/services/authService';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { APP_NAME, APP_TAGLINE } from "@/utils/constants";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e?.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    try {
      setLoading(true);
      await resetPassword(email);
      toast.success("Password reset link sent! Check your email.");
      navigate("/login");
    } catch (error) {
      console.error("Reset error:", error);
      toast.error(error.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">
            <span className="text-3xl">i</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            {APP_NAME}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{APP_TAGLINE}</p>
        </div>

        <h2 className="text-xl font-semibold text-center text-gray-800 mb-2">
          Reset Password
        </h2>
        
        <p className="text-sm text-gray-600 text-center mb-6">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <form onSubmit={handleReset} className="space-y-4">
          <Input 
            type="email"
            placeholder="Email Address" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            className="h-12 text-base"
            autoComplete="email"
          />
          <Button 
            type="submit"
            className="w-full h-12 text-base bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>

        <p className="text-center mt-6 text-gray-600">
          Remember your password?{" "}
          <span
            className="text-purple-600 font-medium cursor-pointer hover:underline"
            onClick={() => navigate("/login")}
          >
            Sign In
          </span>
        </p>
      </div>
    </div>
  );
}
