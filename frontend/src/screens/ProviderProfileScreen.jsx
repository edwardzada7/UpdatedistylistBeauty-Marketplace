import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star, CheckCircle2, MapPin, Calendar, Clock, Store, Home, Car, ShoppingCart, User, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { providersAPI, bookingsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { CURRENCY } from "@/utils/constants";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";

const ProviderProfileScreen = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { userData } = useAuth();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState({});
  
  // Booking flow state - Phase 2.1
  const [bookingStep, setBookingStep] = useState('services'); // 'services' | 'datetime' | 'confirm'
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  useEffect(() => {
    fetchProviderProfile();
  }, [userId]);

  const fetchProviderProfile = async () => {
    setLoading(true);
    try {
      const response = await providersAPI.getFullProfile(userId);
      setProvider(response.data);
    } catch (error) {
      console.error("Failed to fetch provider:", error);
      toast.error("Failed to load provider profile");
    } finally {
      setLoading(false);
    }
  };

  // Toggle service selection
  const toggleServiceSelection = (serviceId) => {
    setSelectedServices(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };

  // Calculate total price and duration
  const selectedServicesList = provider?.services?.filter(s => selectedServices[s.id]) || [];
  const totalPrice = selectedServicesList.reduce((sum, s) => sum + (s.price || 0), 0);
  const totalDuration = selectedServicesList.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  // Fetch available slots when date changes
  const fetchAvailableSlots = async (date) => {
    if (!date || totalDuration <= 0) return;
    
    setLoadingSlots(true);
    setAvailableSlots([]);
    setSelectedSlot('');
    
    try {
      const response = await providersAPI.getAvailableSlots(userId, date, totalDuration);
      setAvailableSlots(response.data?.slots || []);
    } catch (error) {
      console.error("Failed to fetch slots:", error);
      toast.error("Failed to load available times");
    } finally {
      setLoadingSlots(false);
    }
  };

  // Handle date selection
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedSlot('');
    if (date) {
      fetchAvailableSlots(date);
    }
  };

  // Proceed to date/time selection
  const handleProceedToDateTime = () => {
    if (selectedServicesList.length === 0) {
      toast.error("Please select at least one service");
      return;
    }
    setBookingStep('datetime');
  };

  // Go back to services
  const handleBackToServices = () => {
    setBookingStep('services');
    setSelectedDate('');
    setSelectedSlot('');
    setAvailableSlots([]);
  };

  // Confirm booking
  const handleConfirmBooking = async () => {
    if (!selectedSlot) {
      toast.error("Please select a time slot");
      return;
    }
    
    setSubmittingBooking(true);
    
    try {
      const bookingData = {
        provider_id: parseInt(userId),
        customer_id: userData?.id,  // Legacy integer ID for backward compatibility
        customer_auth_id: userData?.auth_id,  // UUID auth_id for proper filtering
        booking_date: selectedDate,
        booking_time: selectedSlot,
        service_ids: selectedServicesList.map(s => s.id),
        service_duration_minutes: totalDuration,
        notes: bookingNotes || null,
        status: "pending"
      };
      
      await bookingsAPI.create(bookingData);
      
      toast.success("Booking request submitted!", {
        description: `${selectedDate} at ${selectedSlot}`
      });
      
      // Reset and go back to services
      setSelectedServices({});
      setBookingStep('services');
      setSelectedDate('');
      setSelectedSlot('');
      setBookingNotes('');
      
    } catch (error) {
      console.error("Booking failed:", error);
      
      // Handle 409 conflict
      if (error.response?.status === 409) {
        toast.error("That time is no longer available. Please choose another slot.");
        // Refresh slots
        fetchAvailableSlots(selectedDate);
      } else {
        toast.error(error.response?.data?.detail || "Failed to submit booking. Please try again.");
      }
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Get min date (today)
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Get max date (30 days from now)
  const getMaxDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
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

  const startingPrice = provider.services?.length > 0 
    ? Math.min(...provider.services.map(s => s.price || 0))
    : 0;

  // Render Date/Time selection step
  if (bookingStep === 'datetime') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToServices}
              data-testid="back-to-services-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Choose Date & Time</h1>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 pb-32 sm:pb-6">
          <div className="max-w-lg mx-auto space-y-4">
            {/* Selected Services Summary */}
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">Selected Services</p>
                <div className="mt-2 space-y-1">
                  {selectedServicesList.map(s => (
                    <div key={s.id} className="flex justify-between text-sm">
                      <span>{s.sub_service_name}</span>
                      <span className="font-medium">{CURRENCY}{s.price?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-purple-200 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-purple-600">
                    {CURRENCY}{totalPrice.toLocaleString()} • {totalDuration} min
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Date Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  Select Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  min={getMinDate()}
                  max={getMaxDate()}
                  className="w-full"
                  data-testid="date-picker"
                />
              </CardContent>
            </Card>

            {/* Time Slots */}
            {selectedDate && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-600" />
                    Select Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                      <span className="ml-2 text-gray-500">Loading available times...</span>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableSlots.map(slot => (
                        <Button
                          key={slot}
                          variant={selectedSlot === slot ? "default" : "outline"}
                          className={`${selectedSlot === slot 
                            ? 'bg-purple-600 hover:bg-purple-700' 
                            : 'hover:bg-purple-50 hover:border-purple-300'
                          }`}
                          onClick={() => setSelectedSlot(slot)}
                          data-testid={`slot-${slot.replace(':', '')}`}
                        >
                          {slot}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="font-medium">No available slots</p>
                      <p className="text-sm">Try selecting a different date</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {selectedSlot && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Additional Notes (Optional)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Any special requests or notes for the provider..."
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    rows={3}
                    data-testid="booking-notes"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Fixed Booking Bar */}
        <div className="fixed bottom-20 md:bottom-4 left-0 right-0 bg-white border-t shadow-lg p-4 z-40">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                {selectedDate && selectedSlot 
                  ? `${selectedDate} at ${selectedSlot}` 
                  : "Select date & time"}
              </p>
              <p className="text-xl font-bold text-purple-600">
                {CURRENCY}{totalPrice.toLocaleString()}
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleConfirmBooking}
              disabled={!selectedSlot || submittingBooking}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              data-testid="confirm-booking-btn"
            >
              {submittingBooking ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Confirm Booking
                </>
              )}
            </Button>
          </div>
        </div>

        <BottomNavigation />
      </div>
    );
  }

  // Default: Services selection step
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
      <div className="container mx-auto px-4 py-6 pb-32 sm:pb-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Profile Card */}
          <Card data-testid="provider-profile-card">
            <CardContent className="p-6">
              {/* Avatar & Basic Info */}
              <div className="flex gap-4 mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
                  {(provider.display_name || provider.name)?.charAt(0) || "P"}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{provider.display_name || provider.name || "Provider"}</h2>
                  {provider.provider_type === "business" && (
                    <Badge variant="outline" className="mb-2 bg-blue-50 text-blue-700 border-blue-200">
                      Business
                    </Badge>
                  )}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {provider.is_verified && (
                      <Badge className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                    {provider.is_premium && (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                        <Star className="h-3 w-3 mr-1 fill-amber-700" />
                        Premium
                      </Badge>
                    )}
                    {provider.total_services > 0 && (
                      <Badge variant="secondary">
                        {provider.total_services} Services
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
                      <span className="text-sm font-medium">{provider.rating?.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Starting Price */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Starting From</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {CURRENCY}{startingPrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">per session</p>
                  </div>
                  {selectedServicesList.length > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Selected Total</p>
                      <p className="text-2xl font-bold text-green-600">
                        {CURRENCY}{totalPrice.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{totalDuration} min</p>
                    </div>
                  )}
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

                {(() => {
                  const providerGender = 
                    provider?.gender || 
                    provider?.profile?.gender || 
                    provider?.provider_gender || 
                    provider?.gender_identity || 
                    "";
                  return providerGender && providerGender !== "prefer_not_to_say" ? (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg" data-testid="provider-gender">
                      <User className="h-5 w-5 text-gray-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Gender</p>
                        <p className="font-medium capitalize">{providerGender}</p>
                      </div>
                    </div>
                  ) : null;
                })()}

                {provider.bio && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">About</p>
                    <p className="text-gray-800">{provider.bio}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Services Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Select Services
              </CardTitle>
              <p className="text-sm text-gray-500">
                Choose one or more services to book
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {provider.services?.length > 0 ? (
                provider.services.map((service) => (
                  <div
                    key={service.id}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedServices[service.id]
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                    onClick={() => toggleServiceSelection(service.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={selectedServices[service.id] || false}
                        onCheckedChange={() => toggleServiceSelection(service.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {service.sub_service_name}
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {service.service_id?.replace(/-/g, ' ')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-purple-600">
                              {CURRENCY}{(service.price || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                              <Clock className="h-3 w-3" />
                              {service.duration_minutes || 60} min
                            </p>
                          </div>
                        </div>
                        
                        {service.description && !service.description.startsWith('modes:') && (
                          <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded" data-testid={`service-description-${service.id}`}>
                            {service.description}
                          </p>
                        )}
                        
                        <div className="flex gap-2 mt-2">
                          {service.in_store && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              <Store className="h-3 w-3" />
                              In-Store
                            </span>
                          )}
                          {service.home_service && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
                              <Home className="h-3 w-3" />
                              Home Visit
                            </span>
                          )}
                          {service.travel_service && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                              <Car className="h-3 w-3" />
                              Travel
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>This provider hasn&apos;t added any services yet.</p>
                </div>
              )}
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

      {/* Fixed Booking Bar */}
      {provider.services?.length > 0 && (
        <div className="fixed bottom-20 md:bottom-4 left-0 right-0 bg-white border-t shadow-lg p-4 z-40">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div>
              {selectedServicesList.length > 0 ? (
                <>
                  <p className="text-sm text-gray-600">
                    {selectedServicesList.length} service{selectedServicesList.length !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xl font-bold text-purple-600">
                    {CURRENCY}{totalPrice.toLocaleString()}
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({totalDuration} min)
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Select services to book</p>
              )}
            </div>
            <Button
              size="lg"
              onClick={handleProceedToDateTime}
              disabled={selectedServicesList.length === 0}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              data-testid="proceed-to-datetime-btn"
            >
              <Calendar className="mr-2 h-5 w-5" />
              Choose Date & Time
            </Button>
          </div>
        </div>
      )}

      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
};

export default ProviderProfileScreen;
