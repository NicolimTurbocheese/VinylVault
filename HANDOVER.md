# VinylVault - Application Handover & Engineering Documentation

**Project Name:** VinylVault — Vinyl Collector Identification, Grading & Collection Management Suite  
**Date:** August 2026  
**Architecture:** Static React 19 frontend (Vite + Tailwind CSS) deployed as a static site, backed by Vercel Serverless Functions (`/api/*.ts`) for calls that need a secret key (Google Gemini AI via `@google/genai`) or need to avoid browser CORS restrictions (Discogs / MusicBrainz / iTunes). Converted from an earlier Express-server architecture — see "Static Conversion Notes" below.

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

3. **Multi-Source Cover Art Refresher (`src/components/RecordCoverImage.tsx`, `/api/cover-art`)**
   - **Multi-API Fallback**: Queries Discogs API (by catalogue # or pressing title), iTunes Search API (with strict keyword/title matching), and Cover Art Archive (MusicBrainz).
   - **Refresher Control**: Circular refresh badge allows collectors to cycle through verified high-resolution cover references on demand.

4. **Grading & Complete Valuation Engine (`src/utils/valuation.ts`, `src/components/AddToShelfModal.tsx`)**
   - Goldmine Grading standard (M, NM, VG+, VG, G+, G, P).
   - Factors in sleeve condition, vinyl media condition, OBI strip presence, Japanese insert inclusions, autographed sleeves, or physical flaws (e.g. seam splits, ring wear, warping).

5. **Collection Insights & Portfolio Dashboard (`src/components/CollectionInsightsTab.tsx`)**
   - Portfolio total valuation (Low, Median, High).
   - Top valuable records leaderboard, genre breakdown charts (Recharts), and country pressing analytics.

---

## 2. Recent Bug Fixes & Resolved Issues

| Issue / Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Missing Collection Records on Reload** (historical, pre-static-conversion) | Server restart reset `shelf-data.json` to default seed, overwriting client state. | Superseded by the static-site conversion: the server-side `shelf-data.json` store was removed entirely and the shelf now persists only in browser `localStorage`, so there's no server restart to lose data to. See "Static Conversion Notes" for the remaining cross-device tradeoff. |
| **"Save to Cabinet" Terminology Reversion** | Inconsistent UI text across modal, scan, and shelf tabs. | Standardized all action buttons and headings to **"SAVE TO SHELF"** paired with the `BookmarkPlus` icon. |
| **Incorrect Refreshed Cover Art** (e.g., *Beauty & the Beast* cover appearing for *Grease*) | Unfiltered iTunes search queries for "Various Artists" assigned mismatched soundtrack covers. | Built `/api/cover-art` backend route with strict album title matching, stripping generic artist terms, and catalogue number verification. |
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

---

## 4. Recommended Future Improvements

### Priority 1: Authentication & User Accounts
- **Firebase Auth / Cloud Storage**: Upgrade `shelf-data.json` to multi-tenant Cloud Firestore and Firebase Auth so multiple collectors can maintain separate private vinyl vaults with cross-device sync.

### Priority 2: Discogs OAuth Integration
- **Direct Collection Import/Export**: Implement Discogs OAuth so users can sync their existing Discogs collection and wantlists directly with VinylVault with one click.

### Priority 3: Barcode & Audio Acoustic Fingerprinting
- **WebCam Live Barcode Scanner**: Integrate `zxing-js` for real-time EAN/UPC barcode camera scanning.
- **Audio Sample Recognition**: Integrate Chromaprint / AcoustID audio snippet scanning for spinning turntables.

### Priority 4: Market Value Price Tracking over Time
- **Historical Charting**: Track valuation trends over time (e.g. 6-month value history graphs) to highlight appreciating records in the user's collection.

---

## 5. Environment & Running the Application

- **Frontend Dev Command**: `npm run dev` (runs `vite` only — serves the React app, but `/api/*` calls will 404 since there's no serverless runtime under plain Vite)
- **Full Local Dev (frontend + API functions)**: `npx vercel dev` (requires a free Vercel account/login; emulates the `/api/*.ts` serverless functions alongside the Vite frontend)
- **Build Command**: `npm run build` (static `vite build` only — output in `dist/`)
- **Lint Verification**: `npm run lint`
- **Environment Variables**:
  - `GEMINI_API_KEY`: Set in the Vercel project's environment variables (Settings → Environment Variables). Used only inside `/api/identify-record.ts` and `/api/recalculate-valuation.ts` — never exposed to the client bundle.

## 6. Static Conversion Notes (August 2026)

VinylVault was converted from an Express server (`server.ts`, requiring a persistent Node host) to a fully static frontend + Vercel Serverless Functions architecture, so it can deploy on free static hosting instead of a paid/limited Node host:

- **What moved to `/api/*.ts`**: `identify-record.ts` and `recalculate-valuation.ts` (both need `GEMINI_API_KEY` kept secret, so they must run server-side) and `cover-art.ts` (runs server-side mainly to sidestep browser CORS restrictions on Discogs/MusicBrainz). Shared helpers (genre normalization, format cleanup, valuation math, Discogs/MusicBrainz search) live in `api/_lib/shared.ts`.
- **What changed in the frontend**: `src/App.tsx` no longer calls `/api/shelf*` — there is no server-side shelf database anymore. The shelf collection is stored purely in browser `localStorage`.
- **Known tradeoff**: without a server-side database, the collection does **not** sync across devices/browsers — it's local to whichever browser saved it. If cross-device sync becomes a priority, the fix is still what's listed under "Priority 1" above (Firebase/Firestore or a similar backend-as-a-service), which is compatible with this static + serverless architecture (no need to reintroduce a persistent Node server).
