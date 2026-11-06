import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseZahl,
  formatMenge,
  neuerEintrag,
  mengeAendern,
  schritt,
  setzeDa,
  sortiere,
  hinzufuegenOderErhoehen,
} from '../js/pantry.js';

const mk = (o) => neuerEintrag({ name: 'Nudeln', art: 'menge', menge: 500, einheit: 'g', ...o }, { id: 'x' });

// --- Zahlen eintippen (deutsches Komma) ---
test('parseZahl: Komma und Punkt', () => {
  assert.equal(parseZahl('1,5'), 1.5);
  assert.equal(parseZahl(' 250 '), 250);
  assert.equal(parseZahl('0.5'), 0.5);
});
test('parseZahl: Unsinn ergibt NaN', () => {
  for (const s of ['', 'abc', '1,2,3', '-5', '1e3', '  ']) assert.ok(Number.isNaN(parseZahl(s)), s);
});

// --- Anzeige ---
test('formatMenge: g, kg, ml, l, Stück', () => {
  assert.equal(formatMenge(500, 'g'), '500 g');
  assert.equal(formatMenge(1500, 'g'), '1,5 kg');
  assert.equal(formatMenge(2000, 'g'), '2 kg');
  assert.equal(formatMenge(250, 'ml'), '250 ml');
  assert.equal(formatMenge(1000, 'ml'), '1 l');
  assert.equal(formatMenge(1, 'stk'), '1 Stück');
  assert.equal(formatMenge(6, 'stk'), '6 Stück');
  assert.equal(formatMenge(12.5, 'g'), '12,5 g');
});

// --- Eintrag anlegen ---
test('neuerEintrag: Menge-Eintrag', () => {
  const e = neuerEintrag(
    { name: '  Nudeln ', art: 'menge', menge: 500, einheit: 'g', ablauf: '2027-01-31', barcode: '4001234567890' },
    { id: 'a1' }
  );
  assert.deepEqual(e, {
    id: 'a1',
    name: 'Nudeln',
    art: 'menge',
    menge: 500,
    einheit: 'g',
    da: null,
    ablauf: '2027-01-31',
    barcode: '4001234567890',
  });
});
test('neuerEintrag: Gewürz hat nur da/leer, keine Menge', () => {
  const e = neuerEintrag({ name: 'Salz', art: 'da_leer', menge: 99, einheit: 'g' }, { id: 'a2' });
  assert.equal(e.art, 'da_leer');
  assert.equal(e.da, true);
  assert.equal(e.menge, null);
  assert.equal(e.einheit, null);
});
test('neuerEintrag: Fehler werden mit deutscher Meldung abgelehnt', () => {
  assert.throws(() => mk({ name: '   ' }), /Name/);
  assert.throws(() => mk({ menge: -1 }), /Menge/);
  assert.throws(() => mk({ menge: NaN }), /Menge/);
  assert.throws(() => mk({ einheit: 'kg' }), /Einheit/);
  assert.throws(() => mk({ art: 'quatsch' }), /Art/);
  assert.throws(() => mk({ ablauf: '31.01.2027' }), /Datum/);
  assert.throws(() => mk({ ablauf: '2027-02-31' }), /Datum/);
});
test('neuerEintrag: leeres Ablaufdatum ist erlaubt', () => {
  assert.equal(mk({ ablauf: '' }).ablauf, null);
  assert.equal(mk({ ablauf: undefined }).ablauf, null);
});

// --- Menge ändern ---
test('schritt: 50 für g/ml, 1 für Stück', () => {
  assert.equal(schritt('g'), 50);
  assert.equal(schritt('ml'), 50);
  assert.equal(schritt('stk'), 1);
});
test('mengeAendern: plus und minus', () => {
  assert.equal(mengeAendern(mk({}), +1).menge, 550);
  assert.equal(mengeAendern(mk({}), -1).menge, 450);
  assert.equal(mengeAendern(mk({ menge: 3, einheit: 'stk' }), -1).menge, 2);
});
test('mengeAendern: nie unter 0', () => {
  assert.equal(mengeAendern(mk({ menge: 20 }), -1).menge, 0);
  assert.equal(mengeAendern(mk({ menge: 0 }), -1).menge, 0);
});
test('mengeAendern: verändert das Original nicht', () => {
  const e = mk({});
  mengeAendern(e, +1);
  assert.equal(e.menge, 500);
});
test('mengeAendern: Gewürze haben keine Menge', () => {
  const salz = neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' });
  assert.throws(() => mengeAendern(salz, +1), /da \/ leer/);
});
test('setzeDa: da und leer umschalten', () => {
  const salz = neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' });
  assert.equal(setzeDa(salz, false).da, false);
  assert.equal(setzeDa(setzeDa(salz, false), true).da, true);
  assert.throws(() => setzeDa(mk({}), true), /da \/ leer/);
});

// --- Sortierung ---
test('sortiere: nach Name, Umlaute und Groß/Klein richtig', () => {
  const l = ['zwiebel', 'Äpfel', 'Butter', 'ananas'].map((n) => mk({ name: n }));
  assert.deepEqual(
    sortiere(l).map((e) => e.name),
    ['ananas', 'Äpfel', 'Butter', 'zwiebel']
  );
});

// --- Zusammenführen beim Einkauf ---
test('hinzufuegenOderErhoehen: neues Produkt wird angehängt', () => {
  const r = hinzufuegenOderErhoehen([mk({ name: 'Reis' })], mk({ name: 'Nudeln' }));
  assert.equal(r.liste.length, 2);
  assert.equal(r.zusammengefuehrt, false);
});
test('hinzufuegenOderErhoehen: gleicher Barcode und gleiche Einheit addiert die Menge', () => {
  const alt = neuerEintrag({ name: 'Nudeln', art: 'menge', menge: 500, einheit: 'g', barcode: '111' }, { id: 'alt' });
  const neu = neuerEintrag({ name: 'Spaghetti', art: 'menge', menge: 500, einheit: 'g', barcode: '111' }, { id: 'neu' });
  const r = hinzufuegenOderErhoehen([alt], neu);
  assert.equal(r.liste.length, 1);
  assert.equal(r.liste[0].id, 'alt');
  assert.equal(r.liste[0].menge, 1000);
  assert.equal(r.zusammengefuehrt, true);
});
test('hinzufuegenOderErhoehen: ohne Barcode zählt der Name (Groß/Klein egal)', () => {
  const r = hinzufuegenOderErhoehen([mk({ name: 'Zwiebel', menge: 2, einheit: 'stk' })], mk({ name: ' zwiebel ', menge: 3, einheit: 'stk' }));
  assert.equal(r.liste.length, 1);
  assert.equal(r.liste[0].menge, 5);
});
test('hinzufuegenOderErhoehen: andere Einheit wird nicht addiert', () => {
  const r = hinzufuegenOderErhoehen([mk({ name: 'Milch', menge: 1, einheit: 'stk' })], mk({ name: 'Milch', menge: 500, einheit: 'ml' }));
  assert.equal(r.liste.length, 2);
});
test('hinzufuegenOderErhoehen: das frühere Ablaufdatum bleibt', () => {
  const a = mk({ name: 'Joghurt', ablauf: '2027-03-10' });
  const b = mk({ name: 'Joghurt', ablauf: '2027-03-01' });
  assert.equal(hinzufuegenOderErhoehen([a], b).liste[0].ablauf, '2027-03-01');
  const c = mk({ name: 'Joghurt', ablauf: '' });
  assert.equal(hinzufuegenOderErhoehen([c], b).liste[0].ablauf, '2027-03-01');
  assert.equal(hinzufuegenOderErhoehen([b], c).liste[0].ablauf, '2027-03-01');
});
test('hinzufuegenOderErhoehen: Gewürz wird wieder auf "da" gesetzt', () => {
  const leer = setzeDa(neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' }), false);
  const r = hinzufuegenOderErhoehen([leer], neuerEintrag({ name: 'salz', art: 'da_leer' }, { id: 'n' }));
  assert.equal(r.liste.length, 1);
  assert.equal(r.liste[0].da, true);
});
test('hinzufuegenOderErhoehen: Original-Liste bleibt unverändert', () => {
  const alt = mk({ name: 'Reis', menge: 100 });
  const liste = [alt];
  hinzufuegenOderErhoehen(liste, mk({ name: 'Reis', menge: 100 }));
  assert.equal(liste[0].menge, 100);
  assert.equal(liste.length, 1);
});
