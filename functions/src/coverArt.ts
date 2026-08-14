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

      // 1. Query Discogs API by Catalogue Number or Clean Title
      try {
        let discogsQuery = "";
        if (catalogueNumber && catalogueNumber !== "CAT-NO" && catalogueNumber !== "N/A") {
          discogsQuery = `https://api.discogs.com/database/search?catno=${encodeURIComponent(catalogueNumber)}&type=release`;
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
                if (rTitle.includes(mainKeyword)) {
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
          const mbq = catalogueNumber && catalogueNumber !== "CAT-NO"
            ? `catno:${catalogueNumber}`
            : `release:"${cleanTitle}" AND artist:"${cleanArtist || 'Various Artists'}"`;
          const mbRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(mbq)}&fmt=json`, {
            headers: { "User-Agent": "VinylVault/1.0 (contact@vinylvault.app)" }
          });
          if (mbRes.ok) {
            const mbJson: any = await mbRes.json();
            if (mbJson.releases && mbJson.releases.length > 0) {
              for (const rel of mbJson.releases.slice(0, 3)) {
                const caaUrl = `https://coverartarchive.org/release/${rel.id}/front-500`;
                if (!results.includes(caaUrl)) {
                  results.push(caaUrl);
                }
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
