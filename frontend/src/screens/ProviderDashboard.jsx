import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import LoadingSpinner from "@/components/LoadingSpinner";

const ProviderDashboard = () => {
  const [services, setServices] = useState([]);
  const [providerServices, setProviderServices] = useState({});
  const [loading, setLoading] = useState(true);

  const userId = supabase.auth.user()?.id; // Current provider ID

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        // Fetch all services with subcategories
        const { data: allServices, error: serviceError } = await supabase
          .from("services")
          .select("*")
          .order("category", { ascending: true })
          .order("subcategory", { ascending: true });

        if (serviceError) throw serviceError;

        setServices(allServices || []);

        // Fetch provider's selected services
        const { data: providerData, error: providerError } = await supabase
          .from("provider_services")
          .select("*")
          .eq("provider_id", userId);

        if (providerError) throw providerError;

        const providerMap = {};
        providerData?.forEach((ps) => {
          providerMap[ps.service_id] = ps;
        });
        setProviderServices(providerMap);
      } catch (error) {
        console.error("Error fetching services:", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [userId]);

  const handleToggle = (service) => {
    setProviderServices((prev) => {
      const existing = prev[service.id];
      return {
        ...prev,
        [service.id]: {
          ...existing,
          is_active: !existing?.is_active,
          service_id: service.id,
        },
      };
    });
  };

  const handleChange = (serviceId, field, value) => {
    setProviderServices((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value,
      },
    }));
  };

  const saveProviderServices = async () => {
    try {
      setLoading(true);
      const upserts = Object.values(providerServices).map((ps) => ({
        ...ps,
        provider_id: userId,
      }));

      const { error } = await supabase
        .from("provider_services")
        .upsert(upserts, { onConflict: ["provider_id", "service_id"] });

      if (error) throw error;

      alert("Services saved successfully!");
    } catch (error) {
      console.error("Failed to save provider services:", error.message);
      alert("Failed to save services. Check console.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Your Services</h2>
      {services?.map((service) => {
        const ps = providerServices[service.id] || {};
        return (
          <div
            key={service.id}
            className="border rounded p-3 flex flex-col md:flex-row md:items-center md:space-x-4"
          >
            <div className="flex-1">
              <p className="font-semibold">{service.name}</p>
              <p className="text-sm text-gray-500">{service.subcategory}</p>
            </div>

            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={ps.is_active || false}
                  onChange={() => handleToggle(service)}
                />
                <span>Enabled</span>
              </label>

              <input
                type="number"
                placeholder="Price"
                className="border px-2 py-1 rounded w-20"
                value={ps.price || ""}
                disabled={!ps.is_active}
                onChange={(e) =>
                  handleChange(service.id, "price", parseFloat(e.target.value))
                }
              />

              <input
                type="number"
                placeholder="Duration (min)"
                className="border px-2 py-1 rounded w-28"
                value={ps.duration_minutes || ""}
                disabled={!ps.is_active}
                onChange={(e) =>
                  handleChange(service.id, "duration_minutes", parseInt(e.target.value))
                }
              />

              <div className="flex space-x-1">
                <label>
                  <input
                    type="checkbox"
                    checked={ps.in_store || false}
                    disabled={!ps.is_active}
                    onChange={(e) =>
                      handleChange(service.id, "in_store", e.target.checked)
                    }
                  />
                  <span className="text-xs">In-store</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={ps.home_service || false}
                    disabled={!ps.is_active}
                    onChange={(e) =>
                      handleChange(service.id, "home_service", e.target.checked)
                    }
                  />
                  <span className="text-xs">Home</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={ps.travel_service || false}
                    disabled={!ps.is_active}
                    onChange={(e) =>
                      handleChange(service.id, "travel_service", e.target.checked)
                    }
                  />
                  <span className="text-xs">Travel</span>
                </label>
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={saveProviderServices}
        className="bg-blue-600 text-white px-4 py-2 rounded mt-4"
      >
        Save Services
      </button>
    </div>
  );
};

export default ProviderDashboard;
