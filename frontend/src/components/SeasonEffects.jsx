import { useMemo } from "react";
import { useSeasonTheme } from "@/contexts/SeasonThemeContext";

const GLYPHS = {
  snow: ["❄", "❅", "❆"],
  hearts: ["💖", "💕", "❤"],
  confetti: ["🎉", "✨", "🎊"],
  stars: ["✨", "🌙", "⭐"],
};

/** Light falling decorations. Off for reduced-motion users or when the user turns effects off. */
export default function SeasonEffects() {
  const { theme, effectsOn } = useSeasonTheme();
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = useMemo(() => {
    const glyphs = GLYPHS[theme?.effect] || [];
    if (!glyphs.length) return [];
    return Array.from({ length: 10 }, (_, i) => ({
      id: i,
      g: glyphs[i % glyphs.length],
      left: (i * 97) % 100,
      size: 12 + ((i * 7) % 10),
      dur: 12 + ((i * 3) % 9),
      delay: -((i * 5) % 12),
    }));
  }, [theme]);

  if (!theme || !effectsOn || reduce || !items.length) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" data-testid="season-effects">
      <style>{`@keyframes season-fall{0%{transform:translateY(-8vh) rotate(0deg);opacity:0}10%{opacity:.8}100%{transform:translateY(108vh) rotate(360deg);opacity:0}}`}</style>
      {items.map((it) => (
        <span
          key={it.id}
          style={{ position: "absolute", top: 0, left: `${it.left}%`, fontSize: it.size, animation: `season-fall ${it.dur}s linear ${it.delay}s infinite`, opacity: 0.7 }}
        >
          {it.g}
        </span>
      ))}
    </div>
  );
}
