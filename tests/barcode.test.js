import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bereinigeBarcode, barcodeGueltig, normalisiereBarcode } from '../js/barcode.js';

test('barcodeGueltig: echte Barcodes (EAN-13, EAN-8, UPC-A)', () => {
  for (const c of ['4006381333931', '3017620422003', '96385074', '036000291452']) {
    assert.equal(barcodeGueltig(c), true, c);
  }
});
test('barcodeGueltig: falsche Prüfziffer, falsche Länge, Buchstaben', () => {
  for (const c of ['4006381333932', '4260107222138', '123', '', 'abcdefgh', '40063813339311', null, undefined]) {
    assert.equal(barcodeGueltig(c), false, String(c));
  }
});
test('bereinigeBarcode: Leerzeichen und Bindestriche raus', () => {
  assert.equal(bereinigeBarcode(' 4006 3813-33931 '), '4006381333931');
  assert.equal(bereinigeBarcode(null), '');
});
test('normalisiereBarcode: UPC-A (12 Stellen) wird zu EAN-13 mit führender 0', () => {
  assert.equal(normalisiereBarcode('036000291452'), '0036000291452');
  assert.equal(normalisiereBarcode('4006381333931'), '4006381333931');
  assert.equal(normalisiereBarcode('96385074'), '96385074');
});
