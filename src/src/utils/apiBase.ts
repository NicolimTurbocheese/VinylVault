// The frontend (GitHub Pages) and the API functions (Firebase Cloud Functions) are
// hosted on different origins, so calls need an absolute URL rather than a same-origin
// relative path.
//
// Set VITE_API_BASE_URL to your Firebase project's functions base URL, e.g.:
//   https://us-central1-your-project-id.cloudfunctions.net
// (find the exact region/URL for each function in the Firebase Console → Functions,
// or in the `firebase deploy` output — they all share the same base, just the function
// name differs: .../identifyRecord, .../recalculateValuation, .../coverArt)
//
// Left unset, this defaults to a same-origin "/api" path — only correct if you later
// front the functions with Firebase Hosting rewrites (or another same-origin proxy)
// instead of calling Cloud Functions URLs directly cross-origin.
const DEFAULT_BASE = "/api";

export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
