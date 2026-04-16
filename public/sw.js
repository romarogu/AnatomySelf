// v2 — Network-first for HTML/JS to ensure latest code
const CACHE = 'anatomyself-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete all old caches
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Never intercept API calls
  if (url.includes('/api/')) return;
  // Network-first for everything — always try to get the latest
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        // Only cache successful GETs of static assets (images, fonts)
        if (resp.ok && e.request.method === 'GET' && (url.match(/\.(png|jpg|jpeg|svg|woff2?|ttf)$/i))) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(e.request)) // Offline fallback
  );
});

// Listen for skip waiting message from client
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
