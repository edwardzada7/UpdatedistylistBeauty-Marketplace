import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Scissors, Wallet, User, Star, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { stylistsAPI } from "@/services/api";
import { APP_NAME, APP_TAGLINE, CURRENCY } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";

const HomeScreen = ({ currentUser }) => {
  const navigate = useNavigate();
  const [topStylists, setTopStylists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopStylists();
  }, []);

  const fetchTopStylists = async () => {
    try {
      const response = await stylistsAPI.getAll({ 
        verifiedOnly: true, 
        sortBy: "premium" 
      });
      setTopStylists(response.data.slice(0, 3)); // Top 3
    } catch (error) {
      console.error("Failed to fetch stylists:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              BeautyQ
            </h1>
            <p className="text-xs text-gray-600">Find Your Perfect Stylist</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2"
            data-testid="profile-nav-btn"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{currentUser.name}</span>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Welcome, {currentUser.name.split(" ")[0]}! 👋
          </h2>
          <p className="text-gray-600 mb-6">
            Book verified beauty stylists in your area
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-12">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate("/stylists")}
            data-testid="browse-stylists-card"
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-purple-100 rounded-full">
                <Scissors className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Browse Stylists</h3>
                <p className="text-sm text-gray-600">Find your perfect match</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate("/wallet")}
            data-testid="wallet-card"
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-green-100 rounded-full">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">My Wallet</h3>
                <p className="text-sm text-gray-600">Manage your balance</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Verified Stylists */}
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">✨ Top Verified Stylists</h3>
            <Button variant="link" onClick={() => navigate("/stylists")} size="sm">
              View All →
            </Button>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-16 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4">
              {topStylists.map((stylist) => (
                <Card
                  key={stylist.user_id}
                  className="cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => navigate(`/stylists/${stylist.user_id}`)}
                  data-testid={`stylist-card-${stylist.user_id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg mb-1">
                          {stylist.user_name || "Stylist"}
                        </h4>
                        <div className="flex items-center gap-1">
                          {stylist.is_verified && (
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          )}
                          {stylist.is_premium && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">
                      ₦{stylist.hourly_rate.toLocaleString()}
                      <span className="text-sm text-gray-600">/hr</span>
                    </p>
                    {stylist.location && (
                      <p className="text-xs text-gray-500 mt-2">
                        📍 {stylist.location}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg sm:hidden">
        <div className="flex justify-around py-3">
          <button onClick={() => navigate("/")} className="flex flex-col items-center text-purple-600">
            <Scissors className="h-5 w-5" />
            <span className="text-xs mt-1">Home</span>
          </button>
          <button onClick={() => navigate("/stylists")} className="flex flex-col items-center text-gray-600">
            <User className="h-5 w-5" />
            <span className="text-xs mt-1">Stylists</span>
          </button>
          <button onClick={() => navigate("/wallet")} className="flex flex-col items-center text-gray-600">
            <Wallet className="h-5 w-5" />
            <span className="text-xs mt-1">Wallet</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;