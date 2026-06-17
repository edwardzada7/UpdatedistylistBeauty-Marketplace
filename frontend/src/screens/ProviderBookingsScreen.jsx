import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsAPI } from "@/services/api";
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
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  CalendarCheck,
  CalendarX
} from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700 border-blue-200" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  canceled: { label: "Canceled", className: "bg-red-100 text-red-700 border-red-200" },
  declined: { label: "Declined", className: "bg-gray-100 text-gray-700 border-gray-200" }
};

const ProviderBookingsScreen = () => {
  const navigate = useNavigate();
  const { userData, isProvider } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [updatingId, setUpdatingId] = useState(null);

  const authId = userData?.auth_id;

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await bookingsAPI.list({
        role: "provider",
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
    if (authId && isProvider) {
      fetchBookings();
    }
  }, [authId, isProvider, fetchBookings]);

  const handleStatusUpdate = async (bookingId, newStatus, e) => {
    e.stopPropagation();
    
    try {
      setUpdatingId(bookingId);
      await bookingsAPI.updateStatus(bookingId, newStatus, "provider", authId);
      toast.success(`Booking ${newStatus === "confirmed" ? "confirmed" : newStatus === "declined" ? "declined" : newStatus}`);
      fetchBookings(); // Refresh
    } catch (error) {
      console.error("Failed to update booking:", error);
      toast.error(error.response?.data?.detail || "Failed to update booking");
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter bookings by status
  const pendingBookings = bookings.filter(b => b.status === "pending");
  const confirmedBookings = bookings.filter(b => b.status === "confirmed");
  const completedBookings = bookings.filter(b => b.status === "completed");
  const canceledBookings = bookings.filter(b => ["canceled", "declined"].includes(b.status));

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
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  const BookingCard = ({ booking, showActions = false }) => {
    const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
    const isUpdating = updatingId === booking.id;
    
    return (
      <Card 
        className="cursor-pointer hover:shadow-md transition-all"
        onClick={() => navigate(`/bookings/${booking.id}`)}
        data-testid={`booking-card-${booking.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-purple-600" />
                <span className="font-semibold text-gray-900">
                  {booking.customer_display_name || "Customer"}
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
              
              <div className="flex items-center gap-3">
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
            </div>
            
            {!showActions && (
              <ChevronRight className="h-5 w-5 text-gray-400 mt-2" />
            )}
          </div>
          
          {/* Quick Actions for Pending */}
          {showActions && booking.status === "pending" && (
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={(e) => handleStatusUpdate(booking.id, "confirmed", e)}
                disabled={isUpdating}
                data-testid={`confirm-btn-${booking.id}`}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Confirm
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={(e) => handleStatusUpdate(booking.id, "declined", e)}
                disabled={isUpdating}
                data-testid={`decline-btn-${booking.id}`}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-1" />
                    Decline
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!isProvider) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Provider Access Only</h2>
          <p className="text-gray-600">You need to be registered as a provider to access this page.</p>
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
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        <LoadingSpinner fullScreen message="Loading bookings..." />
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
            onClick={() => navigate("/provider/dashboard")}
            className="text-white hover:bg-white/20"
            data-testid="back-btn"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl font-semibold flex-1">Bookings</h1>
        </div>
      </div>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="pending" className="text-xs px-2">
              <AlertCircle className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Pending ({pendingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs px-2">
              <CalendarCheck className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Confirmed ({confirmedBookings.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs px-2">
              <CheckCircle className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Done ({completedBookings.length})
            </TabsTrigger>
            <TabsTrigger value="canceled" className="text-xs px-2">
              <CalendarX className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Other ({canceledBookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {pendingBookings.length > 0 ? (
              pendingBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} showActions={true} />
              ))
            ) : (
              <EmptyState
                title="No pending bookings"
                description="New booking requests will appear here"
              />
            )}
          </TabsContent>

          <TabsContent value="confirmed" className="space-y-3">
            {confirmedBookings.length > 0 ? (
              confirmedBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <EmptyState
                title="No confirmed bookings"
                description="Confirmed appointments will appear here"
              />
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {completedBookings.length > 0 ? (
              completedBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <EmptyState
                title="No completed bookings"
                description="Completed appointments will appear here"
              />
            )}
          </TabsContent>

          <TabsContent value="canceled" className="space-y-3">
            {canceledBookings.length > 0 ? (
              canceledBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <EmptyState
                title="No canceled bookings"
                description="Canceled or declined bookings will appear here"
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

export default ProviderBookingsScreen;
