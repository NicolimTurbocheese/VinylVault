import { GoldmineGrade } from "../types";

export type WizardMode = "media" | "sleeve";

export interface WizardQuestion {
  prompt: string;
  helper?: string;
  options: { label: string; score: number }[];
}

// Each question's options are ordered best (score 0) to worst (score 3), mirroring how
// Goldmine grading works in practice: a record's final grade reflects the cumulative
// effect of its flaws, not any single defect in isolation. This is a starting-point
// heuristic to help decide between adjacent grades (e.g. "is this VG+ or VG?") --
// not a replacement for hands-on expert grading, which the result screen says plainly.
export const MEDIA_QUESTIONS: WizardQuestion[] = [
  {
    prompt: "Does the record play from start to finish without skipping or repeating?",
    options: [
      { label: "Yes, plays perfectly", score: 0 },
      { label: "Yes, but with occasional light static/pop", score: 1 },
      { label: "Mostly, with a few brief skips", score: 2 },
      { label: "No — skips, repeats, or won't track", score: 3 },
    ],
  },
  {
    prompt: "Is there any audible surface noise or crackle during quiet passages?",
    options: [
      { label: "None — dead quiet", score: 0 },
      { label: "Very slight, only noticeable with headphones", score: 1 },
      { label: "Noticeable but doesn't overpower the music", score: 2 },
      { label: "Heavy — competes with the music", score: 3 },
    ],
  },
  {
    prompt: "Hold the record up to a light at an angle — do you see any scuffs, scratches, or marks?",
    options: [
      { label: "None visible", score: 0 },
      { label: "Light hairline marks only", score: 1 },
      { label: "Visible scratches you can feel with a fingernail", score: 2 },
      { label: "Deep gouges or heavy scuffing", score: 3 },
    ],
  },
  {
    prompt: "Any visible signs of groove wear — a dulled or whitish tint in the grooves?",
    options: [
      { label: "None", score: 0 },
      { label: "Slight", score: 1 },
      { label: "Moderate", score: 2 },
      { label: "Heavy", score: 3 },
    ],
  },
  {
    prompt: "Does the vinyl still have its original shine/gloss, or does it look dull?",
    options: [
      { label: "Full original gloss", score: 0 },
      { label: "Slightly dulled", score: 1 },
      { label: "Noticeably dulled", score: 2 },
      { label: "Very dull / matte looking", score: 3 },
    ],
  },
];

export const SLEEVE_QUESTIONS: WizardQuestion[] = [
  {
    prompt: "Are there any seam splits (open edges) on the sleeve?",
    options: [
      { label: "None", score: 0 },
      { label: "One minor split, under an inch", score: 1 },
      { label: "One major split, or split along a full edge", score: 2 },
      { label: "Multiple splits / falling apart", score: 3 },
    ],
  },
  {
    prompt: "Is there ring wear (a circular impression from the record) visible on the sleeve?",
    options: [
      { label: "None", score: 0 },
      { label: "Slight, barely visible", score: 1 },
      { label: "Moderate, clearly visible", score: 2 },
      { label: "Heavy, prominent ring", score: 3 },
    ],
  },
  {
    prompt: "Any writing, stickers, or tape on the sleeve?",
    options: [
      { label: "None", score: 0 },
      { label: "Small price sticker only", score: 1 },
      { label: "Writing, or a larger sticker", score: 2 },
      { label: "Heavy writing, tape, or damage from removal", score: 3 },
    ],
  },
  {
    prompt: "Are the corners and edges sharp, or worn/frayed?",
    options: [
      { label: "Sharp", score: 0 },
      { label: "Slightly worn", score: 1 },
      { label: "Noticeably worn", score: 2 },
      { label: "Frayed or torn", score: 3 },
    ],
  },
  {
    prompt: "Overall, does the artwork/print look bright and fresh, or faded?",
    options: [
      { label: "Bright and fresh", score: 0 },
      { label: "Slightly faded", score: 1 },
      { label: "Noticeably faded", score: 2 },
      { label: "Very faded or damaged", score: 3 },
    ],
  },
];

// Total score range is 0-15 across 5 questions. Boundaries are deliberately generous at
// the top (a single "slightly dulled" answer shouldn't knock a record out of NM) and
// steeper at the bottom (multiple real defects compound quickly toward G/F-P).
export function scoreToGrade(totalScore: number): GoldmineGrade {
  if (totalScore === 0) return "M";
  if (totalScore <= 2) return "NM";
  if (totalScore <= 5) return "VG+";
  if (totalScore <= 8) return "VG";
  if (totalScore <= 11) return "G";
  return "F_P";
}
