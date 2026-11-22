import { useEffect, useState } from "react";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { locationApi, getBrowserPosition } from "@/services/locationApi";

/**
 * Area list + "use my current location" + street address. No map service needed (a map can replace the
 * inside of this component later without changing the screens that use it).
 *
 * value:    { area_id, latitude, longitude, location_address }
 * onChange: receives the full next value plus area details: { ...value, country_code, region, city, area_name }
 */
export default function LocationPicker({ value = {}, onChange, addressLabel = "Street address (optional)", showAddress = true }) {
  const [areas, setAreas] = useState([]);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    locationApi.areas().then((r) => !cancelled && setAreas(r.data?.areas || [])).catch(() => !cancelled && setAreas([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const emit = (patch, area) => {
    const next = { ...value, ...patch };
    const a = area || areas.find((x) => String(x.id) === String(next.area_id));
    onChange({ ...next, ...(a ? { country_code: a.country_code, region: a.region, city: a.city, area_name: a.name } : {}) });
  };

  const pickArea = (id) => {
    const a = areas.find((x) => String(x.id) === String(id));
    if (!a) return emit({ area_id: null });
    // Keep an exact GPS point if we already have one in this area; otherwise use the area's centre.
    emit({ area_id: a.id, latitude: value.latitude ?? a.latitude, longitude: value.longitude ?? a.longitude }, a);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await getBrowserPosition();
      const res = await locationApi.resolve(pos.latitude, pos.longitude);
      if (res.data.outside_service_area || !res.data.area) {
        toast.error("iStylist isn't available in your area yet. We're starting in Lagos.");
        return;
      }
      emit({ area_id: res.data.area.id, latitude: pos.latitude, longitude: pos.longitude }, res.data.area);
      toast.success(`Location set to ${res.data.area.name}`);
    } catch (e) {
      toast.error(e.message || "Could not get your location");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="location-picker">
      <div>
        <Label htmlFor="area-select">Area in Lagos</Label>
        <div className="relative mt-2">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <select
            id="area-select"
            value={value.area_id || ""}
            onChange={(e) => pickArea(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 text-sm"
            data-testid="area-select"
          >
            <option value="">Select your area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating} data-testid="use-my-location">
        {locating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crosshair className="h-4 w-4 mr-2" />}
        Use my current location
      </Button>
      {showAddress && (
        <div>
          <Label htmlFor="street-address">{addressLabel}</Label>
          <Input id="street-address" className="mt-2" value={value.location_address || ""} onChange={(e) => emit({ location_address: e.target.value })} placeholder="e.g. 12 Orchid Road" maxLength={200} />
        </div>
      )}
    </div>
  );
}
