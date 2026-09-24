/* Service worker de Cada día: caché de la app para uso sin conexión + notificaciones push. */
const VERSION = 'cadadia-v1';
const CONCHA = [
  './', './index.html', './manifest.webmanifest',
  './css/estilos.css',
  './js/app.js', './js/estado.js', './js/fechas.js', './js/contenido.js', './js/confeti.js',
  './js/github.js', './js/sincronizar.js', './js/notificaciones.js', './js/iconos.js', './js/vistas.js',
  './contenido/index.json', './contenido/divina-comedia.json',
  './iconos/icono.svg', './iconos/icono-192.png', './iconos/icono-512.png', './iconos/insignia-96.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CONCHA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname === 'api.github.com') return; // nunca cachear la API
  // Fuentes de Google: caché al vuelo.
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.open(VERSION + '-fuentes').then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // App y contenido: red primero (para coger versiones nuevas), caché si falla.
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) caches.open(VERSION).then((c) => c.put(e.request, r.clone()));
      return r;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html'))),
  );
});

self.addEventListener('push', (e) => {
  let datos = {};
  try { datos = e.data ? e.data.json() : {}; } catch { datos = { body: e.data ? e.data.text() : '' }; }
  const titulo = datos.title || 'Cada día';
  const opciones = {
    body: datos.body || 'Hoy toca tu lectura.',
    icon: './iconos/icono-192.png',
    badge: './iconos/insignia-96.png',
    tag: datos.tag || 'recordatorio',
    renotify: true,
    data: { url: datos.url || './#/hoy' },
    actions: [{ action: 'leer', title: 'Leer ahora' }],
  };
  e.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || './', self.location.href).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.startsWith(self.registration.scope) && 'focus' in v) { v.navigate(destino); return v.focus(); }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
