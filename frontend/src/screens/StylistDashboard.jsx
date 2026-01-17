import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { providerServicesAPI, walletsAPI, bookingsAPI } from "@/services/api";
import { CURRENCY } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  User, 
  Wallet, 
  Calendar, 
  Settings, 
  LogOut, 
  ChevronRight,
  Sparkles,
  MapPin,
  Shield,
  Star,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Share2,
  Grid3X3
} from "lucide-react";

const StylistDashboard = () => {
  const navigate = useNavigate();
  const { userData, providerData, displayName, isProvider, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [activeServices, setActiveServices] = useState([]);
  const [stats, setStats] = useState({
    totalServices: 0,
    totalEarnings: 0,
    upcomingBookings: 0,
    completedBookings: 0,
    pendingBookings: 0
  });

  const providerId = userData?.id;
  const authId = userData?.auth_id;

  // Load dashboard data
  useEffect(() => {
    if (!providerId || !authId) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Load provider services
        const servicesResponse = await providerServicesAPI.getByProviderId(providerId, true);
        const services = servicesResponse.data || [];
        setActiveServices(services.filter(s => s.is_active));

        // Calculate stats
        const totalPrice = services
          .filter(s => s.is_active)
          .reduce((sum, s) => sum + (s.price || 0), 0);

        setStats(prev => ({
          ...prev,
          totalServices: services.filter(s => s.is_active).length,
          totalEarnings: totalPrice
        }));

        // Load wallet balance
        try {
          const walletResponse = await walletsAPI.getByAuthId(userData?.auth_id);
          setWalletBalance(walletResponse.data?.balance || 0);
        } catch (e) {
          // Wallet might not exist
          setWalletBalance(0);
        }

      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [providerId, userData?.auth_id]);

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

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/providers/${providerId}`;
    navigator.clipboard.writeText(profileUrl);
    toast.success("Profile link copied to clipboard!");
  };

  if (!isProvider) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Provider Access Only</h2>
          <p className="text-gray-600">You need to be registered as a provider to access this dashboard.</p>
          <Button onClick={() => navigate("/user/home")} className="mt-4">
            Go to Home
          </Button>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <LoadingSpinner fullScreen message="Loading your dashboard..." />
        <BottomNavigation />
      </div>
    );
  }

  // Get primary service (first active service)
  const primaryService = activeServices[0];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="p-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Stylist Dashboard</h1>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/profile")}
            className="text-white hover:bg-white/20"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Profile Section */}
        <div className="px-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-3xl font-bold">
              {displayName?.charAt(0)?.toUpperCase() || "P"}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{displayName}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {providerData?.is_verified && (
                  <Badge className="bg-green-500/20 text-green-100 border-green-300/30">
                    <Shield className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
                {providerData?.is_premium && (
                  <Badge className="bg-amber-500/20 text-amber-100 border-amber-300/30">
                    <Star className="h-3 w-3 mr-1" />
                    Premium
                  </Badge>
                )}
                {primaryService && (
                  <Badge className="bg-white/20 text-white border-white/30">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {primaryService.sub_service_name}
                  </Badge>
                )}
              </div>
              {providerData?.location && (
                <p className="text-purple-100 text-sm mt-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {providerData.location}
                </p>
              )}
            </div>
          </div>

          {/* Share Profile Button */}
          <Button 
            onClick={handleShareProfile}
            variant="outline"
            className="w-full mt-4 bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Booking Link
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 -mt-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-white shadow-lg">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Active Services</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalServices}</p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-lg">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Total Value</p>
              <p className="text-2xl font-bold text-green-600">
                {CURRENCY}{stats.totalEarnings.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-lg">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Wallet</p>
              <p className="text-2xl font-bold text-blue-600">
                {CURRENCY}{walletBalance.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Wallet Section */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-all"
          onClick={() => navigate("/wallet")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Wallet & Earnings</h3>
                  <p className="text-sm text-gray-500">Balance: {CURRENCY}{walletBalance.toLocaleString()}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/wallet");
                }}
              >
                Top Up
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.info("Payout feature coming soon!");
                }}
              >
                Withdraw
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/wallet");
                }}
              >
                History
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* My Services Section */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-all border-purple-200 bg-purple-50/50"
          onClick={() => navigate("/provider/services")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Grid3X3 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">My Services</h3>
                  <p className="text-sm text-gray-500">{stats.totalServices} active services</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
            
            {/* Active Services Preview */}
            {activeServices.length > 0 && (
              <div className="mt-3 space-y-2">
                {activeServices.slice(0, 3).map((service, index) => (
                  <div 
                    key={service.id || index}
                    className="flex items-center justify-between p-2 bg-white rounded-lg"
                  >
                    <span className="text-sm text-gray-700">{service.sub_service_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-purple-600">
                        {CURRENCY}{service.price?.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {service.duration_minutes}min
                      </span>
                    </div>
                  </div>
                ))}
                {activeServices.length > 3 && (
                  <p className="text-xs text-purple-600 text-center">
                    +{activeServices.length - 3} more services
                  </p>
                )}
              </div>
            )}
            
            {activeServices.length === 0 && (
              <p className="mt-3 text-sm text-gray-500 text-center py-2">
                No services added yet. Tap to add your services.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Availability Section - Phase 2.1 */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-all border-indigo-200 bg-indigo-50/50"
          onClick={() => navigate("/provider/availability")}
          data-testid="availability-card"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Availability</h3>
                  <p className="text-sm text-gray-500">Set your working hours & booking rules</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        {/* Bookings Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              Bookings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Upcoming Bookings */}
            <div 
              className="flex items-center justify-between p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition"
              onClick={() => navigate("/provider/bookings")}
              data-testid="upcoming-bookings-card"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Upcoming</p>
                  <p className="text-xs text-gray-500">Scheduled appointments</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {stats.upcomingBookings}
                </Badge>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* Pending Confirmations */}
            <div 
              className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 transition"
              onClick={() => navigate("/provider/bookings")}
              data-testid="pending-bookings-card"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-gray-900">Pending</p>
                  <p className="text-xs text-gray-500">Awaiting confirmation</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                  {stats.pendingBookings}
                </Badge>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* Completed Bookings */}
            <div 
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition"
              onClick={() => navigate("/provider/bookings")}
              data-testid="completed-bookings-card"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Completed</p>
                  <p className="text-xs text-gray-500">Past appointments</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {stats.completedBookings}
                </Badge>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats (Future Ready) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-600" />
              Dashboard Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-purple-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.totalServices}</p>
                <p className="text-xs text-gray-500">Active Services</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">
                  {CURRENCY}{stats.totalEarnings.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Service Value</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.upcomingBookings}</p>
                <p className="text-xs text-gray-500">Upcoming</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.completedBookings}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings & Logout */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Profile Settings */}
            <div 
              className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition"
              onClick={() => navigate("/profile")}
            >
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Profile Settings</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>

            {/* App Settings */}
            <div 
              className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition"
              onClick={() => toast.info("Settings coming soon!")}
            >
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Notification Preferences</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>

            {/* Logout */}
            <div 
              className="flex items-center justify-between p-3 hover:bg-red-50 rounded-lg cursor-pointer transition text-red-600"
              onClick={handleSignOut}
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Logout</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default StylistDashboard;
