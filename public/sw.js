/**
 * PWA offline shell for practice (Phase 5 §4).
 *
 * Scored/generated content always needs a live Gemini call, so there is no
 * offline scoring or generation — this only keeps the app CHROME usable
 * offline: previously-visited pages, static assets, and a small set of
 * precached shell routes load from cache when the network is unreachable,
 * so a learner who loses connectivity mid-session can still navigate the
 * app and see already-loaded results rather than a blank error page.
 *
 * API routes (/api/*) are always network-only — caching a scoring or
 * generation response would risk serving stale/wrong exam content, which
 * is worse than a clear "you're offline" failure.
 */

const CACHE_VERSION = "bandup-shell-v1";

const SHELL_ROUTES = ["/", "/practice", "/progress", "/plan"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ROUTES).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only ever handle same-origin GETs — everything else (API calls,
  // cross-origin requests, non-GET methods) passes straight through.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (isStaticAsset(url)) {
    // Hashed, immutable filenames — safe to serve cache-first.
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
            return response;
          }),
      ),
    );
    return;
  }

  // Page navigations: network-first (always prefer fresh content), falling
  // back to whatever was last cached for this URL when offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("/"))),
  );
});
