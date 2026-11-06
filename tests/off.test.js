import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sucheBeiOff } from '../js/off.js';

const antwort = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('sucheBeiOff: gefunden', async () => {
  let angefragt;
  const fetchFn = async (url, optionen) => {
    angefragt = { url, optionen };
    return antwort(200, { status: 1, product: { product_name: 'Nutella', quantity: '450 g' } });
  };
  const r = await sucheBeiOff('3017620422003', { fetchFn });
  assert.equal(r.status, 'gefunden');
  assert.equal(r.produkt.name, 'Nutella');
  assert.equal(r.produkt.packung, 450);
  // Datenschutz: nur der Barcode in der Adresse, keine Cookies, keine Herkunftsadresse
  assert.match(angefragt.url, /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/3017620422003\.json\?fields=/);
  assert.equal(angefragt.optionen.credentials, 'omit');
  assert.equal(angefragt.optionen.referrerPolicy, 'no-referrer');
});

test('sucheBeiOff: UPC-A wird als EAN-13 angefragt', async () => {
  let url;
  await sucheBeiOff('036000291452', { fetchFn: async (u) => ((url = u), antwort(200, { status: 0 })) });
  assert.match(url, /product\/0036000291452\.json/);
});

test('sucheBeiOff: unbekanntes Produkt (404 oder status 0)', async () => {
  assert.deepEqual(await sucheBeiOff('1', { fetchFn: async () => antwort(404, { status: 0 }) }), { status: 'unbekannt' });
  assert.deepEqual(await sucheBeiOff('1', { fetchFn: async () => antwort(200, { status: 0 }) }), { status: 'unbekannt' });
});

test('sucheBeiOff: Serverfehler und kein Internet sind "fehler", nicht "unbekannt"', async () => {
  const a = await sucheBeiOff('1', { fetchFn: async () => antwort(503, {}) });
  assert.equal(a.status, 'fehler');
  const b = await sucheBeiOff('1', {
    fetchFn: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  assert.equal(b.status, 'fehler');
  assert.match(b.grund, /Internet/);
});

test('sucheBeiOff: Zeitüberschreitung', async () => {
  const fetchFn = (url, { signal }) =>
    new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' }))));
  const r = await sucheBeiOff('1', { fetchFn, timeoutMs: 20 });
  assert.equal(r.status, 'fehler');
  assert.match(r.grund, /zu lange/);
});
