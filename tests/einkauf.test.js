import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  neuerProduktEintrag,
  neuerFreiEintrag,
  fuegeHinzu,
  aendereAnzahl,
  schalteHaken,
  sortiereListe,
  sucheProdukte,
  eintragTexte,
  produktAusEintrag,
  einraeumen,
  findeTreffer,
  kandidaten,
  verbucheScan,
  normalisiereListeneintrag,
} from '../js/einkauf.js';
import { neuesProdukt } from '../js/produkt.js';
import { neuerEintrag } from '../js/pantry.js';

const prod = (o) => neuesProdukt({ art: 'menge', packung: 500, einheit: 'g', ...o });
const barilla = prod({ barcode: '4006381333931', name: 'Barilla Spaghetti', marke: 'Barilla' });
const gug = prod({ barcode: '96385074', name: 'Gut & Günstig Spaghetti', marke: 'Gut & Günstig' });
const milch = prod({ barcode: '3017620422003', name: 'Vollmilch', marke: 'Weihenstephan', packung: 1000, einheit: 'ml' });
const salz = neuesProdukt({ barcode: '036000291452', name: 'Salz', art: 'da_leer' });

const lp = (p, n = 1, id) => neuerProduktEintrag(p, n, { id: id || 'l-' + p.barcode });
const lf = (name, anzahl = 1, einheit = 'stk', id) => neuerFreiEintrag({ name, anzahl, einheit }, { id: id || 'f-' + name });

// --- Einträge anlegen ---
test('neuerProduktEintrag: Produkt mit Anzahl', () => {
  assert.deepEqual(neuerProduktEintrag(barilla, 2, { id: 'l1' }), {
    id: 'l1',
    typ: 'produkt',
    barcode: '4006381333931',
    name: 'Barilla Spaghetti',
    marke: 'Barilla',
    produktArt: 'menge',
    packung: 500,
    einheit: 'g',
    anzahl: 2,
    erledigt: false,
  });
});
test('neuerProduktEintrag: Anzahl ist standardmäßig 1, muss größer als 0 sein', () => {
  assert.equal(neuerProduktEintrag(barilla).anzahl, 1);
  assert.throws(() => neuerProduktEintrag(barilla, 0), /Anzahl/);
  assert.throws(() => neuerProduktEintrag(barilla, NaN), /Anzahl/);
  assert.throws(() => neuerProduktEintrag(barilla, -2), /Anzahl/);
});
test('neuerProduktEintrag: Gewürz-Produkt (da / leer) hat keine Packungsgröße', () => {
  const e = neuerProduktEintrag(salz);
  assert.equal(e.produktArt, 'da_leer');
  assert.equal(e.packung, null);
  assert.equal(e.einheit, null);
});
test('neuerFreiEintrag: Freitext mit Menge und Einheit (Standard Stück)', () => {
  assert.deepEqual(neuerFreiEintrag({ name: ' Zwiebeln ', anzahl: 3 }, { id: 'f1' }), {
    id: 'f1',
    typ: 'frei',
    barcode: null,
    name: 'Zwiebeln',
    marke: null,
    produktArt: null,
    packung: null,
    einheit: 'stk',
    anzahl: 3,
    erledigt: false,
  });
});
test('neuerFreiEintrag: Fehler mit deutscher Meldung', () => {
  assert.throws(() => neuerFreiEintrag({ name: ' ', anzahl: 1 }), /Name/);
  assert.throws(() => neuerFreiEintrag({ name: 'X', anzahl: 0 }), /Menge/);
  assert.throws(() => neuerFreiEintrag({ name: 'X', anzahl: 1, einheit: 'kg' }), /Einheit/);
});

// --- Nicht doppelt anlegen ---
test('fuegeHinzu: neues Produkt wird angehängt', () => {
  const r = fuegeHinzu([lp(milch)], lp(barilla));
  assert.equal(r.liste.length, 2);
  assert.equal(r.zusammengefuehrt, false);
  assert.equal(r.eintrag.barcode, barilla.barcode);
});
test('fuegeHinzu: gleiches Produkt erhöht nur die Anzahl', () => {
  const alt = lp(barilla, 1, 'alt');
  const r = fuegeHinzu([alt], lp(barilla, 2, 'neu'));
  assert.equal(r.liste.length, 1);
  assert.equal(r.eintrag.id, 'alt');
  assert.equal(r.eintrag.anzahl, 3);
  assert.equal(r.zusammengefuehrt, true);
});
test('fuegeHinzu: war es schon abgehakt, ist es wieder offen und zählt neu', () => {
  const alt = schalteHaken(lp(barilla, 2, 'alt'));
  assert.equal(alt.erledigt, true);
  const r = fuegeHinzu([alt], lp(barilla, 1, 'neu'));
  assert.equal(r.liste.length, 1);
  assert.equal(r.eintrag.erledigt, false);
  assert.equal(r.eintrag.anzahl, 1);
});
test('fuegeHinzu: Freitext gleicher Name und Einheit (Groß/Klein egal) wird addiert', () => {
  const r = fuegeHinzu([lf('Zwiebeln', 2)], lf(' zwiebeln ', 3));
  assert.equal(r.liste.length, 1);
  assert.equal(r.eintrag.anzahl, 5);
});
test('fuegeHinzu: Freitext mit anderer Einheit oder Produkt mit gleichem Namen bleibt getrennt', () => {
  assert.equal(fuegeHinzu([lf('Hack', 500, 'g')], lf('Hack', 2, 'stk')).liste.length, 2);
  assert.equal(fuegeHinzu([lp(milch)], lf('Vollmilch', 1)).liste.length, 2);
});
test('fuegeHinzu: Original-Liste bleibt unverändert', () => {
  const liste = [lp(barilla, 1, 'alt')];
  fuegeHinzu(liste, lp(barilla, 5, 'neu'));
  assert.equal(liste[0].anzahl, 1);
  assert.equal(liste.length, 1);
});

// --- Anzahl und Haken ---
test('aendereAnzahl: Produkte in Schritten von 1, nie auf 0', () => {
  assert.equal(aendereAnzahl(lp(barilla, 2), +1).anzahl, 3);
  assert.equal(aendereAnzahl(lp(barilla, 2), -1).anzahl, 1);
  assert.equal(aendereAnzahl(lp(barilla, 1), -1).anzahl, 1);
});
test('aendereAnzahl: Freitext in g/ml in 50er-Schritten, Stück in 1er', () => {
  assert.equal(aendereAnzahl(lf('Hack', 500, 'g'), +1).anzahl, 550);
  assert.equal(aendereAnzahl(lf('Hack', 50, 'g'), -1).anzahl, 50);
  assert.equal(aendereAnzahl(lf('Zwiebeln', 3, 'stk'), -1).anzahl, 2);
});
test('schalteHaken: an und wieder aus, Original bleibt', () => {
  const e = lp(barilla);
  assert.equal(schalteHaken(e).erledigt, true);
  assert.equal(schalteHaken(schalteHaken(e)).erledigt, false);
  assert.equal(e.erledigt, false);
});

// --- Sortierung ---
test('sortiereListe: offene zuerst, abgehakte unten, jeweils nach Name', () => {
  const liste = [schalteHaken(lp(milch)), lf('Zwiebeln'), lp(barilla), schalteHaken(lf('Äpfel'))];
  assert.deepEqual(
    sortiereListe(liste).map((e) => e.name),
    ['Barilla Spaghetti', 'Zwiebeln', 'Äpfel', 'Vollmilch']
  );
  assert.equal(liste[0].name, 'Vollmilch'); // Original nicht verändert
});

// --- Suche in den eigenen Produkten ---
const produkte = [barilla, gug, milch, salz];
test('sucheProdukte: Teile von Wörtern, Groß/Klein egal', () => {
  assert.deepEqual(sucheProdukte(produkte, 'spag').map((p) => p.barcode), [barilla.barcode, gug.barcode]);
});
test('sucheProdukte: mehrere Wörter müssen alle passen (auch Marke)', () => {
  assert.deepEqual(sucheProdukte(produkte, 'barilla spag').map((p) => p.barcode), [barilla.barcode]);
  assert.deepEqual(sucheProdukte(produkte, 'weihen').map((p) => p.barcode), [milch.barcode]);
});
test('sucheProdukte: Umlaute egal (gunstig findet Günstig)', () => {
  assert.deepEqual(sucheProdukte(produkte, 'gunstig').map((p) => p.barcode), [gug.barcode]);
  assert.deepEqual(sucheProdukte(produkte, 'GÜNSTIG').map((p) => p.barcode), [gug.barcode]);
});
test('sucheProdukte: Packungsgröße zählt mit, leere Suche ergibt nichts', () => {
  assert.equal(sucheProdukte(produkte, 'spag 500').length, 2);
  assert.equal(sucheProdukte(produkte, '1 l').length, 1);
  assert.deepEqual(sucheProdukte(produkte, ''), []);
  assert.deepEqual(sucheProdukte(produkte, '   '), []);
  assert.deepEqual(sucheProdukte(produkte, 'xyz'), []);
});
test('sucheProdukte: höchstens 20 Treffer', () => {
  const viele = Array.from({ length: 30 }, (_, i) => prod({ barcode: String(i).padStart(8, '0'), name: 'Nudeln ' + i }));
  assert.equal(sucheProdukte(viele, 'nudeln').length, 20);
});

// --- Anzeige ---
test('eintragTexte: Produkt, Marke nur wenn sie nicht schon im Namen steht', () => {
  assert.deepEqual(eintragTexte(lp(barilla, 2)), { titel: 'Barilla Spaghetti', untertitel: '500 g', menge: '2×' });
  const ohneMarkeImNamen = lp(prod({ barcode: '4006381333931', name: 'Spaghetti', marke: 'Barilla' }));
  assert.equal(eintragTexte(ohneMarkeImNamen).untertitel, 'Barilla · 500 g');
  assert.equal(eintragTexte(lp(milch)).untertitel, 'Weihenstephan · 1 l');
});
test('eintragTexte: Freitext zeigt die Menge mit Einheit', () => {
  assert.deepEqual(eintragTexte(lf('Zwiebeln', 3)), { titel: 'Zwiebeln', untertitel: '', menge: '3 Stück' });
  assert.equal(eintragTexte(lf('Hack', 1500, 'g')).menge, '1,5 kg');
});

// --- Von der Liste in den Vorrat ---
test('produktAusEintrag: liefert ein Produkt für den Vorrat', () => {
  assert.deepEqual(produktAusEintrag(lp(barilla)), {
    barcode: '4006381333931',
    name: 'Barilla Spaghetti',
    marke: 'Barilla',
    art: 'menge',
    packung: 500,
    einheit: 'g',
  });
});
test('einraeumen: nur Abgehakte, Menge = Packung mal Anzahl, bestehende werden erhöht', () => {
  const vorratBarilla = neuerEintrag({ name: 'Barilla Spaghetti', art: 'menge', menge: 500, einheit: 'g', barcode: barilla.barcode }, { id: 'v1' });
  const liste = [schalteHaken(lp(barilla, 2, 'l1')), lp(gug, 1, 'l2'), schalteHaken(lf('Zwiebeln', 3, 'stk', 'l3'))];
  const r = einraeumen(liste, [vorratBarilla]);
  assert.equal(r.anzahl, 2);
  assert.deepEqual([...r.zuLoeschen].sort(), ['l1', 'l3']);
  const barillaNeu = r.zuSpeichern.find((e) => e.id === 'v1');
  assert.equal(barillaNeu.menge, 1500);
  const zwiebeln = r.zuSpeichern.find((e) => e.name === 'Zwiebeln');
  assert.equal(zwiebeln.menge, 3);
  assert.equal(zwiebeln.einheit, 'stk');
  assert.equal(r.zuSpeichern.length, 2);
  assert.equal(vorratBarilla.menge, 500); // Original unverändert
});
test('einraeumen: gleiches Produkt mehrfach abgehakt ergibt einen Eintrag', () => {
  const r = einraeumen([schalteHaken(lf('Reis', 2, 'stk', 'a')), schalteHaken(lf('reis', 1, 'stk', 'b'))], []);
  assert.equal(r.zuSpeichern.length, 1);
  assert.equal(r.zuSpeichern[0].menge, 3);
  assert.equal(r.zuLoeschen.length, 2);
});
test('einraeumen: Gewürz-Produkt kommt als "da" in den Vorrat', () => {
  const r = einraeumen([schalteHaken(lp(salz, 1, 's'))], []);
  assert.equal(r.zuSpeichern[0].art, 'da_leer');
  assert.equal(r.zuSpeichern[0].da, true);
});
test('einraeumen: ohne Abgehakte passiert nichts', () => {
  const r = einraeumen([lp(barilla), lf('Zwiebeln')], []);
  assert.deepEqual(r, { zuSpeichern: [], zuLoeschen: [], anzahl: 0 });
});

// --- Scan: gehört das zu einem Listeneintrag? ---
test('findeTreffer: gleicher Barcode', () => {
  const liste = [lp(milch), lp(barilla)];
  assert.equal(findeTreffer(liste, barilla, produkte).barcode, barilla.barcode);
  assert.equal(findeTreffer(liste, gug, produkte), null);
});
test('findeTreffer: als gleichwertig gemerkte Produkte (gleiche Gruppe)', () => {
  const b = { ...barilla, gruppe: 'g1' };
  const g = { ...gug, gruppe: 'g1' };
  const liste = [lp(b)];
  assert.equal(findeTreffer(liste, g, [b, g, milch]).barcode, barilla.barcode);
  assert.equal(findeTreffer(liste, { ...milch, gruppe: 'g2' }, [b, g, milch]), null);
});
test('findeTreffer: offene Einträge haben Vorrang vor abgehakten', () => {
  const b = { ...barilla, gruppe: 'g1' };
  const g = { ...gug, gruppe: 'g1' };
  const liste = [schalteHaken(lp(b, 1, 'abgehakt')), lp(g, 1, 'offen')];
  assert.equal(findeTreffer(liste, { ...prod({ barcode: '0036000291452', name: 'Dritte Marke' }), gruppe: 'g1' }, [b, g]).id, 'offen');
});
test('findeTreffer: Freitext mit gleichem Namen passt', () => {
  const liste = [lf('Vollmilch', 1, 'stk', 'frei1')];
  assert.equal(findeTreffer(liste, milch, produkte).id, 'frei1');
});
test('kandidaten: nur offene Einträge, ähnliche zuerst', () => {
  const liste = [lp(milch), lp(barilla), schalteHaken(lf('Spaghetti Reste')), lf('Penne Rigate')];
  const k = kandidaten(liste, gug);
  assert.deepEqual(
    k.map((x) => [x.eintrag.name, x.aehnlich]),
    [
      ['Barilla Spaghetti', true],
      ['Penne Rigate', false],
      ['Vollmilch', false],
    ]
  );
});
test('verbucheScan: ganz gekauft entfernt, teilweise verringert, abgehakt entfernt', () => {
  assert.deepEqual(verbucheScan(lp(barilla, 2, 'x'), 2), { loeschen: 'x' });
  assert.deepEqual(verbucheScan(lp(barilla, 2, 'x'), 3), { loeschen: 'x' });
  const t = verbucheScan(lp(barilla, 3, 'x'), 1);
  assert.equal(t.aendern.anzahl, 2);
  assert.equal(t.aendern.id, 'x');
  assert.deepEqual(verbucheScan(schalteHaken(lp(barilla, 3, 'x')), 1), { loeschen: 'x' });
  assert.equal(verbucheScan(lp(barilla, 1, 'x'), 0.5).aendern.anzahl, 0.5);
});

// --- Prüfen beim Einlesen einer Sicherung ---
test('normalisiereListeneintrag: Hin und zurück für beide Arten', () => {
  for (const e of [lp(barilla, 2), schalteHaken(lf('Zwiebeln', 3)), lp(salz)]) {
    assert.deepEqual(normalisiereListeneintrag(JSON.parse(JSON.stringify(e))), e);
  }
});
test('normalisiereListeneintrag: Fehler und fremde Felder', () => {
  const ok = lp(barilla, 2, 'x');
  assert.throws(() => normalisiereListeneintrag({ ...ok, typ: 'quatsch' }), /Art/);
  assert.throws(() => normalisiereListeneintrag({ ...ok, anzahl: -1 }), /Anzahl|Menge/);
  assert.throws(() => normalisiereListeneintrag({ ...ok, name: '' }), /Name/);
  assert.throws(() => normalisiereListeneintrag({ ...ok, barcode: '' }), /Barcode/);
  assert.throws(() => normalisiereListeneintrag({ ...ok, id: '' }), /Kennung/);
  assert.throws(() => normalisiereListeneintrag({ ...lf('X'), einheit: 'kg' }), /Einheit/);
  assert.throws(() => normalisiereListeneintrag({ ...ok, erledigt: 'ja' }), /Haken/);
  assert.equal('boese' in normalisiereListeneintrag({ ...ok, boese: 1 }), false);
});
