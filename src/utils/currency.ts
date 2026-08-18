// All values are stored and calculated in SGD (the valuation engine's native unit) --
// these are fixed, approximate reference rates for DISPLAY conversion only, not a live
// feed. Update them here if they drift noticeably; there's no live FX API wired in.
export const SUPPORTED_CURRENCIES = ["SGD", "USD", "JPY", "EUR"] as const;
export type DisplayCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_RATES_FROM_SGD: Record<DisplayCurrency, number> = {
  SGD: 1,
  USD: 0.74,
  JPY: 110,
  EUR: 0.68,
};

export const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  SGD: "S$",
  USD: "US$",
  JPY: "¥",
  EUR: "€",
};

// JPY conventionally has no decimal subunit in everyday display.
const decimalsFor = (currency: DisplayCurrency) => (currency === "JPY" ? 0 : 2);

export function convertFromSGD(amountSGD: number, currency: DisplayCurrency): number {
  return amountSGD * CURRENCY_RATES_FROM_SGD[currency];
}

// For a number that's already been converted (e.g. a chart's internal data value) --
// applies only the symbol/decimal formatting, no further conversion.
export function formatConvertedAmount(amount: number, currency: DisplayCurrency): string {
  const decimals = decimalsFor(currency);
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${CURRENCY_SYMBOLS[currency]}${formatted}`;
}

export function formatCurrency(
  amountSGD: number,
  currency: DisplayCurrency,
  opts: { compact?: boolean } = {}
): string {
  const converted = convertFromSGD(amountSGD, currency);
  const decimals = opts.compact ? 0 : decimalsFor(currency);
  const formatted = converted.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${CURRENCY_SYMBOLS[currency]}${formatted}`;
}
