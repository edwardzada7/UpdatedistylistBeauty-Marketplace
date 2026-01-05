import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronRight, Search, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SERVICE_CATEGORIES, APP_NAME } from "@/utils/constants";
import BottomNavigation from "@/components/BottomNavigation";

export default function ServicesScreen() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Filter services based on search
  const filteredCategories = SERVICE_CATEGORIES.map(category => ({
    ...category,
    services: category.services.filter(service =>
      service.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => 
    searchQuery === "" || category.services.length > 0
  );

  const handleServiceClick = (service, category) => {
    // Navigate to providers filtered by this service
    toast.info(`Browsing ${service.name} providers...`);
    navigate(`/providers?service=${service.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Services</h1>
              <p className="text-xs text-gray-500">Browse all service categories</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="pl-10"
            />
          </div>
        </div>
      </header>

      {/* Service Categories */}
      <div className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
        <div className="space-y-4">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="overflow-hidden">
              {/* Category Header */}
              <button
                className={`w-full p-4 flex items-center justify-between bg-gradient-to-r ${category.color} text-white`}
                onClick={() => setExpandedCategory(
                  expandedCategory === category.id ? null : category.id
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{category.icon}</span>
                  <div className="text-left">
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-xs opacity-80">
                      {category.services.length} services
                    </p>
                  </div>
                </div>
                <ChevronRight className={`h-5 w-5 transition-transform ${
                  expandedCategory === category.id ? "rotate-90" : ""
                }`} />
              </button>

              {/* Category Notice (for Body & Aesthetics) */}
              {category.notice && expandedCategory === category.id && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-xs text-amber-700">{category.notice}</p>
                </div>
              )}

              {/* Services List */}
              {expandedCategory === category.id && (
                <CardContent className="p-0">
                  <div className="divide-y">
                    {category.services.map((service) => (
                      <button
                        key={service.id}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        onClick={() => handleServiceClick(service, category)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl w-8">{service.icon}</span>
                          <span className="text-sm font-medium text-gray-700">
                            {service.name}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Quick Access - Popular Services */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Popular Services</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {[
              { icon: "✂️", name: "Barbers", id: "barbers" },
              { icon: "💄", name: "Makeup", id: "makeup-artists" },
              { icon: "💅", name: "Nails", id: "nail-technicians" },
              { icon: "💇", name: "Hair", id: "hairdressers" },
              { icon: "🧘", name: "Spa", id: "spa-services" },
              { icon: "👰", name: "Bridal", id: "bridal-designers" },
            ].map((service) => (
              <Card 
                key={service.id}
                className="cursor-pointer hover:shadow-md transition-all hover:scale-105"
                onClick={() => {
                  toast.info(`Browsing ${service.name}...`);
                  navigate(`/providers?service=${service.id}`);
                }}
              >
                <CardContent className="p-4 text-center">
                  <span className="text-2xl">{service.icon}</span>
                  <p className="text-xs font-medium text-gray-600 mt-1">{service.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Phase 2 Notice */}
        <div className="mt-8 p-4 bg-purple-50 rounded-xl border border-purple-100">
          <p className="text-sm text-purple-700 text-center">
            🚀 <strong>Coming Soon:</strong> Book appointments, chat with providers, and pay securely — all in Phase 2!
          </p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
