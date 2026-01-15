import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Mail, Phone, Save, Loader2, LogOut, Shield, Star, MapPin, FileText, Globe, Building2 } from "lucide-react";
import { toast } from "sonner";
import { usersAPI, stylistsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { TOAST_MESSAGES, APP_NAME, CURRENCY } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { user, userData, providerData, displayName, role, isProvider, signOut, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingProvider, setEditingProvider] = useState(false);
  
  // User form data
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    // Phase 1.9 - Privacy & Identity fields
    country: "",
    city: "",
    gender: "",
  });
  
  // Provider form data
  const [providerFormData, setProviderFormData] = useState({
    hourly_rate: 0,
    bio: "",
    location: "",
    // Phase 1.9 - Provider Type
    provider_type: "individual",
    business_name: "",
  });

  // Initialize form data from userData or user metadata
  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || "",
        phone: userData.phone || "",
        // Phase 1.9 fields
        country: userData.country || "",
        city: userData.city || "",
        gender: userData.gender || "",
      });
    } else if (user) {
      setFormData({
        name: user.user_metadata?.full_name || "",
        phone: user.user_metadata?.phone || "",
        country: "",
        city: "",
        gender: "",
      });
    }
  }, [userData, user]);

  // Initialize provider form data
  useEffect(() => {
    if (providerData) {
      setProviderFormData({
        hourly_rate: providerData.hourly_rate || 0,
        bio: providerData.bio || "",
        location: providerData.location || "",
        // Phase 1.9 - Provider Type
        provider_type: providerData.provider_type || "individual",
        business_name: providerData.business_name || "",
      });
    }
  }, [providerData]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    if (!userData?.id) {
      toast.error("Unable to update profile. Please try again later.");
      return;
    }

    setLoading(true);
    try {
      await usersAPI.update(userData.id, formData);
      toast.success("Profile updated successfully!", {
        description: "Your changes have been saved."
      });
      setEditing(false);
      await refreshUser();
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile", {
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProviderUpdate = async (e) => {
    e.preventDefault();
    
    if (!userData?.id) {
      toast.error("Unable to update provider info. Please try again later.");
      return;
    }

    setLoading(true);
    try {
      await stylistsAPI.update(userData.id, providerFormData);
      toast.success("Provider info updated successfully!", {
        description: "Your business profile has been updated."
      });
      setEditingProvider(false);
      await refreshUser();
    } catch (error) {
      console.error("Failed to update provider info:", error);
      toast.error("Failed to update provider info", {
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: userData?.name || user?.user_metadata?.full_name || "",
      email: userData?.email || user?.email || "",
      phone: userData?.phone || user?.user_metadata?.phone || "",
    });
    setEditing(false);
  };

  const handleProviderCancel = () => {
    setProviderFormData({
      hourly_rate: providerData?.hourly_rate || 0,
      bio: providerData?.bio || "",
      location: providerData?.location || "",
    });
    setEditingProvider(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to log out");
    }
  };

  // Show empty state if no user at all
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">My Profile</h1>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <EmptyState
            title="Not logged in"
            description="Please log in to view your profile"
            actionLabel="Go to Login"
            onAction={() => navigate("/login")}
          />
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(isProvider ? "/dashboard" : "/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">My Profile</h1>
          </div>
          {/* Logout Button in Header */}
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 pb-24 sm:pb-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{displayName}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="capitalize">
                        {role === "stylist" || role === "provider" ? "Provider" : "Customer"}
                      </Badge>
                      {isProvider && providerData?.is_verified && (
                        <Badge className="bg-green-50 text-green-700 border-green-200">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {isProvider && providerData?.is_premium && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                          <Star className="h-3 w-3 mr-1" />
                          Premium
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {!editing && (
                  <Button onClick={() => setEditing(true)} size="sm">
                    Edit Profile
                  </Button>
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
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={loading} className="flex-1">
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
                    <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
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
                      <p className="font-medium">{userData?.email || user?.email || "Not set"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <Phone className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{userData?.phone || user?.user_metadata?.phone || "Not provided"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <User className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Account Type</p>
                      <p className="font-medium capitalize">
                        {role === "stylist" || role === "provider" ? "Service Provider" : "Customer"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Provider-specific info */}
          {isProvider && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Provider Information</CardTitle>
                  {!editingProvider && (
                    <Button onClick={() => setEditingProvider(true)} size="sm" variant="outline">
                      Edit Info
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingProvider ? (
                  <form onSubmit={handleProviderUpdate} className="space-y-6">
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <div className="relative mt-2">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="location"
                          value={providerFormData.location}
                          onChange={(e) => setProviderFormData({ ...providerFormData, location: e.target.value })}
                          className="pl-10"
                          placeholder="City, Country"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={providerFormData.bio}
                        onChange={(e) => setProviderFormData({ ...providerFormData, bio: e.target.value })}
                        className="mt-2"
                        placeholder="Tell clients about yourself and your services..."
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button type="submit" disabled={loading} className="flex-1">
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Provider Info
                          </>
                        )}
                      </Button>
                      <Button type="button" variant="outline" onClick={handleProviderCancel} disabled={loading}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-600">Manage Your Services</p>
                        <p className="text-sm text-gray-500">Set pricing, duration & availability</p>
                      </div>
                      <Button 
                        variant="default" 
                        onClick={() => navigate("/provider/services")}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        My Services
                      </Button>
                    </div>

                    {providerData?.location && (
                      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                        <MapPin className="h-5 w-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-600">Location</p>
                          <p className="font-medium">{providerData.location}</p>
                        </div>
                      </div>
                    )}

                    {providerData?.bio && (
                      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                        <FileText className="h-5 w-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-600">Bio</p>
                          <p className="font-medium">{providerData.bio}</p>
                        </div>
                      </div>
                    )}

                    {!providerData?.location && !providerData?.bio && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Add a location and bio to help clients find you!
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Logout Button at Bottom */}
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-100 border-red-300"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out of {APP_NAME}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default ProfileScreen;
