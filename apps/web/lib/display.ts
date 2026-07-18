const invalidTextValues = new Set(["null", "undefined", "nan"]);

export function displayText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  if (!text || invalidTextValues.has(text.toLowerCase())) return fallback;
  return text;
}

export function finiteNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function finiteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function displayNumber(
  value: unknown,
  options?: Intl.NumberFormatOptions,
): string {
  const number = finiteNumberOrNull(value);
  if (number === null) return "—";
  return new Intl.NumberFormat("en-IL", options).format(number);
}

export function displayPercent(value: unknown): string {
  const number = finiteNumberOrNull(value);
  if (number === null) return "—";
  return `${Math.round(number)}%`;
}

export function displayMoney(value: unknown, currency: unknown): string {
  const number = finiteNumberOrNull(value);
  if (number === null) return "—";
  const currencyCode = displayText(currency, "ILS").toUpperCase();
  try {
    return new Intl.NumberFormat("en-IL", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return displayNumber(number, { maximumFractionDigits: 2 });
  }
}
