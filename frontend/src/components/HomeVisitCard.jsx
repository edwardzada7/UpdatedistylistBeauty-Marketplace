import { useEffect, useRef, useState } from "react";
import { Crosshair, Home, Loader2, MapPin, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bookingsAPI } from "@/services/api";
import { getBrowserPosition } from "@/services/locationApi";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoney } from "@/utils/money";

/**
 * "Where should we do it?" for a booking: at the provider's place, or at the customer's (home visit).
 * The server re-checks the range and works out the travel fee, so nothing here is trusted for money.
 *
 * value:    { mode: "in_store" | "home", address, latitude, longitude, quote }
 * onChange: (next value)
 */
export default function HomeVisitCard({ providerId, radiusKm, feePerKm, value, onChange }) {
  const { userData } = useAuth();
  const [locating, setLocating] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const latest = useRef(value);
  latest.current = value;

  const set = (patch) => onChange({ ...latest.current, ...patch });
  const hasPoint = value.latitude != null && value.longitude != null;

  // Ask the server whether the provider can come to this point
  useEffect(() => {
    if (value.mode !== "home" || !hasPoint) return undefined;
    let cancelled = false;
    setQuoting(true);
    bookingsAPI
      .homeQuote({ provider_id: Number(providerId), latitude: value.latitude, longitude: value.longitude })
      .then((r) => !cancelled && set({ quote: r.data }))
      .catch(() => !cancelled && set({ quote: { available: false, reason: "We couldn't check the distance. Please try again." } }))
      .finally(() => !cancelled && setQuoting(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.mode, value.latitude, value.longitude, providerId]);

  const useGps = async () => {
    setLocating(true);
    setGeoMsg("");
    try {
      const pos = await getBrowserPosition();
      set({ latitude: pos.latitude, longitude: pos.longitude, source: "gps", quote: null });
      toast.success("Current location captured. Add or confirm your street address below.");
    } catch (e) {
      toast.error(e.message || "Could not get your location");
    } finally {
      setLocating(false);
    }
  };

  const useSaved = () => {
    setGeoMsg("");
    set({
      latitude: userData.latitude,
      longitude: userData.longitude,
      address: userData.location_address || value.address || "",
      source: "saved",
      quote: null,
    });
  };

  // Typing an address makes the typed address the source of truth (the old pin no longer applies)
  const onAddressChange = (text) => {
    setGeoMsg("");
    set({ address: text, source: "typed", latitude: null, longitude: null, quote: null });
  };

  const checkAddress = async () => {
    const text = (latest.current.address || "").trim();
    if (text.length < 5) {
      setGeoMsg("Type your full address first.");
      return;
    }
    setGeocoding(true);
    setGeoMsg("");
    try {
      const r = await bookingsAPI.geocodeAddress(text);
      if (r.data?.found) {
        // keep the customer's own wording, only attach the coordinates
        set({ latitude: r.data.latitude, longitude: r.data.longitude, source: "typed", quote: null, resolved: r.data.label });
      } else {
        setGeoMsg(r.data?.message || "We couldn't find that address.");
      }
    } catch (e) {
      setGeoMsg(e.response?.data?.detail || "Address lookup failed. Try again or use your current location.");
    } finally {
      setGeocoding(false);
    }
  };

  // Look the typed address up automatically once the customer pauses typing
  useEffect(() => {
    if (value.mode !== "home" || value.source !== "typed" || hasPoint) return undefined;
    if ((value.address || "").trim().length < 8) return undefined;
    const t = setTimeout(() => checkAddress(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.address, value.source, value.mode, hasPoint]);

  const q = value.quote;
  const Option = ({ mode, icon: Icon, title, sub }) => (
    <button
      type="button"
      onClick={() => set({ mode, ...(mode === "in_store" ? { quote: null } : {}) })}
      className={`flex-1 text-left rounded-lg border p-3 ${value.mode === mode ? "border-purple-600 bg-purple-50" : "bg-white"}`}
      data-testid={`mode-${mode}`}
    >
      <Icon className="h-4 w-4 text-purple-600 mb-1" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </button>
  );

  return (
    <Card data-testid="home-visit-card">
      <CardContent className="p-4 space-y-3">
        <p className="font-semibold">Where should we do it?</p>
        <div className="flex gap-2">
          <Option mode="in_store" icon={Store} title="At their place" sub="No travel fee" />
          <Option mode="home" icon={Home} title="Come to me" sub={`Within ${Number(radiusKm)} km${feePerKm ? `, ${formatMoney(feePerKm)}/km` : ""}`} />
        </div>

        {value.mode === "home" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-600">Choose where the provider should come. You can use your current or saved location, or type any other address (home, office, another area).</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={value.source === "gps" ? "default" : "outline"} size="sm" onClick={useGps} disabled={locating}>
                {locating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Crosshair className="h-4 w-4 mr-1" />}
                Use my current location
              </Button>
              {userData?.latitude != null && userData?.longitude != null && (
                <Button type="button" variant={value.source === "saved" ? "default" : "outline"} size="sm" onClick={useSaved}>
                  <MapPin className="h-4 w-4 mr-1" />Use my saved address
                </Button>
              )}
            </div>
            <div>
              <Label htmlFor="home-address">Or type the address for this visit</Label>
              <div className="flex gap-2 mt-1">
                <Input id="home-address" maxLength={300} value={value.address || ""} onChange={(e) => onAddressChange(e.target.value)} placeholder="House number, street, area, city" />
                <Button type="button" variant="outline" size="icon" onClick={checkAddress} disabled={geocoding} aria-label="Check address">
                  {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">The provider only sees your address after they confirm the booking.</p>
            </div>
            {geoMsg && <p className="text-xs text-red-600">{geoMsg}</p>}
            {geocoding && <p className="text-xs text-gray-500">Finding your address...</p>}
            {!hasPoint && !geocoding && !geoMsg && <p className="text-xs text-amber-700">Type your full address (we'll check it automatically), or use a location button so we can check the distance.</p>}
            {hasPoint && (
              <p className="text-xs text-gray-500">
                Distance is based on: {value.source === "gps" ? "your current location" : value.source === "saved" ? "your saved location" : `the address you typed${value.resolved ? ` (found: ${value.resolved})` : ""}`}.
              </p>
            )}
            {quoting && <p className="text-xs text-gray-500">Checking distance...</p>}
            {q && !quoting && (
              q.available ? (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
                  <p className="text-green-800 font-medium">{q.distance_km} km away. The provider can visit you.</p>
                  <p className="text-gray-700">Travel fee: <b>{q.travel_fee > 0 ? formatMoney(q.travel_fee) : "None"}</b></p>
                </div>
              ) : (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{q.reason || "This provider can't visit that location."}</div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
