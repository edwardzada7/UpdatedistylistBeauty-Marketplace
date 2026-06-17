import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { providersAPI } from "@/services/api";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Clock, 
  Calendar,
  Save,
  Loader2,
  Plus,
  Trash2,
  AlertCircle
} from "lucide-react";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const DEFAULT_RULES = {
  max_sessions_per_day: 6,
  min_notice_minutes: 120,
  slot_step_minutes: 30,
};

const ProviderAvailabilityScreen = () => {
  const navigate = useNavigate();
  const { userData, isProvider } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Weekly availability state
  const [weeklyAvailability, setWeeklyAvailability] = useState(
    DAYS_OF_WEEK.map(day => ({
      day_of_week: day.value,
      is_active: false,
      start_time: "09:00",
      end_time: "17:00",
    }))
  );
  
  // Exceptions state
  const [exceptions, setExceptions] = useState([]);
  const [newException, setNewException] = useState({
    date: "",
    is_unavailable: true,
    start_time: "",
    end_time: "",
    note: "",
  });
  
  // Booking rules state
  const [rules, setRules] = useState(DEFAULT_RULES);

  const providerId = userData?.id;

  const loadAvailability = useCallback(async () => {
    try {
      setLoading(true);
      const response = await providersAPI.getAvailability(providerId);
      const data = response.data;
      
      // Map weekly availability
      if (data.weekly && data.weekly.length > 0) {
        const updatedWeekly = DAYS_OF_WEEK.map(day => {
          const existing = data.weekly.find(w => w.day_of_week === day.value);
          if (existing) {
            return {
              day_of_week: day.value,
              is_active: existing.is_active ?? true,
              start_time: existing.start_time?.slice(0, 5) || "09:00",
              end_time: existing.end_time?.slice(0, 5) || "17:00",
            };
          }
          return {
            day_of_week: day.value,
            is_active: false,
            start_time: "09:00",
            end_time: "17:00",
          };
        });
        setWeeklyAvailability(updatedWeekly);
      }
      
      // Map exceptions
      if (data.exceptions) {
        setExceptions(data.exceptions.map(exc => ({
          ...exc,
          start_time: exc.start_time?.slice(0, 5) || "",
          end_time: exc.end_time?.slice(0, 5) || "",
        })));
      }
      
      // Map rules
      if (data.rules && typeof data.rules === 'object') {
        setRules({
          max_sessions_per_day: data.rules.max_sessions_per_day ?? DEFAULT_RULES.max_sessions_per_day,
          min_notice_minutes: data.rules.min_notice_minutes ?? DEFAULT_RULES.min_notice_minutes,
          slot_step_minutes: data.rules.slot_step_minutes ?? DEFAULT_RULES.slot_step_minutes,
        });
      }
    } catch (error) {
      console.error("Failed to load availability:", error);
      // Don't show error toast - just use defaults
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  // Load existing availability on mount
  useEffect(() => {
    if (!providerId) return;
    loadAvailability();
  }, [providerId, loadAvailability]);

  // Update weekly availability for a day
  const updateDayAvailability = (dayValue, field, value) => {
    setWeeklyAvailability(prev => 
      prev.map(day => 
        day.day_of_week === dayValue 
          ? { ...day, [field]: value }
          : day
      )
    );
  };

  // Add exception
  const addException = () => {
    if (!newException.date) {
      toast.error("Please select a date");
      return;
    }
    
    // Check if exception already exists for this date
    if (exceptions.some(e => e.date === newException.date)) {
      toast.error("Exception already exists for this date");
      return;
    }
    
    setExceptions(prev => [...prev, { ...newException }]);
    setNewException({
      date: "",
      is_unavailable: true,
      start_time: "",
      end_time: "",
      note: "",
    });
    toast.success("Exception added");
  };

  // Remove exception
  const removeException = (index) => {
    setExceptions(prev => prev.filter((_, i) => i !== index));
    toast.success("Exception removed");
  };

  // Save all settings
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validate weekly availability
      for (const day of weeklyAvailability) {
        if (day.is_active) {
          if (!day.start_time || !day.end_time) {
            toast.error(`Please set times for ${DAYS_OF_WEEK[day.day_of_week].label}`);
            return;
          }
          if (day.start_time >= day.end_time) {
            toast.error(`End time must be after start time for ${DAYS_OF_WEEK[day.day_of_week].label}`);
            return;
          }
        }
      }

      // Save weekly availability
      await providersAPI.setWeeklyAvailability(providerId, weeklyAvailability);
      
      // Save exceptions if any
      if (exceptions.length > 0) {
        await providersAPI.setExceptions(providerId, exceptions);
      }
      
      // Save rules
      await providersAPI.setRules(providerId, rules);
      
      toast.success("Availability settings saved!");
    } catch (error) {
      console.error("Failed to save availability:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
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
        <LoadingSpinner fullScreen message="Loading availability settings..." />
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
          <h1 className="text-xl font-semibold flex-1">Availability Settings</h1>
        </div>
        <p className="text-purple-100 text-sm mt-2 ml-1">
          Set your working hours and booking rules
        </p>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Weekly Availability */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              Weekly Hours
            </CardTitle>
            <p className="text-sm text-gray-500">Set your regular working hours for each day</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {DAYS_OF_WEEK.map((day, index) => {
              const dayData = weeklyAvailability.find(d => d.day_of_week === day.value);
              return (
                <div 
                  key={day.value} 
                  className={`p-3 rounded-lg border transition-all ${
                    dayData?.is_active 
                      ? 'bg-purple-50 border-purple-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={dayData?.is_active || false}
                        onCheckedChange={(checked) => updateDayAvailability(day.value, 'is_active', checked)}
                        data-testid={`toggle-${day.short.toLowerCase()}`}
                      />
                      <span className={`font-medium ${dayData?.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                        {day.label}
                      </span>
                    </div>
                    
                    {dayData?.is_active && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Open
                      </Badge>
                    )}
                  </div>
                  
                  {dayData?.is_active && (
                    <div className="flex items-center gap-2 mt-3 ml-12">
                      <Input
                        type="time"
                        value={dayData.start_time}
                        onChange={(e) => updateDayAvailability(day.value, 'start_time', e.target.value)}
                        className="w-28"
                        data-testid={`start-${day.short.toLowerCase()}`}
                      />
                      <span className="text-gray-400">to</span>
                      <Input
                        type="time"
                        value={dayData.end_time}
                        onChange={(e) => updateDayAvailability(day.value, 'end_time', e.target.value)}
                        className="w-28"
                        data-testid={`end-${day.short.toLowerCase()}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Exceptions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              Exceptions
            </CardTitle>
            <p className="text-sm text-gray-500">Add days off or modified hours</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add New Exception */}
            <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Date</Label>
                  <Input
                    type="date"
                    value={newException.date}
                    onChange={(e) => setNewException(prev => ({ ...prev, date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1"
                    data-testid="exception-date"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Type</Label>
                  <Select
                    value={newException.is_unavailable ? "off" : "custom"}
                    onValueChange={(value) => setNewException(prev => ({ 
                      ...prev, 
                      is_unavailable: value === "off" 
                    }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Day Off</SelectItem>
                      <SelectItem value="custom">Custom Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {!newException.is_unavailable && (
                <div className="flex items-center gap-2 mt-3">
                  <Input
                    type="time"
                    value={newException.start_time}
                    onChange={(e) => setNewException(prev => ({ ...prev, start_time: e.target.value }))}
                    placeholder="Start"
                    className="w-28"
                  />
                  <span className="text-gray-400">to</span>
                  <Input
                    type="time"
                    value={newException.end_time}
                    onChange={(e) => setNewException(prev => ({ ...prev, end_time: e.target.value }))}
                    placeholder="End"
                    className="w-28"
                  />
                </div>
              )}
              
              <div className="mt-3">
                <Input
                  placeholder="Note (optional)"
                  value={newException.note}
                  onChange={(e) => setNewException(prev => ({ ...prev, note: e.target.value }))}
                />
              </div>
              
              <Button 
                size="sm" 
                className="mt-3 w-full"
                onClick={addException}
                data-testid="add-exception-btn"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Exception
              </Button>
            </div>
            
            {/* Existing Exceptions */}
            {exceptions.length > 0 ? (
              <div className="space-y-2">
                {exceptions.map((exc, index) => (
                  <div 
                    key={exc.date || index} 
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      exc.is_unavailable ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{exc.date}</p>
                      <p className="text-sm text-gray-500">
                        {exc.is_unavailable 
                          ? 'Day Off' 
                          : `${exc.start_time || '?'} - ${exc.end_time || '?'}`}
                        {exc.note && ` • ${exc.note}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeException(index)}
                      className="text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm py-2">No exceptions added</p>
            )}
          </CardContent>
        </Card>

        {/* Booking Rules */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              Booking Rules
            </CardTitle>
            <p className="text-sm text-gray-500">Configure how bookings work</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Time Slot Duration</Label>
              <Select
                value={rules.slot_step_minutes.toString()}
                onValueChange={(value) => setRules(prev => ({ ...prev, slot_step_minutes: parseInt(value) }))}
              >
                <SelectTrigger className="mt-1" data-testid="slot-step">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="20">20 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">How often slots start</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Minimum Notice</Label>
              <Select
                value={rules.min_notice_minutes.toString()}
                onValueChange={(value) => setRules(prev => ({ ...prev, min_notice_minutes: parseInt(value) }))}
              >
                <SelectTrigger className="mt-1" data-testid="min-notice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No minimum</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                  <SelectItem value="360">6 hours</SelectItem>
                  <SelectItem value="720">12 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">How far in advance must bookings be made</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Max Sessions Per Day</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={rules.max_sessions_per_day}
                onChange={(e) => setRules(prev => ({ ...prev, max_sessions_per_day: parseInt(e.target.value) || 6 }))}
                className="mt-1"
                data-testid="max-sessions"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum bookings you accept per day</p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button 
          size="lg"
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          onClick={handleSave}
          disabled={saving}
          data-testid="save-availability-btn"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Save All Settings
            </>
          )}
        </Button>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default ProviderAvailabilityScreen;
