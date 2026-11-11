/* Service worker · CDSS TB Materna · RN
   Funciona con o sin internet. Al publicar una versión nueva, cambie VERSION. */
const VERSION = 'tb-materna-v1.0.0';
const CORE = ['./', './index.html'];
const FONT_CACHE = 'tb-materna-fonts';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Páginas: red primero (máx. 4 s) y, si falla, la copia guardada. Nunca se queda cargando. */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await Promise.race([fetch(req), timeout(4000)]);
        if (res && res.ok) {
          const c = await caches.open(VERSION);
          c.put('./index.html', res.clone());
        }
        return res;
      } catch (e) {
        const c = await caches.open(VERSION);
        return (await c.match('./index.html')) || (await c.match('./')) ||
          new Response('<h1>Sin conexión</h1><p>Abra la app una vez con internet para guardarla.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  /* Tipografías de Google: se guardan cuando hay red; sin red, la app usa fuentes del sistema. */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const c = await caches.open(FONT_CACHE);
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
    return;
  }

  /* Resto del mismo origen: caché primero, luego red. */
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    })());
  }
});
