import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, Send, Loader2, RefreshCcw, MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import { bookingsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";

const BookingChatScreen = () => {
  const navigate = useNavigate();
  const { id: bookingId } = useParams();
  const { userData } = useAuth();
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const authId = userData?.auth_id;

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch chat messages
  const fetchChat = useCallback(async (showLoading = false) => {
    if (!authId || !bookingId) return;
    
    if (showLoading) setLoading(true);
    
    try {
      const response = await bookingsAPI.getChat(bookingId, authId);
      setMessages(response.data.messages || []);
      setParticipants(response.data.participants || null);
      setError(null);
      
      // Mark as read
      try {
        await bookingsAPI.markChatRead(bookingId, authId);
      } catch (markErr) {
        console.error("Failed to mark chat as read:", markErr);
      }
    } catch (err) {
      console.error("Failed to fetch chat:", err);
      if (err.response?.status === 403) {
        setError("You don't have access to this chat");
      } else if (err.response?.status === 404) {
        setError("Booking not found");
      } else {
        setError("Failed to load chat");
      }
    } finally {
      setLoading(false);
    }
  }, [authId, bookingId]);

  // Initial fetch and polling setup
  useEffect(() => {
    fetchChat(true);
    
    // Poll every 6 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchChat(false);
    }, 6000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
    const messageText = newMessage.trim();
    setNewMessage("");
    setSending(true);
    
    // Optimistic update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      booking_id: parseInt(bookingId),
      sender_auth_id: authId,
      receiver_auth_id: participants?.provider_auth_id === authId 
        ? participants?.customer_auth_id 
        : participants?.provider_auth_id,
      message: messageText,
      read: false,
      created_at: new Date().toISOString(),
      _sending: true
    };
    
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();
    
    try {
      const response = await bookingsAPI.sendChatMessage(bookingId, authId, messageText);
      
      // Replace temp message with real one
      setMessages(prev => prev.map(m => 
        m.id === tempMessage.id ? { ...response.data, _sending: false } : m
      ));
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message");
      
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      setNewMessage(messageText); // Restore the message
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-NG", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: true
    });
  };

  // Format date for grouping
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-NG", { 
      weekday: "short",
      month: "short", 
      day: "numeric" 
    });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        <LoadingSpinner fullScreen message="Loading chat..." />
        <BottomNavigation />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="p-4 flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Chat</h1>
          </div>
        </div>
        
        <div className="p-4">
          <Card>
            <CardContent className="py-12 text-center">
              <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">{error}</h3>
              <Button 
                variant="outline" 
                onClick={() => navigate(-1)}
                className="mt-4"
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <BottomNavSpacer />
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(`/bookings/${bookingId}`)}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Chat</h1>
              <p className="text-xs text-gray-500">Booking #{bookingId}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchChat(false)}
            className="h-9 w-9"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 pb-24" style={{ minHeight: "calc(100vh - 180px)" }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <MessageCircle className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-1">No messages yet</h3>
            <p className="text-sm text-gray-500 text-center">
              Say hello to start the conversation!
            </p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <div className="px-3 py-1 bg-gray-200 rounded-full">
                  <span className="text-xs text-gray-600">{date}</span>
                </div>
              </div>
              
              {/* Messages for this date */}
              {dateMessages.map((message) => {
                const isSent = message.sender_auth_id === authId;
                
                return (
                  <div
                    key={message.id}
                    className={`flex mb-3 ${isSent ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${message.id}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        isSent
                          ? "bg-purple-600 text-white rounded-br-md"
                          : "bg-white text-gray-800 rounded-bl-md shadow-sm"
                      } ${message._sending ? "opacity-70" : ""}`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.message}
                      </p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${
                        isSent ? "text-purple-200" : "text-gray-400"
                      }`}>
                        <span className="text-xs">
                          {formatTime(message.created_at)}
                        </span>
                        {isSent && message._sending && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container - Fixed at bottom above BottomNav */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t p-3 z-20">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={sending}
            className="flex-1"
            data-testid="chat-input"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="bg-purple-600 hover:bg-purple-700 h-10 w-10 p-0"
            data-testid="send-button"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Bottom nav spacer for mobile */}
      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
};

export default BookingChatScreen;
