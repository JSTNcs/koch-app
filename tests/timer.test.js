import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findeZeiten, restSekunden, formatRest, zeitText } from '../js/timer.js';

test('findeZeiten: Minuten, Sekunden, Stunden', () => {
  assert.deepEqual(findeZeiten('Die Sauce 15 Minuten köcheln lassen.'), [{ sekunden: 900, text: '15 Minuten' }]);
  assert.deepEqual(findeZeiten('Etwa 20 Minuten backen.'), [{ sekunden: 1200, text: '20 Minuten' }]);
  assert.deepEqual(findeZeiten('Eine Minute rühren: 1 Minute'), [{ sekunden: 60, text: '1 Minute' }]);
  assert.deepEqual(findeZeiten('30 Sekunden anbraten'), [{ sekunden: 30, text: '30 Sekunden' }]);
  assert.deepEqual(findeZeiten('Gut 2 Stunden ruhen lassen'), [{ sekunden: 7200, text: '2 Stunden' }]);
  assert.deepEqual(findeZeiten('Nach 10 Min. wenden'), [{ sekunden: 600, text: '10 Min.' }]);
});
test('findeZeiten: Bereiche nehmen die obere Zahl', () => {
  assert.deepEqual(findeZeiten('6 bis 8 Minuten braten, bis es durchgegart ist.'), [{ sekunden: 480, text: '6 bis 8 Minuten' }]);
  assert.deepEqual(findeZeiten('Bei 200 °C 30 bis 35 Minuten backen'), [{ sekunden: 2100, text: '30 bis 35 Minuten' }]);
  assert.deepEqual(findeZeiten('3-5 Minuten'), [{ sekunden: 300, text: '3-5 Minuten' }]);
});
test('findeZeiten: mehrere Zeiten in einem Schritt, doppelte nur einmal, höchstens drei', () => {
  const z = findeZeiten('Erst 5 Minuten anbraten, dann 10 Minuten köcheln, danach 5 Minuten ruhen.');
  assert.deepEqual(z.map((x) => x.sekunden), [300, 600]);
  assert.equal(findeZeiten('1 Minute, 2 Minuten, 3 Minuten, 4 Minuten').length, 3);
});
test('findeZeiten: Zahlen ohne Zeit werden ignoriert', () => {
  assert.deepEqual(findeZeiten('2 Esslöffel Öl und 200 g Nudeln bei 180 °C.'), []);
  assert.deepEqual(findeZeiten('Kurz anbraten.'), []);
  assert.deepEqual(findeZeiten(''), []);
  assert.deepEqual(findeZeiten(null), []);
});

test('restSekunden: aufgerundet, nie unter 0', () => {
  assert.equal(restSekunden(10_000, 5_000), 5);
  assert.equal(restSekunden(10_000, 5_001), 5);
  assert.equal(restSekunden(10_000, 9_999), 1);
  assert.equal(restSekunden(10_000, 10_000), 0);
  assert.equal(restSekunden(10_000, 20_000), 0);
});
test('formatRest: m:ss und h:mm:ss', () => {
  assert.equal(formatRest(0), '0:00');
  assert.equal(formatRest(9), '0:09');
  assert.equal(formatRest(600), '10:00');
  assert.equal(formatRest(3599), '59:59');
  assert.equal(formatRest(3600), '1:00:00');
  assert.equal(formatRest(7325), '2:02:05');
});
test('zeitText: kurze Beschriftung für den Knopf', () => {
  assert.equal(zeitText(45), '45 Sek.');
  assert.equal(zeitText(60), '1 Min.');
  assert.equal(zeitText(900), '15 Min.');
  assert.equal(zeitText(3600), '1 Std.');
  assert.equal(zeitText(5400), '1 Std. 30 Min.');
});
