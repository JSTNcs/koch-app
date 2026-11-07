import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planeAbzug,
  wendeAn,
  berechneRest,
  neuerRest,
  esseRestPortion,
  restAlterText,
  neuesProtokoll,
  macheRueckgaengig,
  normalisiereRest,
  normalisiereProtokoll,
  neuerKochstand,
} from '../js/kochen.js';
import { neuesRezept } from '../js/rezepte.js';
import { neuerEintrag, setzeDa } from '../js/pantry.js';

const rezept = (zutaten, o = {}) => neuesRezept({ name: 'Sauce', portionen: 2, zutaten, schritte: ['Kochen.'], ...o });
const sauce = () =>
  rezept([
    { zutat: 'Spaghetti', menge: 200, einheit: 'g' },
    { zutat: 'Zwiebeln', menge: 1, einheit: 'stk' },
    { zutat: 'Salz', art: 'da_leer' },
    { zutat: 'Parmesan', menge: 30, einheit: 'g', optional: true },
  ]);
const ev = (id, name, menge, einheit, o = {}) => neuerEintrag({ name, art: 'menge', menge, einheit, ...o }, { id });
const ctx = (vorrat) => ({ vorrat, produkte: [] });
const zeile = (plan, zutat) => plan.zeilen.find((z) => z.zutat === zutat);

// --- Abzug planen ---
test('planeAbzug: Menge aus dem Rezept wird vom Vorrat abgezogen', () => {
  const plan = planeAbzug(sauce(), 2, ctx([ev('a', 'Barilla Spaghetti', 500, 'g'), ev('b', 'Zwiebeln', 3, 'stk')]));
  const s = zeile(plan, 'Spaghetti');
  assert.equal(s.art, 'abzug');
  assert.equal(s.betrag, 200);
  assert.equal(s.einheit, 'g');
  assert.deepEqual(s.quellen.map((q) => [q.eintrag.id, q.abziehen, q.nachher, q.entfernt]), [['a', 200, 300, false]]);
  assert.equal(s.fehlt, 0);
  assert.deepEqual(zeile(plan, 'Zwiebeln').quellen.map((q) => [q.abziehen, q.nachher]), [[1, 2]]);
});
test('planeAbzug: mehr Portionen, mehr Abzug', () => {
  const plan = planeAbzug(sauce(), 4, ctx([ev('a', 'Spaghetti', 500, 'g')]));
  assert.equal(zeile(plan, 'Spaghetti').betrag, 400);
});
test('planeAbzug: bald ablaufende zuerst, bei gleichem Datum die kleinere Menge, ohne Datum zuletzt', () => {
  const vorrat = [
    ev('a', 'Spaghetti', 500, 'g', { ablauf: '2027-06-01' }),
    ev('b', 'Spaghetti', 100, 'g', { ablauf: '2027-01-01' }),
    ev('c', 'Spaghetti', 50, 'g'),
    ev('d', 'Spaghetti', 80, 'g', { ablauf: '2027-01-01' }),
  ];
  const s = zeile(planeAbzug(sauce(), 2, ctx(vorrat)), 'Spaghetti');
  assert.deepEqual(s.quellen.map((q) => [q.eintrag.id, q.abziehen, q.entfernt]), [['d', 80, true], ['b', 100, true], ['a', 20, false]]);
  assert.equal(s.quellen[2].nachher, 480);
});
test('planeAbzug: leere Einträge werden entfernt (nachher 0)', () => {
  const s = zeile(planeAbzug(sauce(), 2, ctx([ev('a', 'Spaghetti', 200, 'g')])), 'Spaghetti');
  assert.deepEqual(s.quellen.map((q) => [q.nachher, q.entfernt]), [[0, true]]);
});
test('planeAbzug: zu wenig im Vorrat, es wird nur abgezogen, was da ist', () => {
  const s = zeile(planeAbzug(sauce(), 2, ctx([ev('a', 'Spaghetti', 150, 'g')])), 'Spaghetti');
  assert.equal(s.quellen[0].abziehen, 150);
  assert.equal(s.fehlt, 50);
  assert.equal(s.betrag, 200);
});
test('planeAbzug: Zutat gar nicht im Vorrat', () => {
  const s = zeile(planeAbzug(sauce(), 2, ctx([])), 'Spaghetti');
  assert.equal(s.art, 'nichtDa');
  assert.deepEqual(s.quellen, []);
  assert.equal(s.fehlt, 200);
});
test('planeAbzug: Vorrat in anderer Einheit, die Menge gibt der Nutzer an', () => {
  const vorrat = [ev('z', 'Zwiebeln', 1000, 'g')];
  const plan = planeAbzug(sauce(), 2, ctx(vorrat));
  const z = zeile(plan, 'Zwiebeln');
  assert.equal(z.art, 'unklar');
  assert.equal(z.einheit, 'g');
  assert.equal(z.standard, null);
  assert.equal(z.betrag, 0);
  assert.deepEqual(z.quellen, []);
  assert.equal(z.kandidaten.length, 1);
  const mit = zeile(planeAbzug(sauce(), 2, ctx(vorrat), { mengen: { [z.index]: 150 } }), 'Zwiebeln');
  assert.deepEqual(mit.quellen.map((q) => [q.abziehen, q.nachher]), [[150, 850]]);
});
test('planeAbzug: Gewürze werden nicht abgezogen, nur zur Auswahl "leer" angeboten', () => {
  const salz = neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' });
  const s = zeile(planeAbzug(sauce(), 2, ctx([salz])), 'Salz');
  assert.equal(s.art, 'gewuerz');
  assert.deepEqual(s.quellen, []);
  assert.deepEqual(s.kandidaten.map((e) => e.id), ['s']);
  assert.deepEqual(zeile(planeAbzug(sauce(), 2, ctx([])), 'Salz').kandidaten, []);
});
test('planeAbzug: freiwillige Zutaten nur, wenn benutzt', () => {
  const vorrat = [ev('p', 'Parmesan', 100, 'g')];
  const ohne = zeile(planeAbzug(sauce(), 2, ctx(vorrat)), 'Parmesan');
  assert.equal(ohne.benutzt, false);
  assert.deepEqual(ohne.quellen, []);
  const mit = zeile(planeAbzug(sauce(), 2, ctx(vorrat), { optionalBenutzt: [ohne.index] }), 'Parmesan');
  assert.equal(mit.benutzt, true);
  assert.deepEqual(mit.quellen.map((q) => [q.abziehen, q.nachher]), [[30, 70]]);
});
test('planeAbzug: der Nutzer kann die Menge ändern', () => {
  const vorrat = [ev('a', 'Spaghetti', 500, 'g')];
  const index = zeile(planeAbzug(sauce(), 2, ctx(vorrat)), 'Spaghetti').index;
  const s = zeile(planeAbzug(sauce(), 2, ctx(vorrat), { mengen: { [index]: 250 } }), 'Spaghetti');
  assert.equal(s.betrag, 250);
  assert.equal(s.quellen[0].nachher, 250);
  assert.equal(s.standard, 200);
});
test('planeAbzug: dieselbe Zutat zweimal im Rezept verbraucht den Vorrat nur einmal', () => {
  const r = rezept([{ zutat: 'Zwiebeln', menge: 1, einheit: 'stk' }, { zutat: 'Zwiebeln', menge: 1, einheit: 'stk' }]);
  const plan = planeAbzug(r, 2, ctx([ev('z', 'Zwiebeln', 1, 'stk')]));
  assert.equal(plan.zeilen[0].quellen[0].abziehen, 1);
  assert.equal(plan.zeilen[1].quellen.length, 0);
  assert.equal(plan.zeilen[1].fehlt, 1);
});
test('planeAbzug: die Marke ist egal, die Zutat zählt', () => {
  const s = zeile(planeAbzug(sauce(), 2, { vorrat: [ev('a', 'Gut & Günstig Spaghetti N.5', 500, 'g')], produkte: [] }), 'Spaghetti');
  assert.equal(s.quellen[0].eintrag.id, 'a');
});

// --- Abzug anwenden ---
test('wendeAn: was gespeichert, gelöscht und für "Rückgängig" gemerkt wird', () => {
  const vorrat = [ev('a', 'Spaghetti', 500, 'g', { ablauf: '2027-06-01' }), ev('b', 'Spaghetti', 100, 'g', { ablauf: '2027-01-01' })];
  const kopie = JSON.stringify(vorrat);
  const r = wendeAn(planeAbzug(sauce(), 2, ctx(vorrat)), {});
  assert.deepEqual(r.vorratLoesche, ['b']);
  assert.deepEqual(r.vorratPut.map((e) => [e.id, e.menge]), [['a', 400]]);
  assert.deepEqual(r.vorher.map((e) => e.id).sort(), ['a', 'b']);
  assert.equal(r.vorher.find((e) => e.id === 'a').menge, 500);
  assert.equal(JSON.stringify(vorrat), kopie); // Original unverändert
});
test('wendeAn: Gewürz kann auf "leer" gesetzt werden', () => {
  const salz = neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' });
  const plan = planeAbzug(sauce(), 2, ctx([salz]));
  const r = wendeAn(plan, { gewuerzLeer: [zeile(plan, 'Salz').index] });
  assert.deepEqual(r.vorratPut.map((e) => [e.id, e.da]), [['s', false]]);
  assert.equal(r.vorher[0].da, true);
  assert.deepEqual(wendeAn(plan, {}).vorratPut, []);
});
test('wendeAn: ohne Änderungen bleibt alles leer', () => {
  assert.deepEqual(wendeAn(planeAbzug(sauce(), 2, ctx([])), {}), { vorratPut: [], vorratLoesche: [], vorher: [] });
});

// --- Portionen und Reste ---
test('berechneRest: gesamt minus gegessen', () => {
  assert.equal(berechneRest(4, 1), 3);
  assert.equal(berechneRest(2, 2), 0);
  assert.equal(berechneRest(1, 0), 1);
});
test('berechneRest: Fehler mit deutscher Meldung', () => {
  assert.throws(() => berechneRest(2, 3), /mehr/);
  assert.throws(() => berechneRest(0, 0), /Portionen/);
  assert.throws(() => berechneRest(2.5, 1), /Portionen/);
  assert.throws(() => berechneRest(2, -1), /gegessen/);
  assert.throws(() => berechneRest(2, 0.5), /gegessen/);
  assert.throws(() => berechneRest(NaN, 1), /Portionen/);
});
const JETZT = new Date('2026-11-10T12:00:00.000Z');
test('neuerRest: Felder und Prüfung', () => {
  assert.deepEqual(neuerRest({ rezeptId: 'r1', name: 'Chili', portionen: 2, jetzt: JETZT }, { id: 'x' }), {
    id: 'x',
    rezeptId: 'r1',
    name: 'Chili',
    portionen: 2,
    gekochtAm: '2026-11-10T12:00:00.000Z',
  });
  assert.throws(() => neuerRest({ rezeptId: 'r1', name: '', portionen: 2, jetzt: JETZT }), /Name/);
  assert.throws(() => neuerRest({ rezeptId: 'r1', name: 'X', portionen: 0, jetzt: JETZT }), /Portionen/);
});
test('esseRestPortion: eine Portion weniger, bei 0 verschwindet der Rest', () => {
  const r = neuerRest({ rezeptId: 'r1', name: 'Chili', portionen: 2, jetzt: JETZT }, { id: 'x' });
  assert.equal(esseRestPortion(r).rest.portionen, 1);
  assert.equal(r.portionen, 2);
  assert.deepEqual(esseRestPortion({ ...r, portionen: 1 }), { loeschen: 'x' });
});
test('restAlterText: heute, gestern, vor N Tagen', () => {
  const rest = (tageZurueck) => ({ gekochtAm: new Date(JETZT.getTime() - tageZurueck * 86400000 - 3600000).toISOString() });
  assert.equal(restAlterText({ gekochtAm: JETZT.toISOString() }, JETZT), 'heute gekocht');
  assert.equal(restAlterText(rest(1), JETZT), 'gestern gekocht');
  assert.equal(restAlterText(rest(3), JETZT), 'vor 3 Tagen gekocht');
});

// --- Protokoll und Rückgängig ---
test('neuesProtokoll und macheRueckgaengig: alles lässt sich zurückholen', () => {
  const vorrat = [ev('a', 'Spaghetti', 500, 'g'), ev('b', 'Spaghetti', 50, 'g', { ablauf: '2027-01-01' })];
  const plan = planeAbzug(sauce(), 2, ctx(vorrat));
  const wirkung = wendeAn(plan, {});
  const rest = neuerRest({ rezeptId: 'sauce', name: 'Sauce', portionen: 1, jetzt: JETZT }, { id: 'rest1' });
  const p = neuesProtokoll({ rezept: sauce(), portionen: 2, gesamt: 2, gegessen: 1, rest, wirkung, jetzt: JETZT, zusammenfassung: ['Spaghetti: 200 g'] }, { id: 'prot1' });
  assert.equal(p.id, 'prot1');
  assert.equal(p.name, 'Sauce');
  assert.equal(p.gesamt, 2);
  assert.equal(p.gegessen, 1);
  assert.equal(p.restId, 'rest1');
  assert.equal(p.datum, '2026-11-10T12:00:00.000Z');
  const rueck = macheRueckgaengig(p);
  assert.deepEqual(rueck.vorratPut.map((e) => [e.id, e.menge]).sort(), [['a', 500], ['b', 50]]);
  assert.equal(rueck.restLoeschen, 'rest1');
  assert.equal(rueck.protokollLoeschen, 'prot1');
});
test('neuesProtokoll: ohne Rest', () => {
  const wirkung = wendeAn(planeAbzug(sauce(), 2, ctx([])), {});
  const p = neuesProtokoll({ rezept: sauce(), portionen: 2, gesamt: 1, gegessen: 1, rest: null, wirkung, jetzt: JETZT, zusammenfassung: [] }, { id: 'p' });
  assert.equal(p.restId, null);
  assert.equal(macheRueckgaengig(p).restLoeschen, null);
});

// --- Prüfen beim Einlesen einer Sicherung ---
test('normalisiereRest: Hin und zurück, Fehler, fremde Felder', () => {
  const r = neuerRest({ rezeptId: 'r1', name: 'Chili', portionen: 2, jetzt: JETZT }, { id: 'x' });
  assert.deepEqual(normalisiereRest(JSON.parse(JSON.stringify(r))), r);
  assert.equal('boese' in normalisiereRest({ ...r, boese: 1 }), false);
  assert.throws(() => normalisiereRest({ ...r, id: '' }), /Kennung/);
  assert.throws(() => normalisiereRest({ ...r, portionen: -1 }), /Portionen/);
  assert.throws(() => normalisiereRest({ ...r, gekochtAm: 'gestern' }), /Datum/);
  assert.throws(() => normalisiereRest('x'), /Rest/);
});
test('normalisiereProtokoll: Hin und zurück, Fehler, verdorbene Sicherungseinträge', () => {
  const salz = setzeDa(neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' }), false);
  const p = neuesProtokoll(
    { rezept: sauce(), portionen: 2, gesamt: 2, gegessen: 1, rest: null, wirkung: { vorratPut: [], vorratLoesche: [], vorher: [ev('a', 'Spaghetti', 500, 'g'), salz] }, jetzt: JETZT, zusammenfassung: ['x'] },
    { id: 'p' }
  );
  const n = normalisiereProtokoll(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(n, p);
  assert.equal(n.vorher[1].da, false);
  assert.throws(() => normalisiereProtokoll({ ...p, id: '' }), /Kennung/);
  assert.throws(() => normalisiereProtokoll({ ...p, gesamt: 0 }), /Portionen/);
  assert.throws(() => normalisiereProtokoll({ ...p, datum: 'x' }), /Datum/);
  assert.throws(() => normalisiereProtokoll({ ...p, vorher: [{ id: 'a', name: '', art: 'menge', menge: 1, einheit: 'g' }] }), /Name/);
  assert.throws(() => normalisiereProtokoll({ ...p, vorher: 'x' }), /Vorrat/);
  assert.equal('boese' in normalisiereProtokoll({ ...p, boese: 1 }), false);
});

// --- Laufender Kochvorgang ---
test('neuerKochstand: Start bei den Zutaten, gegessen standardmäßig 1', () => {
  const k = neuerKochstand(sauce(), 4, JETZT);
  assert.equal(k.rezeptId, sauce().id);
  assert.equal(k.portionen, 4);
  assert.equal(k.phase, 'zutaten');
  assert.equal(k.schritt, 0);
  assert.equal(k.gesamt, 4);
  assert.equal(k.gegessen, 1);
  assert.deepEqual([k.bereit, k.optionalBenutzt, k.mengen, k.gewuerzLeer], [[], [], {}, []]);
  assert.equal(k.gestartet, '2026-11-10T12:00:00.000Z');
  assert.equal(neuerKochstand(sauce(), 1, JETZT).gegessen, 1);
});
