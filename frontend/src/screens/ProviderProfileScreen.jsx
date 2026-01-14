import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star, CheckCircle2, MapPin, Mail, Calendar } from "lucide-react";
import { toast } from "sonner";
import { stylistsAPI } from "@/services/api";
import { CURRENCY, STYLIST_SERVICES, TOAST_MESSAGES } from "@/utils/constants";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import BottomNavigation from "@/components/BottomNavigation";

const ProviderProfileScreen = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProviderProfile();
  }, [userId]);

  const fetchProviderProfile = async () => {
    setLoading(true);
    try {
      const response = await stylistsAPI.getById(userId);
      setProvider(response.data);
    } catch (error) {
      console.error("Failed to fetch provider:", error);
      toast.error("Failed to load provider profile");
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = () => {
    toast.info(TOAST_MESSAGES.BOOKING_PHASE_2, {
      description: "We're working on adding booking functionality."
    });
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading provider profile..." />;
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Provider Profile</h1>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <EmptyState
            title="Provider not found"
            description="This provider profile doesn't exist or has been removed."
            actionLabel="Browse Providers"
            onAction={() => navigate("/user/providers", { replace: true })}
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
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            data-testid="back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Provider Profile</h1>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Profile Card */}
          <Card data-testid="provider-profile-card">
            <CardContent className="p-6">
              {/* Avatar & Basic Info */}
              <div className="flex gap-4 mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
                  {provider.user_name?.charAt(0) || "P"}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{provider.user_name || "Provider"}</h2>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {provider.is_verified && (
                      <Badge className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified Provider
                      </Badge>
                    )}
                    {provider.is_premium && (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                        <Star className="h-3 w-3 mr-1 fill-amber-700" />
                        Premium Member
                      </Badge>
                    )}
                  </div>
                  {provider.rating > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(provider.rating)
                                ? "fill-amber-400 text-amber-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium">{provider.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Hourly Rate</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {CURRENCY}{provider.hourly_rate.toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleBooking}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    data-testid="book-now-btn"
                  >
                    <Calendar className="mr-2 h-5 w-5" />
                    Book Now
                  </Button>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4">
                {provider.location && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Location</p>
                      <p className="font-medium">{provider.location}</p>
                    </div>
                  </div>
                )}

                {provider.user_email && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{provider.user_email}</p>
                    </div>
                  </div>
                )}

                {provider.bio && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">About</p>
                    <p className="text-gray-800">{provider.bio}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Services Card */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4">Services Offered</h3>
              <div className="grid grid-cols-2 gap-3">
                {STYLIST_SERVICES.slice(0, 8).map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-2xl">{service.icon}</span>
                    <span className="text-sm font-medium">{service.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                Full service list and booking coming in Phase 2
              </p>
            </CardContent>
          </Card>

          {/* Why Book This Provider */}
          {provider.is_verified && (
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Why Book This Provider?
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span>Verified identity and credentials</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span>Professional service provider</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span>Secure payment through wallet</span>
                  </li>
                  {provider.is_premium && (
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-1">⭐</span>
                      <span>Premium member with priority support</span>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default ProviderProfileScreen;
