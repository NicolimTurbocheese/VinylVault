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
  storeLocation?: string;
  physicalShelfLocation?: string;
  customNotes?: string;
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
