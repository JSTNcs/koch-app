import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  tabellenEintrag,
  gramm,
  naehrwerteFuerZutat,
  rezeptNaehrwerte,
  tabellenProEinheit,
  proFuerEintrag,
  proFuerProdukt,
  mahlzeitAusPortionen,
} from '../js/naehrwerte.js';
import { neuesRezept, pruefeRezeptDatei } from '../js/rezepte.js';
import { neueMahlzeit } from '../js/tagebuch.js';
import { neuerEintrag } from '../js/pantry.js';
import { neuesProdukt } from '../js/produkt.js';
import { ZUTATEN } from '../js/zutaten.js';

const eintrag = (kcal, eiweiss, kohlenhydrate, fett, o = {}) => ({ kcal, eiweiss, kohlenhydrate, fett, stueckG: null, dichte: null, richtmengeG: null, ...o });
const tabelle = {
  zutaten: {
    Spaghetti: eintrag(371, 13, 74.7, 1.5),
    Zwiebeln: eintrag(40, 1.1, 9.3, 0.1, { stueckG: 90 }),
    Milch: eintrag(61, 3.2, 4.8, 3.3, { dichte: 1.03 }),
    Eier: eintrag(143, 12.6, 0.7, 9.5, { stueckG: 50 }),
    Öl: eintrag(884, 0, 0, 100, { dichte: 0.92, richtmengeG: 5 }),
    Karotten: eintrag(41, 0.9, 9.6, 0.2), // ohne Stückgewicht
  },
};

// --- Nachschlagen und Gewicht ---
test('tabellenEintrag: Zutat oder Synonym, unbekannte Zutat ergibt null', () => {
  assert.equal(tabellenEintrag(tabelle, 'Spaghetti').kcal, 371);
  assert.equal(tabellenEintrag(tabelle, 'zwiebel').kcal, 40); // Synonym
  assert.equal(tabellenEintrag(tabelle, 'Hirse'), null);
  assert.equal(tabellenEintrag(tabelle, 'Salz'), null);
  assert.equal(tabellenEintrag(null, 'Spaghetti'), null);
});
test('gramm: g, ml mit Dichte, Stück mit Stückgewicht', () => {
  assert.equal(gramm(200, 'g', tabelle.zutaten.Spaghetti), 200);
  assert.equal(gramm(100, 'ml', tabelle.zutaten.Milch), 103);
  assert.equal(gramm(100, 'ml', tabelle.zutaten.Spaghetti), 100); // ohne Dichte: 1 g pro ml
  assert.equal(gramm(2, 'stk', tabelle.zutaten.Eier), 100);
  assert.equal(gramm(2, 'stk', tabelle.zutaten.Karotten), null); // kein Stückgewicht
});

// --- Nährwerte einer Zutat ---
test('naehrwerteFuerZutat: aus der Tabelle (g, Stück, ml)', () => {
  const s = naehrwerteFuerZutat(tabelle, [], 'Spaghetti', 200, 'g');
  assert.deepEqual([s.kcal, s.eiweiss, s.kohlenhydrate, s.fett, s.quelle], [742, 26, 149.4, 3, 'tabelle']);
  assert.equal(naehrwerteFuerZutat(tabelle, [], 'Zwiebeln', 1, 'stk').kcal, 36);
  assert.ok(Math.abs(naehrwerteFuerZutat(tabelle, [], 'Milch', 200, 'ml').kcal - 125.66) < 0.01);
});
test('naehrwerteFuerZutat: eigene Produktdaten haben Vorrang (g und ml)', () => {
  const p = neuesProdukt({ barcode: '4006381333931', name: 'Barilla Spaghetti', art: 'menge', packung: 500, einheit: 'g', naehrwerte: { kcal: 350, eiweiss: 12, kohlenhydrate: 70, fett: 2 } });
  const r = naehrwerteFuerZutat(tabelle, [p], 'Spaghetti', 200, 'g');
  assert.equal(r.kcal, 700);
  assert.equal(r.quelle, 'produkt');
});
test('naehrwerteFuerZutat: Produkt ohne Nährwerte, anderes Produkt und Stückangaben nehmen die Tabelle', () => {
  const ohne = neuesProdukt({ barcode: '4006381333931', name: 'Barilla Spaghetti', art: 'menge', packung: 500, einheit: 'g' });
  assert.equal(naehrwerteFuerZutat(tabelle, [ohne], 'Spaghetti', 100, 'g').quelle, 'tabelle');
  const eier = neuesProdukt({ barcode: '3017620422003', name: 'Eier 10er', art: 'menge', packung: 10, einheit: 'stk', naehrwerte: { kcal: 150, eiweiss: 12, kohlenhydrate: 1, fett: 10 } });
  assert.equal(naehrwerteFuerZutat(tabelle, [eier], 'Eier', 2, 'stk').kcal, 143); // Stück: Tabelle mit Stückgewicht
});
test('naehrwerteFuerZutat: unbekannte Zutat oder fehlendes Stückgewicht ergibt null', () => {
  assert.equal(naehrwerteFuerZutat(tabelle, [], 'Hirse', 100, 'g'), null);
  assert.equal(naehrwerteFuerZutat(tabelle, [], 'Karotten', 2, 'stk'), null);
  const hirse = neuesProdukt({ barcode: '4006381333931', name: 'Hirse', art: 'menge', packung: 500, einheit: 'g', naehrwerte: { kcal: 360, eiweiss: 11, kohlenhydrate: 70, fett: 4 } });
  assert.equal(naehrwerteFuerZutat(tabelle, [hirse], 'Hirse', 100, 'g').kcal, 360); // eigene Daten genügen auch ohne Tabelle
});

// --- Rezept pro Portion ---
const rezept = (zutaten, portionen = 1) => neuesRezept({ name: 'Test', portionen, zutaten, schritte: ['x'] });
test('rezeptNaehrwerte: Summe der Zutaten, "nach Bedarf"-Öl mit Richtmenge, freiwillige und Gewürze zählen nicht', () => {
  const r = rezept([
    { zutat: 'Spaghetti', menge: 200, einheit: 'g' },
    { zutat: 'Eier', menge: 2, einheit: 'stk' },
    { zutat: 'Öl', art: 'da_leer' },
    { zutat: 'Salz', art: 'da_leer' },
    { zutat: 'Parmesan', menge: 30, einheit: 'g', optional: true },
  ]);
  const n = rezeptNaehrwerte(r, { tabelle, produkte: [], vorrat: [] });
  // 742 + 143 + Öl 5 g (44,2)
  assert.equal(n.proPortion.kcal, 929);
  assert.equal(n.proPortion.eiweiss, 38.6);
  assert.equal(n.proPortion.kohlenhydrate, 150.1);
  assert.equal(n.proPortion.fett, 17.5);
  assert.deepEqual(n.fehlend, []);
  assert.deepEqual(n.geschaetzt, ['Öl']);
  assert.equal(n.vollstaendig, true);
});
test('rezeptNaehrwerte: pro Portion = Summe geteilt durch die Portionen, Öl pro Portion', () => {
  const r = rezept([{ zutat: 'Spaghetti', menge: 200, einheit: 'g' }, { zutat: 'Eier', menge: 2, einheit: 'stk' }, { zutat: 'Öl', art: 'da_leer' }], 2);
  // (742 + 143 + 2 × 44,2) / 2 = 486,7
  assert.equal(rezeptNaehrwerte(r, { tabelle, produkte: [], vorrat: [] }).proPortion.kcal, 487);
});
test('rezeptNaehrwerte: unbekannte Zutaten werden gemeldet und das Rezept ist unvollständig', () => {
  const r = rezept([{ zutat: 'Spaghetti', menge: 200, einheit: 'g' }, { zutat: 'Hirse', menge: 100, einheit: 'g' }, { zutat: 'Karotten', menge: 2, einheit: 'stk' }]);
  const n = rezeptNaehrwerte(r, { tabelle, produkte: [], vorrat: [] });
  assert.deepEqual(n.fehlend, ['Hirse', 'Karotten']);
  assert.equal(n.vollstaendig, false);
  assert.equal(n.proPortion.kcal, 742);
});
test('rezeptNaehrwerte: ist nichts berechenbar, gibt es keine Zahl', () => {
  const r = rezept([{ zutat: 'Hirse', menge: 100, einheit: 'g' }]);
  const n = rezeptNaehrwerte(r, { tabelle, produkte: [], vorrat: [] });
  assert.equal(n.proPortion, null);
  assert.deepEqual(n.fehlend, ['Hirse']);
});
test('rezeptNaehrwerte: eigenes Produkt (bevorzugt eines im Vorrat) vor der Tabelle', () => {
  const a = neuesProdukt({ barcode: '4006381333931', name: 'A Spaghetti', art: 'menge', packung: 500, einheit: 'g', naehrwerte: { kcal: 300, eiweiss: 10, kohlenhydrate: 60, fett: 1 } });
  const b = neuesProdukt({ barcode: '96385074', name: 'B Spaghetti', art: 'menge', packung: 500, einheit: 'g', naehrwerte: { kcal: 400, eiweiss: 10, kohlenhydrate: 60, fett: 1 } });
  const r = rezept([{ zutat: 'Spaghetti', menge: 100, einheit: 'g' }]);
  assert.equal(rezeptNaehrwerte(r, { tabelle, produkte: [a, b], vorrat: [] }).proPortion.kcal, 300); // erstes nach Name
  const imVorrat = [neuerEintrag({ name: 'B Spaghetti', art: 'menge', menge: 500, einheit: 'g', barcode: b.barcode }, { id: 'v' })];
  assert.equal(rezeptNaehrwerte(r, { tabelle, produkte: [a, b], vorrat: imVorrat }).proPortion.kcal, 400);
});

// --- Vorrat und Scan: Nährwerte aus der Tabelle vorschlagen ---
test('tabellenProEinheit: pro 100 g, pro 100 ml und pro Stück', () => {
  assert.deepEqual(tabellenProEinheit(tabelle, 'Spaghetti', 'g'), { kcal: 371, eiweiss: 13, kohlenhydrate: 74.7, fett: 1.5 });
  assert.deepEqual(tabellenProEinheit(tabelle, 'Milch', 'ml'), { kcal: 63, eiweiss: 3.3, kohlenhydrate: 4.9, fett: 3.4 });
  assert.deepEqual(tabellenProEinheit(tabelle, 'Eier', 'stk'), { kcal: 72, eiweiss: 6.3, kohlenhydrate: 0.4, fett: 4.8 });
  assert.equal(tabellenProEinheit(tabelle, 'Karotten', 'stk'), null);
  assert.equal(tabellenProEinheit(tabelle, 'Hirse', 'g'), null);
});
test('proFuerEintrag: aus der Zutat des Vorratseintrags', () => {
  const e = neuerEintrag({ name: 'Zwiebeln', art: 'menge', menge: 3, einheit: 'stk' }, { id: 'z' });
  assert.equal(proFuerEintrag(tabelle, e, []).kcal, 36);
  const g = neuerEintrag({ name: 'Billig Spaghetti N.5', art: 'menge', menge: 500, einheit: 'g' }, { id: 's' }); // Zutat wird aus dem Namen geraten
  assert.equal(proFuerEintrag(tabelle, g, []).kcal, 371);
  assert.equal(proFuerEintrag(tabelle, neuerEintrag({ name: 'Hirse', art: 'menge', menge: 1, einheit: 'g' }, { id: 'h' }), []), null);
});
test('proFuerProdukt: nur für g und ml', () => {
  assert.equal(proFuerProdukt(tabelle, { name: 'Barilla Spaghetti', zutat: null }, 'g').kcal, 371);
  assert.equal(proFuerProdukt(tabelle, { name: 'Hirse', zutat: null }, 'g'), null);
});

// --- Tagebucheintrag aus Rezept-Portionen ---
const pp = { kcal: 433, eiweiss: 13.5, kohlenhydrate: 78.9, fett: 6.5 };
test('mahlzeitAusPortionen: mehrere Portionen, Einzahl und Mehrzahl, als Näherung gekennzeichnet', () => {
  const m = mahlzeitAusPortionen({ name: 'Chili', rezeptId: 'r1', proPortion: pp, anzahl: 2, quelle: 'rezept' });
  assert.deepEqual(m, { name: 'Chili', kcal: 866, eiweiss: 27, kohlenhydrate: 157.8, fett: 13, menge: '2 Portionen', ca: true, quelle: 'rezept', rezeptId: 'r1' });
  assert.equal(mahlzeitAusPortionen({ name: 'Chili', rezeptId: 'r1', proPortion: pp, anzahl: 1, quelle: 'rest' }).menge, '1 Portion');
});
test('mahlzeitAusPortionen: das Ergebnis passt in einen Tagebucheintrag', () => {
  const m = neueMahlzeit(mahlzeitAusPortionen({ name: 'Chili', rezeptId: 'r1', proPortion: pp, anzahl: 1, quelle: 'rest' }), { id: 'x' });
  assert.equal(m.kcal, 433);
  assert.equal(m.quelle, 'rest');
  assert.equal(m.ca, true);
});

// --- Die echte Tabelle ---
const echt = JSON.parse(readFileSync(fileURLToPath(new URL('../daten/naehrwerte.json', import.meta.url)), 'utf8'));
test('Echte Tabelle: Quelle, Lizenz und jede gemessene Zutat der App sind enthalten', () => {
  assert.match(echt.quelle, /FoodData Central/);
  assert.match(echt.lizenz, /CC0/);
  for (const z of ZUTATEN.filter((x) => x.art === 'menge')) assert.ok(echt.zutaten[z.name], `Kein Eintrag für ${z.name}`);
});
test('Echte Tabelle: Zutaten in Stück haben ein Stückgewicht', () => {
  for (const z of ZUTATEN.filter((x) => x.art === 'menge' && x.einheit === 'stk')) assert.ok(echt.zutaten[z.name].stueckG > 0, `Kein Stückgewicht für ${z.name}`);
});
test('Echte Tabelle: Werte sind plausibel (Kalorien passen zu Eiweiß, Kohlenhydraten und Fett)', () => {
  for (const [name, z] of Object.entries(echt.zutaten)) {
    for (const f of ['kcal', 'eiweiss', 'kohlenhydrate', 'fett']) assert.ok(typeof z[f] === 'number' && z[f] >= 0, `${name}: ${f}`);
    assert.ok(z.kcal <= 900, `${name}: ${z.kcal} kcal sind zu viel für 100 g`);
    const berechnet = 4 * z.eiweiss + 4 * z.kohlenhydrate + 9 * z.fett;
    assert.ok(Math.abs(z.kcal - berechnet) <= 0.15 * z.kcal + 15, `${name}: ${z.kcal} kcal passen nicht zu ${berechnet.toFixed(0)} aus den Nährstoffen`);
    assert.ok(z.eiweiss + z.kohlenhydrate + z.fett <= 100.5, `${name}: mehr als 100 g Nährstoffe pro 100 g`);
  }
});
test('Echte Tabelle: Richtmengen für Öl, Olivenöl und Mayonnaise', () => {
  assert.equal(echt.zutaten['Öl'].richtmengeG, 5);
  assert.equal(echt.zutaten['Olivenöl'].richtmengeG, 5);
  assert.equal(echt.zutaten['Mayonnaise'].richtmengeG, 10);
});
test('Startpaket: Jedes Rezept lässt sich vollständig berechnen und ist plausibel', () => {
  const rezepte = pruefeRezeptDatei(readFileSync(fileURLToPath(new URL('../daten/startpaket.json', import.meta.url)), 'utf8'));
  const zeilen = [];
  for (const r of rezepte) {
    const n = rezeptNaehrwerte(r, { tabelle: echt, produkte: [], vorrat: [] });
    assert.deepEqual(n.fehlend, [], `${r.name}: nicht berechenbar: ${n.fehlend}`);
    assert.ok(n.proPortion.kcal >= 150 && n.proPortion.kcal <= 1100, `${r.name}: ${n.proPortion.kcal} kcal pro Portion`);
    zeilen.push(`${r.name.padEnd(46)} ${String(n.proPortion.kcal).padStart(5)} kcal  E ${n.proPortion.eiweiss}  KH ${n.proPortion.kohlenhydrate}  F ${n.proPortion.fett}`);
  }
  if (process.env.ZEIGE_STARTPAKET) console.log('\n' + zeilen.join('\n'));
});
