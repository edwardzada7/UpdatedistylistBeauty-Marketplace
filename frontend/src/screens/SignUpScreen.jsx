import React, { useState } from "react";
import { signUpWithEmail } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { APP_NAME, APP_TAGLINE } from "@/utils/constants";
import { Loader2, User, Scissors } from "lucide-react";

export default function SignUpScreen() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e?.preventDefault();
    
    if (!fullName || !email || !password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      await signUpWithEmail({ email, password, phone, fullName, role });
      toast.success("Account created! Please check your email to verify.");
      navigate("/login");
    } catch (error) {
      console.error("SignUp error:", error);
      toast.error(error.message || "Failed to sign up. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 py-8 px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        
        {/* Logo & Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">
            <span className="text-3xl">i</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            {APP_NAME}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{APP_TAGLINE}</p>
        </div>

        {/* Header */}
        <h2 className="text-xl font-semibold text-center text-gray-800 mb-6">
          Create Your Account
        </h2>

        {/* Signup Form */}
        <form onSubmit={handleSignUp} className="space-y-4">
          <Input
            type="text"
            placeholder="Full Name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-12 text-base"
            required
          />
          
          <Input
            type="email"
            placeholder="Email Address *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 text-base"
            autoComplete="email"
            required
          />
          
          <Input
            type="password"
            placeholder="Password (min 6 characters) *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 text-base"
            autoComplete="new-password"
            required
          />
          
          <Input
            type="tel"
            placeholder="Phone Number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-12 text-base"
          />

          {/* Role Selection */}
          <div className="pt-2">
            <p className="text-sm text-gray-600 mb-3">I want to:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                  role === "user"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                <User className={`h-6 w-6 mb-2 ${role === "user" ? "text-purple-500" : "text-gray-400"}`} />
                <span className="font-medium">Book Services</span>
                <span className="text-xs mt-1 opacity-70">As a Customer</span>
              </button>
              
              <button
                type="button"
                onClick={() => setRole("stylist")}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                  role === "stylist"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                <Scissors className={`h-6 w-6 mb-2 ${role === "stylist" ? "text-purple-500" : "text-gray-400"}`} />
                <span className="font-medium">Offer Services</span>
                <span className="text-xs mt-1 opacity-70">As a Provider</span>
              </button>
            </div>
          </div>

          <Button 
            type="submit"
            className="w-full h-12 text-base bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 transition-all mt-4"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        {/* Login Link */}
        <p className="text-center mt-6 text-gray-600">
          Already have an account?{" "}
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
