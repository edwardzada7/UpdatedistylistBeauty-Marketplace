import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, Wallet, Settings, Calendar, TrendingUp, 
  Star, CheckCircle2, Clock, DollarSign, Users,
  Grid3X3, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { stylistsAPI } from "@/services/api";
import { APP_NAME, CURRENCY, SERVICE_CATEGORIES } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const { displayName, userData, providerData, isProvider, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    completedBookings: 0,
    earnings: 0,
  });

  // Redirect non-providers to home
  useEffect(() => {
    if (!isProvider) {
      navigate("/home", { replace: true });
    }
  }, [isProvider, navigate]);

  useEffect(() => {
    // Simulate loading provider stats (Phase 2 will have real data)
    const timer = setTimeout(() => {
      setStats({
        totalBookings: 12,
        pendingBookings: 3,
        completedBookings: 9,
        earnings: 45000,
      });
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const firstName = displayName.split(" ")[0];

  // Placeholder bookings for Phase 1
  const upcomingBookings = [
    { id: 1, client: "Sarah A.", service: "Hair Styling", date: "Today, 2:00 PM", status: "confirmed" },
    { id: 2, client: "Mike B.", service: "Haircut", date: "Tomorrow, 10:00 AM", status: "pending" },
    { id: 3, client: "Lisa C.", service: "Hair Color", date: "Jan 8, 3:00 PM", status: "confirmed" },
  ];

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">
              i
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                {APP_NAME}
              </h1>
              <p className="text-xs text-gray-500">Provider Dashboard</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{displayName}</span>
          </Button>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Welcome back, {firstName}! 👋
          </h2>
          <p className="text-gray-600">Here's your business overview</p>
        </div>

        {/* Provider Status Card */}
        <Card className="mb-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm mb-1">Your Status</p>
                <div className="flex items-center gap-2">
                  {providerData?.is_verified ? (
                    <Badge className="bg-green-500 text-white">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500 text-black">
                      Pending Verification
                    </Badge>
                  )}
                  {providerData?.is_premium && (
                    <Badge className="bg-amber-500 text-black">
                      <Star className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-purple-100 text-sm mb-1">Hourly Rate</p>
                <p className="text-2xl font-bold">
                  {CURRENCY}{providerData?.hourly_rate?.toLocaleString() || "0"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
              <p className="text-xs text-gray-600">Total Bookings</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingBookings}</p>
              <p className="text-xs text-gray-600">Pending</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.completedBookings}</p>
              <p className="text-xs text-gray-600">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 bg-purple-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{CURRENCY}{stats.earnings.toLocaleString()}</p>
              <p className="text-xs text-gray-600">Earnings</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate("/my-services")}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 bg-pink-100 rounded-full">
                <Grid3X3 className="h-5 w-5 text-pink-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">My Services</h3>
                <p className="text-sm text-gray-600">Manage your offerings</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate("/wallet")}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 bg-green-100 rounded-full">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Wallet</h3>
                <p className="text-sm text-gray-600">View earnings</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate("/profile")}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <Settings className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Settings</h3>
                <p className="text-sm text-gray-600">Edit profile</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Bookings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Upcoming Bookings</CardTitle>
              <Badge variant="outline">{upcomingBookings.length} scheduled</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">{booking.client}</p>
                      <p className="text-sm text-gray-600">{booking.service}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{booking.date}</p>
                    <Badge 
                      variant="outline" 
                      className={booking.status === "confirmed" 
                        ? "bg-green-50 text-green-700 border-green-200" 
                        : "bg-yellow-50 text-yellow-700 border-yellow-200"
                      }
                    >
                      {booking.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Phase 2 Notice */}
            <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-sm text-purple-700 text-center">
                📅 Full booking management coming in Phase 2
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default ProviderDashboard;
