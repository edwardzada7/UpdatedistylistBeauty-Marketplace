import React, { useState } from "react";
import { signUpWithEmail, sendSignUpOTP, verifyPhoneOTP } from "@/services/authService";
import { usersAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";


export default function SignUpScreen() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("user"); // user or stylist

  const handleSignUp = async () => {
    try {
      await signUpWithEmail({ email, password, phone, fullName, role });
      toast.success("Verification email sent!");
      navigate("/login");
    } catch (error) {
      console.error("SignUp error:", error);
      toast.error("Failed to sign up. Try again.");
    }
  };

  const handlePhoneSignUp = async () => {
    try {
      await sendSignUpOTP(phone);
      toast.success("OTP sent to phone!");
      // navigate to OTP verification screen if implemented
    } catch (error) {
      console.error("Phone sign-up error:", error);
      toast.error("Failed to send OTP.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="App Logo" className="h-16 w-16 object-contain" />
        </div>

        <h2 className="text-2xl font-bold text-center mb-6">Sign Up</h2>

        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          {/* Role selection */}
          <div className="flex justify-between">
            <Button
              variant={role === "user" ? "default" : "outline"}
              onClick={() => setRole("user")}
            >
              User
            </Button>
            <Button
              variant={role === "stylist" ? "default" : "outline"}
              onClick={() => setRole("stylist")}
            >
              Stylist
            </Button>
          </div>

          <Button onClick={handleSignUp} className="w-full">Sign Up</Button>

          <Button onClick={handlePhoneSignUp} className="w-full mt-2">Sign Up with Phone</Button>
        </div>

        <p className="text-center mt-4">
          Already have an account?{" "}
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
