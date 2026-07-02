/* Whalabi Service Worker — app shell offline + estructura Web Push preparada.
 *
 * Estrategia: precache del shell; network-first para navegación con fallback
 * al shell offline. NO cachea respuestas de Matrix (sync/mensajes) — esos
 * deben ir siempre a la red.
 */
const CACHE = 'whalabi-shell-v5';
const SHELL = ['/', '/login', '/offline', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // No interceptar llamadas a Matrix ni a la API (siempre red).
  if (url.pathname.startsWith('/_matrix') || url.pathname.startsWith('/api')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline').then((r) => r || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});

/* --- Web Push (estructura preparada; activar cuando haya VAPID configurado) --- */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = { title: 'Whalabi', body: 'Nuevo mensaje', url: '/', type: 'message' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch (_e) {
    payload.body = event.data.text();
  }
  const isCall = payload.type === 'call';
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Las llamadas suenan/vibran e insisten hasta que el usuario interactúe.
      tag: isCall ? 'whalabi-call' : undefined,
      renotify: isCall,
      requireInteraction: isCall,
      vibrate: isCall ? [600, 300, 600, 300, 600] : [200],
      data: { url: payload.url || '/chat' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/chat';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Si ya hay una ventana de Whalabi abierta, enfocarla en vez de abrir otra.
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
