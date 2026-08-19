import { onRequest } from "firebase-functions/v2/https";
import { handlePreflight } from "./_lib/cors";
import { discogsApiTokenSecret } from "./_lib/secrets";

// Discogs' documented, authorized marketplace endpoint. It reports what a release is
// LISTED at right now (lowest active asking price + how many copies are for sale) — not
// what anything actually sold for, and not any history. Discogs deliberately withholds
// sales history from the API, so this is the real ceiling on automated market data.
//
// The value of polling it daily is that the app accumulates its own genuine observation
// series over time: each day's reading is stored against the record, so after a few months
// there's a real, measured "what was this listing for" curve per pressing — something no
// API hands over up front.

const DISCOGS_SUPPORTED_CURRENCIES = [
  "USD", "GBP", "EUR", "CAD", "AUD", "JPY", "CHF", "MXN", "BRL", "NZD", "SEK", "ZAR",
];

export const marketStats = onRequest(
  { cors: false, timeoutSeconds: 30, secrets: [discogsApiTokenSecret] },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const artist = String(req.query.artist || "").trim();
      const albumTitle = String(req.query.albumTitle || "").trim();
      const catalogueNumber = String(req.query.catalogueNumber || "").trim();
      // Cached from a previous call so repeat lookups skip the search step entirely —
      // one API call per record per day instead of two.
      const knownReleaseId = String(req.query.releaseId || "").trim();
      const requested = String(req.query.currency || "USD").trim().toUpperCase();
      const currency = DISCOGS_SUPPORTED_CURRENCIES.includes(requested) ? requested : "USD";

      const token = discogsApiTokenSecret.value();
      if (!token) {
        res.status(200).json({ available: false, reason: "no-token" });
        return;
      }

      const headers: Record<string, string> = {
        "User-Agent": "VinylVault/1.0 (+https://vinylvault.app)",
        Authorization: `Discogs token=${token}`,
      };

      const isPlaceholderCatNo = (v: string) =>
        !v || ["cat-no", "n/a", "barcode", "unknown", "none", "-", "tbd"].includes(v.trim().toLowerCase());
      const primaryCatNo = (v: string) => v.split(/[,/]/)[0].trim();

      // 1. Resolve a Discogs release id if the caller doesn't already have one.
      let releaseId = knownReleaseId;
      if (!releaseId) {
        const usableCatNo = catalogueNumber && !isPlaceholderCatNo(catalogueNumber);
        const query = usableCatNo
          ? `https://api.discogs.com/database/search?catno=${encodeURIComponent(primaryCatNo(catalogueNumber))}&format=Vinyl&type=release`
          : `https://api.discogs.com/database/search?q=${encodeURIComponent([artist, albumTitle].filter(Boolean).join(" "))}&format=Vinyl&type=release`;

        const searchRes = await fetch(query, { headers });
        if (!searchRes.ok) {
          res.status(200).json({ available: false, reason: `search-failed-${searchRes.status}` });
          return;
        }
        const searchJson: any = await searchRes.json();
        const results: any[] = searchJson?.results || [];
        if (results.length === 0) {
          res.status(200).json({ available: false, reason: "no-release-match" });
          return;
        }

        // With a catalogue-number search the match is already pressing-specific; otherwise
        // require the title to actually resemble what's on file before trusting it.
        if (usableCatNo) {
          releaseId = String(results[0].id);
        } else {
          const keyword = albumTitle.toLowerCase().replace(/\s+/g, " ").trim();
          const hit = results.find((r) => String(r.title || "").toLowerCase().includes(keyword));
          if (!hit) {
            res.status(200).json({ available: false, reason: "no-confident-match" });
            return;
          }
          releaseId = String(hit.id);
        }
      }

      // 2. Ask for the current marketplace stats on that release.
      const statsRes = await fetch(
        `https://api.discogs.com/marketplace/stats/${encodeURIComponent(releaseId)}?curr_abbr=${currency}`,
        { headers }
      );

      if (statsRes.status === 401 || statsRes.status === 403) {
        // The token exists but isn't authorized for marketplace data. Reported rather than
        // thrown so the client can degrade quietly instead of showing an error per record.
        res.status(200).json({ available: false, reason: "not-authorized", releaseId });
        return;
      }
      if (!statsRes.ok) {
        res.status(200).json({ available: false, reason: `stats-failed-${statsRes.status}`, releaseId });
        return;
      }

      const stats: any = await statsRes.json();
      const lowest = stats?.lowest_price;

      res.status(200).json({
        available: lowest != null,
        releaseId,
        lowestPrice: lowest?.value ?? null,
        currency: lowest?.currency ?? currency,
        numForSale: stats?.num_for_sale ?? 0,
        blockedFromSale: !!stats?.blocked_from_sale,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch marketplace stats." });
    }
  }
);
