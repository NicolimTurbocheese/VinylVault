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

const monthKey = (iso: string) => iso.slice(0, 7); // "YYYY-MM"

// Records a new value snapshot once per calendar month — call on every app load. If a
// snapshot already exists for the current month, updates it in place (so the month's
// figure reflects the collection's latest state rather than freezing at first-open),
// otherwise appends a new one. Never records for an empty shelf.
export function recordMonthlySnapshotIfNeeded(shelfItems: ShelfItem[]): ValueSnapshot[] {
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
  const currentMonth = monthKey(today);
  const existingIdx = snapshots.findIndex((s) => monthKey(s.date) === currentMonth);

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
