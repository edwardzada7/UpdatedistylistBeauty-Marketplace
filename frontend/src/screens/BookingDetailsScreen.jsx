import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsAPI, paymentsAPI } from "@/services/api";
import { CURRENCY } from "@/utils/constants";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  MapPin,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Store,
  Home,
  Car,
  RefreshCcw,
  CreditCard,
  Wallet,
  MessageCircle
} from "lucide-react";

const STATUS_CONFIG = {
  pending_payment: { label: "Awaiting Payment", className: "bg-orange-100 text-orange-700 border-orange-200", icon: CreditCard },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  canceled: { label: "Canceled", className: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  declined: { label: "Declined", className: "bg-gray-100 text-gray-700 border-gray-200", icon: XCircle }
};

const BookingDetailsScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { userData, isProvider } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const authId = userData?.auth_id;
  const role = isProvider ? "provider" : "customer";

  useEffect(() => {
    if (id) {
      fetchBooking();
    }
  }, [id]);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      const response = await bookingsAPI.getById(id, role);
      setBooking(response.data);
    } catch (error) {
      console.error("Failed to fetch booking:", error);
      toast.error("Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdating(true);
      await bookingsAPI.updateStatus(id, newStatus, role, authId);
      toast.success(`Booking ${newStatus}`);
      fetchBooking(); // Refresh
    } catch (error) {
      console.error("Failed to update booking:", error);
      toast.error(error.response?.data?.detail || "Failed to update booking");
    } finally {
      setUpdating(false);
    }
  };

  const handleBack = () => {
    if (isProvider) {
      navigate("/provider/bookings");
    } else {
      navigate("/bookings");
    }
  };

  const handleRebook = () => {
    // Navigate to provider profile to book again
    // We'd need to get provider_id (integer) from provider UUID
    toast.info("Rebook feature coming soon!");
  };

  const handlePayNow = async () => {
    if (!booking || !userData?.auth_id) {
      toast.error("Unable to process payment. Please try again.");
      return;
    }

    setProcessingPayment(true);
    try {
      // Use wallet-based payment instead of Paystack
      const response = await paymentsAPI.payWithWallet(booking.id, userData.auth_id);

      if (response.data.status === "success") {
        toast.success("Payment successful!", {
          description: "Your booking has been confirmed."
        });
        // Refresh booking details
        fetchBookingDetails();
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
      setProcessingPayment(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Date TBD";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        <LoadingSpinner fullScreen message="Loading booking details..." />
        <BottomNavigation />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        <div className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Booking Not Found</h2>
          <p className="text-gray-600 mb-4">This booking does not exist or you do not have access to it.</p>
          <Button onClick={handleBack}>Go Back</Button>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  // Determine what actions are available
  const canCustomerCancel = !isProvider && ["pending", "confirmed", "pending_payment"].includes(booking.status);
  const canCustomerPay = !isProvider && booking.status === "pending_payment";
  const canProviderConfirm = isProvider && booking.status === "pending";
  const canProviderDecline = isProvider && booking.status === "pending";
  const canProviderComplete = isProvider && booking.status === "confirmed";
  const canProviderCancel = isProvider && ["pending", "confirmed"].includes(booking.status);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-white hover:bg-white/20"
            data-testid="back-btn"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl font-semibold flex-1">Booking Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Status Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusIcon className={`h-8 w-8 ${booking.status === "completed" ? "text-green-600" : booking.status === "confirmed" ? "text-blue-600" : booking.status === "pending" ? "text-yellow-600" : "text-red-600"}`} />
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge variant="outline" className={`${statusConfig.className} text-base`}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Booking ID</p>
                <p className="font-mono text-lg font-semibold">#{booking.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Person Info Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              {isProvider ? "Customer" : "Provider"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-gray-900">
                {isProvider ? booking.customer_display_name : booking.provider_display_name}
              </p>
              {/* Chat Button - Show unless canceled */}
              {booking.status !== "canceled" && booking.status !== "declined" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/bookings/${booking.id}/chat`)}
                  className="text-purple-600 border-purple-200 hover:bg-purple-50"
                  data-testid="chat-btn"
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Chat
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Date & Time Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-purple-600" />
              <span className="font-medium">{formatDate(booking.booking_date)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-purple-600" />
              <span className="font-medium">{formatTime(booking.booking_time)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Services Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Services</CardTitle>
          </CardHeader>
          <CardContent>
            {booking.services && booking.services.length > 0 ? (
              <div className="space-y-3">
                {booking.services.map((service, index) => (
                  <div 
                    key={service.service_id || index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{service.service_name}</p>
                      {service.duration_minutes > 0 && (
                        <p className="text-xs text-gray-500">{service.duration_minutes} minutes</p>
                      )}
                    </div>
                    <span className="font-semibold text-purple-600">
                      {CURRENCY}{(service.price || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                
                {/* Total */}
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200 mt-4">
                  <div>
                    <p className="font-semibold text-gray-900">Total</p>
                    {booking.total_duration > 0 && (
                      <p className="text-xs text-gray-500">{booking.total_duration} minutes total</p>
                    )}
                  </div>
                  <span className="text-xl font-bold text-purple-600">
                    {CURRENCY}{(booking.total_amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No services recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Notes Card */}
        {booking.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{booking.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-500 mb-3">Actions</p>
            <div className="space-y-2">
              {/* Pay from Wallet button for pending_payment */}
              {canCustomerPay && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handlePayNow}
                  disabled={processingPayment}
                  data-testid="pay-now-btn"
                >
                  {processingPayment ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wallet className="h-4 w-4 mr-2" />
                  )}
                  Pay from Wallet - {CURRENCY}{(booking.total_amount || 0).toLocaleString()}
                </Button>
              )}
              
              {/* Customer Actions */}
              {canCustomerCancel && (
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleStatusUpdate("canceled")}
                  disabled={updating}
                  data-testid="cancel-booking-btn"
                >
                  {updating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Cancel Booking
                </Button>
              )}
              
              {/* Rebook option for customers (past bookings) */}
              {!isProvider && ["completed", "canceled", "declined"].includes(booking.status) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleRebook}
                  data-testid="rebook-btn"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Book Again
                </Button>
              )}
              
              {/* Provider Actions */}
              {canProviderConfirm && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => handleStatusUpdate("confirmed")}
                  disabled={updating}
                  data-testid="confirm-booking-btn"
                >
                  {updating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirm Booking
                </Button>
              )}
              
              {canProviderDecline && (
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleStatusUpdate("declined")}
                  disabled={updating}
                  data-testid="decline-booking-btn"
                >
                  {updating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Decline Booking
                </Button>
              )}
              
              {canProviderComplete && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => handleStatusUpdate("completed")}
                  disabled={updating}
                  data-testid="complete-booking-btn"
                >
                  {updating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Mark as Completed
                </Button>
              )}
              
              {canProviderCancel && booking.status !== "pending" && (
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleStatusUpdate("canceled")}
                  disabled={updating}
                  data-testid="provider-cancel-btn"
                >
                  {updating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Cancel Booking
                </Button>
              )}
              
              {/* No actions available */}
              {!canCustomerCancel && !canCustomerPay && !canProviderConfirm && !canProviderDecline && !canProviderComplete && !canProviderCancel && !["completed", "canceled", "declined"].includes(booking.status) && (
                <p className="text-center text-gray-500 py-2">No actions available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
};

export default BookingDetailsScreen;
