import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  neuesRezept,
  skaliere,
  pruefeRezept,
  gruppiereVorschlaege,
  fehlendFuerListe,
  pruefeRezeptDatei,
  planeImport,
  rezeptTexte,
} from '../js/rezepte.js';
import { neuerEintrag, setzeDa } from '../js/pantry.js';
import { neuesProdukt } from '../js/produkt.js';

const tomatensauce = (o = {}) =>
  neuesRezept({
    name: 'Spaghetti mit Tomatensauce',
    portionen: 2,
    dauerMinuten: 25,
    zutaten: [
      { zutat: 'Spaghetti', menge: 200, einheit: 'g' },
      { zutat: 'Dosentomaten', menge: 400, einheit: 'g' },
      { zutat: 'Zwiebeln', menge: 1, einheit: 'stk' },
      { zutat: 'Knoblauch', menge: 2, einheit: 'stk' },
      { zutat: 'Olivenöl', art: 'da_leer' },
      { zutat: 'Salz', art: 'da_leer' },
      { zutat: 'Parmesan', menge: 30, einheit: 'g', optional: true },
    ],
    schritte: ['Nudeln kochen.', 'Sauce köcheln.'],
    ...o,
  });

// --- Rezept anlegen und prüfen ---
test('neuesRezept: Standardwerte, Kennung aus dem Namen, Art aus der Menge', () => {
  const r = neuesRezept({
    name: '  Rührei ',
    portionen: 1,
    zutaten: [{ zutat: 'Eier', menge: 3, einheit: 'stk' }, { zutat: 'Salz' }],
    schritte: ['Eier verquirlen.', '  ', 'Braten.'],
  });
  assert.equal(r.id, 'ruhrei');
  assert.equal(r.name, 'Rührei');
  assert.equal(r.dauerMinuten, null);
  assert.equal(r.quelle, null);
  assert.deepEqual(r.schritte, ['Eier verquirlen.', 'Braten.']);
  assert.deepEqual(r.zutaten[0], { zutat: 'Eier', art: 'menge', menge: 3, einheit: 'stk', optional: false, notiz: null });
  assert.deepEqual(r.zutaten[1], { zutat: 'Salz', art: 'da_leer', menge: null, einheit: null, optional: false, notiz: null });
});
test('neuesRezept: Kennung ohne Umlaute und Sonderzeichen, eigene Kennung bleibt', () => {
  assert.equal(neuesRezept({ name: 'Käse-Spätzle (schnell)!', portionen: 2, zutaten: [{ zutat: 'Eier', menge: 1, einheit: 'stk' }], schritte: ['x'] }).id, 'kase-spatzle-schnell');
  assert.equal(neuesRezept({ id: 'start-001', name: 'X', portionen: 2, zutaten: [{ zutat: 'Eier', menge: 1, einheit: 'stk' }], schritte: ['x'] }).id, 'start-001');
});
test('neuesRezept: Fehler mit deutscher Meldung', () => {
  const ok = { name: 'X', portionen: 2, zutaten: [{ zutat: 'Eier', menge: 1, einheit: 'stk' }], schritte: ['x'] };
  assert.throws(() => neuesRezept({ ...ok, name: ' ' }), /Name/);
  assert.throws(() => neuesRezept({ ...ok, portionen: 0 }), /Portionen/);
  assert.throws(() => neuesRezept({ ...ok, portionen: 1.5 }), /Portionen/);
  assert.throws(() => neuesRezept({ ...ok, dauerMinuten: -5 }), /Dauer/);
  assert.throws(() => neuesRezept({ ...ok, zutaten: [] }), /Zutat/);
  assert.throws(() => neuesRezept({ ...ok, zutaten: [{ zutat: '', menge: 1, einheit: 'g' }] }), /Zutat 1/);
  assert.throws(() => neuesRezept({ ...ok, zutaten: [{ zutat: 'Eier', menge: 0, einheit: 'stk' }] }), /Menge/);
  assert.throws(() => neuesRezept({ ...ok, zutaten: [{ zutat: 'Eier', art: 'menge', menge: 1, einheit: 'kg' }] }), /Einheit/);
  assert.throws(() => neuesRezept({ ...ok, schritte: [] }), /Schritt/);
  assert.throws(() => neuesRezept({ ...ok, schritte: ['  '] }), /Schritt/);
});
test('rezeptTexte: Zutatenzeile zum Anzeigen', () => {
  const r = tomatensauce();
  assert.deepEqual(rezeptTexte(r.zutaten[0]), { titel: 'Spaghetti', menge: '200 g' });
  assert.deepEqual(rezeptTexte(r.zutaten[2]), { titel: 'Zwiebeln', menge: '1 Stück' });
  assert.deepEqual(rezeptTexte(r.zutaten[4]), { titel: 'Olivenöl', menge: 'nach Bedarf' });
});

// --- Portionen umrechnen ---
test('skaliere: Mengen wachsen mit den Portionen, vernünftig gerundet', () => {
  const z = skaliere(tomatensauce(), 3).map((x) => x.menge);
  assert.deepEqual(z, [300, 600, 1.5, 3, null, null, 45]);
  const z1 = skaliere(tomatensauce(), 1).map((x) => x.menge);
  assert.deepEqual(z1, [100, 200, 0.5, 1, null, null, 15]);
});
test('skaliere: Original bleibt unverändert, gleiche Portionen ergeben gleiche Mengen', () => {
  const r = tomatensauce();
  skaliere(r, 4);
  assert.equal(r.zutaten[0].menge, 200);
  assert.equal(skaliere(r, 2)[0].menge, 200);
});

// --- Vorrat bereitstellen ---
const barilla = neuesProdukt({ barcode: '4006381333931', name: 'Barilla Spaghetti N.5', art: 'menge', packung: 500, einheit: 'g' });
const tomaten = neuesProdukt({ barcode: '96385074', name: 'Gehackte Tomaten', art: 'menge', packung: 400, einheit: 'g' });
const produkte = [barilla, tomaten];
const ev = (name, menge, einheit, o = {}) => neuerEintrag({ name, art: 'menge', menge, einheit, ...o }, { id: 'v-' + name });
const alleDa = () => [
  ev('Barilla Spaghetti N.5', 500, 'g', { barcode: barilla.barcode }),
  ev('Gehackte Tomaten', 800, 'g', { barcode: tomaten.barcode }),
  ev('Zwiebeln', 3, 'stk'),
  ev('Knoblauch', 5, 'stk'),
  neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 'v-salz' }),
  neuerEintrag({ name: 'Olivenöl', art: 'da_leer' }, { id: 'v-oel' }),
];
const status = (p, zutat) => p.zutaten.find((z) => z.zutat === zutat);

// --- Abgleich mit dem Vorrat ---
test('pruefeRezept: alles da', () => {
  const p = pruefeRezept(tomatensauce(), { vorrat: alleDa(), produkte });
  assert.equal(p.fehlend, 0);
  assert.equal(p.kategorie, 'alles');
  assert.equal(status(p, 'Spaghetti').status, 'da');
  assert.equal(status(p, 'Spaghetti').habe, 500);
});
test('pruefeRezept: die Marke ist egal, die Zutat zählt (geraten aus dem Namen)', () => {
  const p = pruefeRezept(tomatensauce(), { vorrat: alleDa(), produkte });
  assert.equal(status(p, 'Dosentomaten').status, 'da'); // "Gehackte Tomaten" -> Dosentomaten
});
test('pruefeRezept: eigene Zutat im Eintrag schlägt die Vermutung', () => {
  const vorrat = alleDa().map((e) => (e.name === 'Barilla Spaghetti N.5' ? { ...e, zutat: 'Penne' } : e));
  const p = pruefeRezept(tomatensauce(), { vorrat, produkte });
  assert.equal(status(p, 'Spaghetti').status, 'fehlt');
});
test('pruefeRezept: zu wenig ergibt "teils" mit fehlender Menge', () => {
  const vorrat = alleDa().map((e) => (e.name.startsWith('Barilla') ? { ...e, menge: 150 } : e));
  const p = pruefeRezept(tomatensauce(), { vorrat, produkte });
  assert.equal(status(p, 'Spaghetti').status, 'teils');
  assert.equal(status(p, 'Spaghetti').fehlt, 50);
  assert.equal(p.fehlend, 1);
  assert.equal(p.kategorie, 'wenig');
});
test('pruefeRezept: mehrere Einträge derselben Zutat werden addiert', () => {
  const vorrat = [...alleDa().filter((e) => !e.name.startsWith('Barilla')), ev('Spaghetti', 120, 'g'), ev('Bio Spaghetti', 100, 'g')];
  const p = pruefeRezept(tomatensauce(), { vorrat, produkte });
  assert.equal(status(p, 'Spaghetti').habe, 220);
  assert.equal(status(p, 'Spaghetti').status, 'da');
});
test('pruefeRezept: andere Einheit lässt sich nicht vergleichen, zählt als "unklar" und nicht als fehlend', () => {
  const vorrat = alleDa().map((e) => (e.name === 'Zwiebeln' ? { ...e, menge: 1, einheit: 'g' } : e));
  const p = pruefeRezept(tomatensauce(), { vorrat, produkte });
  assert.equal(status(p, 'Zwiebeln').status, 'unklar');
  assert.equal(p.fehlend, 0);
});
test('pruefeRezept: fehlende Zutat und ein Vorrat mit Menge 0 zählen als fehlend', () => {
  const vorrat = alleDa().filter((e) => e.name !== 'Knoblauch').map((e) => (e.name === 'Zwiebeln' ? { ...e, menge: 0 } : e));
  const p = pruefeRezept(tomatensauce(), { vorrat, produkte });
  assert.equal(status(p, 'Knoblauch').status, 'fehlt');
  assert.equal(status(p, 'Knoblauch').fehlt, 2);
  assert.equal(status(p, 'Zwiebeln').status, 'fehlt');
  assert.equal(p.fehlend, 2);
  assert.equal(p.kategorie, 'wenig');
});
test('pruefeRezept: freiwillige Zutaten zählen nie als fehlend', () => {
  const p = pruefeRezept(tomatensauce(), { vorrat: alleDa(), produkte });
  const parmesan = status(p, 'Parmesan');
  assert.equal(parmesan.optional, true);
  assert.equal(parmesan.status, 'fehlt');
  assert.equal(p.fehlend, 0);
});
test('pruefeRezept: Gewürze ohne Eintrag werden als vorhanden angenommen, "leer" zählt als fehlend', () => {
  const ohne = alleDa().filter((e) => e.art !== 'da_leer');
  const p = pruefeRezept(tomatensauce(), { vorrat: ohne, produkte });
  assert.equal(status(p, 'Salz').status, 'angenommen');
  assert.equal(status(p, 'Olivenöl').status, 'angenommen');
  assert.equal(p.fehlend, 0);
  const leer = [...ohne, setzeDa(neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' }), false)];
  const p2 = pruefeRezept(tomatensauce(), { vorrat: leer, produkte });
  assert.equal(status(p2, 'Salz').status, 'fehlt');
  assert.equal(p2.fehlend, 1);
});
test('pruefeRezept: Öl mit Menge im Vorrat reicht für "nach Bedarf"', () => {
  const vorrat = [...alleDa().filter((e) => e.name !== 'Olivenöl'), ev('Olivenöl', 500, 'ml')];
  assert.equal(status(pruefeRezept(tomatensauce(), { vorrat, produkte }), 'Olivenöl').status, 'da');
  const aufgebraucht = [...alleDa().filter((e) => e.name !== 'Olivenöl'), ev('Olivenöl', 0, 'ml')];
  assert.equal(status(pruefeRezept(tomatensauce(), { vorrat: aufgebraucht, produkte }), 'Olivenöl').status, 'fehlt');
});
test('pruefeRezept: Gewürz im Vorrat deckt auch eine gemessene Menge im Rezept', () => {
  const r = neuesRezept({ name: 'X', portionen: 2, zutaten: [{ zutat: 'Salz', menge: 5, einheit: 'g' }], schritte: ['x'] });
  const p = pruefeRezept(r, { vorrat: [neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' })], produkte: [] });
  assert.equal(p.zutaten[0].status, 'da');
});
test('pruefeRezept: mehr Portionen brauchen mehr', () => {
  const p = pruefeRezept(tomatensauce(), { vorrat: alleDa(), produkte }, { portionen: 6 });
  assert.equal(status(p, 'Spaghetti').braucht, 600);
  assert.equal(status(p, 'Spaghetti').status, 'teils');
  assert.equal(status(p, 'Spaghetti').fehlt, 100);
  assert.equal(p.portionen, 6);
});
test('pruefeRezept: Kategorie "mehr fehlt" ab drei fehlenden Zutaten', () => {
  const p = pruefeRezept(tomatensauce(), { vorrat: [], produkte: [] });
  assert.equal(p.fehlend, 4); // Spaghetti, Dosentomaten, Zwiebeln, Knoblauch (Gewürze angenommen)
  assert.equal(p.kategorie, 'mehr');
});

// --- Gruppen für "Was koche ich?" ---
test('gruppiereVorschlaege: alles da, 1–2 fehlen, mehr fehlt; sortiert', () => {
  const a = tomatensauce({ name: 'B' });
  const b = tomatensauce({ name: 'A' });
  const c = tomatensauce({ name: 'C', id: 'c' });
  const ctxAlles = { vorrat: alleDa(), produkte };
  const ctxWenig = { vorrat: alleDa().filter((e) => e.name !== 'Knoblauch'), produkte };
  const ctxMehr = { vorrat: [], produkte: [] };
  const g = gruppiereVorschlaege([
    { rezept: a, pruefung: pruefeRezept(a, ctxAlles) },
    { rezept: b, pruefung: pruefeRezept(b, ctxAlles) },
    { rezept: c, pruefung: pruefeRezept(c, ctxWenig) },
    { rezept: tomatensauce({ name: 'D' }), pruefung: pruefeRezept(tomatensauce(), ctxMehr) },
  ]);
  assert.deepEqual(g.alles.map((x) => x.rezept.name), ['A', 'B']);
  assert.deepEqual(g.wenig.map((x) => x.rezept.name), ['C']);
  assert.deepEqual(g.mehr.map((x) => x.rezept.name), ['D']);
});

// --- Fehlendes auf die Einkaufsliste ---
test('fehlendFuerListe: bekanntes Produkt mit passender Anzahl Packungen, sonst Freitext', () => {
  const vorrat = alleDa().filter((e) => e.name !== 'Knoblauch').map((e) => (e.name.startsWith('Barilla') ? { ...e, menge: 100 } : e));
  const p = pruefeRezept(tomatensauce(), { vorrat, produkte }, { portionen: 8 }); // braucht 800 g Spaghetti, hat 100
  const liste = fehlendFuerListe(p, { vorrat, produkte });
  const spaghetti = liste.find((e) => e.name.includes('Spaghetti'));
  assert.equal(spaghetti.typ, 'produkt');
  assert.equal(spaghetti.barcode, barilla.barcode);
  assert.equal(spaghetti.anzahl, 2); // fehlen 700 g, Packung 500 g -> 2
  const knoblauch = liste.find((e) => e.name === 'Knoblauch');
  assert.equal(knoblauch.typ, 'frei');
  assert.equal(knoblauch.anzahl, 8);
  assert.equal(knoblauch.einheit, 'stk');
  assert.equal(knoblauch.zutat, 'Knoblauch');
});
test('fehlendFuerListe: Gewürz "leer" kommt als Freitext, angenommene und freiwillige nicht', () => {
  const vorrat = [...alleDa().filter((e) => e.name !== 'Salz'), setzeDa(neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' }), false)];
  const p = pruefeRezept(tomatensauce(), { vorrat, produkte });
  const liste = fehlendFuerListe(p, { vorrat, produkte });
  assert.deepEqual(liste.map((e) => e.name), ['Salz']);
  assert.equal(liste[0].typ, 'frei');
});
test('fehlendFuerListe: nichts fehlt, nichts auf der Liste', () => {
  assert.deepEqual(fehlendFuerListe(pruefeRezept(tomatensauce(), { vorrat: alleDa(), produkte }), { vorrat: alleDa(), produkte }), []);
});
test('fehlendFuerListe: von mehreren bekannten Produkten wird das gewählt, das im Vorrat liegt', () => {
  const gug = neuesProdukt({ barcode: '036000291452', name: 'Gut & Günstig Spaghetti', art: 'menge', packung: 500, einheit: 'g' });
  const vorrat = [ev('Gut & Günstig Spaghetti', 0, 'g', { barcode: gug.barcode })];
  const p = pruefeRezept(tomatensauce(), { vorrat, produkte: [barilla, gug] });
  const e = fehlendFuerListe(p, { vorrat, produkte: [barilla, gug] }).find((x) => x.name.includes('Spaghetti'));
  assert.equal(e.barcode, gug.barcode);
});

// --- Rezeptdatei importieren ---
const datei = (rezepte, o = {}) => JSON.stringify({ format: 'koch-app-rezepte', version: 1, rezepte, ...o });
const roh = (o = {}) => ({ name: 'Rührei', portionen: 1, zutaten: [{ zutat: 'Eier', menge: 3, einheit: 'stk' }], schritte: ['Braten.'], ...o });

test('pruefeRezeptDatei: gültige Datei, Kennung wird ergänzt', () => {
  const r = pruefeRezeptDatei(datei([roh(), roh({ name: 'Omelett', id: 'o1' })]));
  assert.equal(r.length, 2);
  assert.ok(r[0].id && r[1].id === 'o1');
});
test('pruefeRezeptDatei: Fehler mit Nummer und Name', () => {
  assert.throws(() => pruefeRezeptDatei('Quatsch'), /gelesen/);
  assert.throws(() => pruefeRezeptDatei('{"a":1}'), /Rezeptdatei/);
  assert.throws(() => pruefeRezeptDatei(datei([roh()], { format: 'andere' })), /Rezeptdatei/);
  assert.throws(() => pruefeRezeptDatei(datei([roh()], { version: 7 })), /neuer/);
  assert.throws(() => pruefeRezeptDatei(datei([])), /keine Rezepte/);
  assert.throws(() => pruefeRezeptDatei(datei('x')), /Rezepte/);
  assert.throws(() => pruefeRezeptDatei(datei([roh(), roh({ name: 'Kaputt', portionen: 0 })])), /Rezept 2 \(„Kaputt“\).*Portionen/);
  assert.throws(() => pruefeRezeptDatei(datei([roh({ id: 'a' }), roh({ id: 'a', name: 'B' })])), /doppelt/);
});
test('planeImport: neue hinzufügen, gleiche Kennung ersetzen', () => {
  const alt = [neuesRezept(roh({ id: 'a' })), neuesRezept(roh({ id: 'b', name: 'B' }))];
  const neu = [neuesRezept(roh({ id: 'b', name: 'B neu' })), neuesRezept(roh({ id: 'c', name: 'C' }))];
  const plan = planeImport(alt, neu);
  assert.deepEqual(plan.neu.map((r) => r.id), ['c']);
  assert.deepEqual(plan.ersetzt.map((r) => r.id), ['b']);
});
