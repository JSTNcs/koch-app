import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseZutatenzeile, extrahiereRezept, baueRezeptDatei } from '../tools/rezeptimport.mjs';
import { pruefeRezeptDatei } from '../js/rezepte.js';

const eine = (text) => {
  const r = parseZutatenzeile(text);
  assert.equal(r.length, 1, `${text}: ${r.length} Zutaten`);
  return r[0];
};
const kern = (z) => ({ zutat: z.zutat, art: z.art, menge: z.menge, einheit: z.einheit });

// --- Zutatenzeilen verstehen ---
test('parseZutatenzeile: Menge, Einheit und Zutat', () => {
  assert.deepEqual(kern(eine('200 g Mehl')), { zutat: 'Mehl', art: 'menge', menge: 200, einheit: 'g' });
  assert.deepEqual(kern(eine('1,5 kg Kartoffeln')), { zutat: 'Kartoffeln', art: 'menge', menge: 1500, einheit: 'g' });
  assert.deepEqual(kern(eine('400 ml Milch')), { zutat: 'Milch', art: 'menge', menge: 400, einheit: 'ml' });
  assert.deepEqual(kern(eine('1 l Milch')), { zutat: 'Milch', art: 'menge', menge: 1000, einheit: 'ml' });
  assert.deepEqual(kern(eine('2 dl Sahne')), { zutat: 'Sahne', art: 'menge', menge: 200, einheit: 'ml' });
  assert.deepEqual(kern(eine('250g Quark')), { zutat: 'Quark', art: 'menge', menge: 250, einheit: 'g' });
});
test('parseZutatenzeile: Stückzahlen und Namen aus der Zutatenliste', () => {
  assert.deepEqual(kern(eine('2 Eier')), { zutat: 'Eier', art: 'menge', menge: 2, einheit: 'stk' });
  assert.deepEqual(kern(eine('1 Zwiebel')), { zutat: 'Zwiebeln', art: 'menge', menge: 1, einheit: 'stk' });
  assert.deepEqual(kern(eine('2 Knoblauchzehen')), { zutat: 'Knoblauch', art: 'menge', menge: 2, einheit: 'stk' });
  assert.deepEqual(kern(eine('3 Scheiben Toastbrot')), { zutat: 'Brot', art: 'menge', menge: 3, einheit: 'stk' });
  assert.deepEqual(kern(eine('3 Stück Möhren')), { zutat: 'Karotten', art: 'menge', menge: 3, einheit: 'stk' });
});
test('parseZutatenzeile: Brüche und Bereiche', () => {
  assert.equal(eine('½ Zitrone').menge, 0.5);
  assert.equal(eine('1/2 l Milch').menge, 500);
  assert.equal(eine('1 ½ Zwiebeln').menge, 1.5);
  const bereich = eine('2-3 Karotten');
  assert.equal(bereich.menge, 3);
  assert.equal(bereich.notiz, '2-3');
});
test('parseZutatenzeile: ungefähr, Hinweise nach Komma und in Klammern', () => {
  assert.deepEqual(kern(eine('ca. 500 g Hähnchenbrustfilet')), { zutat: 'Hähnchenbrust', art: 'menge', menge: 500, einheit: 'g' });
  const z = eine('200 g Zwiebeln, fein gewürfelt');
  assert.equal(z.zutat, 'Zwiebeln');
  assert.equal(z.notiz, 'fein gewürfelt');
  assert.equal(eine('1 Dose gehackte Tomaten (400 g)').menge, 400);
  assert.equal(eine('1 Dose gehackte Tomaten (400 g)').zutat, 'Dosentomaten');
});
test('parseZutatenzeile: Löffel, Prisen und Bund bei Gewürzen sind "nach Bedarf"', () => {
  const oel = eine('1 EL Olivenöl');
  assert.deepEqual(kern(oel), { zutat: 'Olivenöl', art: 'da_leer', menge: null, einheit: null });
  assert.equal(oel.notiz, '1 EL');
  assert.equal(eine('1 Prise Salz').art, 'da_leer');
  assert.equal(eine('1 Bund Petersilie').art, 'da_leer');
  assert.deepEqual(kern(eine('Pfeffer')), { zutat: 'Pfeffer', art: 'da_leer', menge: null, einheit: null });
});
test('parseZutatenzeile: Löffel bei gemessenen Zutaten werden umgerechnet und gemerkt', () => {
  const mehl = eine('3 EL Mehl');
  assert.deepEqual(kern(mehl), { zutat: 'Mehl', art: 'menge', menge: 45, einheit: 'g' });
  assert.equal(mehl.notiz, '3 EL');
  assert.equal(eine('2 TL Honig').menge, 10);
});
test('parseZutatenzeile: "Salz und Pfeffer" werden zwei Zutaten', () => {
  assert.deepEqual(parseZutatenzeile('Salz und Pfeffer').map((z) => z.zutat), ['Salz', 'Pfeffer']);
  assert.deepEqual(parseZutatenzeile('Salz, Pfeffer').map((z) => z.zutat), ['Salz', 'Pfeffer']);
  assert.deepEqual(parseZutatenzeile('Salz & Pfeffer aus der Mühle').map((z) => z.zutat), ['Salz', 'Pfeffer']);
});
test('parseZutatenzeile: unbekannte Zutaten werden übernommen und markiert', () => {
  const z = eine('100 g Hirse');
  assert.deepEqual(kern(z), { zutat: 'Hirse', art: 'menge', menge: 100, einheit: 'g' });
  assert.equal(z.unbekannt, true);
  assert.equal(eine('2 Eier').unbekannt, false);
  const pck = eine('1 Packung Blätterteig');
  assert.equal(pck.menge, 1);
  assert.equal(pck.einheit, 'stk');
  assert.equal(pck.unbekannt, true);
});
test('parseZutatenzeile: Wasser und Leeres sind keine Zutaten', () => {
  assert.deepEqual(parseZutatenzeile('Wasser'), []);
  assert.deepEqual(parseZutatenzeile('500 ml Wasser'), []);
  assert.deepEqual(parseZutatenzeile('   '), []);
});

// --- Rezeptdaten aus einer Webseite ---
const seite = (json, extra = '') =>
  `<html><head><title>x</title>${extra}<script type="application/ld+json">${JSON.stringify(json)}</script></head><body>Rezept</body></html>`;
const rezeptJson = (o = {}) => ({
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Pasta &amp; Sauce',
  recipeYield: '4 Portionen',
  totalTime: 'PT1H15M',
  recipeIngredient: ['400 g Spaghetti', '1 Zwiebel', 'Salz und Pfeffer'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Nudeln <b>kochen</b>.' },
    { '@type': 'HowToStep', text: 'Sauce &quot;köcheln&quot; lassen.' },
  ],
  ...o,
});

test('extrahiereRezept: Name, Portionen, Dauer, Zutaten, Schritte, Quelle', () => {
  const { rezept, warnungen } = extrahiereRezept(seite(rezeptJson()), 'https://www.beispiel.de/rezepte/pasta');
  assert.equal(rezept.name, 'Pasta & Sauce');
  assert.equal(rezept.portionen, 4);
  assert.equal(rezept.dauerMinuten, 75);
  assert.deepEqual(rezept.zutaten.map((z) => z.zutat), ['Spaghetti', 'Zwiebeln', 'Salz', 'Pfeffer']);
  assert.deepEqual(rezept.schritte, ['Nudeln kochen.', 'Sauce "köcheln" lassen.']);
  assert.equal(rezept.quelle, 'https://www.beispiel.de/rezepte/pasta');
  assert.match(rezept.id, /^link-pasta-sauce/);
  assert.deepEqual(warnungen, []);
});
test('extrahiereRezept: Rezept versteckt in @graph oder in einer Liste', () => {
  const graph = seite({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', name: 'Seite' }, rezeptJson()] });
  assert.equal(extrahiereRezept(graph, 'https://a.de/x').rezept.name, 'Pasta & Sauce');
  const liste = seite([{ '@type': 'BreadcrumbList' }, rezeptJson({ '@type': ['Recipe', 'Thing'] })]);
  assert.equal(extrahiereRezept(liste, 'https://a.de/x').rezept.name, 'Pasta & Sauce');
});
test('extrahiereRezept: verschiedene Schreibweisen für Portionen, Dauer und Anleitung', () => {
  assert.equal(extrahiereRezept(seite(rezeptJson({ recipeYield: 2 })), 'https://a.de/x').rezept.portionen, 2);
  assert.equal(extrahiereRezept(seite(rezeptJson({ recipeYield: ['6', '6 Portionen'] })), 'https://a.de/x').rezept.portionen, 6);
  assert.equal(extrahiereRezept(seite(rezeptJson({ totalTime: undefined, cookTime: 'PT45M' })), 'https://a.de/x').rezept.dauerMinuten, 45);
  const abschnitte = rezeptJson({
    recipeInstructions: [{ '@type': 'HowToSection', name: 'Sauce', itemListElement: [{ '@type': 'HowToStep', text: 'Zwiebel hacken.' }, { '@type': 'HowToStep', text: 'Anbraten.' }] }, 'Servieren.'],
  });
  assert.deepEqual(extrahiereRezept(seite(abschnitte), 'https://a.de/x').rezept.schritte, ['Zwiebel hacken.', 'Anbraten.', 'Servieren.']);
  const text = rezeptJson({ recipeInstructions: 'Erst kochen.\nDann essen.' });
  assert.deepEqual(extrahiereRezept(seite(text), 'https://a.de/x').rezept.schritte, ['Erst kochen.', 'Dann essen.']);
});
test('extrahiereRezept: fehlende Angaben ergeben Warnungen', () => {
  const { rezept, warnungen } = extrahiereRezept(seite(rezeptJson({ recipeYield: undefined, totalTime: undefined, recipeIngredient: ['100 g Hirse', '1 Zwiebel'] })), 'https://a.de/x');
  assert.equal(rezept.portionen, 2);
  assert.equal(rezept.dauerMinuten, null);
  assert.ok(warnungen.some((w) => /Portionen/.test(w)));
  assert.ok(warnungen.some((w) => /Hirse/.test(w) && /Zutatenliste/.test(w)));
});
test('extrahiereRezept: keine Rezeptdaten auf der Seite', () => {
  assert.throws(() => extrahiereRezept('<html><body>Hallo</body></html>', 'https://a.de/x'), /keine maschinenlesbaren Rezeptdaten/);
  assert.throws(() => extrahiereRezept(seite({ '@type': 'WebPage' }), 'https://a.de/x'), /keine maschinenlesbaren Rezeptdaten/);
  assert.throws(() => extrahiereRezept('<script type="application/ld+json">{kaputt</script>', 'https://a.de/x'), /keine maschinenlesbaren Rezeptdaten/);
});
test('baueRezeptDatei: Ergebnis wird von der App akzeptiert', () => {
  const { rezept } = extrahiereRezept(seite(rezeptJson()), 'https://www.beispiel.de/rezepte/pasta');
  const datei = baueRezeptDatei([rezept]);
  assert.equal(datei.format, 'koch-app-rezepte');
  const geprueft = pruefeRezeptDatei(JSON.stringify(datei));
  assert.equal(geprueft.length, 1);
  assert.equal(geprueft[0].zutaten.length, 4);
  assert.equal(geprueft[0].zutaten.every((z) => !('unbekannt' in z)), true);
});
