import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALD_TAGE, tageBis, ablaufStatus, baldAblaufend, datumInTagen, datumInMonaten, kurzText } from '../js/ablauf.js';
import { neuerEintrag, setzeDa } from '../js/pantry.js';

const JETZT = new Date(2026, 10, 9, 15, 0); // 9. November 2026, Ortszeit

test('BALD_TAGE: 3 Tage (so entschieden)', () => {
  assert.equal(BALD_TAGE, 3);
});

test('tageBis: ganze Kalendertage in Ortszeit', () => {
  assert.equal(tageBis('2026-11-09', JETZT), 0);
  assert.equal(tageBis('2026-11-10', JETZT), 1);
  assert.equal(tageBis('2026-11-08', JETZT), -1);
  assert.equal(tageBis('2026-12-01', JETZT), 22);
  assert.equal(tageBis('2026-11-09', new Date(2026, 10, 9, 0, 1)), 0);
  assert.equal(tageBis('2026-11-09', new Date(2026, 10, 9, 23, 59)), 0);
});
test('tageBis: Zeitumstellung verschiebt nichts', () => {
  assert.equal(tageBis('2026-10-26', new Date(2026, 9, 24, 23, 0)), 2); // Umstellung in der Nacht zum 25.10.
  assert.equal(tageBis('2027-03-30', new Date(2027, 2, 27, 1, 0)), 3); // Umstellung am 28.03.
});

test('ablaufStatus: ohne Datum nichts', () => {
  assert.deepEqual(ablaufStatus(null, JETZT), { art: 'keins', tage: null, text: '' });
  assert.deepEqual(ablaufStatus('', JETZT), { art: 'keins', tage: null, text: '' });
});
test('ablaufStatus: überschritten, heute, morgen, bald, später', () => {
  assert.deepEqual(ablaufStatus('2026-11-05', JETZT), { art: 'abgelaufen', tage: -4, text: 'Datum seit 4 Tagen überschritten' });
  assert.deepEqual(ablaufStatus('2026-11-08', JETZT), { art: 'abgelaufen', tage: -1, text: 'Datum gestern überschritten' });
  assert.deepEqual(ablaufStatus('2026-11-09', JETZT), { art: 'bald', tage: 0, text: 'läuft heute ab' });
  assert.deepEqual(ablaufStatus('2026-11-10', JETZT), { art: 'bald', tage: 1, text: 'läuft morgen ab' });
  assert.deepEqual(ablaufStatus('2026-11-12', JETZT), { art: 'bald', tage: 3, text: 'läuft in 3 Tagen ab' });
  assert.deepEqual(ablaufStatus('2026-11-13', JETZT), { art: 'ok', tage: 4, text: 'Haltbar bis 13.11.2026' });
});
test('ablaufStatus: die Schwelle lässt sich ändern', () => {
  assert.equal(ablaufStatus('2026-11-13', JETZT, 5).art, 'bald');
  assert.equal(ablaufStatus('2026-11-13', JETZT, 5).text, 'läuft in 4 Tagen ab');
  assert.equal(ablaufStatus('2026-11-11', JETZT, 1).art, 'ok');
});

test('kurzText: heute, morgen, in N Tagen, überschritten', () => {
  assert.equal(kurzText(0), 'heute');
  assert.equal(kurzText(1), 'morgen');
  assert.equal(kurzText(3), 'in 3 Tagen');
  assert.equal(kurzText(-2), 'überschritten');
});

const ev = (id, name, menge, ablauf, o = {}) => neuerEintrag({ name, art: 'menge', menge, einheit: 'g', ablauf, ...o }, { id });
test('baldAblaufend: nur vorhandene Einträge, überschrittene und bald ablaufende, nach Dringlichkeit', () => {
  const salz = neuerEintrag({ name: 'Salz', art: 'da_leer', ablauf: '2026-11-11' }, { id: 'salz' });
  const leerSalz = setzeDa(neuerEintrag({ name: 'Pfeffer', art: 'da_leer', ablauf: '2026-11-10' }, { id: 'pfeffer' }), false);
  const vorrat = [
    ev('milch', 'Milch', 500, '2026-11-10'),
    ev('joghurt', 'Joghurt', 150, '2026-11-14'), // erst in 5 Tagen: nicht dabei
    ev('brot', 'Brot', 300, '2026-11-07'),
    ev('leer', 'Leer', 0, '2026-11-10'), // nichts mehr da: nicht dabei
    ev('ohne', 'Ohne Datum', 100, null),
    salz,
    leerSalz,
  ];
  const r = baldAblaufend(vorrat, JETZT);
  assert.deepEqual(r.map((x) => [x.eintrag.id, x.status.tage]), [['brot', -2], ['milch', 1], ['salz', 2]]);
  assert.equal(r[0].status.art, 'abgelaufen');
  assert.equal(r[1].status.art, 'bald');
});
test('baldAblaufend: Schwelle änderbar, leere Liste', () => {
  assert.deepEqual(baldAblaufend([], JETZT), []);
  assert.equal(baldAblaufend([ev('j', 'Joghurt', 100, '2026-11-14')], JETZT, 5).length, 1);
});

test('datumInTagen: Schnellknöpfe +3 Tage, +1 Woche', () => {
  assert.equal(datumInTagen(3, JETZT), '2026-11-12');
  assert.equal(datumInTagen(7, JETZT), '2026-11-16');
  assert.equal(datumInTagen(30, JETZT), '2026-12-09');
  assert.equal(datumInTagen(25, new Date(2026, 11, 20)), '2027-01-14');
});
test('datumInMonaten: +1 Monat, am Monatsende nicht über den Monat hinaus', () => {
  assert.equal(datumInMonaten(1, JETZT), '2026-12-09');
  assert.equal(datumInMonaten(1, new Date(2026, 0, 31)), '2026-02-28');
  assert.equal(datumInMonaten(1, new Date(2028, 0, 31)), '2028-02-29');
  assert.equal(datumInMonaten(3, new Date(2026, 10, 30)), '2027-02-28');
  assert.equal(datumInMonaten(12, JETZT), '2027-11-09');
});
