/**
 * Utility function to clean and deduplicate record format specification strings.
 * Ensures record sizes (e.g., 12", 7", 10") appear at most ONCE at the beginning
 * and removes any duplicate tokens or redundant size entries.
 */
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
