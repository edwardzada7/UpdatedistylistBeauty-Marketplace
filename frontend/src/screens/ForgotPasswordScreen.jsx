import React, { useState } from "react";
import { resetPassword } from '@/services/authService';

export default function ForgotPasswordScreen({ navigate }) {
  const [email, setEmail] = useState("");

  const handleReset = async () => {
    try {
      await resetPassword({ email });
      alert("Password reset link sent! Check your email.");
      navigate("LoginScreen");
    } catch (error) {
      alert("Failed: " + error.message);
    }
  };

  return (
    <div className="p-4">
      <h1>Forgot Password</h1>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <button onClick={handleReset}>Send Reset Link</button>
    </div>
  );
}


