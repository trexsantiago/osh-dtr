const CACHE_NAME = "wpu-dtr-cache-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/qr-scanner.js",
  "./js/app.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/sheets-api.js",
  "./img/icons/icon-192x192.png",
  "./img/icons/icon-512x512.png"
];

// Install event: Cache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch event: Serve cached resources
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Activate event: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
