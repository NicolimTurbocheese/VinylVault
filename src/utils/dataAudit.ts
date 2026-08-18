import { ShelfItem } from "./../types";

// Fields worth auditing across the collection, in rough order of how much each one
// affects the app's usefulness: valuation accuracy first, then searchability/matching,
// then nice-to-haves. `weight` drives the completeness score and the default ordering
// of what to fix first.
export interface AuditRule {
  key: string;
  label: string;
  // Short explanation of why it matters, shown in the UI.
  why: string;
  weight: number;
  isMissing: (item: ShelfItem) => boolean;
}

const isBlank = (v?: string | null) => !v || !String(v).trim();

// Placeholder text that means "no real value was recorded" even though the field
// technically has content — same convention the cover-art search uses.
const PLACEHOLDER_CATNOS = ["cat-no", "n/a", "barcode", "unknown", "none", "-", "tbd"];
const isPlaceholderCatNo = (v?: string) =>
  isBlank(v) || PLACEHOLDER_CATNOS.includes(String(v).trim().toLowerCase());

export const AUDIT_RULES: AuditRule[] = [
  {
    key: "needsReview",
    label: "Grading unconfirmed",
    why: "Grade was defaulted during import rather than confirmed against the physical record — the single biggest source of valuation error.",
    weight: 5,
    isMissing: (i) => !!i.needsReview,
  },
  {
    key: "purchasePrice",
    label: "No purchase price",
    why: "Without it this record is excluded from profit/loss and 'value gain' figures.",
    weight: 4,
    isMissing: (i) => i.purchasePrice === undefined || i.purchasePrice === null,
  },
  {
    key: "catalogueNumber",
    label: "No catalogue number",
    why: "The strongest signal for matching the exact pressing — without it, cover art and tracklist lookups fall back to fuzzy title search.",
    weight: 4,
    isMissing: (i) => isPlaceholderCatNo(i.catalogueNumber),
  },
  {
    key: "coverArtUrl",
    label: "No cover art",
    why: "Missing artwork makes the shelf harder to scan visually.",
    weight: 3,
    isMissing: (i) => isBlank(i.coverArtUrl),
  },
  {
    key: "tracklist",
    label: "No tracklist",
    why: "Tracklist data couldn't be matched from any source.",
    weight: 3,
    isMissing: (i) => !i.tracklist || i.tracklist.length === 0,
  },
  {
    key: "matrixCode",
    label: "No matrix / runout code",
    why: "Distinguishes between pressings that share a catalogue number — matters most for first-pressing valuation.",
    weight: 2,
    isMissing: (i) => isBlank(i.matrixCode),
  },
  {
    key: "purchaseDate",
    label: "No purchase date",
    why: "Needed for an accurate acquisition timeline on the value chart.",
    weight: 2,
    isMissing: (i) => isBlank(i.purchaseDate),
  },
  {
    key: "boxId",
    label: "Not filed in a box",
    why: "Record isn't assigned to a physical storage location.",
    weight: 1,
    isMissing: (i) => isBlank(i.boxId),
  },
  {
    key: "releaseYear",
    label: "No release year",
    why: "Era affects the valuation multiplier.",
    weight: 1,
    isMissing: (i) => !i.releaseYear,
  },
];

const TOTAL_WEIGHT = AUDIT_RULES.reduce((sum, r) => sum + r.weight, 0);

export interface ItemAudit {
  item: ShelfItem;
  missing: AuditRule[];
  // Sum of the weights of everything missing — higher means more worth fixing.
  missingWeight: number;
  // 0-100; 100 means nothing on the checklist is missing.
  completeness: number;
}

export function auditItem(item: ShelfItem): ItemAudit {
  const missing = AUDIT_RULES.filter((rule) => rule.isMissing(item));
  const missingWeight = missing.reduce((sum, r) => sum + r.weight, 0);
  return {
    item,
    missing,
    missingWeight,
    completeness: Math.round(((TOTAL_WEIGHT - missingWeight) / TOTAL_WEIGHT) * 100),
  };
}

export interface CollectionAudit {
  audits: ItemAudit[];
  // How many records are missing each rule, keyed by rule.key.
  countsByRule: Record<string, number>;
  overallCompleteness: number;
  fullyCompleteCount: number;
}

export function auditCollection(items: ShelfItem[]): CollectionAudit {
  const audits = items.map(auditItem);

  const countsByRule: Record<string, number> = {};
  for (const rule of AUDIT_RULES) {
    countsByRule[rule.key] = audits.filter((a) => a.missing.some((m) => m.key === rule.key)).length;
  }

  const overallCompleteness =
    audits.length === 0
      ? 100
      : Math.round(audits.reduce((sum, a) => sum + a.completeness, 0) / audits.length);

  return {
    audits,
    countsByRule,
    overallCompleteness,
    fullyCompleteCount: audits.filter((a) => a.missing.length === 0).length,
  };
}
