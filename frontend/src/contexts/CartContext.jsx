import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { lineKey } from "@/services/shopApi";

const STORAGE_KEY = "istylist_web_cart";
const CartContext = createContext(null);

const load = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [lines, setLines] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable (private mode) - cart still works for this session */
    }
  }, [lines]);

  const addItem = useCallback((line, qty = 1) => {
    setLines((prev) => {
      const key = lineKey(line);
      const existing = prev.find((l) => lineKey(l) === key);
      const max = Number(line.stock) || Infinity;
      if (existing) return prev.map((l) => (lineKey(l) === key ? { ...l, ...line, quantity: Math.min(l.quantity + qty, max) } : l));
      return [...prev, { ...line, quantity: Math.min(qty, max) }];
    });
  }, []);

  const setQuantity = useCallback((key, quantity) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => lineKey(l) !== key)
        : prev.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.min(quantity, Number(l.stock) || Infinity) } : l))
    );
  }, []);

  const removeItem = useCallback((key) => setLines((prev) => prev.filter((l) => lineKey(l) !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      addItem,
      setQuantity,
      removeItem,
      clear,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      total: lines.reduce((s, l) => s + Number(l.price) * l.quantity, 0),
    }),
    [lines, addItem, setQuantity, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
};
