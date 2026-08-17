const SUBGENRES_STORAGE_KEY = "vinylvault_subgenres";

// Seeded from every style already used across the app's genre-classification work,
// so the picker isn't empty on first use.
const DEFAULT_SUBGENRES = [
  "Prog Rock", "Psychedelic Rock", "Art Rock", "Classic Rock", "Pop Rock", "Merseybeat",
  "Hard Rock", "Heavy Metal", "Soft Rock", "Arena Rock", "Blues Rock", "Surf",
  "Emo", "Indie Rock", "Rock & Roll",
  "Bebop", "Hard Bop", "Cool Jazz", "Big Band", "Swing", "Bossa Nova", "Dixieland",
  "Jazz-Funk", "Fusion", "Gypsy Jazz", "Vocal",
  "Disco", "Quiet Storm", "Rhythm & Blues",
  "Folk", "Indie Folk", "Country", "Chanson", "Folk Rock",
  "Christmas", "Opera", "Romantic", "Baroque", "Choral", "Ballet",
];

export function getStoredSubgenres(): string[] {
  const raw = localStorage.getItem(SUBGENRES_STORAGE_KEY);
  if (!raw) {
    saveSubgenresToLocal(DEFAULT_SUBGENRES);
    return [...DEFAULT_SUBGENRES];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_SUBGENRES];
  } catch {
    return [...DEFAULT_SUBGENRES];
  }
}

export function saveSubgenresToLocal(subgenres: string[]) {
  const deduped = Array.from(new Set(subgenres.map((s) => s.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  localStorage.setItem(SUBGENRES_STORAGE_KEY, JSON.stringify(deduped));
}
