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

// Discogs labels conditions in full; the app stores Goldmine short codes.
export const DISCOGS_CONDITION_BY_GRADE: Record<string, string> = {
  M: "Mint (M)",
  NM: "Near Mint (NM or M-)",
  "VG+": "Very Good Plus (VG+)",
  VG: "Very Good (VG)",
  G: "Good (G)",
  F_P: "Fair (F)",
};

// Picks the suggestion matching the record's own media grade. Falls back down the grade
// ladder rather than up, so a missing suggestion never inflates a record's value.
const GRADE_LADDER = ["M", "NM", "VG+", "VG", "G", "F_P"];

export function suggestionForGrade(
  suggestions: Record<string, number> | null | undefined,
  mediaGrade: string | undefined
): number | null {
  if (!suggestions) return null;
  const startIdx = Math.max(0, GRADE_LADDER.indexOf(mediaGrade || "VG+"));
  for (let i = startIdx; i < GRADE_LADDER.length; i++) {
    const label = DISCOGS_CONDITION_BY_GRADE[GRADE_LADDER[i]];
    const val = label ? suggestions[label] : undefined;
    if (typeof val === "number" && val > 0) return val;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Which number counts as "the value of this record"
// ---------------------------------------------------------------------------
const VALUATION_SOURCE_KEY = "vinylvault_valuation_source";
export type ValuationSource = "market" | "estimate";

export function getValuationSource(): ValuationSource {
  return localStorage.getItem(VALUATION_SOURCE_KEY) === "estimate" ? "estimate" : "market";
}

export function setValuationSource(src: ValuationSource) {
  localStorage.setItem(VALUATION_SOURCE_KEY, src);
}

// The value to actually report for a record. On "market", a real observed price wins over
// the app's own estimate — condition-matched where Discogs offered one, otherwise the
// cheapest current listing. Records never successfully polled fall back to the estimate, so
// a partially-polled collection still totals correctly instead of dropping to zero.
export function effectiveValueSGD(item: ShelfItem, source: ValuationSource = getValuationSource()): number {
  const estimate = item.calculatedValue?.median || 0;
  if (source === "estimate") return estimate;
  const latest = latestObservation(item);
  if (!latest) return estimate;
  if (typeof latest.gradedValueSGD === "number" && latest.gradedValueSGD > 0) return latest.gradedValueSGD;
  if (latest.lowestPriceSGD > 0) return latest.lowestPriceSGD;
  return estimate;
}

// True when the reported value came from real market data rather than the app's estimate.
export function isMarketValued(item: ShelfItem, source: ValuationSource = getValuationSource()): boolean {
  if (source === "estimate") return false;
  const latest = latestObservation(item);
  if (!latest) return false;
  return (latest.gradedValueSGD || 0) > 0 || latest.lowestPriceSGD > 0;
}
