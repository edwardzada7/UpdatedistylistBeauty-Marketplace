import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LoadingSpinner from "../components/LoadingSpinner";

export default function UserProvidersList() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedProvider, setExpandedProvider] = useState(null);
  const [selectedServices, setSelectedServices] = useState({});

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("provider_services")
      .select(`
        id,
        price,
        duration,
        description,
        provider_id,
        services (
          id,
          name,
          category,
          subcategory
        ),
        profiles:provider_id (
          id,
          full_name,
          location_city
        )
      `)
      .eq("is_active", true);

    if (!error && data) {
      const grouped = {};

      data.forEach((row) => {
        const pid = row.provider_id;
        if (!grouped[pid]) {
          grouped[pid] = {
            provider: row.profiles,
            services: [],
          };
        }
        grouped[pid].services.push(row);
      });

      setProviders(Object.values(grouped));
    }

    setLoading(false);
  };

  const toggleService = (providerId, service) => {
    setSelectedServices((prev) => {
      const providerServices = prev[providerId] || [];
      const exists = providerServices.find((s) => s.id === service.id);

      return {
        ...prev,
        [providerId]: exists
          ? providerServices.filter((s) => s.id !== service.id)
          : [...providerServices, service],
      };
    });
  };

  const calculateTotal = (providerId) => {
    return (selectedServices[providerId] || []).reduce(
      (sum, s) => sum + Number(s.price || 0),
      0
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="provider-list">
      {providers.map(({ provider, services }) => {
        const startingPrice = Math.min(
          ...services.map((s) => Number(s.price || 0))
        );

        return (
          <div key={provider.id} className="provider-card">
            <div className="provider-header">
              <h3>{provider.full_name}</h3>
              <p>{provider.location_city}</p>
              <p>Starting from ₦{startingPrice}</p>

              <button
                onClick={() =>
                  setExpandedProvider(
                    expandedProvider === provider.id ? null : provider.id
                  )
                }
              >
                {expandedProvider === provider.id
                  ? "Hide Services"
                  : "View Services"}
              </button>
            </div>

            {expandedProvider === provider.id && (
              <div className="services-list">
                {services.map((s) => {
                  const isSelected =
                    selectedServices[provider.id]?.some(
                      (x) => x.id === s.id
                    );

                  return (
                    <label key={s.id} className="service-item">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleService(provider.id, s)}
                      />
                      <div>
                        <strong>{s.services.subcategory}</strong>
                        <p>{s.description}</p>
                        <span>
                          ₦{s.price} • {s.duration} mins
                        </span>
                      </div>
                    </label>
                  );
                })}

                <div className="booking-summary">
                  <p>
                    Total: ₦{calculateTotal(provider.id)}
                  </p>
                  <button
                    disabled={!selectedServices[provider.id]?.length}
                    onClick={() =>
                      alert("Proceed to booking flow (Phase 1.5)")
                    }
                  >
                    Proceed to Booking
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
