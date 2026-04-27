/* Namaz PWA v3.1 — Service Worker
   Cache First + Network Update. Skip api.groq.com / api.deepseek.com. */
const VERSION = 'v3.1';
const BUILD   = (self.registration && self.registration.scope) ? '20260423' : '20260423';
const CACHE_NAME = `namaz-${VERSION}-${BUILD}-${Date.now()}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './namaz-guide-assets/vendor/qrcode.min.js',
  './namaz-guide-assets/icons/icon-192.png',
  './namaz-guide-assets/icons/icon-512.png',
  './namaz-guide-assets/icons/apple-touch-icon.png',
  './namaz-guide-assets/img/rijaal/niet.png',
  './namaz-guide-assets/img/rijaal/takbir.png',
  './namaz-guide-assets/img/rijaal/qyam-qyraat.png',
  './namaz-guide-assets/img/rijaal/ruku.png',
  './namaz-guide-assets/img/rijaal/sajda.png',
  './namaz-guide-assets/img/rijaal/tashahud.png',
  './namaz-guide-assets/img/rijaal/tashahud-legs.png',
  './namaz-guide-assets/img/rijaal/tashahud-edu.png',
  './namaz-guide-assets/img/rijaal/salam-right.png',
  './namaz-guide-assets/img/rijaal/salam-left.png',
  './namaz-guide-assets/img/rijaal/dua.png',
  './namaz-guide-assets/audio/02_Takbir.mp3',
  './namaz-guide-assets/audio/03_Subhanaka+04_Istiaza.mp3',
  './namaz-guide-assets/audio/05_Fatiha+12_Kausar.mp3',
  './namaz-guide-assets/audio/05_Fatiha.mp3',
  './namaz-guide-assets/audio/07_Dua-ruku.mp3',
  './namaz-guide-assets/audio/08_SamiaLlahu+09_Rabbana.mp3',
  './namaz-guide-assets/audio/10_Dua-sudjud.mp3',
  './namaz-guide-assets/audio/11_Rabbigfirli.mp3',
  './namaz-guide-assets/audio/13_attahiyat.mp3',
  './namaz-guide-assets/audio/13_attahiyat+14_Salavat+15_dua-attahiyat.mp3',
  './namaz-guide-assets/audio/16_salam.mp3',
  './namaz-guide-assets/audio/17_dua-posle-namaza.mp3',
  './namaz-guide-assets/audio/Basmala.mp3',
  './namaz-guide-assets/audio/Fatiha+Ikhlas.mp3'
];

const NO_CACHE_HOSTS = ['api.groq.com', 'api.deepseek.com'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(ASSETS.map(async (url) => {
        try {
          const res = await fetch(url, { cache: 'reload' });
          if (res && (res.ok || res.type === 'opaque')) await cache.put(url, res);
        } catch (_) { /* offline-tolerant */ }
      }));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  if (NO_CACHE_HOSTS.some(h => url.hostname.endsWith(h))) return; // network-only

  // Fonts / Google: stale-while-revalidate with cache
  const isAsset = url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: false });
    const network = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque') && isAsset) {
        cache.put(req, res.clone()).catch(()=>{});
      }
      return res;
    }).catch(() => null);

    if (cached) {
      network.catch(()=>{}); // warm in background
      return cached;
    }
    const fresh = await network;
    if (fresh) return fresh;
    // Navigation offline fallback
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response('', { status: 504, statusText: 'offline' });
  })());
});
