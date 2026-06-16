const CACHE_NAME = 'prevafrica-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/prevafrica_icon_192.png',
  '/images/prevafrica_icon_512.png',
  '/images/prevafrica_phone_screenshot.png',
  '/images/prevafrica_tablet_screenshot.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Use gentle cache adding so network requests don't fail installation
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(err => console.warn('Cache add failed for:', url, err)))
        );
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).catch(error => {
          // Si on est hors-ligne et que l'utilisateur demande une page HTML, on renvoie la racine '/' cachée
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/');
          }
          return Promise.reject(error);
        });
      })
  );
});
