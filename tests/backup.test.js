import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erzeugeSicherung, pruefeSicherung, sicherungsDateiname, tageSeit, sicherungsHinweis } from '../js/backup.js';
import { neuerEintrag, setzeDa } from '../js/pantry.js';
import { neuesProdukt } from '../js/produkt.js';
import { neuerProduktEintrag, neuerFreiEintrag, schalteHaken } from '../js/einkauf.js';
import { neuesRezept } from '../js/rezepte.js';
import { neuerRest, neuesProtokoll } from '../js/kochen.js';

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

// --- Einkaufsliste in der Sicherung ---
const liste1 = neuerProduktEintrag(produkt, 2, { id: 'l1' });
const liste2 = schalteHaken(neuerFreiEintrag({ name: 'Zwiebeln', anzahl: 3 }, { id: 'l2' }));

test('Einkaufsliste: kommt in die Sicherung und wieder heraus', () => {
  const s = erzeugeSicherung({ ...daten(), einkauf: [liste1, liste2] }, JETZT);
  assert.equal(s.daten.einkauf.length, 2);
  const r = pruefeSicherung(JSON.stringify(s));
  assert.deepEqual(r.einkauf, [liste1, liste2]);
});
test('Einkaufsliste: alte Sicherungen ohne Liste bleiben lesbar', () => {
  const alt = gueltig();
  delete alt.daten.einkauf;
  assert.deepEqual(pruefeSicherung(JSON.stringify(alt)).einkauf, []);
  assert.deepEqual(erzeugeSicherung(daten(), JETZT).daten.einkauf, []);
});
test('Einkaufsliste: ungültiger Eintrag wird mit Nummer gemeldet, doppelte Kennung abgelehnt', () => {
  const s = JSON.parse(JSON.stringify(erzeugeSicherung({ ...daten(), einkauf: [liste1, liste2] }, JETZT)));
  const kaputt = JSON.parse(JSON.stringify(s));
  kaputt.daten.einkauf[1].anzahl = -1;
  assert.throws(() => pruefeSicherung(JSON.stringify(kaputt)), /Einkaufsliste, Eintrag 2/);
  const doppelt = JSON.parse(JSON.stringify(s));
  doppelt.daten.einkauf[1].id = 'l1';
  assert.throws(() => pruefeSicherung(JSON.stringify(doppelt)), /doppelt/);
  const keinArray = JSON.parse(JSON.stringify(s));
  keinArray.daten.einkauf = 'x';
  assert.throws(() => pruefeSicherung(JSON.stringify(keinArray)), /Einkaufsliste/);
});

// --- Rezepte in der Sicherung ---
const rezept1 = neuesRezept({
  id: 'r1',
  name: 'Rührei',
  portionen: 1,
  dauerMinuten: 5,
  zutaten: [{ zutat: 'Eier', menge: 3, einheit: 'stk' }, { zutat: 'Salz', art: 'da_leer', optional: true, notiz: 'eine Prise' }],
  schritte: ['Eier verquirlen.', 'Braten.'],
  quelle: 'Eigenes Rezept',
});

test('Rezepte: kommen in die Sicherung und wieder heraus', () => {
  const s = erzeugeSicherung({ ...daten(), rezepte: [rezept1] }, JETZT);
  assert.equal(s.daten.rezepte.length, 1);
  assert.deepEqual(pruefeSicherung(JSON.stringify(s)).rezepte, [rezept1]);
});
test('Rezepte: alte Sicherungen ohne Rezepte bleiben lesbar', () => {
  const alt = gueltig();
  delete alt.daten.rezepte;
  assert.deepEqual(pruefeSicherung(JSON.stringify(alt)).rezepte, []);
  assert.deepEqual(erzeugeSicherung(daten(), JETZT).daten.rezepte, []);
});
test('Rezepte: ungültiges Rezept wird mit Nummer gemeldet, doppelte Kennung abgelehnt', () => {
  const s = JSON.parse(JSON.stringify(erzeugeSicherung({ ...daten(), rezepte: [rezept1, { ...rezept1, id: 'r2' }] }, JETZT)));
  const kaputt = JSON.parse(JSON.stringify(s));
  kaputt.daten.rezepte[1].portionen = 0;
  assert.throws(() => pruefeSicherung(JSON.stringify(kaputt)), /Rezept 2.*Portionen/);
  const doppelt = JSON.parse(JSON.stringify(s));
  doppelt.daten.rezepte[1].id = 'r1';
  assert.throws(() => pruefeSicherung(JSON.stringify(doppelt)), /doppelt/);
  const keinArray = JSON.parse(JSON.stringify(s));
  keinArray.daten.rezepte = 'x';
  assert.throws(() => pruefeSicherung(JSON.stringify(keinArray)), /Rezepte/);
});
test('Zutat im Vorratseintrag und im Produkt überlebt die Sicherung', () => {
  const e = neuerEintrag({ name: 'Barilla Spaghetti', art: 'menge', menge: 500, einheit: 'g', zutat: 'Spaghetti' }, { id: 'z1' });
  const p = neuesProdukt({ barcode: '4006381333931', name: 'Barilla Spaghetti', art: 'menge', packung: 500, einheit: 'g', zutat: 'Spaghetti' });
  const r = pruefeSicherung(JSON.stringify(erzeugeSicherung({ vorrat: [e], produkte: [p], einstellungen: [] }, JETZT)));
  assert.equal(r.vorrat[0].zutat, 'Spaghetti');
  assert.equal(r.produkte[0].zutat, 'Spaghetti');
});

// --- Reste und Kochprotokoll in der Sicherung ---
const rest1 = neuerRest({ rezeptId: 'r1', name: 'Chili', portionen: 2, jetzt: JETZT }, { id: 'rest1' });
const protokoll1 = neuesProtokoll(
  { rezept: rezept1, portionen: 2, gesamt: 3, gegessen: 1, rest: rest1, wirkung: { vorratPut: [], vorratLoesche: [], vorher: [nudeln, salz] }, jetzt: JETZT, zusammenfassung: ['Nudeln: 200 g'] },
  { id: 'prot1' }
);

test('Reste und Kochprotokoll: kommen in die Sicherung und wieder heraus', () => {
  const s = erzeugeSicherung({ ...daten(), reste: [rest1], gekocht: [protokoll1] }, JETZT);
  assert.equal(s.daten.reste.length, 1);
  assert.equal(s.daten.gekocht.length, 1);
  const r = pruefeSicherung(JSON.stringify(s));
  assert.deepEqual(r.reste, [rest1]);
  assert.deepEqual(r.gekocht, [protokoll1]);
  assert.equal(r.gekocht[0].vorher[1].da, false);
});
test('Reste und Kochprotokoll: alte Sicherungen ohne beides bleiben lesbar', () => {
  const alt = gueltig();
  delete alt.daten.reste;
  delete alt.daten.gekocht;
  const r = pruefeSicherung(JSON.stringify(alt));
  assert.deepEqual(r.reste, []);
  assert.deepEqual(r.gekocht, []);
  assert.deepEqual(erzeugeSicherung(daten(), JETZT).daten.reste, []);
  assert.deepEqual(erzeugeSicherung(daten(), JETZT).daten.gekocht, []);
});
test('Reste und Kochprotokoll: Fehler mit Nummer, doppelte Kennungen, kaputte Listen', () => {
  const basis = () => JSON.parse(JSON.stringify(erzeugeSicherung({ ...daten(), reste: [rest1, { ...rest1, id: 'rest2' }], gekocht: [protokoll1, { ...protokoll1, id: 'prot2' }] }, JETZT)));
  const a = basis(); a.daten.reste[1].portionen = 0;
  assert.throws(() => pruefeSicherung(JSON.stringify(a)), /Rest 2.*Portionen/);
  const b = basis(); b.daten.reste[1].id = 'rest1';
  assert.throws(() => pruefeSicherung(JSON.stringify(b)), /Reste.*doppelt/);
  const c = basis(); c.daten.gekocht[1].gesamt = 0;
  assert.throws(() => pruefeSicherung(JSON.stringify(c)), /Kochprotokoll 2.*Portionen/);
  const d = basis(); d.daten.gekocht[1].id = 'prot1';
  assert.throws(() => pruefeSicherung(JSON.stringify(d)), /Kochprotokoll.*doppelt/);
  const e = basis(); e.daten.reste = 'x';
  assert.throws(() => pruefeSicherung(JSON.stringify(e)), /Reste/);
  const f = basis(); f.daten.gekocht = 'x';
  assert.throws(() => pruefeSicherung(JSON.stringify(f)), /Kochprotokoll/);
});
test('Der laufende Kochvorgang gehört nicht in die Sicherung', () => {
  const s = erzeugeSicherung({ ...daten(), einstellungen: [{ key: 'kochen', value: { schritt: 2 } }, { key: 'irgendwas', value: 1 }] }, JETZT);
  assert.deepEqual(s.daten.einstellungen, [{ key: 'irgendwas', value: 1 }]);
});
