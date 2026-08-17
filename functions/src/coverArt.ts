import { onRequest } from "firebase-functions/v2/https";
import { handlePreflight } from "./_lib/cors";

export const coverArt = onRequest(
  { cors: false, timeoutSeconds: 30 },
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
      const matrixCode = String(req.query.matrixCode || "").trim();

      if (!albumTitle) {
        res.status(400).json({ error: "albumTitle parameter required" });
        return;
      }

      const results: string[] = [];

      // Extract main album title (remove parenthetical subtitles like (The Original Soundtrack...))
      const cleanTitle = albumTitle.replace(/\s*\([^)]*\)/g, "").trim();
      const mainKeyword = (cleanTitle.length >= 3 ? cleanTitle : albumTitle).toLowerCase();

      // Check if artist is generic
      const isVarious = !artist || /various|v\/a|soundtrack|ost/i.test(artist);
      const cleanArtist = isVarious ? "" : artist.replace(/\s*\([^)]*\)/g, "").trim();

      // Discogs formats "The Beatles" as "Beatles, The" inside a "Beatles, The - Abbey Road"
      // release title — strip both forms of "the" wherever they appear so that convention
      // doesn't produce a false non-match for "The <Band>" style artist names.
      const normalizeArtistName = (s: string) =>
        s.toLowerCase().replace(/,\s*the\b/gi, "").replace(/\bthe\s+/gi, "").trim();
      const normalizedArtist = cleanArtist ? normalizeArtistName(cleanArtist) : "";

      // Placeholder text collectors use in the catalogue-number field when only a barcode
      // (or nothing) was legible — never a real catalogue number, so never usable as a
      // Discogs catno search term (searching catno="Barcode" returns garbage/no matches).
      const isPlaceholderCatNo = (v: string) =>
        !v || ["cat-no", "n/a", "barcode", "unknown", "none", "-", "tbd"].includes(v.trim().toLowerCase());

      // 1. Query Discogs API by Catalogue Number, Matrix/Runout Code, or Clean Title.
      // Catalogue number is the strongest signal (Discogs' catno= field is indexed
      // directly); the matrix/runout code isn't a dedicated search field on Discogs, so
      // it's folded into the free-text query as the next-best pressing-specific signal
      // when there's no usable catalogue number.
      try {
        let discogsQuery = "";
        if (catalogueNumber && !isPlaceholderCatNo(catalogueNumber)) {
          discogsQuery = `https://api.discogs.com/database/search?catno=${encodeURIComponent(catalogueNumber)}&type=release`;
        } else if (matrixCode) {
          const q = [cleanArtist, cleanTitle, matrixCode].filter(Boolean).join(" ");
          discogsQuery = `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release`;
        } else {
          const q = [cleanArtist, cleanTitle].filter(Boolean).join(" ");
          discogsQuery = `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release`;
        }

        const dRes = await fetch(discogsQuery, {
          headers: { "User-Agent": "VinylVault/1.0 (+https://vinylvault.app)" }
        });
        if (dRes.ok) {
          const dJson: any = await dRes.json();
          if (dJson.results && dJson.results.length > 0) {
            for (const r of dJson.results) {
              const img = r.cover_image || r.thumb;
              if (img && !img.includes("spacer.gif") && !results.includes(img)) {
                const rTitle = (r.title || "").toLowerCase();
                const matchesTitle = rTitle.includes(mainKeyword);
                const matchesArtist = normalizedArtist ? normalizeArtistName(rTitle).includes(normalizedArtist) : true;
                if (matchesTitle && matchesArtist) {
                  results.push(img);
                }
              }
              if (results.length >= 4) break;
            }
          }
        }
      } catch (err) {
        console.warn("Discogs cover art search error:", err);
      }

      // 2. Query iTunes API with strict keyword verification
      try {
        let itunesQuery = isVarious ? `${cleanTitle} soundtrack` : `${cleanArtist} ${cleanTitle}`;
        const iRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(itunesQuery.trim())}&entity=album&limit=10`);
        if (iRes.ok) {
          const iJson: any = await iRes.json();
          if (iJson.results && Array.isArray(iJson.results)) {
            for (const item of iJson.results) {
              if (!item.artworkUrl100) continue;
              const collName = (item.collectionName || "").toLowerCase();
              const artName = (item.artistName || "").toLowerCase();

              // Strict Filter: collectionName MUST match album title keywords (e.g. "Grease" MUST be in title)
              const matchesTitle = collName.includes(mainKeyword) || mainKeyword.includes(collName);
              const matchesArtist = cleanArtist ? artName.includes(cleanArtist.toLowerCase()) || isVarious : true;

              if (matchesTitle && matchesArtist) {
                const highResArt = item.artworkUrl100.replace("100x100bb", "600x600bb");
                if (!results.includes(highResArt)) {
                  results.push(highResArt);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("iTunes cover art search error:", err);
      }

      // 3. Fallback to MusicBrainz / CoverArtArchive
      if (results.length < 2) {
        try {
          const mbq = catalogueNumber && !isPlaceholderCatNo(catalogueNumber)
            ? `catno:${catalogueNumber}`
            : `release:"${cleanTitle}" AND artist:"${cleanArtist || 'Various Artists'}"`;
          const mbRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(mbq)}&fmt=json`, {
            headers: { "User-Agent": "VinylVault/1.0 (contact@vinylvault.app)" }
          });
          if (mbRes.ok) {
            const mbJson: any = await mbRes.json();
            if (mbJson.releases && mbJson.releases.length > 0) {
              for (const rel of mbJson.releases) {
                const relTitle = (rel.title || "").toLowerCase();
                const relArtist = (rel["artist-credit"]?.[0]?.name || "").toLowerCase();
                const matchesTitle = relTitle.includes(mainKeyword) || mainKeyword.includes(relTitle);
                const matchesArtist = normalizedArtist ? normalizeArtistName(relArtist).includes(normalizedArtist) : true;
                if (!matchesTitle || !matchesArtist) continue;

                const caaUrl = `https://coverartarchive.org/release/${rel.id}/front-500`;
                if (!results.includes(caaUrl)) {
                  results.push(caaUrl);
                }
                if (results.length >= 2) break;
              }
            }
          }
        } catch (err) {
          console.warn("MusicBrainz cover art search error:", err);
        }
      }

      res.status(200).json({
        albumTitle,
        artist,
        catalogueNumber,
        results
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to search cover art." });
    }
  }
);
