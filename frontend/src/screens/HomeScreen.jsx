import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Scissors, Wallet, User, Star, CheckCircle2, TrendingUp, Grid3X3, Sparkles, Heart } from "lucide-react";
import { toast } from "sonner";
import { stylistsAPI, feedAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { APP_NAME, APP_TAGLINE, CURRENCY, SERVICE_CATEGORIES } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import NotificationBell from "@/components/NotificationBell";
import { timeAgoShort } from "@/utils/timeAgo";

const HomeScreen = () => {
  const navigate = useNavigate();
  const { displayName, isProvider, userData } = useAuth();
  const [topProviders, setTopProviders] = useState([]);
  const [stats, setStats] = useState({ totalProviders: 0, verified: 0, premium: 0 });
  const [loading, setLoading] = useState(true);
  const [feedPreview, setFeedPreview] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  // Redirect providers to dashboard
  useEffect(() => {
    if (isProvider) {
      navigate("/dashboard", { replace: true });
    }
  }, [isProvider, navigate]);

  const fetchTopProviders = useCallback(async () => {
    try {
      const response = await stylistsAPI.getAll({ 
        verifiedOnly: true, 
        sortBy: "premium" 
      });
      const allProviders = response.data;
      setTopProviders(allProviders.slice(0, 3));
      
      setStats({
        totalProviders: allProviders.length,
        verified: allProviders.filter(s => s.is_verified).length,
        premium: allProviders.filter(s => s.is_premium).length,
      });
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Phase 4 - lightweight feed preview (top 4 newest posts). Fails silently
  // if the social-feed migration hasn't been applied.
  const fetchFeedPreview = useCallback(async () => {
    try {
      const res = await feedAPI.list(userData?.auth_id, 4, 0);
      setFeedPreview(res.data?.posts || []);
    } catch (err) {
      // 503 = migration not applied; silently ignore
      setFeedPreview([]);
    } finally {
      setLoadingFeed(false);
    }
  }, [userData?.auth_id]);

  useEffect(() => {
    fetchTopProviders();
    fetchFeedPreview();
  }, [fetchTopProviders, fetchFeedPreview]);

  const firstName = displayName.split(" ")[0];

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
              <p className="text-xs text-gray-500">{APP_TAGLINE}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
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
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Welcome, {firstName}! 👋
          </h2>
          <p className="text-gray-600 mb-6">
            {APP_TAGLINE}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate("/services")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-pink-100 rounded-full">
                <Grid3X3 className="h-6 w-6 text-pink-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Services</h3>
                <p className="text-sm text-gray-600">Browse categories</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate("/user/providers")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-purple-100 rounded-full">
                <Scissors className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Providers</h3>
                <p className="text-sm text-gray-600">Find services</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate("/wallet")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-green-100 rounded-full">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Wallet</h3>
                <p className="text-sm text-gray-600">Manage balance</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Categories Preview */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              <Sparkles className="inline h-5 w-5 mr-2 text-purple-500" />
              Service Categories
            </h3>
            <Button variant="link" onClick={() => navigate("/services")} size="sm">
              View All →
            </Button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {SERVICE_CATEGORIES.slice(0, 6).map((category) => (
              <Card
                key={category.id}
                className="cursor-pointer hover:shadow-md transition-all hover:scale-105"
                onClick={() => navigate("/services")}
              >
                <CardContent className="p-4 text-center">
                  <span className="text-2xl">{category.icon}</span>
                  <p className="text-xs font-medium text-gray-600 mt-2 line-clamp-1">
                    {category.name.split(" ")[0]}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Marketplace Stats */}
        <div className="max-w-4xl mx-auto mb-8">
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">Marketplace Stats</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">{stats.totalProviders}</p>
                  <p className="text-xs text-gray-600 mt-1">Active Providers</p>
                </div>
                <div className="text-center border-x border-purple-200">
                  <p className="text-3xl font-bold text-green-600">{stats.verified}</p>
                  <p className="text-xs text-gray-600 mt-1">Verified</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-600">{stats.premium}</p>
                  <p className="text-xs text-gray-600 mt-1">Premium</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Verified Providers */}
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">✨ Top Verified Providers</h3>
            <Button variant="link" onClick={() => navigate("/user/providers")} size="sm">
              View All →
            </Button>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading top providers..." />
          ) : topProviders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p>No verified providers available yet</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => navigate("/user/providers")}
                >
                  Browse All Providers
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4">
              {topProviders.map((provider) => (
                <Card
                  key={provider.user_id}
                  className="cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => navigate(`/providers/${provider.user_id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg mb-1">
                          {provider.user_name || "Provider"}
                        </h4>
                        <div className="flex items-center gap-1">
                          {provider.is_verified && (
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          )}
                          {provider.is_premium && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">
                      {CURRENCY}{provider.hourly_rate?.toLocaleString() || "0"}
                      <span className="text-sm text-gray-600">/session</span>
                    </p>
                    {provider.location && (
                      <p className="text-xs text-gray-500 mt-2">
                        📍 {provider.location}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Phase 4 - Discovery Feed Preview */}
        <div className="max-w-4xl mx-auto mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-500" />
              Discovery Feed
            </h3>
            <Button
              variant="link"
              onClick={() => navigate("/feed")}
              size="sm"
              data-testid="home-feed-view-all"
            >
              View All →
            </Button>
          </div>

          {loadingFeed ? (
            <LoadingSpinner message="Loading feed..." />
          ) : feedPreview.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Sparkles className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm">No posts yet — be the first to discover new looks soon.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {feedPreview.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => navigate("/feed")}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 active:scale-95 transition"
                  data-testid={`home-feed-tile-${post.id}`}
                >
                  <img
                    src={post.image_url}
                    alt={post.caption || "Post"}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                    <p className="text-white text-xs font-medium truncate">
                      {post.provider?.display_name || "Provider"}
                    </p>
                    <p className="text-white/80 text-[10px] flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {post.likes_count || 0}
                      <span className="ml-auto">{timeAgoShort(post.created_at)}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
      <BottomNavigation />
    </div>
  );
};

export default HomeScreen;
