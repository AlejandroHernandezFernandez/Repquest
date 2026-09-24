// Keep the offline shell current when application file names change.
const CACHE = "repquest-shell-v1.03";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll([
          "./",
          "./workout-styles.css",
          "./workout-tracker.js",
          "./timer.js",
          "./manifest.webmanifest",
          "./icon-192.png",
          "./icon-512.png",
        ]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("repquest-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  if (
    ![
      "/",
      "/index.html",
      "/workout-styles.css",
      "/workout-tracker.js",
      "/timer.js",
      "/manifest.webmanifest",
      "/icon-192.png",
      "/icon-512.png",
    ].includes(url.pathname)
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && !response.redirected) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((r) => r || Response.error()),
      ),
  );
});
