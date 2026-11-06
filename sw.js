// Service Worker: legt alle App-Dateien im Handy-Speicher ab, damit die App offline läuft.
// WICHTIG: Bei jeder Änderung an App-Dateien VERSION hochzählen, sonst sieht das Handy die Änderung nicht.
const VERSION = 'v6';
const CACHE = 'koch-app-' + VERSION;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/routes.js',
  'js/dom.js',
  'js/db.js',
  'js/pantry.js',
  'js/barcode.js',
  'js/produkt.js',
  'js/off.js',
  'js/scanner.js',
  'js/backup.js',
  'js/sicherung.js',
  'js/version.js',
  'js/einkauf.js',
  'js/screens/leer.js',
  'js/screens/vorrat.js',
  'js/screens/einstellungen.js',
  'js/screens/einkauf.js',
  'js/screens/scan.js',
  'lib/barcode-detector/ponyfill.js',
  'lib/barcode-detector/zxing-exported.js',
  'lib/zxing-wasm/zxing_reader.wasm',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache: 'reload' umgeht den Zwischenspeicher von GitHub Pages, damit wirklich die neue Datei kommt
      await Promise.all(
        ASSETS.map(async (url) => {
          const antwort = await fetch(new Request(url, { cache: 'reload' }));
          if (!antwort.ok) throw new Error('Konnte nicht laden: ' + url);
          await cache.put(url, antwort);
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const namen = await caches.keys();
      await Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET') return;
  // Nur eigene Dateien aus dem Speicher bedienen. Anfragen an Open Food Facts gehen direkt ins Netz.
  if (new URL(anfrage.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const treffer = await caches.match(anfrage, { ignoreSearch: true });
      if (treffer) return treffer;
      try {
        return await fetch(anfrage);
      } catch (e) {
        if (anfrage.mode === 'navigate') return caches.match('index.html');
        throw e;
      }
    })()
  );
});
