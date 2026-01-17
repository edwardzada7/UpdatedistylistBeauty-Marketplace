import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { providerServicesAPI } from "@/services/api";
import { SERVICE_CATALOG, CURRENCY, getAllSubServices } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Save, Store, Home, Car, DollarSign, Clock } from "lucide-react";

const ProviderDashboard = () => {
  const { userData, providerData, isProvider } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedServices, setExpandedServices] = useState({});
  const [providerServices, setProviderServices] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  
  const providerId = userData?.id;
  
  // Get all sub-services from catalog
  const allSubServices = useMemo(() => getAllSubServices(), []);
  
  // Load provider's existing services from backend API
  useEffect(() => {
    if (!providerId) return;
    
    const loadServices = async () => {
      try {
        setLoading(true);
        const response = await providerServicesAPI.getByProviderId(providerId);
        
        // Convert to lookup map by sub_service_id
        const servicesMap = {};
        (response.data || []).forEach(svc => {
          servicesMap[svc.sub_service_id] = {
            id: svc.id,
            is_active: svc.is_active,
            price: svc.price,
            duration_minutes: svc.duration_minutes,
            in_store: svc.in_store,
            home_service: svc.home_service,
            travel_service: svc.travel_service,
            description: svc.description || ""
          };
        });
        setProviderServices(servicesMap);
      } catch (error) {
        console.error("Failed to load services:", error);
        // Don't show error toast - just start with empty state
      } finally {
        setLoading(false);
      }
    };
    
    loadServices();
  }, [providerId]);
  
  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };
  
  // Toggle service expansion
  const toggleService = (serviceId) => {
    setExpandedServices(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };
  
  // Toggle a sub-service on/off
  const toggleSubService = (subService) => {
    const current = providerServices[subService.id] || {
      is_active: false,
      price: subService.defaultPrice || 0,
      duration_minutes: subService.defaultDuration || 60,
      in_store: true,
      home_service: false,
      travel_service: false,
      description: ""
    };
    
    setProviderServices(prev => ({
      ...prev,
      [subService.id]: {
        ...current,
        is_active: !current.is_active,
        price: current.price || subService.defaultPrice || 0,
        duration_minutes: current.duration_minutes || subService.defaultDuration || 60
      }
    }));
    setHasChanges(true);
  };
  
  // Update price for a sub-service
  const updatePrice = (subServiceId, price) => {
    setProviderServices(prev => ({
      ...prev,
      [subServiceId]: {
        ...(prev[subServiceId] || {}),
        price: parseFloat(price) || 0
      }
    }));
    setHasChanges(true);
  };
  
  // Update duration for a sub-service
  const updateDuration = (subServiceId, duration) => {
    setProviderServices(prev => ({
      ...prev,
      [subServiceId]: {
        ...(prev[subServiceId] || {}),
        duration_minutes: parseInt(duration) || 60
      }
    }));
    setHasChanges(true);
  };
  
  // Toggle service mode
  const toggleServiceMode = (subServiceId, mode) => {
    setProviderServices(prev => ({
      ...prev,
      [subServiceId]: {
        ...(prev[subServiceId] || {}),
        [mode]: !(prev[subServiceId]?.[mode] || false)
      }
    }));
    setHasChanges(true);
  };
  
  // Save all changes via backend API
  const saveChanges = async () => {
    if (!providerId) {
      toast.error("Provider ID not found");
      return;
    }
    
    try {
      setSaving(true);
      
      // Build services array for bulk toggle
      const servicesToToggle = [];
      
      Object.entries(providerServices).forEach(([subServiceId, data]) => {
        // Find the sub-service in catalog
        const subService = allSubServices.find(s => s.id === subServiceId);
        if (!subService) return;
        
        servicesToToggle.push({
          sub_service_id: subServiceId,
          sub_service_name: subService.name,
          service_id: subService.serviceId,
          category_id: subService.categoryId,
          is_active: data.is_active || false,
          price: data.price || subService.defaultPrice || 0,
          duration_minutes: data.duration_minutes || subService.defaultDuration || 60,
          in_store: data.in_store !== false,
          home_service: data.home_service || false,
          travel_service: data.travel_service || false,
          description: data.description || null
        });
      });
      
      if (servicesToToggle.length > 0) {
        await providerServicesAPI.toggleServices(providerId, servicesToToggle);
      }
      
      toast.success("Services saved successfully!");
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save services:", error);
      toast.error("Failed to save services. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  
  // Count active services
  const activeServiceCount = Object.values(providerServices).filter(s => s.is_active).length;
  
  // Calculate total potential price
  const totalActivePrice = Object.entries(providerServices)
    .filter(([_, data]) => data.is_active)
    .reduce((sum, [_, data]) => sum + (data.price || 0), 0);
  
  if (!isProvider) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Provider Access Only</h2>
          <p className="text-gray-600">You need to be registered as a provider to manage services.</p>
        </div>
        <BottomNavigation />
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
        <LoadingSpinner fullScreen message="Loading your services..." />
        <BottomNavigation />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <h1 className="text-2xl font-bold">Provider Dashboard</h1>
        <p className="text-purple-100 mt-1">Manage your services, pricing & availability</p>
        
        {/* Stats */}
        <div className="flex gap-4 mt-4">
          <div className="bg-white/20 rounded-lg px-4 py-2">
            <p className="text-xs text-purple-100">Active Services</p>
            <p className="text-xl font-bold">{activeServiceCount}</p>
          </div>
          <div className="bg-white/20 rounded-lg px-4 py-2">
            <p className="text-xs text-purple-100">Total Value</p>
            <p className="text-xl font-bold">{CURRENCY}{totalActivePrice.toLocaleString()}</p>
          </div>
        </div>
      </div>
      
      {/* Save Button (Sticky) */}
      {hasChanges && (
        <div className="sticky top-0 z-20 bg-yellow-50 border-b border-yellow-200 p-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <p className="text-sm text-yellow-800">You have unsaved changes</p>
            <Button 
              onClick={saveChanges} 
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
      
      {/* Categories List */}
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {Object.values(SERVICE_CATALOG).map(category => {
          const categoryActiveCount = Object.values(category.services).reduce((count, svc) => {
            return count + (svc.subServices || []).filter(sub => 
              providerServices[sub.id]?.is_active
            ).length;
          }, 0);
          
          return (
            <Card key={category.id} className="overflow-hidden">
              {/* Category Header */}
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition py-4"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      <p className="text-xs text-gray-500">
                        {Object.keys(category.services).length} services
                        {categoryActiveCount > 0 && (
                          <span className="ml-2 text-purple-600 font-medium">
                            • {categoryActiveCount} active
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {expandedCategories[category.id] ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </CardHeader>
              
              {/* Category Content */}
              {expandedCategories[category.id] && (
                <CardContent className="pt-0 pb-4">
                  {Object.values(category.services).map(service => {
                    const serviceActiveCount = (service.subServices || []).filter(sub => 
                      providerServices[sub.id]?.is_active
                    ).length;
                    
                    return (
                      <div key={service.id} className="border-t first:border-t-0">
                        {/* Service Header */}
                        <button
                          onClick={() => toggleService(service.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span>{service.icon}</span>
                            <span className="font-medium text-gray-700">{service.name}</span>
                            {service.requiresVerification && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                Verified Only
                              </span>
                            )}
                            {serviceActiveCount > 0 && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                {serviceActiveCount} active
                              </span>
                            )}
                          </div>
                          {expandedServices[service.id] ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        
                        {/* Sub-Services */}
                        {expandedServices[service.id] && (
                          <div className="bg-gray-50 px-4 py-2 space-y-3">
                            {(service.subServices || []).map(subService => {
                              const serviceData = providerServices[subService.id] || {
                                is_active: false,
                                price: subService.defaultPrice,
                                duration_minutes: subService.defaultDuration,
                                in_store: true,
                                home_service: false,
                                travel_service: false
                              };
                              
                              return (
                                <div 
                                  key={subService.id} 
                                  className={`p-3 rounded-lg border ${
                                    serviceData.is_active 
                                      ? 'bg-purple-50 border-purple-200' 
                                      : 'bg-white border-gray-200'
                                  }`}
                                >
                                  {/* Sub-Service Toggle Row */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                      <Switch
                                        checked={serviceData.is_active}
                                        onCheckedChange={() => toggleSubService(subService)}
                                      />
                                      <div>
                                        <span className={`font-medium ${serviceData.is_active ? 'text-gray-900' : 'text-gray-600'}`}>
                                          {subService.name}
                                        </span>
                                        <p className="text-xs text-gray-400">
                                          Default: {CURRENCY}{subService.defaultPrice?.toLocaleString()} • {subService.defaultDuration}min
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Price & Duration Inputs (shown when active) */}
                                  {serviceData.is_active && (
                                    <div className="mt-3 space-y-3 pl-12">
                                      {/* Price & Duration Row */}
                                      <div className="flex gap-3">
                                        <div className="flex-1">
                                          <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                            <DollarSign className="w-3 h-3" />
                                            Price ({CURRENCY})
                                          </label>
                                          <Input
                                            type="number"
                                            value={serviceData.price || ""}
                                            onChange={(e) => updatePrice(subService.id, e.target.value)}
                                            placeholder={subService.defaultPrice?.toString()}
                                            className="h-9"
                                          />
                                        </div>
                                        <div className="w-28">
                                          <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Duration
                                          </label>
                                          <Input
                                            type="number"
                                            value={serviceData.duration_minutes || ""}
                                            onChange={(e) => updateDuration(subService.id, e.target.value)}
                                            placeholder={subService.defaultDuration?.toString()}
                                            className="h-9"
                                          />
                                        </div>
                                      </div>
                                      
                                      {/* Service Modes */}
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => toggleServiceMode(subService.id, 'in_store')}
                                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                            serviceData.in_store 
                                              ? 'bg-purple-600 text-white' 
                                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                          }`}
                                        >
                                          <Store className="w-3 h-3" />
                                          In-Store
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleServiceMode(subService.id, 'home_service')}
                                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                            serviceData.home_service 
                                              ? 'bg-purple-600 text-white' 
                                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                          }`}
                                        >
                                          <Home className="w-3 h-3" />
                                          Home Visit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleServiceMode(subService.id, 'travel_service')}
                                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                            serviceData.travel_service 
                                              ? 'bg-purple-600 text-white' 
                                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                          }`}
                                        >
                                          <Car className="w-3 h-3" />
                                          Travel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
      
      {/* Fixed Save Button at Bottom */}
      {hasChanges && (
        <div className="fixed bottom-20 md:bottom-4 left-0 right-0 p-4 bg-gradient-to-t from-gray-100 to-transparent pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <Button 
              onClick={saveChanges} 
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-lg shadow-lg"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? "Saving..." : `Save ${activeServiceCount} Service${activeServiceCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
      
      <BottomNavigation />
    </div>
  );
};

export default ProviderDashboard;
