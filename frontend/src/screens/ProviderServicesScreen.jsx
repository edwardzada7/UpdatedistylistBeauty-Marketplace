import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Save, Loader2, DollarSign, Clock, 
  MessageSquare, CheckCircle2 
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { stylistsAPI } from "@/services/api";
import { CURRENCY, SERVICE_CATEGORIES, STYLIST_SERVICES } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";

const ProviderServicesScreen = () => {
  const navigate = useNavigate();
  const { userData, providerData, isProvider, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(providerData?.hourly_rate || 0);
  
  // Service states - in real app, this would come from backend
  const [services, setServices] = useState([]);
  
  // Initialize services from categories
  useEffect(() => {
    const allServices = STYLIST_SERVICES.map(service => ({
      ...service,
      enabled: false,
      price: 0,
      duration: 60,
      consultationRequired: false,
    }));
    setServices(allServices);
    setLoading(false);
  }, []);

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
  };

  const handlePriceChange = (serviceId, price) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, price: parseFloat(price) || 0 } : s
    ));
  };

  const handleDurationChange = (serviceId, duration) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, duration: parseInt(duration) || 60 } : s
    ));
  };

  const handleConsultationToggle = (serviceId) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, consultationRequired: !s.consultationRequired } : s
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update hourly rate
      if (userData?.id) {
        await stylistsAPI.update(userData.id, { hourly_rate: hourlyRate });
      }
      
      // In Phase 2, we would also save individual service settings
      toast.success("Services updated successfully!");
      await refreshUser();
    } catch (error) {
      console.error("Failed to save services:", error);
      toast.error("Failed to save changes");
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
          <Button onClick={handleSave} disabled={saving}>
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
                  onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
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

          return (
            <Card key={category.id} className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-xl">{category.icon}</span>
                  {category.name}
                </CardTitle>
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
                              Consultation Required
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

        {/* Phase 2 Notice */}
        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
          <p className="text-sm text-purple-700 text-center">
            💡 Service availability scheduling and booking management coming in Phase 2
          </p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default ProviderServicesScreen;
