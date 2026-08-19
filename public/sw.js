/* VinylVault service worker.
 *
 * The point is crate-digging: standing in a shop with no signal, wanting to check whether
 * a record is already on the shelf. The collection itself lives in localStorage and is
 * available offline for free — what was missing was the app shell needed to render it.
 *
 * Deliberately hand-rolled rather than generated. Vite emits content-hashed asset names,
 * so a precache manifest would have to be built and kept in sync; caching those hashed
 * files on first request achieves the same result without that machinery, because a name
 * that changes on every build can never serve stale content.
 */

const VERSION = "v1";
const SHELL_CACHE = `vv-shell-${VERSION}`;
const ASSET_CACHE = `vv-assets-${VERSION}`;
const IMAGE_CACHE = `vv-images-${VERSION}`;

// Cover art is remote and unbounded, so its cache is capped. Roughly one entry per record
// with headroom for re-fetches.
const IMAGE_CACHE_LIMIT = 400;

// Filled in at build time by the vv-sw-precache Vite plugin — these are content-hashed,
// so the list can't be written by hand.
const PRECACHE_ASSETS = /*__VV_PRECACHE__*/[];

const SHELL_URLS = ["./", "./index.html", "./logo.svg", "./icon-192.png", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 can't fail the whole install and leave the app
      // permanently without a worker.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((u) => cache.add(u))))
      .then(() =>
        caches
          .open(ASSET_CACHE)
          .then((c) => Promise.allSettled(PRECACHE_ASSETS.map((u) => c.add(u))))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("vv-") && !k.endsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  // Oldest-first; cache.keys() preserves insertion order.
  await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache API calls. A stale valuation or market price is worse than no answer,
  // and these are the endpoints whose whole purpose is to be current.
  if (/cloudfunctions\.net|\/api\//.test(url.href)) return;

  // Navigations: try the network so a deployed update is picked up promptly, and fall
  // back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() =>
          caches.match("./index.html").then((r) => r || caches.match("./"))
        )
    );
    return;
  }

  // Hashed build assets: cache-first is safe because the filename changes when the
  // content does.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Remote cover art: serve from cache immediately, refresh in the background.
  if (req.destination === "image") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              cache.put(req, res.clone()).then(() => trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT));
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
  }
});
