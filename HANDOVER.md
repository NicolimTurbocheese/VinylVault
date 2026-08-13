# VinylVault - Application Handover & Engineering Documentation

**Project Name:** VinylVault — Vinyl Collector Identification, Grading & Collection Management Suite  
**Date:** August 2026  
**Architecture:** Static React 19 frontend (Vite + Tailwind CSS) deployed to **GitHub Pages** via GitHub Actions, calling out cross-origin to **Firebase Cloud Functions** (`functions/`) for anything that needs a secret key (Google Gemini AI via `@google/genai`) or needs to avoid browser CORS restrictions (Discogs / MusicBrainz / iTunes). Optional cross-device sync runs on **Cloud Firestore** directly from the browser. Converted from an earlier Express-server architecture — see "Deployment Architecture Notes" (section 6) for the full history and why it's split this way.

---

## 1. System Architecture Overview

VinylVault is an end-to-end vinyl archiving, valuation, and market analysis tool designed for vinyl collectors, crate diggers, and record store owners.

### Key Functional Components

1. **Scan & Search Engine (`src/components/ScanSearchTab.tsx`)**
   - **OCR & Visual AI**: Camera or file upload scanning of record matrix codes, catalogue numbers, center labels, OBI strips, and sleeve jackets via Gemini Vision (`gemini-2.5-flash`).
   - **Market & Discogs Grounding**: Combines Gemini API analysis with real-time Discogs API and MusicBrainz API queries to pull exact release years, country pressings, format specifications, and completed sale benchmarks.
   - **Dynamic Currency Converter**: Converts valuations across **SGD, USD, EUR, GBP, JPY, AUD, CAD, HKD** using live rate tables.

2. **Collection Shelf (`src/components/MyShelfTab.tsx`, `src/App.tsx`)**
   - **Local Persistence**: The shelf collection is stored entirely in the browser via `localStorage` (merging legacy keys `vinylvault_shelf`, `vinyl_vault_shelf_v1`, `vinyl_shelf` on load). There is no server-side database — collections are per-browser/per-device only. See "Known Constraints" below for the tradeoff and the recommended fix.

3. **Multi-Source Cover Art Refresher (`src/components/RecordCoverImage.tsx`, `functions/src/coverArt.ts`)**
   - **Multi-API Fallback**: Queries Discogs API (by catalogue # or pressing title), iTunes Search API (with strict keyword/title matching), and Cover Art Archive (MusicBrainz).
   - **Refresher Control**: Circular refresh badge allows collectors to cycle through verified high-resolution cover references on demand.

4. **Grading & Complete Valuation Engine (`src/utils/valuation.ts`, `src/components/AddToShelfModal.tsx`)**
   - Goldmine Grading standard (M, NM, VG+, VG, G+, G, P).
   - Factors in sleeve condition, vinyl media condition, OBI strip presence, Japanese insert inclusions, autographed sleeves, or physical flaws (e.g. seam splits, ring wear, warping).

5. **Collection Insights & Portfolio Dashboard (`src/components/CollectionInsightsTab.tsx`)**
   - Portfolio total valuation (Low, Median, High).
   - Top valuable records leaderboard, genre breakdown charts (Recharts), and country pressing analytics.

6. **Organise: Physical Storage Boxes (`src/components/OrganiseTab.tsx`)**
   - Custom, user-named "Boxes" representing physical storage (crates, shelves, cases). See section 8 for details.
   - Editable genre/sub-genre categorization per record (`src/components/AddToShelfModal.tsx`) and multi-select genre + style filtering on **MY SHELF** (`src/components/MyShelfTab.tsx`).

---

## 2. Recent Bug Fixes & Resolved Issues

| Issue / Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Missing Collection Records on Reload** (historical, pre-static-conversion) | Server restart reset `shelf-data.json` to default seed, overwriting client state. | Superseded by the static-site conversion: the server-side `shelf-data.json` store was removed entirely and the shelf now persists only in browser `localStorage`, so there's no server restart to lose data to. See "Static Conversion Notes" for the remaining cross-device tradeoff. |
| **"Save to Cabinet" Terminology Reversion** | Inconsistent UI text across modal, scan, and shelf tabs. | Standardized all action buttons and headings to **"SAVE TO SHELF"** paired with the `BookmarkPlus` icon. |
| **Incorrect Refreshed Cover Art** (e.g., *Beauty & the Beast* cover appearing for *Grease*) | Unfiltered iTunes search queries for "Various Artists" assigned mismatched soundtrack covers. | Built a dedicated `coverArt` backend function (`functions/src/coverArt.ts`) with strict album title matching, stripping generic artist terms, and catalogue number verification. |
| **Search/Genre Filtering Hiding Items** | Users mistakenly thought records were deleted when a genre filter was active. | Added an active filter banner on **MY SHELF** displaying filtered record count and a one-click **"Clear Filters"** button. |

---

## 3. Known Constraints & Potential Edge Cases

1. **Discogs API Rate Limits**:
   - Discogs rate-limits unauthenticated API calls to 25 requests per minute.
   - *Current Safeguard*: The app falls back to MusicBrainz and Gemini AI when Discogs responds with HTTP 429.

2. **Unsplash Cover Art Placeholders**:
   - For rare, obscure, or unofficial bootleg pressings without entries in Discogs, iTunes, or CoverArtArchive, the cover image defaults to styled vinyl stock photography.

3. **Browser iFrame Camera Constraints**:
   - In sandboxed iFrame preview environments, camera permissions can occasionally be restricted by browser policy.
   - *Fallback*: Full support for image drag-and-drop and file selection is provided in `CameraModal`.

4. **Cross-Origin API Calls & Open CORS**:
   - The frontend (GitHub Pages) and the API (Firebase Cloud Functions) are on different origins, so the functions respond with `Access-Control-Allow-Origin: *` (see `functions/src/_lib/cors.ts`) to allow the browser to call them at all.
   - This is deliberately permissive since these endpoints have no auth/session/cookie model — the only real secret (`GEMINI_API_KEY`) never leaves the server regardless of who calls it. If that changes (e.g. per-user rate limiting is added), tighten this to a specific allowed origin.

---

## 4. Recommended Future Improvements

### Priority 1: Authentication & User Accounts
- **Status: partially shipped.** Cross-device sync now exists via a Vault Code + Cloud Firestore (see "Cross-Device Sync" section below) — no server-side `shelf-data.json` remains. What's still missing is real accounts: today, anyone holding a vault code has full read/write on that vault, there's no login, password reset, or per-user identity. Upgrading to Firebase Auth (email or Google sign-in) tied to the same Firestore data model would close that gap.

### Priority 2: Discogs OAuth Integration
- **Direct Collection Import/Export**: Implement Discogs OAuth so users can sync their existing Discogs collection and wantlists directly with VinylVault with one click.

### Priority 3: Barcode & Audio Acoustic Fingerprinting
- **WebCam Live Barcode Scanner**: Integrate `zxing-js` for real-time EAN/UPC barcode camera scanning.
- **Audio Sample Recognition**: Integrate Chromaprint / AcoustID audio snippet scanning for spinning turntables.

### Priority 4: Market Value Price Tracking over Time
- **Historical Charting**: Track valuation trends over time (e.g. 6-month value history graphs) to highlight appreciating records in the user's collection.

---

## 5. Environment & Running the Application

This is now **two separate deployable projects** in one repo: the root (frontend, GitHub Pages) and `functions/` (backend, Firebase Cloud Functions). They have separate `package.json`s, separate `node_modules`, and deploy independently.

### Frontend (root)
- **Dev Command**: `npm run dev` (runs `vite` — serves the React app only; API calls will fail unless `VITE_API_BASE_URL` points at a running/deployed functions backend)
- **Build Command**: `npm run build` (`vite build`, output in `dist/`)
- **Lint**: `npm run lint`
- **Deploys via**: `.github/workflows/deploy-pages.yml` — pushes to `main` automatically build and publish `dist/` to GitHub Pages. Requires **Settings → Pages → Source → GitHub Actions** to be selected in the repo (not "Deploy from a branch") or the workflow's output is ignored.
- **Environment variables** (set as **Settings → Secrets and variables → Actions → Variables**, consumed by the workflow, see `.env.example` for the full list):
  - `VITE_API_BASE_URL`: the Firebase Functions base URL (e.g. `https://us-central1-your-project-id.cloudfunctions.net`). Required for Scan/Search, valuation recalculation, and cover art refresh to work at all.
  - `VITE_FIREBASE_*` (six values): optional, only needed for Cross-Device Sync (section 7).

### Backend (`functions/`)
- **Dev Command**: `npm run dev:functions` (from repo root) or `cd functions && npm run serve` — runs the Firebase emulator locally (needs `firebase login` once, or works unauthenticated against a `--project demo-*` for local-only testing).
- **Build**: `cd functions && npm run build` (`tsc`, output in `functions/lib/`)
- **Deploy**: `cd functions && npm run deploy` (or `firebase deploy --only functions` from repo root) — requires `firebase login` and the Blaze (pay-as-you-go) plan enabled on the Firebase project; see section 7 for why.
- **Secret**: `GEMINI_API_KEY` is NOT a `.env` variable here — it's a Secret Manager secret, set once via `firebase functions:secrets:set GEMINI_API_KEY` (from inside `functions/`). Never put it in `VITE_*`/client env vars.

## 6. Deployment Architecture Notes (August 2026)

VinylVault went through two architecture changes this month, in order:

1. **Express server → static frontend + serverless functions.** The original `server.ts` (Express, requiring a persistent Node host like Render) was replaced with a static Vite build plus small serverless functions for the handful of endpoints that need a secret key or need to dodge browser CORS. This was necessary regardless of hosting choice — GitHub Pages, Netlify, Vercel, none of them run a long-lived custom Express process.
2. **Netlify/Vercel functions → Firebase Cloud Functions.** The functions briefly lived on Vercel, then Netlify, before settling on Firebase Cloud Functions — consolidating with Firestore (already needed for Cross-Device Sync, section 7) onto a single provider instead of splitting across two. The tradeoff: Firebase Cloud Functions (2nd gen) require the **Blaze plan**, which needs a credit card on file even though usage stays within the free quota at this app's scale — Netlify Functions didn't require that, but meant maintaining a second unrelated provider.

**Why the frontend and backend are on different hosts at all**: GitHub Pages (the frontend host) is static-file-only — it cannot run *any* server code, so the API genuinely cannot live there. This is why `src/utils/apiBase.ts` builds absolute cross-origin URLs (`VITE_API_BASE_URL`) instead of relative `/api/...` paths, and why the functions set permissive CORS headers.

**GitHub Pages subpath**: project sites are served at `github.io/<repo-name>/`, not the domain root, so `vite.config.ts` sets `base` from a `BASE_PATH` env var (the deploy workflow sets it to `/VinylVault/`) — without this, the built `index.html` would reference asset URLs like `/assets/...` that 404 on GitHub Pages (they'd need to be `/VinylVault/assets/...`).

**Shelf persistence**: still local-only by default (`localStorage`), same as after the first architecture change — no server-side database was reintroduced. See section 7 for the opt-in cross-device sync layer built on top.

## 7. Cross-Device Sync (August 2026)

Collections can sync across devices/browsers via a **Vault Code** — no accounts, no login. Opt-in: with no Firebase project configured, the app behaves exactly as before (local-only `localStorage`).

**How it works**: `src/utils/vaultSync.ts` + `src/utils/firebase.ts` talk directly to Cloud Firestore from the browser (client SDK, not a Cloud Function — Firestore allows direct browser access when rules permit it), with live updates via `onSnapshot`. A vault's records live at `/vaults/{vaultCode}/shelfItems/{itemId}`. The vault code is a 20-character cryptographically random string generated client-side (`generateVaultCode()`) — knowing the code is the entire access control mechanism, enforced by `firestore.rules` (`vaultCode.size() >= 16`). There's no way to browse/discover other people's vaults; you just can't prove *who* holds a given code (that's the accounts gap noted under Priority 1).

**One-time setup to enable it** (skip this and the app just runs local-only):
1. Create a free project at [Firebase Console](https://console.firebase.google.com/) (the same project used for Cloud Functions, section 5/6 — one project covers both).
2. Firestore Database → Create Database → start in **production mode** (the app's own rules, not Firestore's defaults, will govern access).
3. Firestore Database → Rules → paste the contents of `firestore.rules` in this repo → Publish.
4. Project Settings → General → Your apps → Add app → Web → copy the six config values it gives you.
5. Set them as GitHub Actions repo variables (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`) so the deploy workflow bakes them into the build, and locally in a `.env` file (gitignored) for `npm run dev`, matching `.env.example`.
6. Push to `main` (or re-run the workflow) to redeploy with sync enabled. The header's SYNC button will now offer "Start Syncing" instead of showing the "not configured" notice.

**UI entry point**: the SYNC button in the header (`src/components/Header.tsx`) opens `SyncSettingsModal`, which lets a user generate a new vault code (uploads their current local collection to it) or join an existing one by pasting a code from another device (merges that device's local-only items into the vault). Disabling sync just stops the live listener and clears the stored code — it does not delete the vault's Firestore data, so re-joining with the same code later picks up where it left off.

## 8. Organise: Physical Storage Boxes & Genre Editing (August 2026)

Two related additions on top of the existing genre framework (`src/utils/genre.ts`, always normalizes to one Discogs macro-genre + up to 3 styles):

**Editable genre/styles**: `AddToShelfModal` previously only *displayed* the genre/styles a scan produced — there was no way to correct a bad AI guess or add a style Discogs doesn't use. It now has a Genre dropdown (constrained to the fixed Discogs macro-genre list, since that's what genre *means* in this app) and a free-text Sub-Genres/Styles chip editor (up to 3). This is safe against `App.tsx`'s `sanitizeShelfItem` re-normalization on every save/load: as long as the genre stays an exact macro-genre string, `normalizeDiscogsGenre` passes user-entered styles through unchanged (dedup + cap at 3) rather than overwriting them.

**Multi-select genre/style filtering on MY SHELF**: the old genre filter was a single-select dropdown. `MyShelfTab` now has a togglable chip panel for both genre and style, each multi-select (OR within a facet, AND across facets — e.g. "Rock or Jazz" AND "Prog Rock or Fusion"). Style options are computed live from whatever genre(s) are currently selected, so the style list narrows as you filter by genre.

**Organise tab (`src/components/OrganiseTab.tsx`)**: user-defined "Boxes" represent physical storage (a crate, a shelf, a case — whatever the collector actually uses). Data model: `VinylBox { id, name, createdAt }` (`src/types.ts`), stored in `src/utils/boxes.ts` (`localStorage` key `vinylvault_boxes`) and, when Cross-Device Sync is enabled, also synced through Firestore under `/vaults/{vaultCode}/boxes/{boxId}` — `src/utils/vaultSync.ts` was generalized from a shelf-items-only module (`subscribeToVault`, `upsertVaultItem`, ...) to a generic per-collection one (`subscribeToVaultCollection<T>`, `upsertVaultDoc<T>`, ...) so both `shelfItems` and `boxes` reuse the same sync plumbing; `firestore.rules` was correspondingly broadened from a hardcoded `shelfItems` path match to `/vaults/{vaultCode}/{collection}/{docId}`.

- Each `ShelfItem` optionally carries a `boxId` (set via the "Storage Box" selector in `AddToShelfModal`, or by moving it in the Organise tab itself). No `boxId`, or a `boxId` pointing at a box that no longer exists, means the record shows under the virtual **Uncategorised** box — this is computed at render time, not a real stored box, so it can't be renamed or deleted.
- Deleting a box doesn't touch the underlying shelf records — anything filed in it just falls back to Uncategorised (`App.tsx`'s `handleDeleteBox` clears `boxId` on affected items and re-syncs them).
- The assigned box (if any) also shows as a small badge on each card in **MY SHELF**, not just inside the Organise tab.
