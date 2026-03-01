import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { notificationsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const NotificationBell = ({ className = "" }) => {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const authId = userData?.auth_id;

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!authId) return;
    
    try {
      const response = await notificationsAPI.getUnreadCount(authId);
      setUnreadCount(response.data?.count || 0);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, [authId]);

  // Fetch on mount and when authId changes
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Refresh count on window focus
  useEffect(() => {
    const handleFocus = () => {
      fetchUnreadCount();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchUnreadCount]);

  // Refresh periodically (every 60 seconds)
  useEffect(() => {
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate("/notifications")}
      className={`relative ${className}`}
      data-testid="notification-bell"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span 
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full"
          data-testid="notification-badge"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
};

export default NotificationBell;
