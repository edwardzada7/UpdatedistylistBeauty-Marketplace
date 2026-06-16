import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsAPI, paymentsAPI, reviewsAPI } from "@/services/api";
import { CURRENCY } from "@/utils/constants";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  MessageCircle,
  Star,
  Send
} from "lucide-react";

const STATUS_CONFIG = {
  pending_payment: { label: "Awaiting Payment", className: "bg-orange-100 text-orange-700 border-orange-200", icon: CreditCard },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  canceled: { label: "Canceled", className: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  declined: { label: "Declined", className: "bg-gray-100 text-gray-700 border-gray-200", icon: XCircle },
  no_show_pending: { label: "No-Show Pending", className: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  user_no_show: { label: "Customer No-Show", className: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  provider_no_show: { label: "Provider No-Show", className: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  disputed: { label: "Disputed", className: "bg-purple-100 text-purple-700 border-purple-200", icon: AlertTriangle },
};

const BookingDetailsScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { userData, isProvider } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Review state
  const [existingReview, setExistingReview] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // No-show state
  const [showNoShowModal, setShowNoShowModal] = useState(false);   // report
  const [showConfirmNSModal, setShowConfirmNSModal] = useState(false); // confirm
  const [showDisputeModal, setShowDisputeModal] = useState(false); // dispute
  const [noShowReason, setNoShowReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingNoShow, setSubmittingNoShow] = useState(false);
  const [deadlineCountdown, setDeadlineCountdown] = useState("");

  const authId = userData?.auth_id;
  const role = isProvider ? "provider" : "customer";

  useEffect(() => {
    if (id) {
      fetchBooking();
    }
  }, [id]);

  // Fetch review when booking is loaded
  useEffect(() => {
    if (booking && authId) {
      fetchExistingReview();
    }
  }, [booking?.id, authId]);

  // Live countdown for no-show deadline
  useEffect(() => {
    if (booking?.status !== "no_show_pending" || !booking?.no_show_deadline) {
      setDeadlineCountdown("");
      return;
    }
    const tick = () => {
      const dl = new Date(booking.no_show_deadline).getTime();
      const now = Date.now();
      const diff = dl - now;
      if (diff <= 0) {
        setDeadlineCountdown("expired");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setDeadlineCountdown(`${mins}:${String(secs).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [booking?.status, booking?.no_show_deadline]);


  const fetchExistingReview = async () => {
    if (!booking || !authId) return;
    try {
      const response = await reviewsAPI.getByBooking(booking.id, authId);
      setExistingReview(response.data);
      if (response.data?.provider_reply) {
        setReplyText(response.data.provider_reply);
      }
    } catch (error) {
      // Review doesn't exist or error - that's fine
      setExistingReview(null);
    }
  };

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
        fetchBooking();
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

  // Submit a review
  // ====================== No-show handlers ======================
  const handleReportNoShow = async () => {
    if (!booking || !authId) return;
    setSubmittingNoShow(true);
    try {
      const resp = await bookingsAPI.reportNoShow(booking.id, authId, noShowReason.trim() || null);
      toast.success("No-show report submitted", {
        description: `The other party has ${resp.data?.grace_minutes || 20} minutes to respond.`,
      });
      setShowNoShowModal(false);
      setNoShowReason("");
      fetchBooking();
    } catch (error) {
      console.error("Failed to report no-show:", error);
      const detail = error.response?.data?.detail || "Failed to submit no-show report";
      toast.error(detail);
    } finally {
      setSubmittingNoShow(false);
    }
  };

  const handleConfirmNoShow = async () => {
    if (!booking || !authId) return;
    setSubmittingNoShow(true);
    try {
      await bookingsAPI.confirmNoShow(booking.id, authId);
      toast.success("No-show confirmed. Booking has been closed.");
      setShowConfirmNSModal(false);
      fetchBooking();
    } catch (error) {
      console.error("Failed to confirm no-show:", error);
      toast.error(error.response?.data?.detail || "Failed to confirm no-show");
    } finally {
      setSubmittingNoShow(false);
    }
  };

  const handleDisputeNoShow = async () => {
    if (!booking || !authId) return;
    if (!disputeReason.trim()) {
      toast.error("Please provide a reason for your dispute");
      return;
    }
    setSubmittingNoShow(true);
    try {
      await bookingsAPI.disputeNoShow(booking.id, authId, disputeReason.trim());
      toast.success("Dispute submitted", {
        description: "Our team will review the case shortly.",
      });
      setShowDisputeModal(false);
      setDisputeReason("");
      fetchBooking();
    } catch (error) {
      console.error("Failed to dispute no-show:", error);
      toast.error(error.response?.data?.detail || "Failed to submit dispute");
    } finally {
      setSubmittingNoShow(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!booking || !authId) return;
    
    setSubmittingReview(true);
    try {
      await reviewsAPI.create(authId, {
        booking_id: booking.id,
        rating: reviewRating,
        comment: reviewComment.trim() || null
      });
      
      toast.success("Review submitted successfully!", {
        description: "Thank you for your feedback."
      });
      
      setShowReviewModal(false);
      setReviewComment("");
      fetchExistingReview();
    } catch (error) {
      console.error("Failed to submit review:", error);
      if (error.response?.status === 409) {
        toast.error("You have already reviewed this booking");
      } else {
        toast.error(error.response?.data?.detail || "Failed to submit review");
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  // Provider reply to review
  const handleSubmitReply = async () => {
    if (!existingReview || !authId) return;
    
    setSubmittingReply(true);
    try {
      await reviewsAPI.reply(existingReview.id, authId, {
        provider_reply: replyText.trim()
      });
      
      toast.success("Reply submitted successfully!");
      setShowReplyModal(false);
      fetchExistingReview(); // Refresh to show the reply
    } catch (error) {
      console.error("Failed to submit reply:", error);
      toast.error(error.response?.data?.detail || "Failed to submit reply");
    } finally {
      setSubmittingReply(false);
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

  // ====================== NO-SHOW FLOW ======================
  // Either party can report no-show when booking is confirmed (or pending)
  const canReportNoShow = ["confirmed", "pending"].includes(booking.status);
  // While no_show_pending, the OPPOSITE party (not the reporter) can confirm or dispute
  const currentRole = isProvider ? "provider" : "customer";
  const isReporter = booking.no_show_reporter_role === currentRole;
  const canRespondToNoShow =
    booking.status === "no_show_pending" && !isReporter && booking.no_show_reporter_role;
  const isAwaitingMyResponse = canRespondToNoShow;
  const isAwaitingTheirResponse =
    booking.status === "no_show_pending" && isReporter;

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
            {/* Phase 4 - Multi-staff: show assigned staff if any */}
            {booking.staff && (
              <div className="flex items-center gap-3 pt-1" data-testid="booking-staff">
                <User className="h-5 w-5 text-purple-600" />
                <span className="font-medium">
                  Staff: {booking.staff.name}
                  {booking.staff.role && (
                    <span className="text-sm text-gray-500"> · {booking.staff.role}</span>
                  )}
                </span>
              </div>
            )}
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

              {/* ============== NO-SHOW ACTIONS ============== */}
              {canReportNoShow && (
                <Button
                  variant="outline"
                  className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => setShowNoShowModal(true)}
                  disabled={updating || submittingNoShow}
                  data-testid="report-noshow-btn"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {isProvider ? "Mark User No-Show" : "Provider Didn't Show"}
                </Button>
              )}

              {canRespondToNoShow && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm" data-testid="noshow-pending-banner">
                    <p className="font-semibold text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Action required
                    </p>
                    <p className="text-amber-800 mt-1">
                      {booking.no_show_reporter_role === "provider"
                        ? "Your provider reports that you did not show up."
                        : "Your customer reports that you did not show up."}
                    </p>
                    {booking.no_show_reason && (
                      <p className="mt-1 text-xs text-amber-700">
                        Reason: <em>"{booking.no_show_reason}"</em>
                      </p>
                    )}
                    {deadlineCountdown && deadlineCountdown !== "expired" && (
                      <p className="mt-2 text-xs text-amber-700">
                        Auto-finalization in <span className="font-mono font-bold">{deadlineCountdown}</span>
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => setShowConfirmNSModal(true)}
                      disabled={submittingNoShow}
                      data-testid="confirm-noshow-btn"
                    >
                      Confirm
                    </Button>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => setShowDisputeModal(true)}
                      disabled={submittingNoShow}
                      data-testid="dispute-noshow-btn"
                    >
                      Dispute
                    </Button>
                  </div>
                </>
              )}

              {isAwaitingTheirResponse && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm" data-testid="noshow-awaiting-banner">
                  <p className="text-blue-900">
                    Awaiting response from the other party.
                  </p>
                  {deadlineCountdown && deadlineCountdown !== "expired" && (
                    <p className="mt-1 text-xs text-blue-700">
                      Auto-finalization in <span className="font-mono font-bold">{deadlineCountdown}</span>
                    </p>
                  )}
                </div>
              )}

              {booking.status === "disputed" && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm" data-testid="noshow-disputed-banner">
                  <p className="font-semibold text-purple-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Disputed
                  </p>
                  <p className="text-purple-800 mt-1">
                    This booking is under review by our support team. No automatic action will be taken.
                  </p>
                </div>
              )}

              {/* No actions available */}
              {!canCustomerCancel && !canCustomerPay && !canProviderConfirm && !canProviderDecline && !canProviderComplete && !canProviderCancel && !canReportNoShow && !canRespondToNoShow && !isAwaitingTheirResponse && booking.status !== "disputed" && !["completed", "canceled", "declined", "user_no_show", "provider_no_show"].includes(booking.status) && (
                <p className="text-center text-gray-500 py-2">No actions available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Review Section - Phase 3 */}
        {booking.status === "completed" && (
          <Card data-testid="review-section">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4" />
                Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              {existingReview ? (
                // Show existing review
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < existingReview.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        Reviewed on {new Date(existingReview.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {existingReview.comment && (
                    <p className="text-gray-700">{existingReview.comment}</p>
                  )}
                  
                  {existingReview.provider_reply && (
                    <div className="pl-4 border-l-2 border-purple-200 bg-purple-50 p-3 rounded-r">
                      <p className="text-xs font-medium text-purple-700 mb-1">Provider Response</p>
                      <p className="text-sm text-gray-700">{existingReview.provider_reply}</p>
                    </div>
                  )}
                  
                  {/* Provider can reply if no reply yet */}
                  {isProvider && !existingReview.provider_reply && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowReplyModal(true)}
                      className="mt-2"
                      data-testid="reply-to-review-btn"
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Reply to Review
                    </Button>
                  )}
                </div>
              ) : !isProvider ? (
                // Customer can leave a review
                <div className="text-center py-4">
                  <Star className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                  <p className="text-gray-600 mb-3">How was your experience?</p>
                  <Button
                    onClick={() => setShowReviewModal(true)}
                    className="bg-amber-500 hover:bg-amber-600"
                    data-testid="leave-review-btn"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Leave a Review
                  </Button>
                </div>
              ) : (
                // Provider - no review yet
                <p className="text-center text-gray-500 py-4">
                  No review yet from the customer
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Leave a Review</h3>
            
            {/* Star Rating */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                    data-testid={`rating-star-${star}`}
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= reviewRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            
            {/* Comment */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Comment (optional)</p>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience..."
                rows={4}
                data-testid="review-comment-input"
              />
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowReviewModal(false)}
                disabled={submittingReview}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="submit-review-btn"
              >
                {submittingReview ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit Review
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {showReplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Reply to Review</h3>
            
            {/* Original Review Summary */}
            {existingReview && (
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div className="flex items-center gap-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < existingReview.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                {existingReview.comment && (
                  <p className="text-gray-600">{existingReview.comment}</p>
                )}
              </div>
            )}
            
            {/* Reply Text */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Your Reply</p>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Thank you for your feedback..."
                rows={4}
                data-testid="reply-text-input"
              />
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowReplyModal(false)}
                disabled={submittingReply}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReply}
                disabled={submittingReply || !replyText.trim()}
                data-testid="submit-reply-btn"
              >
                {submittingReply ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit Reply
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNavSpacer />
      <BottomNavigation />

      {/* ============== NO-SHOW MODALS ============== */}
      {showNoShowModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !submittingNoShow && setShowNoShowModal(false)}
          data-testid="noshow-report-modal"
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {isProvider ? "Mark customer as no-show?" : "Report provider no-show?"}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  The other party will get a notification and 20 minutes to confirm or dispute.
                  If they don't respond, the booking will be auto-finalized.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="noShowReason" className="text-sm">
                Reason (optional)
              </Label>
              <Textarea
                id="noShowReason"
                value={noShowReason}
                onChange={(e) => setNoShowReason(e.target.value)}
                placeholder="Briefly describe what happened..."
                rows={3}
                maxLength={500}
                className="mt-1"
                data-testid="noshow-reason-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowNoShowModal(false)}
                disabled={submittingNoShow}
              >
                Cancel
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleReportNoShow}
                disabled={submittingNoShow}
                data-testid="noshow-report-submit"
              >
                {submittingNoShow ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Submit Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {showConfirmNSModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !submittingNoShow && setShowConfirmNSModal(false)}
          data-testid="noshow-confirm-modal"
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Confirm no-show?</h3>
            <p className="text-sm text-gray-600">
              By confirming, you agree that{" "}
              {booking.no_show_reporter_role === "provider"
                ? "you (the customer) did not show up. The booking will be closed and payment may be released to the provider per policy."
                : "the provider did not show up. The booking will be closed and your refund will be processed per policy."}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowConfirmNSModal(false)}
                disabled={submittingNoShow}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleConfirmNoShow}
                disabled={submittingNoShow}
                data-testid="noshow-confirm-submit"
              >
                {submittingNoShow ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Confirm No-Show
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDisputeModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !submittingNoShow && setShowDisputeModal(false)}
          data-testid="noshow-dispute-modal"
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Dispute this claim</h3>
            <p className="text-sm text-gray-600 mb-3">
              Our support team will review your case. Auto-finalization will be paused.
              Please tell us what happened.
            </p>
            <Label htmlFor="disputeReason" className="text-sm">
              Your side of the story <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="disputeReason"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Explain what happened..."
              rows={4}
              maxLength={500}
              className="mt-1"
              data-testid="dispute-reason-input"
              required
            />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDisputeModal(false)}
                disabled={submittingNoShow}
              >
                Cancel
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleDisputeNoShow}
                disabled={submittingNoShow || !disputeReason.trim()}
                data-testid="dispute-submit"
              >
                {submittingNoShow ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Submit Dispute
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingDetailsScreen;
