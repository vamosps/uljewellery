const CACHE_NAME = 'ul-jewellery-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './admin-manifest.json',
  './favicon.svg',
  './logo.png',
  './favicon.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('SW cache.addAll warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Ignore non-http(s) schemes (like chrome-extension://, moz-extension://)
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  // Never intercept realtime database, external APIs, tracking pixels, or third-party CDN scripts
  if (
    url.includes('supabase.co') ||
    url.includes('telegram.org') ||
    url.includes('imgbb.com') ||
    url.includes('ibb.co') ||
    url.includes('facebook.net') ||
    url.includes('facebook.com') ||
    url.includes('snapchat.com') ||
    url.includes('sc-static.net') ||
    url.includes('tiktok.com') ||
    url.includes('google-analytics.com') ||
    url.includes('googletagmanager.com') ||
    url.includes('clarity.ms') ||
    url.includes('cdn.jsdelivr.net') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('cdn.tailwindcss.com')
  ) {
    return;
  }

  // For HTML documents / Navigations: Network First with Cache Fallback
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
          return new Response('Network error occurred', { status: 408, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // For local static assets (same-origin): Stale-While-Revalidate
  const isSameOrigin = url.startsWith(self.location.origin);
  if (isSameOrigin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => {
            return cachedResponse;
          });

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// Push & System Notification Handlers
self.addEventListener('push', (event) => {
  let data = { 
    title: 'طلب جديد من UL JEWELLERY! 💎', 
    body: 'وصلك طلب شراء جديد، اضغط لعرض التفاصيل والتواصل مع العميل',
    url: './admin.html#orders'
  };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: './favicon.svg',
    badge: './favicon.svg',
    vibrate: [300, 100, 300, 100, 300],
    data: {
      url: data.url || './admin.html#orders'
    },
    actions: [
      { action: 'open_order', title: 'عرض الطلب 📋' },
      { action: 'close', title: 'إغلاق ✖' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || './admin.html#orders';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ((client.url.includes('admin.html') || client.url.includes('vamosads.html')) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
