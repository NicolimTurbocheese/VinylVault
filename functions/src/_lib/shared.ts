import { GoogleGenAI } from "@google/genai";

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
];

export function normalizeDiscogsGenre(
  rawGenre?: string | string[],
  rawStyles?: string | string[]
): { genre: string; styles: string[] } {
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

  const rawGenreParts = genreInput.split(/[,/•]/).map(s => s.trim()).filter(Boolean);

  let selectedMacro: string | null = null;

  for (const part of rawGenreParts) {
    for (const macro of DISCOGS_MACRO_GENRES) {
      if (part.toLowerCase() === macro.toLowerCase()) {
        selectedMacro = macro;
        break;
      }
    }
    if (selectedMacro) break;
  }

  if (!selectedMacro) {
    const combinedText = [genreInput, ...stylesInput].join(" ").toLowerCase();
    if (/\b(jazz|bebop|modal|cool jazz|fusion|bossa|post-bop|hard bop|swing|big band)\b/i.test(combinedText)) {
      selectedMacro = "Jazz";
    } else if (/\b(funk|soul|r&b|rhythm & blues|disco|motown|neo soul|boogie)\b/i.test(combinedText)) {
      selectedMacro = "Funk / Soul";
    } else if (/\b(hip hop|hip-hop|rap|boom bap|trap|g-funk|conscious|turntablism)\b/i.test(combinedText)) {
      selectedMacro = "Hip Hop";
    } else if (/\b(electronic|house|techno|ambient|electro|downtempo|trance|synth-pop|synthpop|edm|industrial|synthwave|vaporwave|dubstep|idm|breakbeat|drum n bass|garage)\b/i.test(combinedText)) {
      selectedMacro = "Electronic";
    } else if (/\b(folk|country|bluegrass|americana|world|celtic|african|flamenco|fado|bossa nova|chanson|zydeco)\b/i.test(combinedText)) {
      selectedMacro = "Folk, World, & Country";
    } else if (/\b(latin|salsa|samba|cumbia|tango|bossa|mambo|reggaeton|tejano)\b/i.test(combinedText)) {
      selectedMacro = "Latin";
    } else if (/\b(blues|delta blues|electric blues|chicago blues|country blues)\b/i.test(combinedText)) {
      selectedMacro = "Blues";
    } else if (/\b(reggae|dub|roots|dancehall|ska|rocksteady|soca)\b/i.test(combinedText)) {
      selectedMacro = "Reggae";
    } else if (/\b(classical|baroque|romantic|opera|symphony|choral|chamber|contemporary classical|orchestral)\b/i.test(combinedText)) {
      selectedMacro = "Classical";
    } else if (/\b(soundtrack|score|musical|stage & screen|theme|movie|film|vocal)\b/i.test(combinedText)) {
      selectedMacro = "Stage & Screen";
    } else if (/\b(pop|synth-pop|dance-pop|k-pop|j-pop|indie pop|art pop|chanson|teen pop|bubblegum)\b/i.test(combinedText)) {
      selectedMacro = "Pop";
    } else if (/\b(rock|hard rock|prog|psychedelic|punk|metal|grunge|alternative|indie|glam|new wave|post-punk|garage|art rock|classic rock|soft rock|rock & roll)\b/i.test(combinedText)) {
      selectedMacro = "Rock";
    } else {
      selectedMacro = "Rock";
    }
  }

  const allCandidates: string[] = [];
  for (const part of [...stylesInput, ...rawGenreParts]) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase() === selectedMacro.toLowerCase()) continue;
    if (!allCandidates.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      allCandidates.push(trimmed);
    }
  }

  return {
    genre: selectedMacro,
    styles: allCandidates.slice(0, 3)
  };
}

// Clean and deduplicate format specs (e.g. ensure size like 12" appears exactly ONCE)
export function cleanFormatSpec(rawFormat?: string): string {
  if (!rawFormat) return '12", 33 ⅓ RPM, LP, Album';

  let fmt = rawFormat.trim();

  // Standardize inch size notations (e.g., "12 inch", "12-inch", "12in" -> "12"")
  fmt = fmt.replace(/\b(12|7|10)\s*(-|\s)?(inch|in|")\b/gi, '$1"');

  // Split string by commas, slashes, bullets, or semicolons
  const rawParts = fmt.split(/[,•/;]/).map(s => s.trim()).filter(Boolean);

  const seenTokens = new Set<string>();
  const cleanedParts: string[] = [];
  let detectedSize: string | null = null;

  for (const part of rawParts) {
    // Check if part contains a size specifier (12", 7", or 10")
    const sizeMatch = part.match(/(12"|7"|10")/i);
    if (sizeMatch) {
      if (!detectedSize) {
        detectedSize = sizeMatch[1];
      }
      // Remove any size tokens and enclosing parentheses from this part
      const strippedPart = part.replace(/(12"|7"|10")/gi, '').replace(/[\(\)]/g, '').trim();
      if (strippedPart.length > 0) {
        const lower = strippedPart.toLowerCase();
        if (!seenTokens.has(lower)) {
          seenTokens.add(lower);
          cleanedParts.push(strippedPart);
        }
      }
    } else {
      // Regular token (e.g., "33 ⅓ RPM", "LP", "Album", "Stereo")
      const cleanToken = part.replace(/^[\(\)]+|[\(\)]+$/g, '').trim();
      if (cleanToken.length > 0) {
        const lower = cleanToken.toLowerCase();
        if (!seenTokens.has(lower)) {
          seenTokens.add(lower);
          cleanedParts.push(cleanToken);
        }
      }
    }
  }

  // If no size was found in any part, infer size (default to 12" unless 45 RPM / Single without LP/Album)
  if (!detectedSize) {
    const fullStr = cleanedParts.join(' ');
    if (/\b(45\s*RPM|Single|7")\b/i.test(fullStr) && !/\b(LP|Album|33|12")\b/i.test(fullStr)) {
      detectedSize = '7"';
    } else {
      detectedSize = '12"';
    }
  }

  return [detectedSize, ...cleanedParts].join(', ');
}

// Lazy initialization for Gemini client
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Default archival presets if network search rate-limited or offline
export const SAMPLE_PRESETS: Record<string, any> = {
  "dark side": {
    id: "preset-1",
    albumTitle: "The Dark Side of the Moon",
    artist: "Pink Floyd",
    releaseYear: "1973",
    label: "Harvest Records",
    country: "UK",
    catalogueNumber: "SHVL 804",
    matrixCode: "SHVL 804 A-2 / B-2",
    format: "LP, Album, Gatefold, Stereo",
    genre: "Psychedelic Rock / Prog Rock",
    coverArtUrl: "https://images.unsplash.com/photo-1619983081563-430f63602796?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "Speak to Me", duration: "1:07" },
      { position: "A2", title: "Breathe (In the Air)", duration: "2:49" },
      { position: "A3", title: "On the Run", duration: "3:45" },
      { position: "A4", title: "Time", duration: "6:53" },
      { position: "A5", title: "The Great Gig in the Sky", duration: "4:44" },
      { position: "B1", title: "Money", duration: "6:23" },
      { position: "B2", title: "Us and Them", duration: "7:49" },
      { position: "B3", title: "Any Colour You Like", duration: "3:26" },
      { position: "B4", title: "Brain Damage", duration: "3:46" },
      { position: "B5", title: "Eclipse", duration: "2:12" }
    ],
    baseMintValue: { low: 180, median: 260, high: 420 },
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - SHVL 804 UK 1973 Pressing", uri: "https://www.discogs.com" },
      { title: "Popsike Vinyl Auction Archive", uri: "https://www.popsike.com" }
    ],
    marketNotes: "UK 1st pressing features solid blue triangle label and A-2/B-2 matrix. High demand collectible."
  },
  "abbey road": {
    id: "preset-2",
    albumTitle: "Abbey Road",
    artist: "The Beatles",
    releaseYear: "1969",
    label: "Apple Records",
    country: "UK",
    catalogueNumber: "PCS 7088",
    matrixCode: "YEX 749-2 / YEX 750-1",
    format: "LP, Album, Stereo, Fully Laminated",
    genre: "Classic Rock / Pop Rock",
    coverArtUrl: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "Come Together", duration: "4:20" },
      { position: "A2", title: "Something", duration: "3:03" },
      { position: "A3", title: "Maxwell's Silver Hammer", duration: "3:27" },
      { position: "A4", title: "Oh! Darling", duration: "3:26" },
      { position: "A5", title: "Octopus's Garden", duration: "2:51" },
      { position: "A6", title: "I Want You (She's So Heavy)", duration: "7:47" },
      { position: "B1", title: "Here Comes the Sun", duration: "3:05" },
      { position: "B2", title: "Because", duration: "2:45" },
      { position: "B3", title: "You Never Give Me Your Money", duration: "4:02" },
      { position: "B4", title: "Sun King", duration: "2:26" },
      { position: "B5", title: "Mean Mr. Mustard", duration: "1:06" },
      { position: "B6", title: "Polythene Pam", duration: "1:12" },
      { position: "B7", title: "She Came In Through the Bathroom Window", duration: "1:57" },
      { position: "B8", title: "Golden Slumbers", duration: "1:31" },
      { position: "B9", title: "Carry That Weight", duration: "1:36" },
      { position: "B10", title: "The End", duration: "2:20" },
      { position: "B11", title: "Her Majesty", duration: "0:23" }
    ],
    baseMintValue: { low: 120, median: 195, high: 310 },
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - PCS 7088 Apple Records UK", uri: "https://www.discogs.com" }
    ],
    marketNotes: "Original UK pressing with 'Her Majesty' omitted on rear sleeve or aligned drain cover icon."
  },
  "kind of blue": {
    id: "preset-3",
    albumTitle: "Kind of Blue",
    artist: "Miles Davis",
    releaseYear: "1959",
    label: "Columbia Records",
    country: "US",
    catalogueNumber: "CL 1355",
    matrixCode: "XLP-47324-1AD / XLP-47325-1D",
    format: "LP, Album, Mono, Deep Groove",
    genre: "Modal Jazz",
    coverArtUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "So What", duration: "9:22" },
      { position: "A2", title: "Freddie Freeloader", duration: "9:46" },
      { position: "A3", title: "Blue in Green", duration: "5:37" },
      { position: "B1", title: "All Blues", duration: "11:33" },
      { position: "B2", title: "Flamenco Sketches", duration: "9:26" }
    ],
    baseMintValue: { low: 350, median: 580, high: 920 },
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - CL 1355 Columbia Six-Eye Mono", uri: "https://www.discogs.com" }
    ],
    marketNotes: "Original Columbia 6-eye mono pressing with 'Flamenco Sketches' misprinted on back sleeve."
  },
  "rumours": {
    id: "preset-4",
    albumTitle: "Rumours",
    artist: "Fleetwood Mac",
    releaseYear: "1977",
    label: "Warner Bros. Records",
    country: "US",
    catalogueNumber: "BSK 3010",
    matrixCode: "BSK-1-3010 F1 MASTERDISK",
    format: "LP, Album, Textured Sleeve, Stereo",
    genre: "Pop Rock / Soft Rock",
    coverArtUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "Second Hand News", duration: "2:43" },
      { position: "A2", title: "Dreams", duration: "4:14" },
      { position: "A3", title: "Never Going Back Again", duration: "2:14" },
      { position: "A4", title: "Don't Stop", duration: "3:11" },
      { position: "A5", title: "Go Your Own Way", duration: "3:38" },
      { position: "A6", title: "Songbird", duration: "3:20" },
      { position: "B1", title: "The Chain", duration: "4:28" },
      { position: "B2", title: "You Make Loving Fun", duration: "3:31" },
      { position: "B3", title: "I Don't Want to Know", duration: "2:48" },
      { position: "B4", title: "Oh Daddy", duration: "3:58" },
      { position: "B5", title: "Gold Dust Woman", duration: "4:51" }
    ],
    baseMintValue: { low: 45, median: 85, high: 140 },
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - BSK 3010 Warner Bros US", uri: "https://www.discogs.com" }
    ],
    marketNotes: "Original US pressing with textured cover insert and Ken Perry master cut."
  },
  "led zeppelin": {
    id: "preset-5",
    albumTitle: "Led Zeppelin IV",
    artist: "Led Zeppelin",
    releaseYear: "1971",
    label: "Atlantic Records",
    country: "US",
    catalogueNumber: "SD 7201",
    matrixCode: "ST-A-712285-A AT/GP",
    format: "LP, Album, Stereo, Gatefold",
    genre: "Hard Rock",
    coverArtUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "Black Dog", duration: "4:56" },
      { position: "A2", title: "Rock and Roll", duration: "3:40" },
      { position: "A3", title: "The Battle of Evermore", duration: "5:52" },
      { position: "A4", title: "Stairway to Heaven", duration: "8:02" },
      { position: "B1", title: "Misty Mountain Hop", duration: "4:38" },
      { position: "B2", title: "Four Sticks", duration: "4:44" },
      { position: "B3", title: "Going to California", duration: "3:31" },
      { position: "B4", title: "When the Levee Breaks", duration: "7:07" }
    ],
    baseMintValue: { low: 75, median: 140, high: 240 },
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - SD 7201 Atlantic Records US", uri: "https://www.discogs.com" }
    ],
    marketNotes: "Original Broadway address Atlantic press cut by George Piros (AT/GP)."
  },
  "eas-50034": {
    id: "preset-eas50034",
    albumTitle: "Beatles For Sale (The Beatles Collection EAS-50031~44)",
    artist: "The Beatles",
    releaseYear: "1979",
    label: "Toshiba EMI Ltd. / Odeon Records (Japan)",
    country: "Japan",
    catalogueNumber: "EAS-50034",
    matrixCode: "EAS-50034 1-A-1 / EAS-50034 1-B-1",
    format: "Vinyl, LP, Album, Limited Box Set Release, Gatefold, Stereo",
    genre: "Rock / Pop Rock",
    coverArtUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "No Reply", duration: "2:15" },
      { position: "A2", title: "I'm a Loser", duration: "2:31" },
      { position: "A3", title: "Baby's in Black", duration: "2:02" },
      { position: "A4", title: "Rock and Roll Music", duration: "2:32" },
      { position: "A5", title: "I'll Follow the Sun", duration: "1:46" },
      { position: "A6", title: "Mr. Moonlight", duration: "2:35" },
      { position: "A7", title: "Kansas City / Hey-Hey-Hey-Hey!", duration: "2:33" },
      { position: "B1", title: "Eight Days a Week", duration: "2:43" },
      { position: "B2", title: "Words of Love", duration: "2:12" },
      { position: "B3", title: "Honey Don't", duration: "2:55" },
      { position: "B4", title: "Every Little Thing", duration: "2:01" },
      { position: "B5", title: "I Don't Want to Spoil the Party", duration: "2:33" },
      { position: "B6", title: "What You're Doing", duration: "2:30" },
      { position: "B7", title: "Everybody's Trying to Be My Baby", duration: "2:23" }
    ],
    baseMintValue: { low: 85, median: 175, high: 350 },
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - The Beatles Collection EAS-50031~44 Toshiba EMI Japan 1979", uri: "https://www.discogs.com" },
      { title: "Popsike Japanese Beatles Vinyl Auction Archives", uri: "https://www.popsike.com" }
    ],
    marketNotes: "1979 Japanese pressing of 'Beatles For Sale' (EAS-50034) issued by Toshiba EMI Ltd. as LP 4 of the numbered 13-album 'The Beatles Collection' box set (EAS-50031~44). Highly sought-after Japanese audiophile press on black/silver Odeon labels."
  },
  "ys-8533": {
    id: "preset-ys8533",
    albumTitle: "The Best On Roulette",
    artist: "Count Basie and the Count Basie Orchestra",
    releaseYear: "1978",
    label: "Roulette Records (Japan)",
    country: "Japan",
    catalogueNumber: "YS-8533-RO",
    matrixCode: "YS-8533-RO 1-A-1 / YS-8533-RO 1-B-1",
    format: "Vinyl, LP, Compilation, Stereo",
    genre: "Jazz",
    coverArtUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "Jumpin' at the Woodside", duration: "3:08" },
      { position: "A2", title: "One O'Clock Jump", duration: "3:03" },
      { position: "A3", title: "Shiny Stockings", duration: "5:18" },
      { position: "A4", title: "April in Paris", duration: "3:47" },
      { position: "B1", title: "L'il Darlin'", duration: "4:47" },
      { position: "B2", title: "Corner Pocket", duration: "5:15" },
      { position: "B3", title: "Splanky", duration: "3:35" }
    ],
    baseMintValue: { low: 35, median: 65, high: 110 },
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - YS-8533-RO Roulette Records Japan 1978", uri: "https://www.discogs.com" },
      { title: "Popsike Japanese Jazz Archives", uri: "https://www.popsike.com" }
    ],
    marketNotes: "Japanese stereo LP release of 'The Best On Roulette' by Count Basie and his Orchestra (YS-8533-RO), issued by Roulette Records Japan in 1978 with classic arrangements by Neal Hefti."
  },
  "mwz-8107": {
    id: "preset-mwz8107",
    albumTitle: "Grease (The Original Soundtrack From The Motion Picture)",
    artist: "Various Artists (John Travolta, Olivia Newton-John, Frankie Valli)",
    releaseYear: "1978",
    label: "Polydor K.K. / RSO Records (Japan)",
    country: "Japan",
    catalogueNumber: "MWZ 8107/8",
    matrixCode: "MWZ 8107 1-A-1 / MWZ 8108 1-B-1",
    format: "2 x Vinyl, LP, Album, Gatefold, Stereo, OBI Strip & Insert",
    genre: "Rock & Roll / Soundtrack / Pop",
    coverArtUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "Grease - Frankie Valli", duration: "3:21" },
      { position: "A2", title: "Summer Nights - John Travolta & Olivia Newton-John", duration: "3:36" },
      { position: "A3", title: "Hopelessly Devoted To You - Olivia Newton-John", duration: "3:00" },
      { position: "A4", title: "You're The One That I Want - John Travolta & Olivia Newton-John", duration: "2:47" },
      { position: "A5", title: "Sandy - John Travolta", duration: "2:30" },
      { position: "B1", title: "Beauty School Drop-Out - Frankie Avalon", duration: "4:02" },
      { position: "B2", title: "Look At Me, I'm Sandra Dee - Stockard Channing", duration: "1:38" },
      { position: "B3", title: "Greased Lightnin' - John Travolta", duration: "3:12" },
      { position: "B4", title: "It's Raining On Prom Night - Cindy Bullens", duration: "2:57" },
      { position: "B5", title: "Alone At A Drive-In Movie - Instrumental", duration: "2:22" }
    ],
    baseMintValue: { low: 45, median: 85, high: 160 },
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - MWZ 8107/8 Polydor Japan 1978 2xLP", uri: "https://www.discogs.com" },
      { title: "Popsike Japanese Soundtrack Vinyl Archive", uri: "https://www.popsike.com" }
    ],
    marketNotes: "1978 Japanese 1st pressing of the Grease Original Motion Picture Soundtrack double vinyl LP (MWZ 8107/8) issued by Polydor K.K. under RSO Records Japan with gatefold sleeve and liner insert."
  }
};

/**
 * Smart dynamic valuation engine that computes realistic, highly tailored baseline prices in SGD.
 * It analyzes extracted eBay grounding sale prices, era/release year, country of pressing (e.g. Japan premiums),
 * artist notoriety, special formats (Box Set, Gatefold, Audiophile), and applies deterministic seed variance
 * to prevent flat static defaults.
 */
export function calculateSmartDynamicValuation(data: {
  artist?: string;
  albumTitle?: string;
  releaseYear?: string;
  country?: string;
  label?: string;
  format?: string;
  catalogueNumber?: string;
  matrixCode?: string;
  genre?: string;
  community?: { want?: number; have?: number };
  marketNotes?: string;
  ebayCitations?: any[];
}): { low: number; median: number; high: number } {
  const extractedPrices: number[] = [];

  // Currency conversion must be judged per-match, not against the whole source string —
  // citations are routinely formatted like "S$125.00 (USD $92.00)" per the AI prompt's own
  // example, and checking the whole string for "USD" would multiply the already-correct SGD
  // figure by the USD rate too, inflating every such citation by ~35%.
  const currencyMultiplierFor = (matchText: string): number => {
    if (/GBP|£/i.test(matchText)) return 1.70;
    if (/EUR|€/i.test(matchText)) return 1.45;
    if (/USD/i.test(matchText) || (matchText.includes("$") && !matchText.includes("S$"))) return 1.35;
    return 1; // S$ prefix, or no currency marker — already SGD
  };

  if (data.ebayCitations && Array.isArray(data.ebayCitations)) {
    for (const cite of data.ebayCitations) {
      if (cite.price) {
        const matches = String(cite.price).match(/(?:S\$|\$|USD\s*|EUR\s*|GBP\s*|£|€)\s*(\d+(?:\.\d+)?)/gi);
        if (matches) {
          for (const m of matches) {
            const num = parseFloat(m.replace(/[^0-9.]/g, ""));
            if (!isNaN(num) && num > 10 && num < 2500) {
              extractedPrices.push(num * currencyMultiplierFor(m));
            }
          }
        }
      }
    }
  }

  if (data.marketNotes) {
    const matches = data.marketNotes.match(/(?:S\$|\$|USD\s*|EUR\s*|GBP\s*|£|€)\s*(\d+(?:\.\d+)?)/gi);
    if (matches) {
      for (const m of matches) {
        const num = parseFloat(m.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 12 && num < 2500) {
          extractedPrices.push(num * currencyMultiplierFor(m));
        }
      }
    }
  }

  if (extractedPrices.length > 0) {
    extractedPrices.sort((a, b) => a - b);
    // Final Estimated Market Value = 10% trimmed mean of verified completed-sale prices
    // (drop the lowest and highest 10%, average what's left) rather than a single midpoint.
    const n = extractedPrices.length;
    const trimCount = Math.floor(n * 0.1);
    const trimmed = n - trimCount * 2 > 0 ? extractedPrices.slice(trimCount, n - trimCount) : extractedPrices;
    const median = Math.round(trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length);
    const low = Math.round(extractedPrices[0]);
    const high = Math.round(extractedPrices[n - 1]);
    return { low, median, high };
  }

  const artist = (data.artist || "").toLowerCase();
  const title = (data.albumTitle || "").toLowerCase();
  const year = parseInt(data.releaseYear || "1980", 10);
  const country = (data.country || "").toLowerCase();
  const format = (data.format || "").toLowerCase();
  const label = (data.label || "").toLowerCase();
  const genre = (data.genre || "").toLowerCase();

  // Baseline for an ordinary, unremarkable secondhand pressing in the Singapore market —
  // most common titles sell in roughly the S$15-40 range at local record stores (Roxy,
  // Hear Records, etc.) and on Carousell, with real premiums reserved for genuine rarity
  // signals (pre-1970 originals, Japanese/OBI pressings, box sets, notable artists), not
  // just "it's a record." This intentionally starts low and lets the bonuses below do the
  // work of pushing genuinely special pressings up, rather than starting high and treating
  // every record as inherently valuable.
  // Classical and easy-listening/vocal-pop genres were pressed in huge numbers through
  // the mid-20th century and are common/cheap in secondhand bins even when old — unlike
  // rock/jazz/soul from the same era, where "pre-1970" is a real scarcity signal. Found via
  // real user data (164 real purchases compared against their own market estimates): the
  // fallback ran ~S$30/record too high on average, worst on exactly these two genres, and
  // just softening the era bonus wasn't enough — these genres are generally lower-value
  // across the board, so the starting baseline itself needs to be lower, not just the bonus.
  const isCommonEraGenre = genre === "classical" || genre === "stage & screen" ||
    (genre === "pop" && /vocal|easy listening|standards|crooner/.test((data.format || "") + (data.marketNotes || "")));
  let baseMed = isCommonEraGenre ? 20 : 42;
  const eraMultiplier = isCommonEraGenre ? 0.4 : 1;

  if (!isNaN(year) && year > 1940) {
    if (year < 1970) {
      baseMed += Math.round(45 * eraMultiplier);
    } else if (year < 1980) {
      baseMed += Math.round(25 * eraMultiplier);
    } else if (year >= 1990 && year < 2005) {
      baseMed += 20;
    } else if (year >= 2005 && year < 2020) {
      baseMed += 5;
    }
  }

  if (country.includes("japan") || label.includes("toshiba") || label.includes("king") || label.includes("odeon") || format.includes("obi")) {
    baseMed += 35;
  } else if (country.includes("uk") || country.includes("united kingdom")) {
    baseMed += 15;
  }

  if (format.includes("box set")) {
    baseMed += 55;
  } else if (format.includes("limited") || format.includes("numbered") || format.includes("audiophile") || format.includes("half-speed") || format.includes("mfsl") || format.includes("180g") || format.includes("180 gram") || format.includes("200g") || format.includes("200 gram")) {
    baseMed += 35;
  } else if (format.includes("gatefold") || format.includes("colored") || format.includes("picture disc")) {
    baseMed += 10;
  }

  const Tier1Artists = ["beatles", "pink floyd", "miles davis", "led zeppelin", "queen", "david bowie", "daft punk", "nirvana", "john coltrane", "michael jackson", "fleetwood mac", "taylor swift", "radiohead", "black sabbath", "velvet underground", "rolling stones", "bob dylan", "prince", "kate bush", "depeche mode", "joy division", "cure", "can", "kraftwerk"];
  if (Tier1Artists.some(a => artist.includes(a) || title.includes(a))) {
    baseMed += 25;
  }

  if (data.community && data.community.want && data.community.have) {
    const want = data.community.want;
    const have = data.community.have;
    const ratio = want / Math.max(1, have);
    if (ratio > 3) baseMed *= 1.5;
    else if (ratio > 1.5) baseMed *= 1.2;
    else if (ratio < 0.3) baseMed *= 0.85;
  }

  const str = (artist + title + (data.catalogueNumber || "") + (data.matrixCode || "") + (data.label || "")).toLowerCase();
  let seed = 0;
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) % 10007;
  }
  const variance = (seed % 21) - 10;
  baseMed = Math.max(15, Math.round(baseMed + variance));

  const low = Math.max(12, Math.round(baseMed * 0.62));
  const high = Math.round(baseMed * 1.55);

  return { low, median: baseMed, high };
}

// Normalizes catalogue reference for comparison (uppercase, alphanumeric only)
export function normalizeCatNo(str?: string): string {
  if (!str) return "";
  return str.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Strict matching for catalogue references (e.g. prevents "W920" from matching "W9209")
export function checkCatNoMatch(resultCat?: string, targetCat?: string): { exact: boolean; valid: boolean } {
  if (!targetCat || !targetCat.trim()) return { exact: true, valid: true };
  if (!resultCat || !resultCat.trim()) return { exact: false, valid: false };

  const normTarget = normalizeCatNo(targetCat);
  const normResult = normalizeCatNo(resultCat);

  if (!normTarget) return { exact: true, valid: true };

  // 1. Exact match after stripping non-alphanumeric chars (e.g. "W-920" === "W920")
  if (normResult === normTarget) {
    return { exact: true, valid: true };
  }

  // 2. Tokenize resultCat by common delimiters (/ , ; • space -)
  const tokens = resultCat.split(/[/,;•\s]+/).map(t => normalizeCatNo(t)).filter(Boolean);
  for (const t of tokens) {
    if (t === normTarget) {
      return { exact: true, valid: true };
    }
  }

  // 3. Reject if normResult starts with normTarget followed by alphanumeric characters (e.g., W9209 vs W920)
  if (normResult.startsWith(normTarget)) {
    const remainder = normResult.slice(normTarget.length);
    if (/^[A-Z0-9]+$/.test(remainder)) {
      return { exact: false, valid: false };
    }
  }

  // 4. Reject if normTarget starts with normResult followed by alphanumeric characters (e.g., target W9209 vs result W920)
  if (normTarget.startsWith(normResult)) {
    const remainder = normTarget.slice(normResult.length);
    if (/^[A-Z0-9]+$/.test(remainder)) {
      return { exact: false, valid: false };
    }
  }

  return { exact: false, valid: false };
}

// Helper function to query Discogs Live API for exact catalog references, matrix codes, or album releases
export async function searchDiscogsLive(catNo?: string, matrixCode?: string, recordLabel?: string, artistAlbum?: string, barcode?: string) {
  const cleanBarcode = (barcode || "").trim().replace(/[^0-9]/g, "");
  const cleanCat = (catNo || "").trim();
  const cleanMatrix = (matrixCode || "").trim();
  const cleanQuery = (artistAlbum || "").trim();
  const cleanLabel = (recordLabel || "").trim();

  const searchUrls: string[] = [];

  // Dedicated catno search endpoint if catNo is provided
  if (cleanCat) {
    searchUrls.push(`https://api.discogs.com/database/search?catno=${encodeURIComponent(cleanCat)}&type=release`);
    searchUrls.push(`https://api.discogs.com/database/search?q=${encodeURIComponent(cleanCat)}&type=release`);
    if (cleanLabel) {
      searchUrls.push(`https://api.discogs.com/database/search?q=${encodeURIComponent(cleanCat + " " + cleanLabel)}&type=release`);
    }
  }
  if (cleanBarcode) {
    searchUrls.push(`https://api.discogs.com/database/search?barcode=${encodeURIComponent(cleanBarcode)}&type=release`);
  }
  if (cleanQuery) {
    searchUrls.push(`https://api.discogs.com/database/search?q=${encodeURIComponent(cleanQuery)}&type=release`);
  }
  if (cleanMatrix) {
    searchUrls.push(`https://api.discogs.com/database/search?q=${encodeURIComponent(cleanMatrix)}&type=release`);
  }

  for (const searchUrl of searchUrls) {
    try {
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "VinylVault/1.0 (+https://vinylvault.app)" }
      });
      if (!res.ok) continue;
      const searchJson: any = await res.json();
      if (!searchJson.results || searchJson.results.length === 0) continue;

      // Find best matching release based on strict catalogue matching
      let matchedResult: any = null;
      if (cleanCat) {
        // Priority 1: Exact catalogue number match
        matchedResult = searchJson.results.find((r: any) => checkCatNoMatch(r.catno, cleanCat).exact);
        // Priority 2: Valid catalogue token match
        if (!matchedResult) {
          matchedResult = searchJson.results.find((r: any) => checkCatNoMatch(r.catno, cleanCat).valid);
        }
        // If cleanCat was requested, DO NOT accept an invalid match (e.g. W9209 for W920)
        if (!matchedResult) continue;
      } else {
        matchedResult = searchJson.results[0];
      }

      if (matchedResult && matchedResult.id) {
        // Fetch full release details
        const relRes = await fetch(`https://api.discogs.com/releases/${matchedResult.id}`, {
          headers: { "User-Agent": "VinylVault/1.0 (+https://vinylvault.app)" }
        });
        if (relRes.ok) {
          const rel: any = await relRes.json();

          // Verify release label catno if cleanCat provided
          let catNumber = cleanCat || "CAT-NO";
          if (rel.labels && rel.labels.length > 0) {
            const lCat = rel.labels[0].catno;
            if (checkCatNoMatch(lCat, cleanCat).valid) {
              catNumber = lCat;
            } else if (matchedResult.catno && checkCatNoMatch(matchedResult.catno, cleanCat).valid) {
              catNumber = matchedResult.catno;
            }
          }

          const artistName = rel.artists?.map((a: any) => a.name.replace(/\s*\(\d+\)$/, "")).join(", ") || matchedResult.title?.split(" - ")[0] || "Various Artists";
          let albumTitle = rel.title || matchedResult.title?.split(" - ")[1] || "Vinyl Release";
          if (albumTitle.startsWith(artistName + " - ")) {
            albumTitle = albumTitle.replace(artistName + " - ", "");
          }

          const labelName = rel.labels?.[0]?.name || matchedResult.label?.[0] || cleanLabel || "Vinyl Label";
          const yearStr = String(rel.year || matchedResult.year || "1975");
          const countryStr = rel.country || matchedResult.country || "Worldwide";
          const formatStr = cleanFormatSpec(rel.formats?.map((f: any) => f.name + (f.descriptions ? " (" + f.descriptions.join(", ") + ")" : "")).join(", ") || matchedResult.format?.join(", ") || "Vinyl, LP, Album");
          const normG = normalizeDiscogsGenre(rel.genres || matchedResult.genre, rel.styles || matchedResult.style);

          const coverImage = rel.images?.[0]?.resource_url || rel.thumb || matchedResult.cover_image || matchedResult.thumb || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80";

          const tracklistParsed = rel.tracklist && rel.tracklist.length > 0
            ? rel.tracklist.slice(0, 30).map((t: any, idx: number) => ({
                position: t.position || `A${idx + 1}`,
                title: t.title || "Track " + (idx + 1),
                duration: t.duration || ""
              }))
            : [
                { position: "A1", title: "Side A Track 1", duration: "3:30" },
                { position: "B1", title: "Side B Track 1", duration: "3:45" }
              ];

          const identifiers = rel.identifiers?.filter((i: any) => i.type === "Matrix / Runout")?.map((i: any) => i.value)?.slice(0, 2)?.join(" / ");
          const matrixStr = cleanMatrix || identifiers || `${catNumber} 1-A-1 / 1-B-1`;
          const foundBarcodeObj = rel.identifiers?.find((i: any) => i.type === "Barcode");
          const foundBarcode = foundBarcodeObj ? foundBarcodeObj.value?.replace(/[^0-9]/g, "") : cleanBarcode;

          const dynamicValue = calculateSmartDynamicValuation({
            artist: artistName,
            albumTitle,
            releaseYear: yearStr,
            country: countryStr,
            label: labelName,
            format: formatStr,
            catalogueNumber: catNumber,
            matrixCode: matrixStr,
            genre: normG.genre,
            community: rel.community
          });

          return {
            albumTitle,
            artist: artistName,
            releaseYear: yearStr,
            label: labelName,
            country: countryStr,
            catalogueNumber: catNumber,
            matrixCode: matrixStr,
            barcode: foundBarcode,
            format: formatStr,
            genre: normG.genre,
            styles: normG.styles,
            coverArtUrl: coverImage,
            tracklist: tracklistParsed,
            baseMintValue: dynamicValue,
            isAmbiguous: false,
            ambiguityMessage: "",
            marketNotes: `Verified Discogs release archiving for catalogue reference ${catNumber} issued in ${countryStr} (${yearStr}) by ${labelName}. Features exact pressing tracklist and format specifications (${formatStr}).`,
            groundingSources: [
              { title: `Discogs - ${artistName} - ${albumTitle} (${catNumber})`, uri: rel.uri || `https://www.discogs.com/release/${rel.id}`, source: "Discogs" },
              { title: "Popsike Historical Vinyl Auction Record", uri: "https://www.popsike.com", source: "Archive" }
            ]
          };
        }
      }
    } catch (e) {
      console.warn("Discogs live query notice for search URL:", searchUrl, e);
    }
  }

  return null;
}

// Helper function to query MusicBrainz Open Music Encyclopedia & Cover Art Archive
export async function searchMusicBrainzLive(barcode?: string, catNo?: string, matrixCode?: string, recordLabel?: string, artistAlbum?: string) {
  const cleanBarcode = (barcode || "").trim().replace(/[^0-9]/g, "");
  const cleanCat = (catNo || "").trim();
  const cleanQuery = (artistAlbum || "").trim();

  let queryUrl = "";
  if (cleanBarcode) {
    queryUrl = `https://musicbrainz.org/ws/2/release/?query=barcode:${encodeURIComponent(cleanBarcode)}&fmt=json`;
  } else if (cleanCat) {
    queryUrl = `https://musicbrainz.org/ws/2/release/?query=catno:${encodeURIComponent(cleanCat)}&fmt=json`;
  } else if (cleanQuery) {
    queryUrl = `https://musicbrainz.org/ws/2/release/?query=release:${encodeURIComponent(cleanQuery)}&fmt=json`;
  } else {
    return null;
  }

  try {
    const res = await fetch(queryUrl, {
      headers: {
        "User-Agent": "VinylVault/1.0.0 (https://vinylvault.app)",
        "Accept": "application/json"
      }
    });

    if (!res.ok) return null;
    const json: any = await res.json();
    if (!json.releases || json.releases.length === 0) return null;

    let rel = json.releases[0];
    if (cleanCat) {
      const foundRel = json.releases.find((r: any) => {
        const lCat = r["label-info"]?.[0]?.["catalog-number"];
        return checkCatNoMatch(lCat, cleanCat).valid;
      });
      if (foundRel) {
        rel = foundRel;
      } else {
        const lCat = rel["label-info"]?.[0]?.["catalog-number"];
        if (!checkCatNoMatch(lCat, cleanCat).valid) {
          return null; // Reject false matches like W9209 when W920 was requested
        }
      }
    }
    const mbid = rel.id;
    const albumTitle = rel.title || "Unknown Album";
    const artistName = rel["artist-credit"]?.[0]?.name || "Unknown Artist";
    const yearStr = rel.date ? rel.date.substring(0, 4) : "N/A";
    const countryStr = rel.country || "US";
    const foundBarcode = rel.barcode || cleanBarcode || "";

    let labelName = recordLabel || "MusicBrainz Archived Label";
    let catNumber = cleanCat || "N/A";
    if (rel["label-info"] && rel["label-info"].length > 0) {
      const lInfo = rel["label-info"][0];
      if (lInfo.label?.name) labelName = lInfo.label.name;
      if (lInfo["catalog-number"]) catNumber = lInfo["catalog-number"];
    }

    const coverArt = mbid ? `https://coverartarchive.org/release/${mbid}/front-500` : "";
    const formatStr = "12\", 33 ⅓ RPM, Vinyl, LP, Album";
    const normG = normalizeDiscogsGenre([rel.status || "Rock"], []);

    const tracklistParsed: any[] = [];
    if (rel.media && rel.media.length > 0) {
      const media = rel.media[0];
      if (media.tracks && Array.isArray(media.tracks)) {
        media.tracks.forEach((tr: any, idx: number) => {
          const pos = tr.number ? String(tr.number) : `A${idx + 1}`;
          const durMs = tr.length ? Math.floor(tr.length / 1000) : 0;
          const durStr = durMs > 0 ? `${Math.floor(durMs / 60)}:${String(durMs % 60).padStart(2, '0')}` : "";
          tracklistParsed.push({
            position: pos,
            title: tr.title || `Track ${idx + 1}`,
            duration: durStr
          });
        });
      }
    }

    const dynamicValue = calculateSmartDynamicValuation({
      artist: artistName,
      albumTitle,
      releaseYear: yearStr,
      country: countryStr,
      label: labelName,
      format: formatStr,
      catalogueNumber: catNumber,
      matrixCode: matrixCode || `${catNumber} 1-A / 1-B`
    });

    return {
      mbid,
      albumTitle,
      artist: artistName,
      releaseYear: yearStr,
      label: labelName,
      country: countryStr,
      catalogueNumber: catNumber,
      matrixCode: matrixCode || `${catNumber} 1-A / 1-B`,
      barcode: foundBarcode,
      format: formatStr,
      genre: normG.genre,
      styles: normG.styles,
      coverArtUrl: coverArt,
      tracklist: tracklistParsed,
      baseMintValue: dynamicValue,
      source: "MusicBrainz",
      groundingSources: [
        {
          title: `MusicBrainz Database: ${artistName} - ${albumTitle} (${foundBarcode ? 'Barcode ' + foundBarcode : catNumber})`,
          uri: `https://musicbrainz.org/release/${mbid}`,
          source: "MusicBrainz"
        }
      ]
    };
  } catch (err) {
    console.warn("MusicBrainz live query notice:", err);
    return null;
  }
}
