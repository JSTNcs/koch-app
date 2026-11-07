import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pruefeRezeptDatei } from '../js/rezepte.js';
import { findeZutat } from '../js/zutaten.js';

const text = readFileSync(fileURLToPath(new URL('../daten/startpaket.json', import.meta.url)), 'utf8');
const rezepte = pruefeRezeptDatei(text);

test('Startpaket: 20 bis 30 gültige Rezepte', () => {
  assert.ok(rezepte.length >= 20 && rezepte.length <= 30, 'Anzahl: ' + rezepte.length);
});
test('Startpaket: eindeutige Kennungen und Namen, alle für 2 Portionen', () => {
  assert.equal(new Set(rezepte.map((r) => r.id)).size, rezepte.length);
  assert.equal(new Set(rezepte.map((r) => r.name)).size, rezepte.length);
  for (const r of rezepte) {
    assert.equal(r.portionen, 2, r.name);
    assert.ok(r.id.startsWith('start-'), r.id);
    assert.equal(r.quelle, 'Startpaket');
  }
});
test('Startpaket: alle Zutaten stehen in der eingebauten Zutatenliste (so findet der Abgleich sie)', () => {
  for (const r of rezepte) {
    for (const z of r.zutaten) {
      const f = findeZutat(z.zutat);
      assert.ok(f, `${r.name}: Zutat "${z.zutat}" fehlt in der Zutatenliste`);
      assert.equal(z.zutat, f.name, `${r.name}: "${z.zutat}" bitte als "${f.name}" schreiben`);
      assert.equal(z.art, f.art, `${r.name}: ${z.zutat} ist in der Liste "${f.art}", im Rezept "${z.art}"`);
      if (z.art === 'menge') assert.equal(z.einheit, f.einheit, `${r.name}: ${z.zutat} üblicherweise in ${f.einheit}`);
    }
  }
});
test('Startpaket: jedes Rezept hat Zubereitung, mindestens eine nötige Zutat und eine Dauer', () => {
  for (const r of rezepte) {
    assert.ok(r.schritte.length >= 3, `${r.name}: nur ${r.schritte.length} Schritte`);
    assert.ok(r.zutaten.some((z) => !z.optional && z.art === 'menge'), r.name);
    assert.ok(r.dauerMinuten >= 5, r.name);
  }
});
test('Startpaket: gemischt mit Fleisch, Fisch und Vegetarischem', () => {
  const hat = (r, namen) => r.zutaten.some((z) => !z.optional && namen.includes(z.zutat));
  const fleisch = ['Hackfleisch', 'Hähnchenbrust', 'Speck', 'Schinken', 'Würstchen'];
  const fisch = ['Lachs', 'Thunfisch', 'Fischstäbchen'];
  assert.ok(rezepte.filter((r) => hat(r, fleisch)).length >= 6);
  assert.ok(rezepte.filter((r) => hat(r, fisch)).length >= 2);
  assert.ok(rezepte.filter((r) => !hat(r, [...fleisch, ...fisch])).length >= 6);
});
