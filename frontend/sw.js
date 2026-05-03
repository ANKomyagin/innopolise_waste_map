const CACHE_NAME = 'qrbin-cache-v1';
const urlsToCache = [
  '/',
  '/css/tailwind.css',
  '/css/theme.css',
  '/vendor/css/fontawesome.min.css',
  '/js/resident.js',
  '/js/qr_scan.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});