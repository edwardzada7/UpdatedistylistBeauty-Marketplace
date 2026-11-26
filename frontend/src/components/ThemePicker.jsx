import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSeasonTheme } from "@/contexts/SeasonThemeContext";

/** Profile setting: Auto (follows the season) / Default / a specific theme, plus the effects switch. */
export default function ThemePicker() {
  const { themes, choice, setChoice, effectsOn, setEffectsOn, theme } = useSeasonTheme();
  const options = [
    { key: "auto", label: "Auto (follows the season)" },
    { key: "default", label: "Default" },
    ...themes.map((t) => ({ key: t.key, label: `${t.emoji} ${t.name}` })),
  ];
  return (
    <div className="space-y-3" data-testid="theme-picker">
      <div>
        <Label htmlFor="theme-choice" className="text-sm font-medium">App theme</Label>
        <select
          id="theme-choice"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        {choice === "auto" && (
          <p className="text-xs text-gray-500 mt-1">{theme ? `Showing: ${theme.name}` : "No seasonal theme right now."}</p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="theme-fx" className="text-sm">Festive animations</Label>
        <Switch id="theme-fx" checked={effectsOn} onCheckedChange={setEffectsOn} />
      </div>
    </div>
  );
}
