// Prüfen und vereinheitlichen von Barcodes (EAN-13, EAN-8, UPC-A). Reine Logik, keine Kamera.

// Entfernt Leerzeichen und Bindestriche, falls der Barcode von Hand eingetippt wurde.
export function bereinigeBarcode(code) {
  return String(code ?? '').replace(/[\s-]/g, '');
}

// Stimmt Länge (8, 12, 13 oder 14 Ziffern) und die Prüfziffer? So fallen falsch gelesene Barcodes auf.
export function barcodeGueltig(code) {
  const c = typeof code === 'string' ? code : '';
  if (!/^\d+$/.test(c) || ![8, 12, 13, 14].includes(c.length)) return false;
  let summe = 0;
  [...c].reverse().forEach((ziffer, i) => {
    summe += Number(ziffer) * (i % 2 === 0 ? 1 : 3);
  });
  return summe % 10 === 0;
}

// UPC-A (12 Stellen) wird zu EAN-13 mit führender 0, so speichert es auch Open Food Facts.
export function normalisiereBarcode(code) {
  const c = bereinigeBarcode(code);
  return c.length === 12 ? '0' + c : c;
}
