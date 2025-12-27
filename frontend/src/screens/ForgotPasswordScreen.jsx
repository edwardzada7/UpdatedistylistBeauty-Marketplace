import React, { useState } from "react";
import { resetPassword } from '@/services/authService';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
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
      toast.error("Failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="App Logo" className="h-16 w-16 object-contain" />
        </div>

        <h2 className="text-2xl font-bold text-center mb-6">Forgot Password</h2>
        
        <p className="text-sm text-gray-600 text-center mb-4">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <div className="space-y-4">
          <Input 
            type="email"
            placeholder="Email Address" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
          />
          <Button onClick={handleReset} className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </div>

        <p className="text-center mt-4">
          Remember your password?{" "}
          <span
            className="text-blue-500 cursor-pointer"
            onClick={() => navigate("/login")}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}


