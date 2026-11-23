import { useEffect, useRef, useState } from "react";
import { Crosshair, Home, Loader2, Store } from "lucide-react";
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
    try {
      const pos = await getBrowserPosition();
      set({ latitude: pos.latitude, longitude: pos.longitude, quote: null });
      toast.success("Location captured. Add your street address below.");
    } catch (e) {
      toast.error(e.message || "Could not get your location");
    } finally {
      setLocating(false);
    }
  };

  const useSaved = () => {
    set({
      latitude: userData.latitude,
      longitude: userData.longitude,
      address: value.address || userData.location_address || "",
      quote: null,
    });
  };

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
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={useGps} disabled={locating}>
                {locating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Crosshair className="h-4 w-4 mr-1" />}
                Use my current location
              </Button>
              {userData?.latitude != null && userData?.longitude != null && (
                <Button type="button" variant="outline" size="sm" onClick={useSaved}>Use my saved location</Button>
              )}
            </div>
            <div>
              <Label htmlFor="home-address">Your address</Label>
              <Input id="home-address" className="mt-1" maxLength={300} value={value.address || ""} onChange={(e) => set({ address: e.target.value })} placeholder="House number, street, landmark" />
              <p className="text-xs text-gray-500 mt-1">The provider only sees your address after they confirm the booking.</p>
            </div>
            {!hasPoint && <p className="text-xs text-amber-700">Share your location so we can check the distance.</p>}
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
