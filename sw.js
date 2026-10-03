/* =========================================================
   PocketStore · Service Worker
   - install:  guarda el App Shell en caché.
   - activate: borra cachés de versiones anteriores.
   - fetch:    "cache first": si ya está guardado se sirve desde
               la caché; si no, se pide a internet y se guarda.
   ========================================================= */
const SHELL_CACHE = 'pocketstore-shell-v2';
const DATA_CACHE = 'pocketstore-data-v1';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon/icon-192.png',
  './icon/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Mona+Sans:wdth,wght@75..125,200..900&display=swap'
];

// 1) INSTALL: precarga del App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 2) ACTIVATE: limpieza de cachés viejas y control inmediato de la página
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// 3) FETCH: primero la caché, después la red
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Se guardan las respuestas correctas: JSON de la API, portadas, fuentes...
    // (las portadas llegan como respuesta "opaque" porque vienen de otro dominio)
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Sin internet y sin copia guardada
    if (request.mode === 'navigate') return caches.match('./index.html');
    return Response.error();
  }
}
