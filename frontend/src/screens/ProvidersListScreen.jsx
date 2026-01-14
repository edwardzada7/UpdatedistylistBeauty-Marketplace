import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Star, CheckCircle2, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { providersAPI, stylistsAPI } from "@/services/api";
import { CURRENCY, FILTER_OPTIONS, SORT_OPTIONS, SERVICE_CATALOG } from "@/utils/constants";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import BottomNavigation from "@/components/BottomNavigation";

const ProvidersListScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceFilter = searchParams.get("service");
  const categoryFilter = searchParams.get("category");
  
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVerified, setFilterVerified] = useState(FILTER_OPTIONS.ALL);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS.RECOMMENDED);

  useEffect(() => {
    fetchProviders();
  }, [serviceFilter, categoryFilter]);

  useEffect(() => {
    applyFilters();
  }, [providers, searchQuery, filterVerified, sortBy]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      // First try to get providers with services (Phase 1.4)
      const filters = {};
      if (serviceFilter) filters.serviceId = serviceFilter;
      if (categoryFilter) filters.categoryId = categoryFilter;
      
      try {
        const response = await providersAPI.getWithServices(filters);
        setProviders(response.data || []);
      } catch (err) {
        // Fallback to legacy stylists API
        console.log("Falling back to legacy stylists API");
        const response = await stylistsAPI.getAll({ sortBy });
        // Transform to new format
        const transformed = (response.data || []).map(s => ({
          provider_id: s.user_id,
          name: s.user_name || "Provider",
          bio: s.bio,
          location: s.location,
          rating: s.rating || 0,
          is_verified: s.is_verified,
          is_premium: s.is_premium,
          starting_price: s.hourly_rate,
          primary_service: null,
          active_service_count: 0,
          services: []
        }));
        setProviders(transformed);
      }
    } catch (error) {
      console.error("Failed to fetch providers:", error);
      toast.error("Failed to load providers");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...providers];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.primary_service?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Verified filter
    if (filterVerified === FILTER_OPTIONS.VERIFIED) {
      filtered = filtered.filter((p) => p.is_verified);
    } else if (filterVerified === FILTER_OPTIONS.PREMIUM) {
      filtered = filtered.filter((p) => p.is_premium);
    }

    // Sort
    if (sortBy === SORT_OPTIONS.PRICE_LOW) {
      filtered.sort((a, b) => (a.starting_price || 0) - (b.starting_price || 0));
    } else if (sortBy === SORT_OPTIONS.PRICE_HIGH) {
      filtered.sort((a, b) => (b.starting_price || 0) - (a.starting_price || 0));
    } else if (sortBy === SORT_OPTIONS.RECOMMENDED) {
      filtered.sort((a, b) => {
        if (b.is_premium !== a.is_premium) return b.is_premium - a.is_premium;
        if (b.is_verified !== a.is_verified) return b.is_verified - a.is_verified;
        return (b.rating || 0) - (a.rating || 0);
      });
    }

    setFilteredProviders(filtered);
  };

  // Get service name for filter display
  const getServiceName = () => {
    if (!serviceFilter) return null;
    for (const cat of Object.values(SERVICE_CATALOG)) {
      if (cat.services[serviceFilter]) {
        return cat.services[serviceFilter].name;
      }
    }
    return serviceFilter;
  };

  const filterServiceName = getServiceName();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              data-testid="back-btn"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Browse Providers</h1>
              {filterServiceName && (
                <p className="text-sm text-purple-600">
                  Showing: {filterServiceName}
                </p>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, location, or service..."
              className="pl-10"
              data-testid="search-input"
            />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b sticky top-[88px] z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto">
            <Select value={filterVerified} onValueChange={setFilterVerified}>
              <SelectTrigger className="w-[140px]" data-testid="filter-verified">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="verified">Verified Only</SelectItem>
                <SelectItem value="premium">Premium Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]" data-testid="sort-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="premium">Recommended</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            {filterServiceName && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/user/providers", { replace: true })}
                className="whitespace-nowrap"
              >
                Clear filter ✕
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Providers List */}
      <div className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
        {loading ? (
          <LoadingSpinner message="Loading providers..." />
        ) : filteredProviders.length === 0 ? (
          <EmptyState
            title="No providers found"
            description={filterServiceName 
              ? `No providers offering ${filterServiceName} yet. Try browsing all providers.`
              : "Try adjusting your search or filters"
            }
            actionLabel={filterServiceName ? "Browse all providers" : "Clear filters"}
            onAction={() => {
              setSearchQuery("");
              setFilterVerified(FILTER_OPTIONS.ALL);
              if (filterServiceName) navigate("/user/providers", { replace: true });
            }}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {filteredProviders.length} provider{filteredProviders.length !== 1 ? "s" : ""} found
            </p>

            {filteredProviders.map((provider) => (
              <Card
                key={provider.provider_id}
                className="cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate(`/user/providers/${provider.provider_id}`)}
                data-testid={`provider-card-${provider.provider_id}`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Avatar */}
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                      {provider.name?.charAt(0) || "P"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">
                            {provider.name || "Provider"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {provider.is_verified && (
                              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                            {provider.is_premium && (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                                <Star className="h-3 w-3 mr-1 fill-amber-700" />
                                Premium
                              </Badge>
                            )}
                            {provider.active_service_count > 0 && (
                              <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
                                <Sparkles className="h-3 w-3 mr-1" />
                                {provider.active_service_count} services
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-500">From</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {CURRENCY}{(provider.starting_price || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Primary Service */}
                      {provider.primary_service && (
                        <p className="text-sm text-purple-600 mt-1">
                          {provider.primary_service}
                        </p>
                      )}

                      {provider.location && (
                        <p className="text-sm text-gray-600 mt-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {provider.location}
                        </p>
                      )}

                      {provider.rating > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-medium">{provider.rating.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Service Preview */}
                      {provider.services && provider.services.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {provider.services.slice(0, 3).map(svc => (
                            <span 
                              key={svc.sub_service_id || svc.id}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                            >
                              {svc.sub_service_name || svc.service_name}
                            </span>
                          ))}
                          {provider.services.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{provider.services.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default ProvidersListScreen;
