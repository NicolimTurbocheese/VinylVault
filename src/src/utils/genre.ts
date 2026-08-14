/**
 * Two-tiered Discogs Genre Framework Utility
 * Normalizes album metadata into:
 * 1. Macro-category (Genre): Exactly ONE broad Discogs category.
 * 2. Sub-genres (Styles): Up to THREE specific styles/sub-genres.
 */

export const DISCOGS_MACRO_GENRES = [
  "Rock",
  "Electronic",
  "Pop",
  "Folk, World, & Country",
  "Jazz",
  "Funk / Soul",
  "Hip Hop",
  "Classical",
  "Latin",
  "Blues",
  "Reggae",
  "Stage & Screen",
  "Non-Music",
  "Children's",
  "Brass & Military"
] as const;

export type DiscogsMacroGenre = typeof DISCOGS_MACRO_GENRES[number];

/**
 * Maps sub-genre/style keywords or legacy string tokens to the official Discogs macro-category.
 */
export function matchMacroGenre(input: string): DiscogsMacroGenre {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  if (/\b(jazz|bebop|modal|cool jazz|fusion|bossa|post-bop|hard bop|swing|big band)\b/i.test(lower)) {
    return "Jazz";
  }
  if (/\b(funk|soul|r&b|rhythm & blues|disco|motown|neo soul|boogie)\b/i.test(lower)) {
    return "Funk / Soul";
  }
  if (/\b(hip hop|hip-hop|rap|boom bap|trap|g-funk|conscious|turntablism)\b/i.test(lower)) {
    return "Hip Hop";
  }
  if (/\b(electronic|house|techno|ambient|electro|downtempo|trance|synth-pop|synthpop|edm|industrial|synthwave|vaporwave|dubstep|idm|breakbeat|drum n bass|garage)\b/i.test(lower)) {
    return "Electronic";
  }
  if (/\b(folk|country|bluegrass|americana|world|celtic|african|flamenco|fado|bossa nova|chanson|zydeco)\b/i.test(lower)) {
    return "Folk, World, & Country";
  }
  if (/\b(latin|salsa|samba|cumbia|tango|bossa|mambo|reggaeton|tejano)\b/i.test(lower)) {
    return "Latin";
  }
  if (/\b(blues|delta blues|electric blues|chicago blues|country blues)\b/i.test(lower)) {
    return "Blues";
  }
  if (/\b(reggae|dub|roots|dancehall|ska|rocksteady|soca)\b/i.test(lower)) {
    return "Reggae";
  }
  if (/\b(classical|baroque|romantic|opera|symphony|choral|chamber|contemporary classical|orchestral)\b/i.test(lower)) {
    return "Classical";
  }
  if (/\b(soundtrack|score|musical|stage & screen|theme|movie|film|vocal)\b/i.test(lower)) {
    return "Stage & Screen";
  }
  if (/\b(pop|synth-pop|dance-pop|k-pop|j-pop|indie pop|art pop|chanson|teen pop|bubblegum)\b/i.test(lower)) {
    return "Pop";
  }
  if (/\b(rock|hard rock|prog|psychedelic|punk|metal|grunge|alternative|indie|glam|new wave|post-punk|garage|art rock|classic rock|soft rock|rock & roll)\b/i.test(lower)) {
    return "Rock";
  }

  // Fallback direct match with DISCOGS_MACRO_GENRES
  for (const macro of DISCOGS_MACRO_GENRES) {
    if (lower.includes(macro.toLowerCase())) {
      return macro;
    }
  }

  return "Rock";
}

export interface TwoTierGenre {
  genre: DiscogsMacroGenre;
  styles: string[];
}

/**
 * Normalizes input raw genre & styles strings or arrays into the two-tiered Discogs framework.
 * Output: { genre: DiscogsMacroGenre, styles: string[] (max 3) }
 */
export function normalizeDiscogsGenre(
  rawGenre?: string | string[],
  rawStyles?: string | string[]
): TwoTierGenre {
  let genreInput = "";
  if (Array.isArray(rawGenre)) {
    genreInput = rawGenre.join(" / ");
  } else if (rawGenre) {
    genreInput = rawGenre;
  }

  let stylesInput: string[] = [];
  if (Array.isArray(rawStyles)) {
    stylesInput = rawStyles;
  } else if (rawStyles) {
    stylesInput = rawStyles.split(/[,/•]/).map(s => s.trim()).filter(Boolean);
  }

  // Also parse embedded styles from rawGenre if it contains slashes or commas e.g. "Rock / Prog Rock"
  const rawGenreParts = genreInput.split(/[,/•]/).map(s => s.trim()).filter(Boolean);

  // Determine the single macro-category
  let selectedMacro: DiscogsMacroGenre | null = null;

  // First check if any part in rawGenre explicitly matches a Discogs macro genre
  for (const part of rawGenreParts) {
    for (const macro of DISCOGS_MACRO_GENRES) {
      if (part.toLowerCase() === macro.toLowerCase()) {
        selectedMacro = macro;
        break;
      }
    }
    if (selectedMacro) break;
  }

  // If no exact match, infer macro-category from all available text
  if (!selectedMacro) {
    const combinedText = [genreInput, ...stylesInput].join(" ");
    selectedMacro = matchMacroGenre(combinedText);
  }

  // Collect candidate sub-genres/styles
  const allCandidates: string[] = [];
  for (const part of [...stylesInput, ...rawGenreParts]) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Skip if it's identical to the chosen macro-category
    if (trimmed.toLowerCase() === selectedMacro.toLowerCase()) continue;

    // Avoid duplicate tokens (case-insensitive)
    if (!allCandidates.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      allCandidates.push(trimmed);
    }
  }

  // Cap sub-genres (Styles) at up to 3
  const styles = allCandidates.slice(0, 3);

  return {
    genre: selectedMacro,
    styles,
  };
}

/**
 * Formats two-tiered genre into a clean display string.
 * Example: "Rock • Prog Rock, Psychedelic Rock, Art Rock" or "Rock"
 */
export function formatGenreDisplay(genre?: string, styles?: string[]): string {
  const norm = normalizeDiscogsGenre(genre, styles);
  if (norm.styles.length > 0) {
    return `${norm.genre} • ${norm.styles.join(", ")}`;
  }
  return norm.genre;
}
