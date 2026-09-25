export const euros = (cents) =>
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export function money(text) {
  if (typeof text !== "string" || !/^\d+(?:[.,]\d{1,2})?$/.test(text.trim()))
    return null;
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && n <= 100000 ? Math.round(n * 100) : null;
}
// Deliberately fixed UI heuristic, not an EV calculation or solved strategy.
// Use the displayed one-decimal percentage so the label and tier agree.
export function equityHint(q) {
  if (!Number.isFinite(q) || q < 0 || q > 1) return null;
  const percent = Math.round(q * 1000) / 10;
  return percent < 25 ? 0 : percent < 50 ? 60 : percent < 75 ? 120 : 240;
}
