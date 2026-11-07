import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZUTATEN, findeZutat, schlageZutatVor, schluessel, zutatVonProdukt, zutatVonEintrag } from '../js/zutaten.js';
import { EINHEITEN } from '../js/pantry.js';

// --- Die eingebaute Liste ist in Ordnung ---
test('Zutatenliste: Namen und Synonyme sind eindeutig', () => {
  const gesehen = new Map();
  for (const z of ZUTATEN) {
    for (const k of [z.name, ...z.synonyme]) {
      const n = schluessel(k);
      assert.ok(!gesehen.has(n) || gesehen.get(n) === z.name, `"${k}" gehört zu "${z.name}" und "${gesehen.get(n)}"`);
      gesehen.set(n, z.name);
    }
  }
});
test('Zutatenliste: Art und Einheit passen zusammen', () => {
  assert.ok(ZUTATEN.length >= 90, 'mindestens 90 Zutaten, hat ' + ZUTATEN.length);
  for (const z of ZUTATEN) {
    if (z.art === 'menge') assert.ok(EINHEITEN.includes(z.einheit), z.name);
    else {
      assert.equal(z.art, 'da_leer', z.name);
      assert.equal(z.einheit, null, z.name);
    }
  }
});
test('Zutatenliste: Gewürze, Öl und Salz sind "da / leer", Nudeln und Fleisch gemessen', () => {
  for (const n of ['Salz', 'Pfeffer', 'Olivenöl', 'Öl', 'Paprikapulver']) assert.equal(findeZutat(n).art, 'da_leer', n);
  for (const n of ['Spaghetti', 'Hähnchenbrust', 'Milch', 'Eier']) assert.equal(findeZutat(n).art, 'menge', n);
});

// --- Zutat nachschlagen ---
test('findeZutat: Name und Synonyme, Groß/Klein und Umlaute egal', () => {
  assert.equal(findeZutat('Spaghetti').name, 'Spaghetti');
  assert.equal(findeZutat('  spaghetti ').name, 'Spaghetti');
  assert.equal(findeZutat('Möhren').name, 'Karotten');
  assert.equal(findeZutat('MOEHREN'), null); // nur echte Schreibweisen
  assert.equal(findeZutat('zwiebel').name, 'Zwiebeln');
  assert.equal(findeZutat('Hirse'), null);
  assert.equal(findeZutat(''), null);
});
test('schluessel: gleiche Zutat ergibt gleichen Schlüssel', () => {
  assert.equal(schluessel('Möhren'), schluessel('Karotten'));
  assert.equal(schluessel(' Hirse '), 'hirse');
  assert.equal(schluessel('Gemüse  Brühe'), schluessel('gemüse brühe'));
});

// --- Vorschlag aus dem Produktnamen ---
test('schlageZutatVor: typische Produktnamen', () => {
  const faelle = [
    ['Barilla Spaghetti N.5', 'Spaghetti'],
    ['Gut & Günstig Spaghetti', 'Spaghetti'],
    ['Vollmilch 3,5%', 'Milch'],
    ['H-Milch', 'Milch'],
    ['Rinderhack', 'Hackfleisch'],
    ['Eier Freiland 10 Stück', 'Eier'],
    ['Kartoffeln festkochend', 'Kartoffeln'],
    ['Gehackte Tomaten', 'Dosentomaten'],
    ['Passierte Tomaten', 'Passierte Tomaten'],
    ['Tomatenmark', 'Tomatenmark'],
    ['Olivenöl extra vergine', 'Olivenöl'],
    ['Sonnenblumenöl', 'Öl'],
    ['Basmati Reis', 'Reis'],
    ['Fusilli', 'Nudeln'],
    ['Nuss-Nugat-Creme', null],
  ];
  for (const [text, erwartet] of faelle) assert.equal(schlageZutatVor(text), erwartet, text);
});
test('schlageZutatVor: Wortteile in zusammengesetzten Wörtern täuschen nicht', () => {
  for (const text of ['Hafermilch', 'Buttermilch', 'Milchreis', 'Erdnussbutter', 'Reiswaffeln', 'Zitronensaft']) {
    assert.equal(schlageZutatVor(text), null, text);
  }
});
test('schlageZutatVor: die genauere Zutat gewinnt', () => {
  assert.equal(schlageZutatVor('Gehackte Tomaten in Dose'), 'Dosentomaten');
  assert.equal(schlageZutatVor('Tomaten'), 'Tomaten');
});
test('schlageZutatVor: leere Eingabe', () => {
  assert.equal(schlageZutatVor(''), null);
  assert.equal(schlageZutatVor(null), null);
});

// --- Zutat eines Produkts oder Vorratseintrags ---
test('zutatVonProdukt: gesetzt, sonst geraten, sonst keine', () => {
  assert.deepEqual(zutatVonProdukt({ name: 'Barilla Spaghetti', zutat: 'Nudeln' }), { zutat: 'Nudeln', geraten: false });
  assert.deepEqual(zutatVonProdukt({ name: 'Barilla Spaghetti', zutat: null }), { zutat: 'Spaghetti', geraten: true });
  assert.deepEqual(zutatVonProdukt({ name: 'Nuss-Nugat-Creme' }), { zutat: 'Nuss-Nugat-Creme', geraten: true });
});
test('zutatVonEintrag: Reihenfolge Eintrag, Produkt, gleichwertiges Produkt, Vermutung', () => {
  const produkte = [
    { barcode: '1', name: 'Bio Nudeln', zutat: 'Spaghetti', gruppe: null },
    { barcode: '2', name: 'Irgendwas', zutat: null, gruppe: 'g1' },
    { barcode: '3', name: 'Marke X Penne', zutat: 'Penne', gruppe: 'g1' },
  ];
  assert.deepEqual(zutatVonEintrag({ name: 'Mehl', zutat: 'Mehl', barcode: null }, produkte), { zutat: 'Mehl', geraten: false });
  assert.deepEqual(zutatVonEintrag({ name: 'Bio Nudeln', zutat: null, barcode: '1' }, produkte), { zutat: 'Spaghetti', geraten: false });
  assert.deepEqual(zutatVonEintrag({ name: 'Irgendwas', zutat: null, barcode: '2' }, produkte), { zutat: 'Penne', geraten: false });
  assert.deepEqual(zutatVonEintrag({ name: 'Zwiebeln', zutat: null, barcode: null }, produkte), { zutat: 'Zwiebeln', geraten: true });
  assert.deepEqual(zutatVonEintrag({ name: 'Hirse', zutat: null, barcode: null }, produkte), { zutat: 'Hirse', geraten: true });
});
