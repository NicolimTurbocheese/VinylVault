import { ShelfItem } from "../types";

const SNAPSHOTS_STORAGE_KEY = "vinylvault_value_snapshots";

export interface ValueSnapshot {
  date: string; // ISO date the snapshot was taken
  totalLow: number;
  totalMedian: number;
  totalHigh: number;
  itemCount: number;
}

export function getStoredSnapshots(): ValueSnapshot[] {
  const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSnapshotsToLocal(snapshots: ValueSnapshot[]) {
  localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
}

const dayKey = (iso: string) => iso.slice(0, 10); // "YYYY-MM-DD"

// Records a new value snapshot once per calendar day — call on every app load. If a
// snapshot already exists for today, updates it in place (so today's figure reflects the
// collection's latest state rather than freezing at first-open), otherwise appends a new
// one. Never records for an empty shelf. Daily (rather than monthly) granularity is what
// makes a real stock-app-style timeline toggle (1W/1M/3M/1Y) possible — any older monthly
// snapshots recorded before this change remain valid points in the same series, since the
// shape is unchanged; the history just gets denser going forward.
export function recordDailySnapshotIfNeeded(shelfItems: ShelfItem[]): ValueSnapshot[] {
  const snapshots = getStoredSnapshots();
  if (shelfItems.length === 0) return snapshots;

  const totals = shelfItems.reduce(
    (acc, item) => {
      acc.totalLow += item.calculatedValue?.low || 0;
      acc.totalMedian += item.calculatedValue?.median || 0;
      acc.totalHigh += item.calculatedValue?.high || 0;
      return acc;
    },
    { totalLow: 0, totalMedian: 0, totalHigh: 0 }
  );

  const today = new Date().toISOString().slice(0, 10);
  const existingIdx = snapshots.findIndex((s) => dayKey(s.date) === today);

  const snapshot: ValueSnapshot = { date: today, ...totals, itemCount: shelfItems.length };

  let updated: ValueSnapshot[];
  if (existingIdx >= 0) {
    updated = [...snapshots];
    updated[existingIdx] = snapshot;
  } else {
    updated = [...snapshots, snapshot].sort((a, b) => a.date.localeCompare(b.date));
  }

  saveSnapshotsToLocal(updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Historical reconstruction
// ---------------------------------------------------------------------------
// Daily snapshots only start accumulating from the day the feature ships, which leaves the
// chart empty of everything that happened before. But the collection already carries enough
// data to reconstruct the past honestly: each record knows when it was acquired
// (purchaseDate, falling back to addedAt), and `history[]` logs the value a record carried
// before each grading/valuation change.
//
// IMPORTANT about what this does and does not claim: for any past day, a record is counted
// only if it was already owned that day, valued at whatever `history` says applied then. For
// records that have never been re-graded there IS no past valuation on file, so their
// present value is used throughout. The reconstructed stretch therefore shows the
// collection *accumulating* at today's estimates — it is not a record of what the market
// said back then, which nothing in the app ever measured. Real measured snapshots take over
// for every day from the first snapshot onward.

const dayOf = (iso?: string) => (iso ? iso.slice(0, 10) : "");

const acquiredOn = (item: ShelfItem): string => dayOf(item.purchaseDate || item.addedAt);

// A history entry records the state that applied *before* the change it describes, stamped
// with the moment of the change. So the value in force on `day` is the one belonging to the
// earliest change that happened after `day`; if no later change exists, today's value stands.
function valueAsOf(item: ShelfItem, day: string): number {
  const later = (item.history || [])
    .filter((h) => dayOf(h.date) > day)
    .sort((a, b) => dayOf(a.date).localeCompare(dayOf(b.date)));
  if (later.length > 0) return later[0].calculatedValue?.median || 0;
  return item.calculatedValue?.median || 0;
}

const addDays = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface ValuePoint {
  date: string; // YYYY-MM-DD
  value: number;
  // False while the point is reconstructed from acquisition/history data rather than
  // measured by a stored snapshot — lets the UI be honest about which is which.
  measured: boolean;
}

// Builds one continuous series from the earliest thing on record right up to today,
// reconstructing the stretch before snapshots existed and using measured snapshots after.
export function buildValueSeries(items: ShelfItem[], snapshots: ValueSnapshot[]): ValuePoint[] {
  if (items.length === 0 && snapshots.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const sortedSnaps = [...snapshots].sort((a, b) => dayOf(a.date).localeCompare(dayOf(b.date)));
  const firstSnapDay = sortedSnaps.length > 0 ? dayOf(sortedSnaps[0].date) : null;

  const candidateStarts = [
    ...items.map(acquiredOn).filter(Boolean),
    ...(firstSnapDay ? [firstSnapDay] : []),
  ].sort();
  if (candidateStarts.length === 0) return [];
  let start = candidateStarts[0];

  // Guard against a stray/typo'd far-past date dragging the axis back years: never build
  // more than ~5 years of points, and thin the resolution on long ranges so the series
  // stays a sensible size to render.
  const MAX_DAYS = 365 * 5;
  const spanDays = Math.round((Date.parse(today) - Date.parse(start)) / 86400000);
  if (spanDays > MAX_DAYS) start = addDays(today, -MAX_DAYS);
  const step = spanDays > 730 ? 7 : 1;

  const points: ValuePoint[] = [];
  let snapIdx = -1;
  for (let day = start; day <= today; day = addDays(day, step)) {
    while (snapIdx + 1 < sortedSnaps.length && dayOf(sortedSnaps[snapIdx + 1].date) <= day) snapIdx++;

    const useMeasured = firstSnapDay !== null && day >= firstSnapDay && snapIdx >= 0;
    if (useMeasured) {
      points.push({ date: day, value: sortedSnaps[snapIdx].totalMedian, measured: true });
    } else {
      const total = items.reduce((sum, item) => {
        const acq = acquiredOn(item);
        if (!acq || acq > day) return sum;
        return sum + valueAsOf(item, day);
      }, 0);
      points.push({ date: day, value: total, measured: false });
    }
  }

  // Always finish exactly on today so the line reaches the right-hand edge.
  if (points.length > 0 && points[points.length - 1].date !== today) {
    const last = sortedSnaps[sortedSnaps.length - 1];
    points.push({
      date: today,
      value: last ? last.totalMedian : items.reduce((s, i) => s + (i.calculatedValue?.median || 0), 0),
      measured: !!last && dayOf(last.date) === today,
    });
  }

  return points;
}
