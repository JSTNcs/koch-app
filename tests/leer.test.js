import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerStatus, listeneintragFuerLeer } from '../js/leer.js';
import { neuerEintrag, setzeDa } from '../js/pantry.js';
import { neuesProdukt } from '../js/produkt.js';

const joghurt = neuesProdukt({ barcode: '4006381333931', name: 'Joghurt Natur', art: 'menge', packung: 500, einheit: 'g' });
const salzProdukt = neuesProdukt({ barcode: '3017620422003', name: 'Jodsalz', art: 'da_leer' });
const ev = (menge, o = {}) => neuerEintrag({ name: 'Joghurt Natur', art: 'menge', menge, einheit: 'g', barcode: joghurt.barcode, ...o }, { id: 'e' });

test('leerStatus: Menge 0 ist leer, unter einem Fünftel der Packung ist fast leer', () => {
  assert.equal(leerStatus(ev(0), [joghurt]), 'leer');
  assert.equal(leerStatus(ev(99), [joghurt]), 'fast'); // unter 20 % von 500 g
  assert.equal(leerStatus(ev(100), [joghurt]), null);
  assert.equal(leerStatus(ev(450), [joghurt]), null);
});
test('leerStatus: ohne bekannte Packungsgröße nur "leer", andere Einheit wird nicht verglichen', () => {
  assert.equal(leerStatus(ev(5, { barcode: null }), []), null);
  assert.equal(leerStatus(ev(0, { barcode: null }), []), 'leer');
  assert.equal(leerStatus(ev(99, { einheit: 'ml' }), [joghurt]), null);
});
test('leerStatus: Gewürze sind leer, wenn sie auf "leer" stehen', () => {
  const salz = neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' });
  assert.equal(leerStatus(salz, []), null);
  assert.equal(leerStatus(setzeDa(salz, false), []), 'leer');
});

test('listeneintragFuerLeer: bekanntes Produkt wird als Produkt auf die Liste gesetzt', () => {
  const l = listeneintragFuerLeer(ev(0), [joghurt]);
  assert.equal(l.typ, 'produkt');
  assert.equal(l.barcode, joghurt.barcode);
  assert.equal(l.anzahl, 1);
  assert.equal(l.erledigt, false);
});
test('listeneintragFuerLeer: Gewürz-Produkt', () => {
  const salz = neuerEintrag({ name: 'Jodsalz', art: 'da_leer', barcode: salzProdukt.barcode }, { id: 's' });
  const l = listeneintragFuerLeer(setzeDa(salz, false), [salzProdukt]);
  assert.equal(l.typ, 'produkt');
  assert.equal(l.produktArt, 'da_leer');
});
test('listeneintragFuerLeer: ohne bekanntes Produkt als Freitext mit Name und Zutat', () => {
  const e = neuerEintrag({ name: 'Mehl', art: 'menge', menge: 0, einheit: 'g', zutat: 'Mehl' }, { id: 'm' });
  const l = listeneintragFuerLeer(e, []);
  assert.equal(l.typ, 'frei');
  assert.equal(l.name, 'Mehl');
  assert.equal(l.zutat, 'Mehl');
  assert.equal(l.anzahl, 1);
  assert.equal(l.einheit, 'stk');
});
