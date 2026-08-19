export type GoldmineGrade = 'M' | 'NM' | 'VG+' | 'VG' | 'G' | 'F_P';

export interface GradeMultiplier {
  grade: GoldmineGrade;
  name: string;
  description: string;
  minPercent: number;
  maxPercent: number;
  defaultMultiplier: number;
}

export const GOLDMINE_GRADES: Record<GoldmineGrade, GradeMultiplier> = {
  'M': {
    grade: 'M',
    name: 'Mint (M)',
    description: 'Perfect in every way. Unplayed or factory sealed.',
    minPercent: 100,
    maxPercent: 100,
    defaultMultiplier: 1.0,
  },
  'NM': {
    grade: 'NM',
    name: 'Near Mint (NM)',
    description: 'Nearly perfect, no obvious signs of wear. Minor sleeve scuffs.',
    minPercent: 85,
    maxPercent: 90,
    defaultMultiplier: 0.88,
  },
  'VG+': {
    grade: 'VG+',
    name: 'Very Good Plus (VG+)',
    description: 'Slight signs of wear or light surface scratches that do not affect play.',
    minPercent: 70,
    maxPercent: 80,
    defaultMultiplier: 0.75,
  },
  'VG': {
    grade: 'VG',
    name: 'Very Good (VG)',
    description: 'Surface noise evident upon play, light scratches affecting sound slightly.',
    minPercent: 50,
    maxPercent: 60,
    defaultMultiplier: 0.55,
  },
  'G': {
    grade: 'G',
    name: 'Good / Good Plus (G / G+)',
    description: 'Can play through without skipping, but has significant surface noise and scratches.',
    minPercent: 30,
    maxPercent: 40,
    defaultMultiplier: 0.35,
  },
  'F_P': {
    grade: 'F_P',
    name: 'Fair / Poor (F / P)',
    description: 'Cracked, warped, or heavily scratched. Plays with major skipping or noise.',
    minPercent: 10,
    maxPercent: 20,
    defaultMultiplier: 0.15,
  },
};

export interface TrackItem {
  position: string;
  title: string;
  duration?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
  price?: string;
  dateSold?: string;
  condition?: string;
  source?: string;
}

export interface RecordValueRange {
  low: number;
  median: number;
  high: number;
}

export interface CandidateOption {
  optionId: string;
  editionBadge: string;
  albumTitle: string;
  artist: string;
  releaseYear: string;
  label: string;
  country: string;
  catalogueNumber: string;
  matrixCode?: string;
  barcode?: string;
  format?: string;
  genre?: string; // Broad macro-category (e.g. "Rock", "Jazz", "Funk / Soul")
  styles?: string[]; // Up to 3 specific sub-genres (e.g. ["Prog Rock", "Psychedelic Rock", "Art Rock"])
  coverArtUrl: string;
  baseMintValue: RecordValueRange;
  marketNotes?: string;
  tracklist?: TrackItem[];
}

export interface RecordScanResult {
  id: string;
  albumTitle: string;
  artist: string;
  releaseYear: string;
  label: string;
  country: string;
  catalogueNumber: string;
  matrixCode?: string;
  barcode?: string;
  format?: string; // e.g. "LP, Album, Stereo, Gatefold"
  genre?: string; // Broad macro-category (e.g. "Rock", "Jazz")
  styles?: string[]; // Up to 3 specific sub-genres (e.g. ["Prog Rock", "Psychedelic Rock", "Art Rock"])
  coverArtUrl?: string;
  tracklist: TrackItem[];
  baseMintValue: RecordValueRange;
  isAmbiguous: boolean;
  ambiguityMessage?: string;
  groundingSources: GroundingSource[];
  marketNotes?: string;
  pressingsFoundCount?: number;
  queryDurationMs?: number;
  liveSearchEngine?: string;
  candidateOptions?: CandidateOption[];
}

export type ObiCondition = GoldmineGrade | 'N/A';

export interface PackageInclusions {
  printedInnerSleeve: boolean;
  lyricsInsert: boolean;
  bookletLinerNotes: boolean;
  originalPoster: boolean;
  photosPostcards: boolean;
}

export interface ValuationAdjustmentItem {
  feature: string;
  impactType: 'increase' | 'decrease' | 'neutral';
  amountSGD: number;
  percentage: number;
  explanation?: string;
}

export interface DetailedValuationBreakdown {
  baselineValue: RecordValueRange;
  mediaGrade: GoldmineGrade;
  sleeveGrade: GoldmineGrade;
  obiCondition: ObiCondition;
  obiAdjustment?: ValuationAdjustmentItem;
  packageInclusions?: PackageInclusions;
  inclusionsAdjustments?: ValuationAdjustmentItem[];
  freeTextNotes?: string;
  freeTextAdjustments: ValuationAdjustmentItem[];
  netAdditionalAdjustmentSGD: number;
  finalValuation: RecordValueRange;
  valuationRationale: string;
}

export interface ShelfItem extends RecordScanResult {
  mediaGrade: GoldmineGrade;
  sleeveGrade: GoldmineGrade;
  obiCondition?: ObiCondition;
  packageInclusions?: PackageInclusions;
  freeTextNotes?: string;
  valuationBreakdown?: DetailedValuationBreakdown;
  calculatedValue: RecordValueRange;
  purchasePrice?: number;
  // ISO date string (yyyy-mm-dd) for when this copy was purchased. Defaults to the
  // day it's added to the shelf, but is user-editable.
  purchaseDate?: string;
  acquisitionCountry?: string;
  acquisitionTransactionType?: string;
  customNotes?: string;
  addedAt: string;
  // Which physical storage Box this record is filed in (Organise tab). Missing/unknown
  // box id means it falls into the virtual "Uncategorised" box.
  boxId?: string;
  // Set when a record's data (typically grading) was defaulted/guessed rather than
  // confirmed — e.g. during a bulk import where the source had a missing or
  // non-standard grade. Surfaced as a "Needs Review" badge/filter so the owner can
  // check the physical record and confirm or correct it.
  needsReview?: boolean;
  reviewNotes?: string;
  // Cached Discogs release id, saved after the first successful marketplace lookup so
  // later polls skip the search step (one API call per record instead of two).
  discogsReleaseId?: string;
  // Observed marketplace readings, oldest first, at most one per day. Each entry is what
  // the cheapest copy was actually LISTED at on that date — a real measurement, unlike
  // calculatedValue which is the app's own estimate. Discogs does not expose sold prices
  // or any history via its API, so this series can only be built forward from first use.
  marketObservations?: MarketObservation[];
  // Snapshot log of grading/value changes over time, newest first. Appended to (not
  // overwritten) whenever a save actually changes mediaGrade, sleeveGrade, obiCondition,
  // or calculatedValue.median — a running history rather than only the current state.
  history?: ValueHistoryEntry[];
}

export interface MarketObservation {
  date: string; // YYYY-MM-DD
  // Converted to SGD (the app's native unit) at capture time, so it lines up with
  // calculatedValue without needing the original rate later.
  lowestPriceSGD: number;
  // Discogs' suggested price for THIS record's actual media grade, in SGD. Far better than
  // lowestPriceSGD as a valuation, since the latter is just the cheapest listing at any
  // condition. Absent when the token isn't seller-authorized or Discogs has no suggestion
  // for that grade.
  gradedValueSGD?: number;
  // What Discogs actually reported, kept for traceability.
  rawPrice: number;
  rawCurrency: string;
  numForSale: number;
}

export interface ValueHistoryEntry {
  date: string; // ISO timestamp
  mediaGrade: GoldmineGrade;
  sleeveGrade: GoldmineGrade;
  obiCondition?: ObiCondition;
  calculatedValue: RecordValueRange;
  note?: string;
}

// A user-defined physical storage location (e.g. "Crate 2", "Living Room Shelf A").
export interface VinylBox {
  id: string;
  name: string;
  createdAt: string;
}

export const UNCATEGORISED_BOX_ID = "uncategorised";

export type WantlistPriority = "low" | "medium" | "high";

// A record the user is looking to acquire — separate from the owned shelf.
export interface WantlistItem {
  id: string;
  artist: string;
  albumTitle: string;
  notes?: string;
  targetPriceSGD?: number;
  priority: WantlistPriority;
  addedAt: string;
}

export interface SearchQueryParams {
  catalogueNumber?: string;
  matrixCode?: string;
  barcode?: string;
  artistAlbum?: string;
  recordLabel?: string;
  imageBase64?: string;
  deepSearch?: boolean;
}
