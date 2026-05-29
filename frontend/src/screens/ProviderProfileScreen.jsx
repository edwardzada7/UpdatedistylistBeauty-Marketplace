import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star, CheckCircle2, MapPin, Calendar, Clock, Store, Home, Car, ShoppingCart, User, Loader2, ChevronLeft, ChevronRight, Wallet, AlertCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { providersAPI, bookingsAPI, paymentsAPI, walletsAPI, reviewsAPI, staffAPI, feedAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { CURRENCY } from "@/utils/constants";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";

const ProviderProfileScreen = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { userData, user } = useAuth();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState({});
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingWallet, setLoadingWallet] = useState(false);
  
  // Booking flow state - Phase 2.1
  const [bookingStep, setBookingStep] = useState('services'); // 'services' | 'staff' | 'datetime' | 'confirm' | 'payment'
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState(null);
  const [processingWalletPayment, setProcessingWalletPayment] = useState(false);

  // Phase 4 - Multi-staff state (only relevant when provider has staff)
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null); // null => "Any available"

  // Reviews state - Phase 3
  const [reviews, setReviews] = useState([]);
  const [reviewsStats, setReviewsStats] = useState({ avg_rating: 0, total_reviews: 0 });
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Phase 4 - Portfolio (provider feed posts)
  const [portfolioPosts, setPortfolioPosts] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  // Fetch wallet balance when entering payment step
  const fetchWalletBalance = async () => {
    if (!user?.id) return;
    setLoadingWallet(true);
    try {
      const response = await walletsAPI.getMyWallet(user.id);
      setWalletBalance(response.data?.available_balance || 0);
    } catch (error) {
      console.error("Failed to fetch wallet:", error);
      setWalletBalance(0);
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    fetchProviderProfile();
  }, [userId]);

  // Phase 4 - Load staff for this provider (only relevant for business providers)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await staffAPI.listForProvider(userId, true);
        setStaffList(res.data?.staff || []);
      } catch {
        setStaffList([]);
      }
    })();
  }, [userId]);

  // Fetch reviews when provider data is available
  useEffect(() => {
    if (provider?.provider_id) {
      fetchProviderReviews();
      fetchPortfolioPosts();
    }
  }, [provider?.provider_id]);

  // Phase 4 - Portfolio
  const fetchPortfolioPosts = async () => {
    if (!provider?.provider_id) return;
    setLoadingPortfolio(true);
    try {
      const res = await feedAPI.listByProvider(provider.provider_id, userData?.auth_id, 12, 0);
      setPortfolioPosts(res.data?.posts || []);
    } catch (err) {
      // 503 (migration not applied) or other → just hide section
      setPortfolioPosts([]);
    } finally {
      setLoadingPortfolio(false);
    }
  };

  const fetchProviderReviews = async () => {
    if (!provider) return;
    
    setLoadingReviews(true);
    try {
      // We need provider's auth_id. Try to get it from users table by provider_id
      const usersResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/users/${provider.provider_id}`);
      if (usersResponse.ok) {
        const userData = await usersResponse.json();
        if (userData?.auth_id) {
          const response = await reviewsAPI.getProviderReviews(userData.auth_id, 5, 0);
          setReviews(response.data?.reviews || []);
          setReviewsStats({
            avg_rating: response.data?.avg_rating || 0,
            total_reviews: response.data?.total_reviews || 0
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoadingReviews(false);
    }
  };

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

  // Fetch available slots when date changes (Phase 4: staff-scoped if a staff is picked)
  const fetchAvailableSlots = async (date) => {
    if (!date || totalDuration <= 0) return;

    setLoadingSlots(true);
    setAvailableSlots([]);
    setSelectedSlot('');

    try {
      let response;
      if (selectedStaffId) {
        response = await staffAPI.getStaffSlots(selectedStaffId, date, totalDuration);
      } else {
        response = await providersAPI.getAvailableSlots(userId, date, totalDuration);
      }
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

  // Proceed to next step after services. If provider has staff, route through staff picker first.
  const handleProceedToDateTime = () => {
    if (selectedServicesList.length === 0) {
      toast.error("Please select at least one service");
      return;
    }
    if (staffList.length > 0) {
      setBookingStep('staff');
    } else {
      setBookingStep('datetime');
    }
  };

  // From staff step → datetime
  const handleProceedFromStaff = () => {
    setBookingStep('datetime');
  };

  // Go back to services
  const handleBackToServices = () => {
    setBookingStep('services');
    setSelectedDate('');
    setSelectedSlot('');
    setAvailableSlots([]);
    setPendingBookingId(null);
  };

  // From datetime back to staff (or services if no staff)
  const handleBackFromDateTime = () => {
    if (staffList.length > 0) {
      setBookingStep('staff');
    } else {
      handleBackToServices();
    }
  };

  // Go back to datetime from payment
  const handleBackToDateTime = () => {
    setBookingStep('datetime');
  };

  // Create booking and proceed to payment step
  const handleConfirmBooking = async () => {
    if (!selectedSlot) {
      toast.error("Please select a time slot");
      return;
    }
    
    setSubmittingBooking(true);
    
    try {
      // Create booking with pending_payment status
      const bookingData = {
        provider_id: parseInt(userId),
        customer_id: userData?.id,
        customer_auth_id: userData?.auth_id,
        booking_date: selectedDate,
        booking_time: selectedSlot,
        service_ids: selectedServicesList.map(s => s.id),
        service_duration_minutes: totalDuration,
        notes: bookingNotes || null,
        status: "pending_payment",
        // Phase 4 - Multi-staff: include if user picked a specific staff member
        ...(selectedStaffId ? { staff_id: selectedStaffId } : {}),
      };
      
      const bookingResponse = await bookingsAPI.create(bookingData);
      const newBookingId = bookingResponse.data?.id;
      
      if (!newBookingId) {
        throw new Error("Booking created but no ID returned");
      }
      
      setPendingBookingId(newBookingId);
      
      // Fetch wallet balance and proceed to payment step
      await fetchWalletBalance();
      setBookingStep('payment');
      
      toast.success("Booking created!", {
        description: "Please complete payment to confirm."
      });
      
    } catch (error) {
      console.error("Booking failed:", error);
      
      // Handle 409 conflict
      if (error.response?.status === 409) {
        toast.error("That time is no longer available. Please choose another slot.");
        fetchAvailableSlots(selectedDate);
      } else {
        toast.error(error.response?.data?.detail || "Failed to create booking. Please try again.");
      }
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Pay with wallet balance
  const handlePayWithWallet = async () => {
    if (!pendingBookingId || !userData?.auth_id) {
      toast.error("Booking information missing. Please try again.");
      return;
    }
    
    setProcessingWalletPayment(true);
    
    try {
      const response = await paymentsAPI.payWithWallet(pendingBookingId, userData.auth_id);
      
      if (response.data.status === "success") {
        toast.success("Payment successful!", {
          description: "Your booking has been confirmed."
        });
        
        // Reset state and navigate to bookings
        setSelectedServices({});
        setBookingStep('services');
        setSelectedDate('');
        setSelectedSlot('');
        setBookingNotes('');
        setPendingBookingId(null);
        setSelectedStaffId(null);
        
        navigate("/bookings");
      }
    } catch (error) {
      console.error("Wallet payment failed:", error);
      
      // Handle insufficient funds (402)
      if (error.response?.status === 402) {
        const detail = error.response.data?.detail;
        if (detail && typeof detail === 'object') {
          toast.error(`Insufficient balance. Need ${CURRENCY}${detail.needed?.toLocaleString()}, have ${CURRENCY}${detail.available?.toLocaleString()}`);
        } else {
          toast.error("Insufficient wallet balance");
        }
      } else {
        toast.error(error.response?.data?.detail || "Payment failed. Please try again.");
      }
    } finally {
      setProcessingWalletPayment(false);
    }
  };

  // Navigate to wallet top-up
  const handleTopUpWallet = () => {
    navigate("/wallet");
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

  // Phase 4 - Render staff picker step (only when provider has staff)
  if (bookingStep === 'staff') {
    const selectedStaff = staffList.find(s => s.id === selectedStaffId) || null;
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToServices}
              data-testid="back-to-services-from-staff-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Choose Staff</h1>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 pb-40 md:pb-32">
          <div className="max-w-lg mx-auto space-y-3" data-testid="staff-picker">
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4">
                <p className="text-sm text-gray-600 mb-2">
                  Pick a staff member for your appointment or let the salon assign one.
                </p>
              </CardContent>
            </Card>

            {/* Any available option */}
            <div
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                selectedStaffId === null
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => setSelectedStaffId(null)}
              data-testid="staff-option-any"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">Any available staff</h4>
                  <p className="text-xs text-gray-500">The salon will assign someone</p>
                </div>
              </div>
            </div>

            {/* Individual staff cards */}
            {staffList.map((s) => (
              <div
                key={s.id}
                className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  selectedStaffId === s.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => setSelectedStaffId(s.id)}
                data-testid={`staff-option-${s.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-purple-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{s.name}</h4>
                    {s.role && <p className="text-xs text-gray-500 truncate">{s.role}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Booking Bar */}
        <div className="fixed bottom-20 md:bottom-4 left-0 right-0 bg-white border-t shadow-lg p-4 z-40">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                {selectedStaff ? `Selected: ${selectedStaff.name}` : "Any available staff"}
              </p>
              <p className="text-xl font-bold text-purple-600">
                {CURRENCY}{totalPrice.toLocaleString()}
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleProceedFromStaff}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              data-testid="proceed-from-staff-btn"
            >
              <Calendar className="mr-2 h-5 w-5" />
              Choose Date & Time
            </Button>
          </div>
        </div>

        <BottomNavigation />
      </div>
    );
  }

  // Render Date/Time selection step
  if (bookingStep === 'datetime') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackFromDateTime}
              data-testid="back-to-services-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Choose Date & Time</h1>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 pb-40 md:pb-32">
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

  // Payment step - wallet-based payment
  if (bookingStep === 'payment') {
    const insufficientFunds = walletBalance < totalPrice;
    const shortfall = totalPrice - walletBalance;
    
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToDateTime}
              data-testid="back-to-datetime-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Complete Payment</h1>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 pb-40 md:pb-32">
          <div className="max-w-lg mx-auto space-y-4">
            {/* Booking Summary */}
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4">
                <p className="text-sm text-gray-600 mb-2">Booking Summary</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Provider</span>
                    <span className="font-medium">{provider.display_name || provider.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Date</span>
                    <span className="font-medium">{selectedDate}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Time</span>
                    <span className="font-medium">{selectedSlot}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-purple-200">
                  {selectedServicesList.map(s => (
                    <div key={s.id} className="flex justify-between text-sm">
                      <span>{s.sub_service_name}</span>
                      <span className="font-medium">{CURRENCY}{s.price?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-purple-200 flex justify-between">
                  <span className="font-semibold">Total Amount</span>
                  <span className="font-bold text-purple-600 text-lg">
                    {CURRENCY}{totalPrice.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Balance Card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Wallet Balance</span>
                  </div>
                  <span className={`text-xl font-bold ${insufficientFunds ? 'text-red-600' : 'text-green-600'}`}>
                    {loadingWallet ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      `${CURRENCY}${walletBalance.toLocaleString()}`
                    )}
                  </span>
                </div>
                
                {insufficientFunds && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-700">Insufficient Balance</p>
                        <p className="text-sm text-red-600">
                          You need {CURRENCY}{shortfall.toLocaleString()} more to complete this booking.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {insufficientFunds ? (
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    onClick={handleTopUpWallet}
                    data-testid="topup-wallet-btn"
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    Top Up Wallet
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={handlePayWithWallet}
                    disabled={processingWalletPayment || loadingWallet}
                    data-testid="pay-with-wallet-btn"
                  >
                    {processingWalletPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Pay {CURRENCY}{totalPrice.toLocaleString()} from Wallet
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Payment Info */}
            <div className="text-center text-sm text-gray-500 space-y-1">
              <p>Funds will be held in escrow until service is completed.</p>
              <p>You can cancel for a full refund before the provider confirms.</p>
            </div>
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
      <div className="container mx-auto px-4 py-6 pb-40 md:pb-32">
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
                  {/* Show rating from reviews stats if available, otherwise from provider */}
                  {(reviewsStats.total_reviews > 0 || provider.rating > 0) && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(reviewsStats.avg_rating || provider.rating)
                                ? "fill-amber-400 text-amber-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium">
                        {(reviewsStats.avg_rating || provider.rating)?.toFixed(1)}
                      </span>
                      {reviewsStats.total_reviews > 0 && (
                        <span className="text-xs text-gray-500">
                          ({reviewsStats.total_reviews})
                        </span>
                      )}
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

          {/* Portfolio Section - Phase 4 (Social Feed) */}
          {portfolioPosts.length > 0 && (
            <Card data-testid="portfolio-section">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-pink-500" />
                  Portfolio
                  <Badge variant="secondary" className="ml-1">
                    {portfolioPosts.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {portfolioPosts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate("/feed")}
                      className="relative aspect-square rounded-md overflow-hidden bg-gray-100 hover:opacity-90 active:scale-95 transition"
                      data-testid={`portfolio-post-${post.id}`}
                    >
                      <img
                        src={post.image_url}
                        alt={post.caption || "Post"}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                      {(post.likes_count || 0) > 0 && (
                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          ♥ {post.likes_count}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews Section - Phase 3 */}
          <Card data-testid="reviews-section">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  Reviews
                </div>
                {reviewsStats.total_reviews > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-bold">{reviewsStats.avg_rating}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      ({reviewsStats.total_reviews} review{reviewsStats.total_reviews !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReviews ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-600" />
                  <p className="text-sm text-gray-500 mt-2">Loading reviews...</p>
                </div>
              ) : reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b last:border-b-0 pb-4 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{review.reviewer_name || "Anonymous"}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < review.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {review.comment && (
                        <p className="text-sm text-gray-700 mt-2">{review.comment}</p>
                      )}
                      
                      {review.provider_reply && (
                        <div className="mt-3 pl-4 border-l-2 border-purple-200 bg-purple-50 p-3 rounded-r">
                          <p className="text-xs font-medium text-purple-700 mb-1">Provider Response</p>
                          <p className="text-sm text-gray-700">{review.provider_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {reviewsStats.total_reviews > 5 && (
                    <div className="text-center pt-2">
                      <p className="text-sm text-gray-500">
                        Showing {reviews.length} of {reviewsStats.total_reviews} reviews
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No reviews yet</p>
                  <p className="text-xs mt-1">Be the first to book and leave a review!</p>
                </div>
              )}
            </CardContent>
          </Card>
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
