import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { providerServicesAPI } from "@/services/api";
import { SERVICE_CATALOG, CURRENCY, getAllSubServices } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, Save, Store, Home, Car } from "lucide-react";

export default function ProviderServicesScreen() {
  const navigate = useNavigate();
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
  
  // Load provider's existing services
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
        toast.error("Failed to load your services");
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
        is_active: !current.is_active
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
  
  // Update description for a sub-service
  const updateDescription = (subServiceId, description) => {
    setProviderServices(prev => ({
      ...prev,
      [subServiceId]: {
        ...(prev[subServiceId] || {}),
        description: description
      }
    }));
    setHasChanges(true);
  };
  
  // Save all changes
  const saveChanges = async () => {
    if (!providerId) return;
    
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
      toast.error("Failed to save services");
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Provider Access Only</h2>
          <p className="text-gray-600">You need to be registered as a provider to manage services.</p>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading your services..." />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <h1 className="text-2xl font-bold">Manage Services</h1>
        <p className="text-purple-100 mt-1">Toggle services, set your prices and durations</p>
        
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
          <div className="flex items-center justify-between">
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
      <div className="p-4 space-y-4">
        {Object.values(SERVICE_CATALOG).map(category => (
          <div key={category.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{category.icon}</span>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-800">{category.name}</h3>
                  <p className="text-xs text-gray-500">
                    {Object.keys(category.services).length} services
                  </p>
                </div>
              </div>
              {expandedCategories[category.id] ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {/* Category Content */}
            {expandedCategories[category.id] && (
              <div className="border-t">
                {Object.values(category.services).map(service => (
                  <div key={service.id} className="border-b last:border-b-0">
                    {/* Service Header */}
                    <button
                      onClick={() => toggleService(service.id)}
                      className="w-full flex items-center justify-between p-3 pl-6 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span>{service.icon}</span>
                        <span className="font-medium text-gray-700">{service.name}</span>
                        {service.requiresVerification && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            Verified Only
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
                      <div className="bg-gray-50 px-4 py-2">
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
                              className={`py-3 border-b last:border-b-0 ${
                                serviceData.is_active ? 'bg-purple-50 -mx-4 px-4' : ''
                              }`}
                            >
                              {/* Sub-Service Toggle Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Switch
                                    checked={serviceData.is_active}
                                    onCheckedChange={() => toggleSubService(subService)}
                                  />
                                  <span className={`text-sm ${serviceData.is_active ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                    {subService.name}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-400">
                                  ~{subService.defaultDuration}min
                                </span>
                              </div>
                              
                              {/* Price & Duration Inputs (shown when active) */}
                              {serviceData.is_active && (
                                <div className="mt-3 space-y-3">
                                  {/* Price & Duration Row */}
                                  <div className="flex gap-3">
                                    <div className="flex-1">
                                      <label className="text-xs text-gray-500 mb-1 block">
                                        Price ({CURRENCY})
                                      </label>
                                      <Input
                                        type="number"
                                        value={serviceData.price || ""}
                                        onChange={(e) => updatePrice(subService.id, e.target.value)}
                                        placeholder={subService.defaultPrice.toString()}
                                        className="h-9"
                                      />
                                    </div>
                                    <div className="w-24">
                                      <label className="text-xs text-gray-500 mb-1 block">
                                        Duration (min)
                                      </label>
                                      <Input
                                        type="number"
                                        value={serviceData.duration_minutes || ""}
                                        onChange={(e) => updateDuration(subService.id, e.target.value)}
                                        placeholder={subService.defaultDuration.toString()}
                                        className="h-9"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Service Modes */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => toggleServiceMode(subService.id, 'in_store')}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                        serviceData.in_store 
                                          ? 'bg-purple-600 text-white' 
                                          : 'bg-gray-200 text-gray-600'
                                      }`}
                                    >
                                      <Store className="w-3 h-3" />
                                      In-Store
                                    </button>
                                    <button
                                      onClick={() => toggleServiceMode(subService.id, 'home_service')}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                        serviceData.home_service 
                                          ? 'bg-purple-600 text-white' 
                                          : 'bg-gray-200 text-gray-600'
                                      }`}
                                    >
                                      <Home className="w-3 h-3" />
                                      Home Visit
                                    </button>
                                    <button
                                      onClick={() => toggleServiceMode(subService.id, 'travel_service')}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                        serviceData.travel_service 
                                          ? 'bg-purple-600 text-white' 
                                          : 'bg-gray-200 text-gray-600'
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
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Fixed Save Button at Bottom */}
      {hasChanges && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 to-transparent">
          <Button 
            onClick={saveChanges} 
            disabled={saving}
            className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-lg"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? "Saving..." : `Save ${activeServiceCount} Services`}
          </Button>
        </div>
      )}
      
      <BottomNavigation />
    </div>
  );
}
