import React, { useState } from "react";
import { loginWithEmail, sendLoginOTP } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function LoginScreen() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [method, setMethod] = useState("email"); // email or phone
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    
    try {
      setLoading(true);
      await loginWithEmail(email, password);
      toast.success("Logged in successfully!");
      
      // Refresh user data in context, then navigate
      // AuthContext will handle phone verification gate
      if (refreshUser) {
        await refreshUser();
      }
      
      // Navigate to home - AuthContext will redirect to verify-phone if needed
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to login. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    try {
      setLoading(true);
      const formattedPhone = phone.replace(/\s+/g, "");
      await sendLoginOTP(formattedPhone);
      toast.success("OTP sent to your phone!");
      // Store phone for OTP verification and navigate
      sessionStorage.setItem('pendingPhoneLogin', formattedPhone);
      navigate("/verify-otp", { replace: true });
    } catch (error) {
      console.error("Phone login error:", error);
      toast.error("Failed to send OTP.");
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

        {/* Header */}
        <h2 className="text-2xl font-bold text-center mb-6">Login</h2>

        {/* Method Toggle */}
        <div className="flex justify-center mb-4 space-x-2">
          <button
            className={`px-4 py-2 rounded ${method === "email" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
            onClick={() => setMethod("email")}
          >
            Email
          </button>
          <button
            className={`px-4 py-2 rounded ${method === "phone" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
            onClick={() => setMethod("phone")}
          >
            Phone
          </button>
        </div>

        {/* Form */}
        {method === "email" ? (
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-sm text-blue-500 underline mt-2"
            >
              Forgot password?
            </button>
            <Button onClick={handleEmailLogin} className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              type="tel"
              placeholder="+234 801 234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button onClick={handlePhoneLogin} className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </div>
        )}

        <p className="text-center mt-4">
          Don't have an account?{" "}
          <span
            className="text-blue-500 cursor-pointer"
            onClick={() => navigate("/signup")}
          >
            Sign Up
          </span>
        </p>
      </div>
    </div>
  );
}


