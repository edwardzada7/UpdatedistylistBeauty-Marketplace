import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, KeyRound, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const ADMIN_KEY_STORAGE = "ADMIN_KEY";

export default function AdminLoginScreen() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if already logged in
  useEffect(() => {
    const storedKey = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (storedKey) {
      navigate("/admin/withdrawals", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!adminKey.trim()) {
      setError("Please enter the admin key");
      return;
    }

    setLoading(true);
    
    try {
      // Verify the key by making a test request
      const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
      const response = await fetch(`${API_BASE}/api/admin/withdrawals?limit=1`, {
        headers: {
          "X-ADMIN-KEY": adminKey.trim()
        }
      });

      if (response.status === 401) {
        setError("Invalid admin key");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to verify admin key");
      }

      // Store key and redirect
      sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey.trim());
      toast.success("Login successful");
      navigate("/admin/withdrawals", { replace: true });
      
    } catch (err) {
      console.error("Admin login error:", err);
      setError("Failed to verify admin key. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-purple-600" />
          </div>
          <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
          <CardDescription>
            Enter your admin key to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-key">Admin Key</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="admin-key"
                  type="password"
                  placeholder="Enter admin key"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="pl-10"
                  autoFocus
                  data-testid="admin-key-input"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={loading}
              data-testid="admin-login-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Login
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-gray-500 mt-4">
            This is a restricted area. Unauthorized access is prohibited.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
