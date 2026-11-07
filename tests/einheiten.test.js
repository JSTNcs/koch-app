import { test } from 'node:test';
import assert from 'node:assert/strict';
import { umrechnen } from '../js/einheiten.js';

const eintrag = (o = {}) => ({ kcal: 0, eiweiss: 0, kohlenhydrate: 0, fett: 0, stueckG: null, dichte: null, richtmengeG: null, ...o });
const tabelle = {
  zutaten: {
    Zwiebeln: eintrag({ stueckG: 90 }),
    Eier: eintrag({ stueckG: 50 }),
    Milch: eintrag({ dichte: 1.03 }),
    Spaghetti: eintrag(),
  },
};

test('umrechnen: gleiche Einheit bleibt unverändert, auch ohne Tabelle', () => {
  assert.equal(umrechnen(5, 'g', 'g', 'Hirse', null), 5);
  assert.equal(umrechnen(2, 'stk', 'stk', 'Zwiebeln', tabelle), 2);
});
test('umrechnen: Gramm und Stück über das Stückgewicht', () => {
  assert.ok(Math.abs(umrechnen(1000, 'g', 'stk', 'Zwiebeln', tabelle) - 11.111) < 0.001);
  assert.equal(umrechnen(2, 'stk', 'g', 'Eier', tabelle), 100);
  assert.equal(umrechnen(1, 'stk', 'g', 'zwiebel', tabelle), 90); // Synonym
});
test('umrechnen: Milliliter und Gramm über die Dichte (ohne Dichte 1 zu 1)', () => {
  assert.equal(umrechnen(500, 'ml', 'g', 'Milch', tabelle), 515);
  assert.ok(Math.abs(umrechnen(515, 'g', 'ml', 'Milch', tabelle) - 500) < 0.001);
  assert.equal(umrechnen(100, 'ml', 'g', 'Spaghetti', tabelle), 100);
});
test('umrechnen: Stück und Milliliter über das Gewicht', () => {
  assert.equal(umrechnen(2, 'stk', 'ml', 'Eier', tabelle), 100);
});
test('umrechnen: nicht möglich ergibt null (kein Stückgewicht, unbekannte Zutat, keine Tabelle)', () => {
  assert.equal(umrechnen(2, 'stk', 'g', 'Spaghetti', tabelle), null);
  assert.equal(umrechnen(100, 'g', 'stk', 'Spaghetti', tabelle), null);
  assert.equal(umrechnen(100, 'g', 'stk', 'Hirse', tabelle), null);
  assert.equal(umrechnen(100, 'g', 'stk', 'Zwiebeln', null), null);
  assert.equal(umrechnen(100, 'g', 'kg', 'Zwiebeln', tabelle), null);
});
