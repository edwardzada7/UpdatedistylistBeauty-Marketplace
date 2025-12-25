import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Star, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { stylistsAPI } from "@/services/api";
import { CURRENCY, FILTER_OPTIONS, SORT_OPTIONS } from "@/utils/constants";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import BottomNavigation from "@/components/BottomNavigation";

const StylistsListScreen = ({ currentUser }) => {
  const navigate = useNavigate();
  const [stylists, setStylists] = useState([]);
  const [filteredStylists, setFilteredStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVerified, setFilterVerified] = useState(FILTER_OPTIONS.ALL);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS.RECOMMENDED);

  if (!currentUser) {
    return null;
  }

  useEffect(() => {
    fetchStylists();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [stylists, searchQuery, filterVerified, sortBy]);

  const fetchStylists = async () => {
    setLoading(true);
    try {
      const response = await stylistsAPI.getAll({ sortBy });
      setStylists(response.data);
    } catch (error) {
      console.error("Failed to fetch stylists:", error);
      toast.error("Failed to load stylists");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...stylists];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (s) =>
          s.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Verified filter
    if (filterVerified === FILTER_OPTIONS.VERIFIED) {
      filtered = filtered.filter((s) => s.is_verified);
    } else if (filterVerified === FILTER_OPTIONS.PREMIUM) {
      filtered = filtered.filter((s) => s.is_premium);
    }

    // Sort
    if (sortBy === SORT_OPTIONS.PRICE_LOW) {
      filtered.sort((a, b) => a.hourly_rate - b.hourly_rate);
    } else if (sortBy === SORT_OPTIONS.PRICE_HIGH) {
      filtered.sort((a, b) => b.hourly_rate - a.hourly_rate);
    } else if (sortBy === SORT_OPTIONS.RECOMMENDED) {
      filtered.sort((a, b) => {
        if (b.is_premium !== a.is_premium) return b.is_premium - a.is_premium;
        if (b.is_verified !== a.is_verified) return b.is_verified - a.is_verified;
        return a.hourly_rate - b.hourly_rate;
      });
    }

    setFilteredStylists(filtered);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              data-testid="back-btn"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Browse Stylists</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or location..."
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
                <SelectItem value="all">All Stylists</SelectItem>
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
          </div>
        </div>
      </div>

      {/* Stylists List */}
      <div className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
        {loading ? (
          <LoadingSpinner message="Loading stylists..." />
        ) : filteredStylists.length === 0 ? (
          <EmptyState
            title="No stylists found"
            description="Try adjusting your search or filters"
            actionLabel="Clear filters"
            onAction={() => {
              setSearchQuery("");
              setFilterVerified(FILTER_OPTIONS.ALL);
            }}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {filteredStylists.length} stylist{filteredStylists.length !== 1 ? "s" : ""} found
            </p>

            {filteredStylists.map((stylist) => (
              <Card
                key={stylist.user_id}
                className="cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate(`/stylists/${stylist.user_id}`)}
                data-testid={`stylist-card-${stylist.user_id}`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Avatar */}
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                      {stylist.user_name?.charAt(0) || "S"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">
                            {stylist.user_name || "Stylist"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {stylist.is_verified && (
                              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                            {stylist.is_premium && (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                                <Star className="h-3 w-3 mr-1 fill-amber-700" />
                                Premium
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-2xl font-bold text-purple-600">
                            {CURRENCY}{stylist.hourly_rate.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-600">per hour</p>
                        </div>
                      </div>

                      {stylist.location && (
                        <p className="text-sm text-gray-600 mt-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {stylist.location}
                        </p>
                      )}

                      {stylist.rating > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-medium">{stylist.rating.toFixed(1)}</span>
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

export default StylistsListScreen;