import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMengenText, produktAusOff, neuesProdukt, eintragAusProdukt, gleichsetzen, gruppeVon } from '../js/produkt.js';

// --- Packungsgröße aus Text ---
test('parseMengenText: übliche Schreibweisen', () => {
  const faelle = [
    ['500 g', { menge: 500, einheit: 'g' }],
    ['250g', { menge: 250, einheit: 'g' }],
    ['1,5 kg', { menge: 1500, einheit: 'g' }],
    ['1 l', { menge: 1000, einheit: 'ml' }],
    ['0,5l', { menge: 500, einheit: 'ml' }],
    ['330 ml', { menge: 330, einheit: 'ml' }],
    ['75 cl', { menge: 750, einheit: 'ml' }],
    ['6 x 125 g', { menge: 750, einheit: 'g' }],
    ['6x125g', { menge: 750, einheit: 'g' }],
    ['2 × 0,5 l', { menge: 1000, einheit: 'ml' }],
    ['500g (4 x 125g)', { menge: 500, einheit: 'g' }],
    ['10 Stück', { menge: 10, einheit: 'stk' }],
    ['6 pcs', { menge: 6, einheit: 'stk' }],
  ];
  for (const [text, erwartet] of faelle) assert.deepEqual(parseMengenText(text), erwartet, text);
});
test('parseMengenText: Unsinn ergibt null', () => {
  for (const t of ['', 'abc', null, undefined, 'frisch', '0 g']) assert.equal(parseMengenText(t), null, String(t));
});

// --- Antwort von Open Food Facts ---
const nutella = {
  status: 1,
  product: {
    product_name: 'Nutella',
    product_name_de: 'Nuss-Nugat-Creme',
    brands: 'Ferrero,Nutella',
    quantity: '450 g',
    nutriments: {
      'energy-kcal_100g': 539,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
    },
  },
};

test('produktAusOff: vollständiges Produkt', () => {
  assert.deepEqual(produktAusOff(nutella, '3017620422003'), {
    barcode: '3017620422003',
    name: 'Nuss-Nugat-Creme',
    marke: 'Ferrero',
    art: 'menge',
    packung: 450,
    einheit: 'g',
    naehrwerte: { kcal: 539, eiweiss: 6.3, kohlenhydrate: 57.5, fett: 30.9 },
    quelle: 'off',
    gruppe: null,
  });
});
test('produktAusOff: nicht gefunden ergibt null', () => {
  assert.equal(produktAusOff({ status: 0, status_verbose: 'product not found' }, '1'), null);
  assert.equal(produktAusOff(null, '1'), null);
  assert.equal(produktAusOff({}, '1'), null);
});
test('produktAusOff: ohne Packungsgröße bleibt sie leer', () => {
  const p = produktAusOff({ status: 1, product: { product_name: 'Etwas' } }, '1');
  assert.equal(p.name, 'Etwas');
  assert.equal(p.packung, null);
  assert.equal(p.einheit, null);
  assert.equal(p.naehrwerte, null);
});
test('produktAusOff: product_quantity mit Einheit als Ersatz', () => {
  const p = produktAusOff({ status: 1, product: { product_name: 'X', product_quantity: '500', product_quantity_unit: 'ml' } }, '1');
  assert.equal(p.packung, 500);
  assert.equal(p.einheit, 'ml');
});
test('produktAusOff: nur Kilojoule wird in kcal umgerechnet', () => {
  const p = produktAusOff(
    { status: 1, product: { product_name: 'X', nutriments: { energy_100g: 1000, proteins_100g: 1, carbohydrates_100g: 2, fat_100g: 3 } } },
    '1'
  );
  assert.equal(p.naehrwerte.kcal, 239);
});
test('produktAusOff: Name fällt auf generic_name zurück, sonst leer', () => {
  assert.equal(produktAusOff({ status: 1, product: { generic_name: 'Haferflocken' } }, '1').name, 'Haferflocken');
  assert.equal(produktAusOff({ status: 1, product: {} }, '1').name, '');
});
test('produktAusOff: Barcode wird normalisiert', () => {
  assert.equal(produktAusOff(nutella, '036000291452').barcode, '0036000291452');
});

// --- Eigenes Produkt von Hand ---
test('neuesProdukt: von Hand mit Nährwerten', () => {
  const p = neuesProdukt({
    barcode: '4006381333931',
    name: ' Haferflocken ',
    art: 'menge',
    packung: 500,
    einheit: 'g',
    naehrwerte: { kcal: 370, eiweiss: 13, kohlenhydrate: 59, fett: 7 },
  });
  assert.deepEqual(p, {
    barcode: '4006381333931',
    name: 'Haferflocken',
    marke: null,
    art: 'menge',
    packung: 500,
    einheit: 'g',
    naehrwerte: { kcal: 370, eiweiss: 13, kohlenhydrate: 59, fett: 7 },
    quelle: 'manuell',
    gruppe: null,
  });
});
test('neuesProdukt: Nährwerte sind freiwillig; leere Felder ergeben null', () => {
  const p = neuesProdukt({ barcode: '4006381333931', name: 'X', art: 'menge', packung: 1, einheit: 'stk', naehrwerte: { kcal: null, eiweiss: null, kohlenhydrate: null, fett: null } });
  assert.equal(p.naehrwerte, null);
  assert.equal(neuesProdukt({ barcode: '4006381333931', name: 'X', art: 'menge', packung: 1, einheit: 'stk' }).naehrwerte, null);
});
test('neuesProdukt: Gewürz braucht keine Packungsgröße', () => {
  const p = neuesProdukt({ barcode: '4006381333931', name: 'Salz', art: 'da_leer' });
  assert.equal(p.packung, null);
  assert.equal(p.einheit, null);
});
test('neuesProdukt: Fehler mit deutscher Meldung', () => {
  const ok = { barcode: '4006381333931', name: 'X', art: 'menge', packung: 500, einheit: 'g' };
  assert.throws(() => neuesProdukt({ ...ok, name: '' }), /Name/);
  assert.throws(() => neuesProdukt({ ...ok, packung: 0 }), /Packungsgröße/);
  assert.throws(() => neuesProdukt({ ...ok, packung: NaN }), /Packungsgröße/);
  assert.throws(() => neuesProdukt({ ...ok, einheit: 'kg' }), /Einheit/);
  assert.throws(() => neuesProdukt({ ...ok, barcode: '' }), /Barcode/);
  assert.throws(() => neuesProdukt({ ...ok, naehrwerte: { kcal: -1, eiweiss: null, kohlenhydrate: null, fett: null } }), /Nährwert/);
});

// --- Produkt in den Vorrat ---
test('eintragAusProdukt: Menge = Packungsgröße mal Anzahl', () => {
  const produkt = neuesProdukt({ barcode: '4006381333931', name: 'Nudeln', art: 'menge', packung: 500, einheit: 'g' });
  const e = eintragAusProdukt(produkt, { anzahl: 2, ablauf: '2027-05-01' }, { id: 'e1' });
  assert.equal(e.id, 'e1');
  assert.equal(e.name, 'Nudeln');
  assert.equal(e.menge, 1000);
  assert.equal(e.einheit, 'g');
  assert.equal(e.barcode, '4006381333931');
  assert.equal(e.ablauf, '2027-05-01');
});
test('eintragAusProdukt: Gewürz ist "da"', () => {
  const produkt = neuesProdukt({ barcode: '4006381333931', name: 'Salz', art: 'da_leer' });
  const e = eintragAusProdukt(produkt, { anzahl: 1 }, { id: 'e2' });
  assert.equal(e.art, 'da_leer');
  assert.equal(e.da, true);
});
test('eintragAusProdukt: Anzahl muss größer als 0 sein', () => {
  const produkt = neuesProdukt({ barcode: '4006381333931', name: 'Nudeln', art: 'menge', packung: 500, einheit: 'g' });
  assert.throws(() => eintragAusProdukt(produkt, { anzahl: 0 }), /Anzahl/);
  assert.throws(() => eintragAusProdukt(produkt, { anzahl: NaN }), /Anzahl/);
});

// --- Gleichwertige Produkte (andere Marke, gleiches Produkt) ---
test('neuesProdukt: behält die Gruppe der Gleichwertigkeit', () => {
  const p = neuesProdukt({ barcode: '4006381333931', name: 'X', art: 'menge', packung: 1, einheit: 'stk', gruppe: 'g1' });
  assert.equal(p.gruppe, 'g1');
});

const mkp = (barcode, name, gruppe = null) => neuesProdukt({ barcode, name, art: 'menge', packung: 500, einheit: 'g', gruppe });

test('gleichsetzen: zwei Produkte ohne Gruppe bekommen eine gemeinsame neue', () => {
  const a = mkp('4006381333931', 'Barilla');
  const b = mkp('96385074', 'Gut & Günstig');
  const geaendert = gleichsetzen([a, b], a, b, { gruppe: 'g1' });
  assert.equal(geaendert.length, 2);
  assert.ok(geaendert.every((p) => p.gruppe === 'g1'));
  assert.deepEqual(geaendert.map((p) => p.barcode).sort(), ['4006381333931', '96385074']);
  assert.equal(a.gruppe, null); // Original unverändert
});
test('gleichsetzen: hat nur eines schon eine Gruppe, übernimmt das andere sie', () => {
  const a = mkp('4006381333931', 'Barilla', 'g7');
  const b = mkp('96385074', 'Gut & Günstig');
  const geaendert = gleichsetzen([a, b], a, b);
  assert.deepEqual(geaendert.map((p) => [p.barcode, p.gruppe]), [['96385074', 'g7']]);
  const umgekehrt = gleichsetzen([a, b], b, a);
  assert.deepEqual(umgekehrt.map((p) => [p.barcode, p.gruppe]), [['96385074', 'g7']]);
});
test('gleichsetzen: zwei verschiedene Gruppen werden zusammengelegt (auch dritte Mitglieder)', () => {
  const a = mkp('4006381333931', 'Barilla', 'g1');
  const b = mkp('96385074', 'Gut & Günstig', 'g2');
  const c = mkp('0036000291452', 'Dritte', 'g2');
  const d = mkp('3017620422003', 'Fremd', 'g3');
  const geaendert = gleichsetzen([a, b, c, d], a, b);
  assert.deepEqual(geaendert.map((p) => [p.barcode, p.gruppe]).sort(), [['0036000291452', 'g1'], ['96385074', 'g1']]);
});
test('gleichsetzen: nichts zu tun bei gleicher Gruppe oder gleichem Produkt', () => {
  const a = mkp('4006381333931', 'Barilla', 'g1');
  const b = mkp('96385074', 'Gut & Günstig', 'g1');
  assert.deepEqual(gleichsetzen([a, b], a, b), []);
  assert.deepEqual(gleichsetzen([a], a, a), []);
});
test('gruppeVon: schlägt die Gruppe nach', () => {
  const a = mkp('4006381333931', 'Barilla', 'g1');
  assert.equal(gruppeVon('4006381333931', [a]), 'g1');
  assert.equal(gruppeVon('4006381333931', [mkp('4006381333931', 'X')]), null);
  assert.equal(gruppeVon('999', [a]), null);
});
