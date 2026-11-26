import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { themesAPI } from "@/services/themesApi";

const CHOICE_KEY = "ISTYLIST_THEME_CHOICE"; // auto | default | <theme key>
const FX_KEY = "ISTYLIST_THEME_FX"; // "0" disables decorations
const CACHE_KEY = "ISTYLIST_THEME_CACHE";
const REFRESH_MS = 6 * 60 * 60 * 1000;

const read = (k, fallback) => {
  try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
};

const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Re-maps the app's purple (primary) and pink (secondary) Tailwind utilities to the theme palette. */
export function buildThemeCss(theme) {
  if (!theme) return "";
  const rules = [];
  const families = [["purple", theme.primary], ["pink", theme.secondary]];
  for (const [family, scale] of families) {
    if (!scale) continue;
    for (const s of SHADES) {
      const c = scale[s];
      if (!c) continue;
      const [r, g, b] = hexToRgb(c);
      const n = `${family}-${s}`;
      const P = 'html[data-season] ';
      rules.push(
        `${P}.bg-${n},${P}.hover\\:bg-${n}:hover,${P}.focus\\:bg-${n}:focus{background-color:${c}!important}`,
        `${P}.text-${n},${P}.hover\\:text-${n}:hover,${P}.focus\\:text-${n}:focus{color:${c}!important}`,
        `${P}.border-${n},${P}.hover\\:border-${n}:hover,${P}.focus\\:border-${n}:focus{border-color:${c}!important}`,
        `${P}.ring-${n},${P}.focus\\:ring-${n}:focus{--tw-ring-color:${c}!important}`,
        `${P}.fill-${n}{fill:${c}!important}`,
        `${P}.stroke-${n}{stroke:${c}!important}`,
        `${P}.from-${n}{--tw-gradient-from:${c} var(--tw-gradient-from-position)!important;--tw-gradient-to:rgb(${r} ${g} ${b} / 0) var(--tw-gradient-to-position)!important;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)!important}`,
        `${P}.via-${n}{--tw-gradient-to:rgb(${r} ${g} ${b} / 0) var(--tw-gradient-to-position)!important;--tw-gradient-stops:var(--tw-gradient-from),${c} var(--tw-gradient-via-position),var(--tw-gradient-to)!important}`,
        `${P}.to-${n}{--tw-gradient-to:${c} var(--tw-gradient-to-position)!important}`,
      );
    }
  }
  return rules.join("\n");
}

const Ctx = createContext({
  theme: null, themes: [], choice: "auto", setChoice: () => {}, effectsOn: true, setEffectsOn: () => {},
});
export const useSeasonTheme = () => useContext(Ctx);

export function SeasonThemeProvider({ children }) {
  const [server, setServer] = useState(() => {
    try { return JSON.parse(read(CACHE_KEY, "null")) || { active: null, themes: [] }; } catch { return { active: null, themes: [] }; }
  });
  const [choice, setChoiceState] = useState(() => read(CHOICE_KEY, "auto"));
  const [effectsOn, setEffectsState] = useState(() => read(FX_KEY, "1") !== "0");

  const load = useCallback(async () => {
    try {
      const data = await themesAPI.active();
      setServer(data);
      write(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* keep cached theme */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const theme = useMemo(() => {
    if (choice === "default") return null;
    if (choice === "auto") return server.active || null;
    return (server.themes || []).find((t) => t.key === choice) || server.active || null;
  }, [choice, server]);

  // apply colours: data attribute + injected stylesheet
  useEffect(() => {
    const root = document.documentElement;
    let el = document.getElementById("season-theme-style");
    if (!theme) {
      root.removeAttribute("data-season");
      if (el) el.textContent = "";
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = "season-theme-style";
      document.head.appendChild(el);
    }
    root.setAttribute("data-season", theme.key);
    el.textContent = buildThemeCss(theme);
  }, [theme]);

  const setChoice = useCallback((v) => { setChoiceState(v); write(CHOICE_KEY, v); }, []);
  const setEffectsOn = useCallback((v) => { setEffectsState(v); write(FX_KEY, v ? "1" : "0"); }, []);

  const value = useMemo(
    () => ({ theme, themes: server.themes || [], choice, setChoice, effectsOn, setEffectsOn }),
    [theme, server, choice, effectsOn, setChoice, setEffectsOn],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
