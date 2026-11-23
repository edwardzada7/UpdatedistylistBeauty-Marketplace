import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { locationApi } from "@/services/locationApi";

let areaCache = null;

/** Shows where the user is (area, city) and opens Profile to change it. Highlights when nothing is set. */
export default function LocationChip({ areaId, className = "", tone = "dark" }) {
  const navigate = useNavigate();
  const [areas, setAreas] = useState(areaCache || []);

  useEffect(() => {
    if (areaCache) return undefined;
    let cancelled = false;
    locationApi
      .areas()
      .then((r) => {
        areaCache = r.data?.areas || [];
        if (!cancelled) setAreas(areaCache);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const area = areaId ? areas.find((a) => String(a.id) === String(areaId)) : null;
  const label = area ? `${area.name}, ${area.city}` : areaId ? "Your location" : "Set your location";
  const palette = !areaId
    ? "bg-amber-100 text-amber-900 border-amber-300"
    : tone === "light"
    ? "bg-white/20 text-white border-white/30"
    : "bg-white text-gray-800 border-gray-200";

  return (
    <button
      type="button"
      onClick={() => navigate("/profile")}
      data-testid="location-chip"
      aria-label="Change your location"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${palette} ${className}`}
    >
      <MapPin className="h-3.5 w-3.5" />
      <span className="truncate max-w-[200px]">{label}</span>
    </button>
  );
}
