import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, Bell, BellOff, Check, CheckCheck, RefreshCcw, 
  Calendar, Wallet, CreditCard, Clock, Loader2,
  ChevronRight, MessageCircle, Star, AlarmClock
} from "lucide-react";
import { toast } from "sonner";
import { notificationsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";

const NotificationsScreen = () => {
  const navigate = useNavigate();
  const { userData, isProvider } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState(null);

  const authId = userData?.auth_id;

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!authId) return;
    
    try {
      const response = await notificationsAPI.getAll(authId, false, 50, 0);
      setNotifications(response.data || []);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    if (!authId) return;
    
    try {
      await notificationsAPI.markAllRead(authId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read if not already
    if (!notification.read) {
      setMarkingRead(notification.id);
      try {
        await notificationsAPI.markRead(authId, [notification.id]);
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
      } catch (error) {
        console.error("Failed to mark as read:", error);
      } finally {
        setMarkingRead(null);
      }
    }

    // Navigate based on notification type and metadata
    const { metadata, type } = notification;
    const meta = metadata || {};
    const bookingId = meta.booking_id;

    // 1) Chat messages → BookingChatScreen
    if (type === "chat_message" && bookingId) {
      navigate(`/bookings/${bookingId}/chat`);
      return;
    }

    // 2) Review received → provider's own profile (reviews section)
    if (type === "review_received") {
      navigate("/profile");
      return;
    }

    // 3) Withdrawals → wallet (provider) or admin (admin)
    if (
      type === "withdrawal_approved" ||
      type === "withdrawal_rejected" ||
      type === "withdrawal_requested"
    ) {
      if (isProvider) {
        navigate("/wallet");
      } else if (meta.withdrawal_id) {
        navigate("/admin/withdrawals");
      } else {
        navigate("/wallet");
      }
      return;
    }

    // 4) Wallet top-up success → wallet
    if (type === "wallet_topup_success") {
      navigate("/wallet");
      return;
    }

    // 5) Booking-related (created/confirmed/cancelled/completed/declined/reminders)
    //    → BookingDetailsScreen if we have a booking_id
    if (bookingId) {
      navigate(`/bookings/${bookingId}`);
      return;
    }

    // 6) Fallback: stay on the notifications screen
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "booking_created":
      case "booking_confirmed":
      case "booking_declined":
      case "booking_canceled":
      case "booking_cancelled":
      case "booking_completed":
        return <Calendar className="h-5 w-5" />;
      case "booking_reminder_2h":
      case "booking_reminder_30m":
        return <AlarmClock className="h-5 w-5" />;
      case "chat_message":
        return <MessageCircle className="h-5 w-5" />;
      case "review_received":
        return <Star className="h-5 w-5" />;
      case "withdrawal_requested":
      case "withdrawal_approved":
      case "withdrawal_rejected":
        return <CreditCard className="h-5 w-5" />;
      case "wallet_topup_success":
        return <Wallet className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationTitle = (type) => {
    switch (type) {
      case "booking_created":
        return "New Booking Request";
      case "booking_confirmed":
        return "Booking Confirmed";
      case "booking_declined":
        return "Booking Declined";
      case "booking_canceled":
      case "booking_cancelled":
        return "Booking Cancelled";
      case "booking_completed":
        return "Service Completed";
      case "booking_reminder_2h":
        return "Appointment in 2 hours";
      case "booking_reminder_30m":
        return "Appointment in 30 minutes";
      case "chat_message":
        return "New Message";
      case "review_received":
        return "New Review";
      case "withdrawal_requested":
        return "Withdrawal Requested";
      case "withdrawal_approved":
        return "Withdrawal Approved";
      case "withdrawal_rejected":
        return "Withdrawal Rejected";
      case "wallet_topup_success":
        return "Wallet Top-Up Successful";
      default:
        return "Notification";
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "booking_created":
        return "bg-blue-100 text-blue-600";
      case "booking_confirmed":
      case "booking_completed":
      case "withdrawal_approved":
      case "wallet_topup_success":
        return "bg-green-100 text-green-600";
      case "booking_declined":
      case "booking_canceled":
      case "booking_cancelled":
      case "withdrawal_rejected":
        return "bg-red-100 text-red-600";
      case "booking_reminder_2h":
      case "booking_reminder_30m":
        return "bg-orange-100 text-orange-600";
      case "chat_message":
        return "bg-indigo-100 text-indigo-600";
      case "review_received":
        return "bg-yellow-100 text-yellow-600";
      case "withdrawal_requested":
        return "bg-amber-100 text-amber-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString("en-NG", { 
      month: "short", 
      day: "numeric" 
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        <LoadingSpinner fullScreen message="Loading notifications..." />
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-500">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9 w-9"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="p-4 space-y-3">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BellOff className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">No notifications yet</h3>
              <p className="text-sm text-gray-500">
                You'll receive notifications about bookings, payments, and more.
              </p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card 
              key={notification.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                !notification.read ? "border-l-4 border-l-purple-500 bg-purple-50/30" : ""
              }`}
              onClick={() => handleNotificationClick(notification)}
              data-testid={`notification-${notification.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full flex-shrink-0 ${getNotificationColor(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-medium text-sm ${!notification.read ? "text-gray-900" : "text-gray-700"}`}>
                        {notification.title || getNotificationTitle(notification.type)}
                      </h3>
                      {markingRead === notification.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400 flex-shrink-0" />
                      ) : !notification.read ? (
                        <div className="h-2 w-2 bg-purple-500 rounded-full flex-shrink-0 mt-1.5" />
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-400">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                      {notification.type === "chat_message" && notification.metadata?.booking_id && (
                        <span className="text-xs text-indigo-600 flex items-center gap-1">
                          Open chat <ChevronRight className="h-3 w-3" />
                        </span>
                      )}
                      {notification.type === "review_received" && (
                        <span className="text-xs text-yellow-700 flex items-center gap-1">
                          View review <ChevronRight className="h-3 w-3" />
                        </span>
                      )}
                      {(notification.type === "wallet_topup_success" ||
                        notification.type === "withdrawal_approved" ||
                        notification.type === "withdrawal_rejected") && (
                        <span className="text-xs text-green-700 flex items-center gap-1">
                          Open wallet <ChevronRight className="h-3 w-3" />
                        </span>
                      )}
                      {notification.metadata?.booking_id &&
                        notification.type !== "chat_message" && (
                        <span className="text-xs text-purple-600 flex items-center gap-1">
                          View booking <ChevronRight className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
};

export default NotificationsScreen;
