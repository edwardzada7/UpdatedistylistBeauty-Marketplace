import { useState, useEffect } from "react";
import { getCurrentUser, signOut } from '@/services/authService';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Mail, Phone, Save, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { usersAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { TOAST_MESSAGES } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";


const ProfileScreen = () => {
  const navigate = useNavigate();
  const { userData, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: userData?.name || "",
    email: userData?.email || "",
    phone: userData?.phone || "",
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name,
        email: userData.email,
        phone: userData.phone || "",
      });
    }
  }, [userData]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await usersAPI.update(userData.id, formData);
      toast.success(TOAST_MESSAGES.PROFILE_UPDATED);
      setEditing(false);
      // Refresh page to get updated data
      window.location.reload();
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(TOAST_MESSAGES.PROFILE_UPDATE_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: userData.name,
      email: userData.email,
      phone: userData.phone || "",
    });
    setEditing(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to log out");
    }
  };

  if (!userData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
            data-testid="back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-xl font-bold">My Profile</h1>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 pb-24 sm:pb-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {userData.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle>{userData.name}</CardTitle>
                    <p className="text-sm text-gray-600 capitalize">{userData.role}</p>
                  </div>
                </div>
                {!editing && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setEditing(true)}
                      size="sm"
                      data-testid="edit-profile-btn"
                    >
                      Edit Profile
                    </Button>
                    <Button
                      onClick={handleSignOut}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid="signout-btn"
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Sign Out
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <form onSubmit={handleUpdate} className="space-y-6">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <div className="relative mt-2">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="pl-10"
                        placeholder="Enter your full name"
                        required
                        data-testid="name-input"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-10"
                        placeholder="your@email.com"
                        required
                        data-testid="email-input"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative mt-2">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="pl-10"
                        placeholder="+234..."
                        data-testid="phone-input"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="flex-1"
                      data-testid="save-profile-btn"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={loading}
                      data-testid="cancel-edit-btn"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <Mail className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{userData.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <Phone className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{userData.phone || "Not provided"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <User className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Account Type</p>
                      <p className="font-medium capitalize">{userData.role}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default ProfileScreen;