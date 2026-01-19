import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsAPI, paymentsAPI } from "@/services/api";
import { CURRENCY } from "@/utils/constants";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  ChevronRight,
  CalendarClock,
  History,
  Wallet,
  Loader2
} from "lucide-react";

const STATUS_CONFIG = {
  pending_payment: { label: "Awaiting Payment", className: "bg-orange-100 text-orange-700 border-orange-200" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700 border-blue-200" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  canceled: { label: "Canceled", className: "bg-red-100 text-red-700 border-red-200" },
  declined: { label: "Declined", className: "bg-gray-100 text-gray-700 border-gray-200" }
};

const formatDate = (dateStr) => {
  if (!dateStr) return "Date TBD";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
};

const formatTime = (timeStr) => {
  if (!timeStr) return "Time TBD";
  // Handle HH:MM:SS or HH:MM format
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0]);
  const minutes = parts[1];
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
};

// Extracted BookingCard component
const BookingCard = ({ booking, onPayNow, isPaying, navigate }) => {
  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const needsPayment = booking.status === "pending_payment";
  
  const handleCardClick = () => {
    navigate(`/bookings/${booking.id}`);
  };

  const handlePayClick = (e) => {
    e.stopPropagation();
    onPayNow(booking);
  };
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all"
      onClick={handleCardClick}
      data-testid={`booking-card-${booking.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-purple-600" />
              <span className="font-semibold text-gray-900">
                {booking.provider_display_name || "Provider"}
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(booking.booking_date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(booking.booking_time)}
              </span>
            </div>
            
            {booking.services && booking.services.length > 0 && (
              <p className="text-xs text-gray-500 mb-2">
                {booking.services.map(s => s.service_name).join(", ")}
              </p>
            )}
            
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
              <span className="font-bold text-purple-600">
                {CURRENCY}{(booking.total_amount || 0).toLocaleString()}
              </span>
              {booking.total_duration > 0 && (
                <span className="text-xs text-gray-500">
                  {booking.total_duration} min
                </span>
              )}
            </div>
            
            {/* Pay Now button for pending_payment bookings */}
            {needsPayment && (
              <Button 
                className="mt-3 w-full bg-green-600 hover:bg-green-700"
                size="sm"
                onClick={handlePayClick}
                disabled={isPaying}
                data-testid={`pay-now-btn-${booking.id}`}
              >
                {isPaying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay Now
                  </>
                )}
              </Button>
            )}
          </div>
          
          <ChevronRight className="h-5 w-5 text-gray-400 mt-2" />
        </div>
      </CardContent>
    </Card>
  );
};

const CustomerBookingsScreen = () => {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [payingBookingId, setPayingBookingId] = useState(null);

  const authId = userData?.auth_id;

  const fetchBookings = useCallback(async () => {
    if (!authId) return;
    try {
      setLoading(true);
      const response = await bookingsAPI.list({
        role: "customer",
        authId: authId
      });
      setBookings(response.data || []);
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [authId]);

  useEffect(() => {
    if (authId) {
      fetchBookings();
    }
  }, [authId, fetchBookings]);

  // Split bookings into upcoming and past
  const today = new Date().toISOString().split('T')[0];
  
  const upcomingBookings = bookings.filter(b => {
    const isUpcomingStatus = ["pending_payment", "pending", "confirmed"].includes(b.status);
    const isUpcomingDate = b.booking_date >= today;
    return isUpcomingStatus && isUpcomingDate;
  });

  const pastBookings = bookings.filter(b => {
    const isPastStatus = ["completed", "canceled", "declined"].includes(b.status);
    const isPastDate = b.booking_date < today;
    return isPastStatus || isPastDate;
  });

  const handlePayNow = async (booking) => {
    if (!userData?.auth_id) {
      toast.error("Authentication required. Please log in.");
      return;
    }

    setPayingBookingId(booking.id);
    try {
      // Use wallet-based payment instead of Paystack
      const response = await paymentsAPI.payWithWallet(booking.id, userData.auth_id);
      
      if (response.data.status === "success") {
        toast.success("Payment successful!", {
          description: "Your booking has been confirmed."
        });
        // Refresh bookings list
        fetchBookings();
      }
    } catch (error) {
      console.error("Wallet payment failed:", error);
      
      // Handle insufficient funds (402)
      if (error.response?.status === 402) {
        const detail = error.response.data?.detail;
        if (detail && typeof detail === 'object') {
          toast.error(`Insufficient balance. Need ${CURRENCY}${detail.needed?.toLocaleString()}, have ${CURRENCY}${detail.available?.toLocaleString()}`, {
            action: {
              label: "Top Up",
              onClick: () => navigate("/wallet")
            }
          });
        } else {
          toast.error("Insufficient wallet balance. Please top up your wallet.", {
            action: {
              label: "Top Up",
              onClick: () => navigate("/wallet")
            }
          });
        }
      } else {
        toast.error(error.response?.data?.detail || "Payment failed. Please try again.");
      }
    } finally {
      setPayingBookingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        <LoadingSpinner fullScreen message="Loading your bookings..." />
        <BottomNavSpacer />
      <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/user/home")}
            className="text-white hover:bg-white/20"
            data-testid="back-btn"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl font-semibold flex-1">My Bookings</h1>
        </div>
      </div>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Upcoming ({upcomingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Past ({pastBookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3">
            {upcomingBookings.length > 0 ? (
              upcomingBookings.map(booking => (
                <BookingCard 
                  key={booking.id} 
                  booking={booking}
                  onPayNow={handlePayNow}
                  isPaying={payingBookingId === booking.id}
                  navigate={navigate}
                />
              ))
            ) : (
              <EmptyState
                title="No upcoming bookings"
                description="Your scheduled appointments will appear here"
                actionLabel="Browse Providers"
                onAction={() => navigate("/user/providers")}
              />
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3">
            {pastBookings.length > 0 ? (
              pastBookings.map(booking => (
                <BookingCard 
                  key={booking.id} 
                  booking={booking}
                  onPayNow={handlePayNow}
                  isPaying={payingBookingId === booking.id}
                  navigate={navigate}
                />
              ))
            ) : (
              <EmptyState
                title="No past bookings"
                description="Your completed bookings will appear here"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
};

export default CustomerBookingsScreen;
