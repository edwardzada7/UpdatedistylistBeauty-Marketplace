import api from "@/services/api";

export const locationApi = {
  areas: (countryCode = "NG", region) => api.get("/locations/areas", { params: { country_code: countryCode, ...(region ? { region } : {}) } }),
  resolve: (latitude, longitude) => api.post("/locations/resolve", { latitude, longitude }),
};

/** Ask the browser for the current position. Rejects with a friendly message. */
export const getBrowserPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Your browser can't share your location. Pick your area instead."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? "Location permission was denied. Pick your area instead." : "We couldn't get your location. Pick your area instead.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
