import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erzeugeSicherung, pruefeSicherung, sicherungsDateiname, tageSeit, sicherungsHinweis } from '../js/backup.js';
import { neuerEintrag, setzeDa } from '../js/pantry.js';
import { neuesProdukt } from '../js/produkt.js';

const JETZT = new Date('2026-11-06T12:00:00.000Z');
const tageZurueck = (n, extraMs = 0) => new Date(JETZT.getTime() - n * 86400000 - extraMs).toISOString();

const nudeln = neuerEintrag({ name: 'Nudeln', art: 'menge', menge: 500, einheit: 'g', barcode: '4006381333931', ablauf: '2027-01-31' }, { id: 'e1' });
const salz = setzeDa(neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 'e2' }), false);
const produkt = neuesProdukt({
  barcode: '4006381333931',
  name: 'Nudeln',
  art: 'menge',
  packung: 500,
  einheit: 'g',
  naehrwerte: { kcal: 350, eiweiss: 12, kohlenhydrate: 70, fett: 2 },
  quelle: 'off',
});
const daten = () => ({
  vorrat: [nudeln, salz],
  produkte: [produkt],
  einstellungen: [
    { key: 'letzteSicherung', value: tageZurueck(3) },
    { key: 'irgendwas', value: 42 },
  ],
});

// --- Erzeugen ---
test('erzeugeSicherung: Kennzeichen, Zeitpunkt und Daten', () => {
  const s = erzeugeSicherung(daten(), JETZT);
  assert.equal(s.app, 'koch-app');
  assert.equal(s.version, 1);
  assert.equal(s.erstelltAm, '2026-11-06T12:00:00.000Z');
  assert.equal(s.daten.vorrat.length, 2);
  assert.equal(s.daten.produkte.length, 1);
});
test('erzeugeSicherung: "letzteSicherung" gehört nicht in die Datei', () => {
  const s = erzeugeSicherung(daten(), JETZT);
  assert.deepEqual(s.daten.einstellungen, [{ key: 'irgendwas', value: 42 }]);
});

// --- Hin und zurück ---
test('Export und Import: alles kommt unverändert zurück (auch Gewürz "leer")', () => {
  const text = JSON.stringify(erzeugeSicherung(daten(), JETZT));
  const r = pruefeSicherung(text);
  assert.deepEqual(r.vorrat, [nudeln, salz]);
  assert.equal(r.vorrat[1].da, false);
  assert.deepEqual(r.produkte, [produkt]);
  assert.deepEqual(r.einstellungen, [{ key: 'irgendwas', value: 42 }]);
  assert.equal(r.erstelltAm, '2026-11-06T12:00:00.000Z');
});
test('Import: leere Sicherung ist erlaubt', () => {
  const r = pruefeSicherung(JSON.stringify(erzeugeSicherung({ vorrat: [], produkte: [], einstellungen: [] }, JETZT)));
  assert.equal(r.vorrat.length, 0);
  assert.equal(r.produkte.length, 0);
});

// --- Kaputte Dateien ---
const gueltig = () => JSON.parse(JSON.stringify(erzeugeSicherung(daten(), JETZT)));
const mitAenderung = (f) => {
  const s = gueltig();
  f(s);
  return JSON.stringify(s);
};

test('Import: Datei ist kein JSON', () => {
  assert.throws(() => pruefeSicherung('das ist keine Sicherung'), /keine Sicherung|gelesen/);
  assert.throws(() => pruefeSicherung(''), /gelesen|leer/);
});
test('Import: fremde Datei', () => {
  assert.throws(() => pruefeSicherung('{"foo": 1}'), /Koch-App/);
  assert.throws(() => pruefeSicherung('[1,2,3]'), /Koch-App/);
  assert.throws(() => pruefeSicherung('null'), /Koch-App/);
  assert.throws(() => pruefeSicherung(mitAenderung((s) => (s.app = 'andere-app'))), /Koch-App/);
});
test('Import: Datei von einer neueren App-Version', () => {
  assert.throws(() => pruefeSicherung(mitAenderung((s) => (s.version = 2))), /neuer/);
});
test('Import: fehlende oder falsche Daten', () => {
  assert.throws(() => pruefeSicherung(mitAenderung((s) => delete s.daten)), /Daten/);
  assert.throws(() => pruefeSicherung(mitAenderung((s) => (s.daten.vorrat = 'x'))), /Vorrat/);
  assert.throws(() => pruefeSicherung(mitAenderung((s) => delete s.daten.produkte)), /Produkte/);
});
test('Import: ungültiger Vorrats-Eintrag wird mit Nummer gemeldet', () => {
  assert.throws(() => pruefeSicherung(mitAenderung((s) => (s.daten.vorrat[1].name = ''))), /Vorrat.*2|Eintrag 2/);
  assert.throws(() => pruefeSicherung(mitAenderung((s) => (s.daten.vorrat[0].menge = -5))), /Menge/);
  assert.throws(() => pruefeSicherung(mitAenderung((s) => (s.daten.vorrat[0] = 'quatsch'))), /Vorrat/);
  assert.throws(() => pruefeSicherung(mitAenderung((s) => delete s.daten.vorrat[0].id)), /Kennung|id/i);
});
test('Import: ungültiges Produkt', () => {
  assert.throws(() => pruefeSicherung(mitAenderung((s) => (s.daten.produkte[0].name = ''))), /Produkt/);
});
test('Import: doppelte Kennung im Vorrat', () => {
  assert.throws(() => pruefeSicherung(mitAenderung((s) => (s.daten.vorrat[1].id = 'e1'))), /doppelt/);
});
test('Import: zusätzliche fremde Felder in Einträgen werden verworfen', () => {
  const r = pruefeSicherung(mitAenderung((s) => (s.daten.vorrat[0].boese = '<script>')));
  assert.equal('boese' in r.vorrat[0], false);
});

// --- Dateiname ---
test('sicherungsDateiname: mit Datum', () => {
  assert.equal(sicherungsDateiname(JETZT), 'koch-app-sicherung-2026-11-06.json');
});

// --- Wie lange ist die Sicherung her? ---
test('tageSeit: volle Tage', () => {
  assert.equal(tageSeit(tageZurueck(0, 1000), JETZT), 0);
  assert.equal(tageSeit(tageZurueck(3), JETZT), 3);
  assert.equal(tageSeit(tageZurueck(3, 3600000), JETZT), 3);
  assert.equal(tageSeit('kein Datum', JETZT), null);
  assert.equal(tageSeit(null, JETZT), null);
});

// --- Hinweis ---
test('sicherungsHinweis: ohne Daten keine Erinnerung', () => {
  assert.equal(sicherungsHinweis({ letzte: null, hatDaten: false, jetzt: JETZT }), null);
});
test('sicherungsHinweis: Daten, aber noch nie gesichert', () => {
  const h = sicherungsHinweis({ letzte: null, hatDaten: true, jetzt: JETZT });
  assert.match(h, /noch keine Sicherung/);
});
test('sicherungsHinweis: bis einschließlich 7 Tage kein Hinweis', () => {
  assert.equal(sicherungsHinweis({ letzte: tageZurueck(0), hatDaten: true, jetzt: JETZT }), null);
  assert.equal(sicherungsHinweis({ letzte: tageZurueck(6), hatDaten: true, jetzt: JETZT }), null);
  assert.equal(sicherungsHinweis({ letzte: tageZurueck(7), hatDaten: true, jetzt: JETZT }), null);
});
test('sicherungsHinweis: älter als 7 Tage', () => {
  assert.match(sicherungsHinweis({ letzte: tageZurueck(7, 60000), hatDaten: true, jetzt: JETZT }), /7 Tagen/);
  assert.match(sicherungsHinweis({ letzte: tageZurueck(8), hatDaten: true, jetzt: JETZT }), /8 Tagen/);
  assert.match(sicherungsHinweis({ letzte: tageZurueck(30), hatDaten: true, jetzt: JETZT }), /30 Tagen/);
});
test('sicherungsHinweis: kaputtes Datum zählt als "noch nie"', () => {
  assert.match(sicherungsHinweis({ letzte: 'murks', hatDaten: true, jetzt: JETZT }), /noch keine Sicherung/);
});
