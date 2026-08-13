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

- **Frontend Dev Command**: `npm run dev` (runs `vite` only — serves the React app, but `/api/*` calls will 404 since there's no serverless runtime under plain Vite)
- **Full Local Dev (frontend + API functions)**: `npx vercel dev` (requires a free Vercel account/login; emulates the `/api/*.ts` serverless functions alongside the Vite frontend)
- **Build Command**: `npm run build` (static `vite build` only — output in `dist/`)
- **Lint Verification**: `npm run lint`
- **Environment Variables**: see `.env.example` for the full list. Summary:
  - `GEMINI_API_KEY`: Set in the Vercel project's environment variables (Settings → Environment Variables). Used only inside `/api/identify-record.ts` and `/api/recalculate-valuation.ts` — never exposed to the client bundle.
  - `VITE_FIREBASE_*` (six values): optional — only needed to enable Cross-Device Sync (see below). Safe to expose client-side (they're not secrets); set them in Vercel too so they're baked into the production build, and locally in a `.env` file (gitignored) for `npm run dev`.

## 6. Static Conversion Notes (August 2026)

VinylVault was converted from an Express server (`server.ts`, requiring a persistent Node host) to a fully static frontend + Vercel Serverless Functions architecture, so it can deploy on free static hosting instead of a paid/limited Node host:

- **What moved to `/api/*.ts`**: `identify-record.ts` and `recalculate-valuation.ts` (both need `GEMINI_API_KEY` kept secret, so they must run server-side) and `cover-art.ts` (runs server-side mainly to sidestep browser CORS restrictions on Discogs/MusicBrainz). Shared helpers (genre normalization, format cleanup, valuation math, Discogs/MusicBrainz search) live in `api/_lib/shared.ts`.
- **What changed in the frontend**: `src/App.tsx` no longer calls `/api/shelf*` — there is no server-side shelf database anymore. The shelf collection is stored purely in browser `localStorage`.
- **Known tradeoff (since resolved)**: without a server-side database, the collection didn't sync across devices/browsers by default — it was local to whichever browser saved it. Cross-device sync via Firestore was added afterward (see section 7) without reintroducing a persistent Node server, confirming the static + serverless architecture was compatible with it.

## 7. Cross-Device Sync (August 2026)

Collections can now sync across devices/browsers via a **Vault Code** — no accounts, no login. The whole feature is opt-in: with no Firebase project configured, the app behaves exactly as before (local-only `localStorage`).

**How it works**: `src/utils/vaultSync.ts` + `src/utils/firebase.ts` talk directly to Cloud Firestore from the browser (no `/api` function involved — Firestore's client SDK handles this, with live updates via `onSnapshot`). A vault's records live at `/vaults/{vaultCode}/shelfItems/{itemId}`. The vault code is a 20-character cryptographically random string generated client-side (`generateVaultCode()`) — knowing the code is the entire access control mechanism, enforced by `firestore.rules` (`vaultCode.size() >= 16`). There's no way to browse/discover other people's vaults; you just can't prove *who* holds a given code (that's the accounts gap noted under Priority 1).

**One-time setup to enable it** (skip this and the app just runs local-only):
1. Create a free project at [Firebase Console](https://console.firebase.google.com/).
2. Firestore Database → Create Database → start in **production mode** (the app's own rules, not Firestore's defaults, will govern access).
3. Firestore Database → Rules → paste the contents of `firestore.rules` in this repo → Publish.
4. Project Settings → General → Your apps → Add app → Web → copy the six config values it gives you.
5. Set them as `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` in Vercel's project environment variables (and locally in `.env` for dev), matching `.env.example`.
6. Redeploy. The header's SYNC button will now offer "Start Syncing" instead of showing the "not configured" notice.

**UI entry point**: the SYNC button in the header (`src/components/Header.tsx`) opens `SyncSettingsModal`, which lets a user generate a new vault code (uploads their current local collection to it) or join an existing one by pasting a code from another device (merges that device's local-only items into the vault). Disabling sync just stops the live listener and clears the stored code — it does not delete the vault's Firestore data, so re-joining with the same code later picks up where it left off.
