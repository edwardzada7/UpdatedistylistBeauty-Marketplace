import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Save, Loader2, DollarSign, Clock, 
  MessageSquare, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { stylistsAPI, providerServicesAPI } from "@/services/api";
import { CURRENCY, SERVICE_CATEGORIES, STYLIST_SERVICES } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";

const ProviderServicesScreen = () => {
  const navigate = useNavigate();
  const { userData, providerData, isProvider, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(providerData?.hourly_rate || 0);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Service states
  const [services, setServices] = useState([]);
  
  // Load services from database
  const loadServices = useCallback(async () => {
    if (!userData?.id) return;
    
    try {
      setLoading(true);
      
      // Initialize all services from constants
      const allServices = STYLIST_SERVICES.map(service => ({
        ...service,
        enabled: false,
        price: 0,
        duration: 60,
        consultationRequired: false,
        dbId: null, // ID from database if exists
      }));
      
      // Try to load saved services from database
      try {
        const response = await providerServicesAPI.getByProviderId(userData.id);
        const savedServices = response.data;
        
        // Merge saved data with all services
        const mergedServices = allServices.map(service => {
          const saved = savedServices.find(s => s.service_id === service.id);
          if (saved) {
            return {
              ...service,
              enabled: saved.enabled,
              price: saved.price,
              duration: saved.duration,
              consultationRequired: saved.consultation_required,
              dbId: saved.id,
            };
          }
          return service;
        });
        
        setServices(mergedServices);
      } catch (error) {
        // If provider_services table doesn't exist or is empty, use defaults
        console.log("No saved services found, using defaults");
        setServices(allServices);
      }
      
      // Set hourly rate from provider data
      if (providerData?.hourly_rate) {
        setHourlyRate(providerData.hourly_rate);
      }
    } catch (error) {
      console.error("Failed to load services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [userData?.id, providerData?.hourly_rate]);
  
  // Initial load
  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Redirect non-providers
  useEffect(() => {
    if (!isProvider) {
      navigate("/home", { replace: true });
    }
  }, [isProvider, navigate]);

  const handleToggleService = (serviceId) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, enabled: !s.enabled } : s
    ));
    setHasChanges(true);
  };

  const handlePriceChange = (serviceId, price) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, price: parseFloat(price) || 0 } : s
    ));
    setHasChanges(true);
  };

  const handleDurationChange = (serviceId, duration) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, duration: parseInt(duration) || 60 } : s
    ));
    setHasChanges(true);
  };

  const handleConsultationToggle = (serviceId) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, consultationRequired: !s.consultationRequired } : s
    ));
    setHasChanges(true);
  };

  const handleHourlyRateChange = (value) => {
    setHourlyRate(parseFloat(value) || 0);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!userData?.id) {
      toast.error("User data not available");
      return;
    }
    
    setSaving(true);
    try {
      // Update hourly rate
      await stylistsAPI.update(userData.id, { hourly_rate: hourlyRate });
      
      // Prepare enabled services for bulk update
      const enabledServices = services
        .filter(s => s.enabled)
        .map(s => ({
          provider_id: userData.id,
          service_id: s.id,
          service_name: s.name,
          price: s.price,
          duration: s.duration,
          enabled: true,
          consultation_required: s.consultationRequired,
        }));
      
      // Also save disabled services that were previously enabled (to track state)
      const disabledServices = services
        .filter(s => !s.enabled && s.dbId) // Only save disabled if they had a dbId (existed before)
        .map(s => ({
          provider_id: userData.id,
          service_id: s.id,
          service_name: s.name,
          price: s.price,
          duration: s.duration,
          enabled: false,
          consultation_required: s.consultationRequired,
        }));
      
      const allServicesToSave = [...enabledServices, ...disabledServices];
      
      if (allServicesToSave.length > 0) {
        await providerServicesAPI.bulkUpdate(userData.id, allServicesToSave);
      }
      
      // Refresh user data
      await refreshUser();
      
      setHasChanges(false);
      toast.success("Services saved successfully!", {
        description: `${enabledServices.length} active services`
      });
    } catch (error) {
      console.error("Failed to save services:", error);
      toast.error("Failed to save changes", {
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setSaving(false);
    }
  };

  const enabledServices = services.filter(s => s.enabled);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading services..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">My Services</h1>
              <p className="text-xs text-gray-500">Manage your service offerings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved
              </Badge>
            )}
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
        {/* Hourly Rate Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Default Hourly Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="hourlyRate">Rate per hour ({CURRENCY})</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => handleHourlyRateChange(e.target.value)}
                  className="mt-2"
                  min={0}
                />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Current Rate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {CURRENCY}{hourlyRate.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Services Summary */}
        <Card className="mb-6 bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Active Services</p>
                <p className="text-2xl font-bold text-purple-900">{enabledServices.length}</p>
              </div>
              <Badge className="bg-purple-600 text-white">
                {enabledServices.length} / {services.length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Services by Category */}
        {SERVICE_CATEGORIES.map((category) => {
          const categoryServices = services.filter(s => s.category === category.id);
          if (categoryServices.length === 0) return null;

          const enabledInCategory = categoryServices.filter(s => s.enabled).length;

          return (
            <Card key={category.id} className="mb-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="text-xl">{category.icon}</span>
                    {category.name}
                  </CardTitle>
                  {enabledInCategory > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {enabledInCategory} active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryServices.map((service) => (
                    <div
                      key={service.id}
                      className={`p-4 rounded-lg border transition-all ${
                        service.enabled 
                          ? "bg-green-50 border-green-200" 
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      {/* Service Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{service.icon}</span>
                          <div>
                            <p className="font-medium">{service.name}</p>
                            {service.enabled && (
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Switch
                          checked={service.enabled}
                          onCheckedChange={() => handleToggleService(service.id)}
                        />
                      </div>

                      {/* Service Settings (only shown when enabled) */}
                      {service.enabled && (
                        <div className="grid sm:grid-cols-3 gap-4 pt-3 border-t">
                          {/* Price */}
                          <div>
                            <Label className="text-xs text-gray-600">Price ({CURRENCY})</Label>
                            <Input
                              type="number"
                              value={service.price}
                              onChange={(e) => handlePriceChange(service.id, e.target.value)}
                              className="mt-1 h-9"
                              min={0}
                            />
                          </div>

                          {/* Duration */}
                          <div>
                            <Label className="text-xs text-gray-600">Duration (mins)</Label>
                            <Input
                              type="number"
                              value={service.duration}
                              onChange={(e) => handleDurationChange(service.id, e.target.value)}
                              className="mt-1 h-9"
                              min={15}
                              step={15}
                            />
                          </div>

                          {/* Consultation Required */}
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`consult-${service.id}`}
                              checked={service.consultationRequired}
                              onCheckedChange={() => handleConsultationToggle(service.id)}
                            />
                            <Label htmlFor={`consult-${service.id}`} className="text-xs">
                              <MessageSquare className="h-3 w-3 inline mr-1" />
                              Consultation
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Info Notice */}
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-sm text-blue-700 text-center">
            💡 Toggle services ON to offer them. Set prices and durations for each service. Changes are saved when you click "Save Changes".
          </p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default ProviderServicesScreen;
