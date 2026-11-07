import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeRezept, ablaufNutzung, gruppiereVorschlaege, baueIndex, neuesRezept } from '../js/rezepte.js';
import { planeAbzug, wendeAn } from '../js/kochen.js';
import { neuerEintrag } from '../js/pantry.js';

const eintrag = (o = {}) => ({ kcal: 0, eiweiss: 0, kohlenhydrate: 0, fett: 0, stueckG: null, dichte: null, richtmengeG: null, ...o });
const tabelle = { zutaten: { Zwiebeln: eintrag({ stueckG: 90 }), Milch: eintrag({ dichte: 1.03 }), Eier: eintrag({ stueckG: 50 }), Spaghetti: eintrag() } };
const rezept = (zutaten, o = {}) => neuesRezept({ name: 'Test', portionen: 2, zutaten, schritte: ['x'], ...o });
const ev = (id, name, menge, einheit, o = {}) => neuerEintrag({ name, art: 'menge', menge, einheit, ...o }, { id });
const status = (p, zutat) => p.zutaten.find((z) => z.zutat === zutat);

// --- Einheiten umrechnen im Abgleich ---
test('pruefeRezept: mit Tabelle ist "1 Zwiebel" gegen "1 kg Zwiebeln" vergleichbar', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 2, einheit: 'stk' }]);
  const p = pruefeRezept(r, { vorrat: [ev('z', 'Zwiebeln', 1000, 'g')], produkte: [], tabelle });
  const z = status(p, 'Zwiebeln');
  assert.equal(z.status, 'da');
  assert.equal(z.habe, 11.11);
  assert.equal(z.umgerechnet, true);
  assert.equal(p.fehlend, 0);
});
test('pruefeRezept: umgerechnet reicht es manchmal nicht (Rest wird in der Rezept-Einheit gemeldet)', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 10, einheit: 'stk' }]);
  const p = pruefeRezept(r, { vorrat: [ev('z', 'Zwiebeln', 450, 'g')], produkte: [], tabelle });
  const z = status(p, 'Zwiebeln');
  assert.equal(z.status, 'teils'); // 450 g = 5 Stück
  assert.equal(z.habe, 5);
  assert.equal(z.fehlt, 5);
  assert.equal(p.fehlend, 1);
});
test('pruefeRezept: gleiche und andere Einheit werden zusammengezählt', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 4, einheit: 'stk' }]);
  const p = pruefeRezept(r, { vorrat: [ev('a', 'Zwiebeln', 2, 'stk'), ev('b', 'Zwiebeln', 180, 'g')], produkte: [], tabelle });
  assert.equal(status(p, 'Zwiebeln').habe, 4);
  assert.equal(status(p, 'Zwiebeln').status, 'da');
});
test('pruefeRezept: Milliliter gegen Gramm über die Dichte', () => {
  const r = rezept([{ zutat: 'Milch', menge: 500, einheit: 'ml' }]);
  const p = pruefeRezept(r, { vorrat: [ev('m', 'Vollmilch', 1000, 'g')], produkte: [], tabelle });
  assert.equal(status(p, 'Milch').status, 'da'); // 1000 g = 970,9 ml
});
test('pruefeRezept: ohne Tabelle oder ohne Stückgewicht bleibt es "unklar"', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 2, einheit: 'stk' }]);
  const vorrat = [ev('z', 'Zwiebeln', 1000, 'g')];
  assert.equal(status(pruefeRezept(r, { vorrat, produkte: [] }), 'Zwiebeln').status, 'unklar');
  const spaghetti = rezept([{ zutat: 'Spaghetti', menge: 2, einheit: 'stk' }]);
  assert.equal(status(pruefeRezept(spaghetti, { vorrat: [ev('s', 'Spaghetti', 500, 'g')], produkte: [], tabelle }), 'Spaghetti').status, 'unklar');
});

// --- Einheiten umrechnen beim Abziehen ---
const zeile = (plan, zutat) => plan.zeilen.find((z) => z.zutat === zutat);
test('planeAbzug: mit Tabelle wird "1 Zwiebel" als 90 g vom Vorrat in g abgezogen', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 1, einheit: 'stk' }]);
  const plan = planeAbzug(r, 2, { vorrat: [ev('z', 'Zwiebeln', 1000, 'g')], produkte: [], tabelle });
  const z = zeile(plan, 'Zwiebeln');
  assert.equal(z.art, 'abzug');
  assert.equal(z.einheit, 'g');
  assert.equal(z.betrag, 90);
  assert.deepEqual(z.umgerechnet, { menge: 1, einheit: 'stk' });
  assert.deepEqual(z.quellen.map((q) => [q.abziehen, q.nachher]), [[90, 910]]);
  assert.equal(wendeAn(plan, {}).vorratPut[0].menge, 910);
});
test('planeAbzug: mehr Portionen rechnen mit', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 1, einheit: 'stk' }]);
  assert.equal(zeile(planeAbzug(r, 4, { vorrat: [ev('z', 'Zwiebeln', 1000, 'g')], produkte: [], tabelle }), 'Zwiebeln').betrag, 180);
});
test('planeAbzug: gleiche Einheit hat Vorrang vor Umrechnung', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 1, einheit: 'stk' }]);
  const z = zeile(planeAbzug(r, 2, { vorrat: [ev('a', 'Zwiebeln', 3, 'stk'), ev('b', 'Zwiebeln', 1000, 'g')], produkte: [], tabelle }), 'Zwiebeln');
  assert.equal(z.einheit, 'stk');
  assert.equal(z.umgerechnet, undefined);
  assert.equal(z.quellen[0].eintrag.id, 'a');
});
test('planeAbzug: ohne Tabelle bleibt es "unklar" (Menge selbst eintragen)', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 1, einheit: 'stk' }]);
  const z = zeile(planeAbzug(r, 2, { vorrat: [ev('z', 'Zwiebeln', 1000, 'g')], produkte: [] }), 'Zwiebeln');
  assert.equal(z.art, 'unklar');
});
test('planeAbzug: die Menge kann trotz Umrechnung geändert werden (in der Einheit des Vorrats)', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 1, einheit: 'stk' }]);
  const vorrat = [ev('z', 'Zwiebeln', 1000, 'g')];
  const index = zeile(planeAbzug(r, 2, { vorrat, produkte: [], tabelle }), 'Zwiebeln').index;
  const z = zeile(planeAbzug(r, 2, { vorrat, produkte: [], tabelle }, { mengen: { [index]: 150 } }), 'Zwiebeln');
  assert.equal(z.quellen[0].nachher, 850);
});

// --- Bald ablaufende Zutaten in Rezepten ---
const JETZT = new Date(2026, 10, 9, 12, 0);
test('ablaufNutzung: welche bald ablaufenden Zutaten ein Rezept verbraucht', () => {
  const r = rezept([{ zutat: 'Milch', menge: 200, einheit: 'ml' }, { zutat: 'Eier', menge: 2, einheit: 'stk' }, { zutat: 'Parmesan', menge: 20, einheit: 'g', optional: true }]);
  const vorrat = [ev('m', 'Vollmilch', 1000, 'ml', { ablauf: '2026-11-10' }), ev('e', 'Eier', 6, 'stk', { ablauf: '2026-11-30' }), ev('p', 'Parmesan', 100, 'g', { ablauf: '2026-11-09' })];
  const n = ablaufNutzung(r, { index: baueIndex(vorrat, []), jetzt: JETZT });
  assert.deepEqual(n.map((x) => [x.zutat, x.name, x.tage]), [['Milch', 'Vollmilch', 1]]); // Eier nicht bald, Parmesan freiwillig
});
test('ablaufNutzung: nimmt den dringendsten Eintrag je Zutat, auch überschrittene', () => {
  const r = rezept([{ zutat: 'Milch', menge: 200, einheit: 'ml' }]);
  const vorrat = [ev('a', 'Milch A', 500, 'ml', { ablauf: '2026-11-11' }), ev('b', 'Milch B', 500, 'ml', { ablauf: '2026-11-08' })];
  const n = ablaufNutzung(r, { index: baueIndex(vorrat, []), jetzt: JETZT });
  assert.deepEqual(n.map((x) => [x.name, x.tage]), [['Milch B', -1]]);
  assert.deepEqual(ablaufNutzung(r, { index: baueIndex([], []), jetzt: JETZT }), []);
});
test('gruppiereVorschlaege: Rezepte mit bald ablaufenden Zutaten stehen innerhalb der Gruppe oben', () => {
  const p = { kategorie: 'alles', fehlend: 0 };
  const mk = (name, tage) => ({ rezept: { name }, pruefung: p, ablauf: tage === undefined ? [] : [{ zutat: 'X', name: 'X', tage }] });
  const g = gruppiereVorschlaege([mk('A ohne'), mk('B morgen', 1), mk('C heute', 0), mk('D überschritten', -2), mk('E ohne')]);
  assert.deepEqual(g.alles.map((x) => x.rezept.name), ['D überschritten', 'C heute', 'B morgen', 'A ohne', 'E ohne']);
});
test('gruppiereVorschlaege: ohne Ablaufdaten bleibt es bei weniger fehlend, dann Name', () => {
  const mk = (name, fehlend) => ({ rezept: { name }, pruefung: { kategorie: 'wenig', fehlend } });
  const g = gruppiereVorschlaege([mk('B', 2), mk('A', 2), mk('C', 1)]);
  assert.deepEqual(g.wenig.map((x) => x.rezept.name), ['C', 'A', 'B']);
});
