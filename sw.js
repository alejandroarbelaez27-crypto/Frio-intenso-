/* Frío Intenso · Service worker
   Permite abrir la app sin internet.
   - La app (index.html): primero intenta la versión nueva; si no hay señal, usa la guardada.
   - Íconos y fuentes: se guardan la primera vez y luego salen del celular.
   - Datos de Supabase: nunca se guardan aquí, siempre van en vivo. */
const CACHE = 'frio-intenso-v1';
const BASE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;
  const esApp = req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));
  e.respondWith(esApp ? redPrimero(req) : cachePrimero(req));
});

// La app: red primero (máximo 4 s de espera), si falla usa la copia guardada
async function redPrimero(req){
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, no) => setTimeout(() => no(new Error('sin respuesta')), 4000))
    ]);
    if (res && res.ok) cache.put('./index.html', res.clone());
    return res;
  } catch (err) {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}

// Archivos que no cambian: primero del celular, si no están se descargan y se guardan
async function cachePrimero(req){
  const guardada = await caches.match(req);
  if (guardada) return guardada;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')){
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(req, copia));
    }
    return res;
  } catch (err) {
    return Response.error();
  }
}
