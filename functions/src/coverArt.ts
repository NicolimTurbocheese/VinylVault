import { onRequest } from "firebase-functions/v2/https";
import { handlePreflight } from "./_lib/cors";
import { discogsApiTokenSecret } from "./_lib/secrets";

export const coverArt = onRequest(
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
      const matrixCode = String(req.query.matrixCode || "").trim();

      if (!albumTitle) {
        res.status(400).json({ error: "albumTitle parameter required" });
        return;
      }

      const results: string[] = [];
      let tracklist: { position: string; title: string; duration?: string }[] = [];
      const discogsToken = discogsApiTokenSecret.value();
      const discogsHeaders: Record<string, string> = {
        "User-Agent": "VinylVault/1.0 (+https://vinylvault.app)",
        ...(discogsToken ? { Authorization: `Discogs token=${discogsToken}` } : {}),
      };

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
        // Bias toward the Vinyl edition specifically — without this, a CD reissue or
        // a bonus-track-laden compilation sharing the same artist/title can outrank
        // the actual vinyl pressing and hand back a wrong/incomplete tracklist.
        let discogsQuery = "";
        if (catalogueNumber && !isPlaceholderCatNo(catalogueNumber)) {
          discogsQuery = `https://api.discogs.com/database/search?catno=${encodeURIComponent(catalogueNumber)}&format=Vinyl&type=release`;
        } else if (matrixCode) {
          const q = [cleanArtist, cleanTitle, matrixCode].filter(Boolean).join(" ");
          discogsQuery = `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&format=Vinyl&type=release`;
        } else {
          const q = [cleanArtist, cleanTitle].filter(Boolean).join(" ");
          discogsQuery = `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&format=Vinyl&type=release`;
        }

        let dRes = await fetch(discogsQuery, { headers: discogsHeaders });
        let dJson: any = dRes.ok ? await dRes.json() : null;
        // The Vinyl-only filter can legitimately return nothing (format tagged
        // differently, or missing on Discogs for this release) — fall back to an
        // unfiltered search rather than losing the match entirely.
        if (!dJson?.results?.length && discogsQuery.includes("&format=Vinyl")) {
          const fallbackQuery = discogsQuery.replace("&format=Vinyl", "");
          dRes = await fetch(fallbackQuery, { headers: discogsHeaders });
          dJson = dRes.ok ? await dRes.json() : null;
        }
        if (dRes.ok) {
          if (dJson.results && dJson.results.length > 0) {
            for (const r of dJson.results) {
              const img = r.cover_image || r.thumb;
              if (img && !img.includes("spacer.gif") && !results.includes(img)) {
                const rTitle = (r.title || "").toLowerCase();
                const matchesTitle = rTitle.includes(mainKeyword);
                const matchesArtist = normalizedArtist ? normalizeArtistName(rTitle).includes(normalizedArtist) : true;
                if (matchesTitle && matchesArtist) {
                  results.push(img);

                  // Pull the full release record for this specific pressing — with an
                  // authenticated token it carries every photo submitted for that exact
                  // release (sleeve variants, obi, labels), not just the one search
                  // thumbnail; either way it also carries the release's tracklist, which
                  // the search endpoint doesn't return.
                  if (r.resource_url && results.length <= 1) {
                    try {
                      const relRes = await fetch(r.resource_url, { headers: discogsHeaders });
                      if (relRes.ok) {
                        const relJson: any = await relRes.json();
                        const images: any[] = relJson?.images || [];
                        for (const im of images) {
                          const fullImg = im.uri || im.resource_url;
                          if (fullImg && !results.includes(fullImg)) {
                            results.push(fullImg);
                          }
                          if (results.length >= 4) break;
                        }
                        const dTracks: any[] = relJson?.tracklist || [];
                        if (dTracks.length > 0 && tracklist.length === 0) {
                          tracklist = dTracks
                            .filter((t) => t.type_ !== "heading")
                            .map((t, idx) => ({
                              position: t.position || `A${idx + 1}`,
                              title: t.title || `Track ${idx + 1}`,
                              duration: t.duration || undefined,
                            }));
                        }
                      }
                    } catch (relErr) {
                      console.warn("Discogs release detail fetch error:", relErr);
                    }
                  }
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

                // iTunes' lookup endpoint returns every track on a collection given its
                // ID, at no extra auth cost — a free tracklist source distinct from
                // Discogs/MusicBrainz that meaningfully widens coverage.
                if (tracklist.length === 0 && item.collectionId) {
                  try {
                    const lookupRes = await fetch(
                      `https://itunes.apple.com/lookup?id=${item.collectionId}&entity=song&limit=200`
                    );
                    if (lookupRes.ok) {
                      const lookupJson: any = await lookupRes.json();
                      const tracks: any[] = (lookupJson?.results || []).filter((r: any) => r.wrapperType === "track");
                      if (tracks.length > 0) {
                        tracklist = tracks.map((t, idx) => {
                          const durMs = t.trackTimeMillis;
                          const durStr = durMs
                            ? `${Math.floor(durMs / 60000)}:${String(Math.floor((durMs % 60000) / 1000)).padStart(2, "0")}`
                            : undefined;
                          return {
                            position: String(t.trackNumber || idx + 1),
                            title: t.trackName || `Track ${idx + 1}`,
                            duration: durStr,
                          };
                        });
                      }
                    }
                  } catch (lookupErr) {
                    console.warn("iTunes tracklist lookup error:", lookupErr);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("iTunes cover art search error:", err);
      }

      // 3. Deezer search — another large commercial catalogue, no API key required for
      // read/search endpoints, and it indexes a different mix of regional/reissue
      // pressings than iTunes does. Also runs whenever tracklist is still empty (not
      // only when cover art is still insufficient), since Deezer's per-album tracks
      // endpoint is another free tracklist source.
      if (results.length < 2 || tracklist.length === 0) {
        try {
          const deezerQuery = [cleanArtist, cleanTitle].filter(Boolean).join(" ") || cleanTitle;
          const dzRes = await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(deezerQuery)}&limit=5`);
          if (dzRes.ok) {
            const dzJson: any = await dzRes.json();
            const items: any[] = dzJson?.data || [];
            for (const item of items) {
              const img = item.cover_big || item.cover_medium || item.cover;
              if (!img) continue;
              const itemTitle = (item.title || "").toLowerCase();
              const itemArtist = (item.artist?.name || "").toLowerCase();
              const matchesTitle = itemTitle.includes(mainKeyword) || mainKeyword.includes(itemTitle);
              const matchesArtist = normalizedArtist ? normalizeArtistName(itemArtist).includes(normalizedArtist) : true;
              if (matchesTitle && matchesArtist) {
                if (!results.includes(img)) {
                  results.push(img);
                }

                if (tracklist.length === 0 && item.id) {
                  try {
                    const dzTracksRes = await fetch(`https://api.deezer.com/album/${item.id}/tracks`);
                    if (dzTracksRes.ok) {
                      const dzTracksJson: any = await dzTracksRes.json();
                      const dzTracks: any[] = dzTracksJson?.data || [];
                      if (dzTracks.length > 0) {
                        tracklist = dzTracks.map((t, idx) => {
                          const durSec = t.duration;
                          const durStr = durSec
                            ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, "0")}`
                            : undefined;
                          return {
                            position: String(t.track_position || idx + 1),
                            title: t.title || `Track ${idx + 1}`,
                            duration: durStr,
                          };
                        });
                      }
                    }
                  } catch (dzTrackErr) {
                    console.warn("Deezer tracklist fetch error:", dzTrackErr);
                  }
                }
              }
              if (results.length >= 2 && tracklist.length > 0) break;
            }
          }
        } catch (err) {
          console.warn("Deezer cover art search error:", err);
        }
      }

      // 4. Fallback to MusicBrainz / CoverArtArchive — also the tracklist fallback when
      // Discogs didn't turn one up, so this must run whenever tracklist is still empty,
      // not only when cover art is still insufficient (iTunes/Deezer finding a cover
      // shouldn't skip the only other tracklist source available).
      if (results.length < 2 || tracklist.length === 0) {
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
              const matched = mbJson.releases.filter((rel: any) => {
                const relTitle = (rel.title || "").toLowerCase();
                const relArtist = (rel["artist-credit"]?.[0]?.name || "").toLowerCase();
                const matchesTitle = relTitle.includes(mainKeyword) || mainKeyword.includes(relTitle);
                const matchesArtist = normalizedArtist ? normalizeArtistName(relArtist).includes(normalizedArtist) : true;
                return matchesTitle && matchesArtist;
              });
              // Prefer the Vinyl-tagged release when the search returned several
              // pressings/editions — a CD or digital edition with the same title can
              // otherwise outrank the vinyl pressing and hand back a wrong tracklist
              // (bonus tracks, different running order, etc).
              const isVinylRelease = (rel: any) =>
                Array.isArray(rel.media) && rel.media.some((m: any) => /vinyl/i.test(m?.format || ""));
              matched.sort((a: any, b: any) => Number(isVinylRelease(b)) - Number(isVinylRelease(a)));

              for (const rel of matched) {

                // Most MusicBrainz releases have no cover art uploaded to the Archive at
                // all — pushing this URL unconditionally used to hand back a broken image
                // and, worse, block the Wikipedia/TheAudioDB fallbacks below (they only
                // run when results is still empty). A HEAD check confirms it's real before
                // it counts as a find.
                try {
                  const caaUrl = `https://coverartarchive.org/release/${rel.id}/front-500`;
                  const caaHead = await fetch(caaUrl, { method: "HEAD" });
                  if (caaHead.ok && !results.includes(caaUrl)) {
                    results.push(caaUrl);
                  } else if (rel["release-group"]?.id) {
                    // The specific pressing has no art uploaded, but the release-group
                    // (the album as a whole, across all its editions) very often does —
                    // a real cover beats no cover even if it's not this exact pressing's photo.
                    const rgUrl = `https://coverartarchive.org/release-group/${rel["release-group"].id}/front-500`;
                    const rgHead = await fetch(rgUrl, { method: "HEAD" });
                    if (rgHead.ok && !results.includes(rgUrl)) {
                      results.push(rgUrl);
                    }
                  }
                } catch (caaErr) {
                  console.warn("CoverArtArchive HEAD check error:", caaErr);
                }

                if (tracklist.length === 0 && rel.id) {
                  try {
                    const relDetailRes = await fetch(
                      `https://musicbrainz.org/ws/2/release/${rel.id}?inc=recordings&fmt=json`,
                      { headers: { "User-Agent": "VinylVault/1.0 (contact@vinylvault.app)" } }
                    );
                    if (relDetailRes.ok) {
                      const relDetail: any = await relDetailRes.json();
                      // A double (or triple) LP is multiple "media" entries, one per disc —
                      // reading only media[0] silently dropped every side after the first.
                      const mediaList: any[] = relDetail?.media || [];
                      const multiDisc = mediaList.length > 1;
                      const mbTracks: { t: any; idx: number; discNo: number }[] = [];
                      mediaList.forEach((media, discIdx) => {
                        (media?.tracks || []).forEach((t: any, idx: number) => {
                          mbTracks.push({ t, idx, discNo: discIdx + 1 });
                        });
                      });
                      if (mbTracks.length > 0) {
                        tracklist = mbTracks.map(({ t, idx, discNo }) => {
                          const durMs = t.length || t.recording?.length;
                          const durStr = durMs ? `${Math.floor(durMs / 60000)}:${String(Math.floor((durMs % 60000) / 1000)).padStart(2, "0")}` : undefined;
                          const basePos = t.number || String(idx + 1);
                          return {
                            position: multiDisc ? `${discNo}-${basePos}` : basePos,
                            title: t.title || t.recording?.title || `Track ${idx + 1}`,
                            duration: durStr,
                          };
                        });
                      }
                    }
                  } catch (trackErr) {
                    console.warn("MusicBrainz tracklist fetch error:", trackErr);
                  }
                }

                if (results.length >= 2) break;
              }
            }
          }
        } catch (err) {
          console.warn("MusicBrainz cover art search error:", err);
        }
      }

      // 5. Wikipedia search fallback — catches well-known albums (especially classical,
      // jazz, and older catalogue titles) that Discogs/iTunes/MusicBrainz miss, without
      // needing a paid image-search API. Searches Wikipedia for the article, then pulls
      // its lead image via the pageimages API — usually the album cover for music articles.
      if (results.length === 0) {
        try {
          const searchTerm = [cleanArtist, cleanTitle].filter(Boolean).join(" ") || cleanTitle;
          const searchRes = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
              searchTerm + " album"
            )}&format=json&srlimit=3`,
            { headers: { "User-Agent": "VinylVault/1.0 (contact@vinylvault.app)" } }
          );
          if (searchRes.ok) {
            const searchJson: any = await searchRes.json();
            const hits: any[] = searchJson?.query?.search || [];
            for (const hit of hits) {
              const hitTitle = String(hit.title || "").toLowerCase();
              // Loose relevance check: don't pull an image for a clearly unrelated article
              if (!hitTitle.includes(mainKeyword.split(" ")[0] || "")) continue;

              const imgRes = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
                  hit.title
                )}&prop=pageimages&format=json&pithumbsize=500`,
                { headers: { "User-Agent": "VinylVault/1.0 (contact@vinylvault.app)" } }
              );
              if (imgRes.ok) {
                const imgJson: any = await imgRes.json();
                const pages = imgJson?.query?.pages || {};
                for (const pageId of Object.keys(pages)) {
                  const thumb = pages[pageId]?.thumbnail?.source;
                  if (thumb && !results.includes(thumb)) {
                    results.push(thumb);
                  }
                }
              }
              if (results.length >= 2) break;
            }
          }
        } catch (err) {
          console.warn("Wikipedia cover art search error:", err);
        }
      }

      // 6. TheAudioDB — free community-run music database, useful for regional/reissue
      // pressings that the bigger commercial catalogues don't carry. "2" is TheAudioDB's
      // own published free test key for exactly this kind of low-volume public use
      // (documented on their site, not a private credential).
      if (results.length === 0) {
        try {
          const adbRes = await fetch(
            `https://theaudiodb.com/api/v1/json/2/searchalbum.php?s=${encodeURIComponent(cleanArtist || artist)}&a=${encodeURIComponent(cleanTitle)}`
          );
          if (adbRes.ok) {
            const adbJson: any = await adbRes.json();
            const albums: any[] = adbJson?.album || [];
            for (const album of albums) {
              const img = album.strAlbumThumb || album.strAlbumThumbHQ;
              if (!img) continue;
              const albumTitleLower = (album.strAlbum || "").toLowerCase();
              const matchesTitle = albumTitleLower.includes(mainKeyword) || mainKeyword.includes(albumTitleLower);
              if (matchesTitle && !results.includes(img)) {
                results.push(img);
              }
              if (results.length >= 2) break;
            }
          }
        } catch (err) {
          console.warn("TheAudioDB cover art search error:", err);
        }
      }

      res.status(200).json({
        albumTitle,
        artist,
        catalogueNumber,
        results,
        tracklist
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to search cover art." });
    }
  }
);
