// One place to format money. Everything is NGN today; the currency code travels with the amount
// so other currencies can be added later without touching every screen.
const SYMBOLS = { NGN: "₦", GBP: "£", USD: "$", CAD: "CA$", GHS: "GH₵", KES: "KSh" };

export const currencySymbol = (currency = "NGN") => SYMBOLS[currency] || `${currency} `;

export const formatMoney = (amount, currency = "NGN") => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currencySymbol(currency)}0`;
  return `${currencySymbol(currency)}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};
