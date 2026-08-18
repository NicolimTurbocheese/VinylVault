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
