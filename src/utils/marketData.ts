import { ShelfItem, MarketObservation } from "../types";
import { CURRENCY_RATES_FROM_SGD, DisplayCurrency } from "./currency";

// Discogs reports marketplace prices in its own supported currencies (SGD isn't one of
// them), so readings are converted back to SGD at capture time — the app's native unit,
// and what calculatedValue is already denominated in.
export function toSGD(amount: number, currency: string): number {
  const code = currency.toUpperCase() as DisplayCurrency;
  const rate = CURRENCY_RATES_FROM_SGD[code];
  // rate is "how many <currency> per 1 SGD", so invert to get SGD.
  if (!rate || rate <= 0) return amount;
  return amount / rate;
}

const dayOf = (iso: string) => iso.slice(0, 10);

// Appends today's reading, replacing any existing entry for the same day so repeated
// fetches in one day don't inflate the series. Kept oldest-first and capped so a long-lived
// collection can't grow its localStorage record without bound.
const MAX_OBSERVATIONS = 400;

export function withMarketObservation(item: ShelfItem, obs: MarketObservation): ShelfItem {
  const existing = (item.marketObservations || []).filter((o) => dayOf(o.date) !== dayOf(obs.date));
  const merged = [...existing, obs].sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...item,
    marketObservations: merged.slice(-MAX_OBSERVATIONS),
  };
}

// Most recent reading, or null if this record has never been successfully polled.
export function latestObservation(item: ShelfItem): MarketObservation | null {
  const obs = item.marketObservations;
  if (!obs || obs.length === 0) return null;
  return obs[obs.length - 1];
}

// How the app's own estimate compares to what the cheapest copy is actually listed at.
// Positive means the estimate sits above the current asking price.
export function estimateVsMarket(item: ShelfItem): { diff: number; pct: number } | null {
  const latest = latestObservation(item);
  const estimate = item.calculatedValue?.median;
  if (!latest || !estimate || latest.lowestPriceSGD <= 0) return null;
  const diff = estimate - latest.lowestPriceSGD;
  return { diff, pct: (diff / latest.lowestPriceSGD) * 100 };
}
