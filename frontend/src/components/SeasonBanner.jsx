import { useState } from "react";
import { X } from "lucide-react";
import { useSeasonTheme } from "@/contexts/SeasonThemeContext";

const dayKey = (t) => `SEASON_BANNER_${t.key}_${new Date().toISOString().slice(0, 10)}`;

/** Festive greeting card for the home screens. Dismissible for the day. */
export default function SeasonBanner() {
  const { theme } = useSeasonTheme();
  const [hidden, setHidden] = useState(() => {
    try { return theme ? localStorage.getItem(dayKey(theme)) === "1" : false; } catch { return false; }
  });
  if (!theme || hidden) return null;
  const close = () => {
    try { localStorage.setItem(dayKey(theme), "1"); } catch { /* ignore */ }
    setHidden(true);
  };
  return (
    <div
      className="relative mx-4 mt-4 rounded-2xl p-4 text-white shadow-md bg-gradient-to-r from-purple-600 to-pink-600"
      data-testid="season-banner"
    >
      <button type="button" onClick={close} aria-label="Dismiss" className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30">
        <X className="h-4 w-4" />
      </button>
      <p className="font-bold text-base pr-8">{theme.banner_title}</p>
      <p className="text-sm opacity-95 mt-1 pr-6">{theme.banner_text}</p>
    </div>
  );
}
