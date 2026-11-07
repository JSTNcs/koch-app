import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAHLZEITEN,
  tagVon,
  verschiebeTag,
  tagText,
  mahlzeitVorschlag,
  neueMahlzeit,
  naehrwerteFuerMenge,
  summiere,
  gruppiereTag,
  fortschritt,
  zieheAb,
  zuletztGegessen,
  normalisiereMahlzeit,
} from '../js/tagebuch.js';
import { neuerEintrag } from '../js/pantry.js';

const um = (h, min = 0, tag = [2026, 10, 9]) => new Date(tag[0], tag[1], tag[2], h, min); // 9. November 2026, Ortszeit
const eintrag = (o = {}, jetzt = um(12, 30)) => neueMahlzeit({ name: 'Joghurt', kcal: 150, eiweiss: 8, kohlenhydrate: 12, fett: 7, ...o }, { id: o.id || 'm1', jetzt });

// --- Tage ---
test('tagVon: Tag in Ortszeit als JJJJ-MM-TT', () => {
  assert.equal(tagVon(um(23, 59)), '2026-11-09');
  assert.equal(tagVon(um(0, 0)), '2026-11-09');
});
test('verschiebeTag: auch über Monats- und Jahresgrenzen', () => {
  assert.equal(verschiebeTag('2026-11-09', 1), '2026-11-10');
  assert.equal(verschiebeTag('2026-11-30', 1), '2026-12-01');
  assert.equal(verschiebeTag('2026-03-01', -1), '2026-02-28');
  assert.equal(verschiebeTag('2026-12-31', 1), '2027-01-01');
});
test('tagText: Heute, Gestern, sonst Wochentag und Datum', () => {
  assert.equal(tagText('2026-11-09', um(12)), 'Heute');
  assert.equal(tagText('2026-11-08', um(12)), 'Gestern');
  assert.equal(tagText('2026-11-06', um(12)), 'Fr., 06.11.2026');
  assert.equal(tagText('2026-11-10', um(12)), 'Di., 10.11.2026');
});
test('mahlzeitVorschlag: nach der Uhrzeit', () => {
  const erwartet = { 6: 'fruehstueck', 10: 'fruehstueck', 11: 'mittag', 14: 'mittag', 15: 'snack', 16: 'snack', 17: 'abend', 21: 'abend', 22: 'snack', 3: 'snack' };
  for (const [stunde, id] of Object.entries(erwartet)) assert.equal(mahlzeitVorschlag(um(Number(stunde))), id, `${stunde} Uhr`);
});
test('MAHLZEITEN: Frühstück, Mittagessen, Abendessen, Snacks', () => {
  assert.deepEqual(MAHLZEITEN.map((m) => m.id), ['fruehstueck', 'mittag', 'abend', 'snack']);
});

// --- Eintrag anlegen ---
test('neueMahlzeit: Felder, Standardwerte und Vorschlag der Mahlzeit nach der Uhrzeit', () => {
  const m = eintrag({}, um(12, 30));
  assert.deepEqual(m, {
    id: 'm1',
    tag: '2026-11-09',
    zeit: um(12, 30).toISOString(),
    mahlzeit: 'mittag',
    name: 'Joghurt',
    menge: null,
    kcal: 150,
    eiweiss: 8,
    kohlenhydrate: 12,
    fett: 7,
    ca: false,
    quelle: 'frei',
    barcode: null,
    rezeptId: null,
  });
});
test('neueMahlzeit: nur Kalorien sind Pflicht, der Rest ist 0; Rundung', () => {
  const m = neueMahlzeit({ name: ' Pizza ', kcal: 800.4, eiweiss: 30.04 }, { id: 'p', jetzt: um(19) });
  assert.equal(m.name, 'Pizza');
  assert.equal(m.kcal, 800);
  assert.equal(m.eiweiss, 30);
  assert.equal(m.kohlenhydrate, 0);
  assert.equal(m.fett, 0);
  assert.equal(m.mahlzeit, 'abend');
});
test('neueMahlzeit: anderer Tag bekommt 12 Uhr als Zeit, eigene Mahlzeit bleibt', () => {
  const m = neueMahlzeit({ name: 'Brot', kcal: 100, tag: '2026-11-07', mahlzeit: 'fruehstueck', menge: '2 Scheiben', ca: true, quelle: 'produkt', barcode: '123' }, { id: 'b', jetzt: um(20) });
  assert.equal(m.tag, '2026-11-07');
  assert.equal(new Date(m.zeit).getHours(), 12);
  assert.equal(tagVon(new Date(m.zeit)), '2026-11-07');
  assert.equal(m.mahlzeit, 'fruehstueck');
  assert.equal(m.menge, '2 Scheiben');
  assert.equal(m.ca, true);
  assert.equal(m.quelle, 'produkt');
  assert.equal(m.barcode, '123');
});
test('neueMahlzeit: Fehler mit deutscher Meldung', () => {
  assert.throws(() => eintrag({ name: ' ' }), /Name/);
  assert.throws(() => eintrag({ kcal: NaN }), /Kalorien/);
  assert.throws(() => eintrag({ kcal: -5 }), /Kalorien/);
  assert.throws(() => eintrag({ kcal: undefined }), /Kalorien/);
  assert.throws(() => eintrag({ eiweiss: -1 }), /Nährwerte/);
  assert.throws(() => eintrag({ fett: NaN }), /Nährwerte/);
  assert.throws(() => eintrag({ mahlzeit: 'brunch' }), /Mahlzeit/);
  assert.throws(() => eintrag({ tag: '9.11.2026' }), /Datum/);
  assert.throws(() => eintrag({ tag: '2026-02-31' }), /Datum/);
  assert.throws(() => eintrag({ quelle: 'x' }), /Quelle/);
});

// --- Nährwerte für eine Menge ---
const nutella = { kcal: 539, eiweiss: 6.3, kohlenhydrate: 57.5, fett: 30.9 };
test('naehrwerteFuerMenge: pro 100 g oder ml, gerundet', () => {
  assert.deepEqual(naehrwerteFuerMenge(nutella, 15, 'g'), { kcal: 81, eiweiss: 0.9, kohlenhydrate: 8.6, fett: 4.6, unvollstaendig: false });
  assert.equal(naehrwerteFuerMenge(nutella, 100, 'ml').kcal, 539);
  assert.equal(naehrwerteFuerMenge(nutella, 250, 'g').kcal, 1348); // 1347,5
});
test('naehrwerteFuerMenge: pro Stück', () => {
  const ei = { kcal: 78, eiweiss: 6.3, kohlenhydrate: 0.6, fett: 5.3 };
  assert.deepEqual(naehrwerteFuerMenge(ei, 2, 'stk'), { kcal: 156, eiweiss: 12.6, kohlenhydrate: 1.2, fett: 10.6, unvollstaendig: false });
});
test('naehrwerteFuerMenge: fehlende Werte zählen als 0 und werden gemeldet', () => {
  const r = naehrwerteFuerMenge({ kcal: 100, eiweiss: null, kohlenhydrate: null, fett: null }, 100, 'g');
  assert.equal(r.unvollstaendig, true);
  assert.equal(r.kcal, 100);
  assert.equal(r.eiweiss, 0);
  assert.equal(naehrwerteFuerMenge(null, 100, 'g').unvollstaendig, true);
  assert.equal(naehrwerteFuerMenge(null, 100, 'g').kcal, 0);
});
test('naehrwerteFuerMenge: Menge muss größer als 0 sein', () => {
  assert.throws(() => naehrwerteFuerMenge(nutella, 0, 'g'), /Menge/);
  assert.throws(() => naehrwerteFuerMenge(nutella, NaN, 'g'), /Menge/);
  assert.throws(() => naehrwerteFuerMenge(nutella, 10, 'kg'), /Einheit/);
});

// --- Summen, Gruppen, Fortschritt ---
test('summiere: Summe aller Werte, leer ergibt 0', () => {
  assert.deepEqual(summiere([]), { kcal: 0, eiweiss: 0, kohlenhydrate: 0, fett: 0 });
  assert.deepEqual(summiere([eintrag({ id: 'a' }), eintrag({ id: 'b', kcal: 200, eiweiss: 10.3 })]), { kcal: 350, eiweiss: 18.3, kohlenhydrate: 24, fett: 14 });
});
test('gruppiereTag: nach Mahlzeit und nach Uhrzeit sortiert', () => {
  const liste = [
    eintrag({ id: 'a', name: 'Abendbrot', mahlzeit: 'abend' }, um(19, 0)),
    eintrag({ id: 'b', name: 'Müsli', mahlzeit: 'fruehstueck' }, um(8, 30)),
    eintrag({ id: 'c', name: 'Brötchen', mahlzeit: 'fruehstueck' }, um(7, 45)),
    eintrag({ id: 'd', name: 'Apfel', mahlzeit: 'snack' }, um(16, 0)),
  ];
  const g = gruppiereTag(liste);
  assert.deepEqual(g.fruehstueck.map((m) => m.name), ['Brötchen', 'Müsli']);
  assert.deepEqual(g.mittag, []);
  assert.deepEqual(g.abend.map((m) => m.name), ['Abendbrot']);
  assert.deepEqual(g.snack.map((m) => m.name), ['Apfel']);
});
test('fortschritt: Ist, Ziel, Anteil und Rest je Wert; ohne Ziel null', () => {
  const f = fortschritt({ kcal: 1040, eiweiss: 60, kohlenhydrate: 120, fett: 80 }, { kcal: 2080, eiweiss: 112, kohlenhydrate: 253, fett: 69 });
  assert.deepEqual(f.kcal, { ist: 1040, ziel: 2080, anteil: 0.5, rest: 1040 });
  assert.equal(f.fett.rest, -11); // über dem Ziel: negative Zahl, kein Urteil
  assert.equal(f.fett.anteil > 1, true);
  assert.equal(fortschritt({ kcal: 1, eiweiss: 1, kohlenhydrate: 1, fett: 1 }, null), null);
});

// --- Aus dem Vorrat abziehen ---
const vorratEintrag = (menge, einheit = 'g') => neuerEintrag({ name: 'Joghurt', art: 'menge', menge, einheit }, { id: 'v1' });
test('zieheAb: weniger Menge, Eintrag bleibt', () => {
  const r = zieheAb(vorratEintrag(500), 150);
  assert.equal(r.put.menge, 350);
  assert.equal(r.abgezogen, 150);
  assert.equal(r.fehlt, 0);
  assert.equal(r.loeschen, undefined);
});
test('zieheAb: leer gewordene Einträge verschwinden, nie unter 0', () => {
  assert.deepEqual(zieheAb(vorratEintrag(150), 150), { loeschen: 'v1', abgezogen: 150, fehlt: 0 });
  assert.deepEqual(zieheAb(vorratEintrag(100), 150), { loeschen: 'v1', abgezogen: 100, fehlt: 50 });
});
test('zieheAb: Original bleibt unverändert, Gewürze werden nicht abgezogen', () => {
  const e = vorratEintrag(500);
  zieheAb(e, 100);
  assert.equal(e.menge, 500);
  const salz = neuerEintrag({ name: 'Salz', art: 'da_leer' }, { id: 's' });
  assert.deepEqual(zieheAb(salz, 5), { abgezogen: 0, fehlt: 0 });
});

// --- Zuletzt gegessen ---
test('zuletztGegessen: neueste zuerst, gleiche Einträge nur einmal, begrenzt', () => {
  const liste = [
    eintrag({ id: '1', name: 'Joghurt' }, um(8, 0, [2026, 10, 7])),
    eintrag({ id: '2', name: 'Apfel', kcal: 80 }, um(9, 0, [2026, 10, 8])),
    eintrag({ id: '3', name: 'Joghurt', kcal: 160 }, um(8, 0, [2026, 10, 9])),
    eintrag({ id: '4', name: 'Pizza', quelle: 'frei' }, um(19, 0, [2026, 10, 6])),
  ];
  const z = zuletztGegessen(liste, 8);
  assert.deepEqual(z.map((m) => [m.name, m.id]), [['Joghurt', '3'], ['Apfel', '2'], ['Pizza', '4']]);
  assert.equal(zuletztGegessen(liste, 2).length, 2);
});

// --- Prüfen beim Einlesen einer Sicherung ---
test('normalisiereMahlzeit: Hin und zurück, Fehler, fremde Felder', () => {
  const m = eintrag({ id: 'x', menge: '150 g', ca: true, quelle: 'produkt', barcode: '4006381333931', rezeptId: 'r1' });
  assert.deepEqual(normalisiereMahlzeit(JSON.parse(JSON.stringify(m))), m);
  assert.equal('boese' in normalisiereMahlzeit({ ...m, boese: 1 }), false);
  assert.throws(() => normalisiereMahlzeit({ ...m, id: '' }), /Kennung/);
  assert.throws(() => normalisiereMahlzeit({ ...m, name: '' }), /Name/);
  assert.throws(() => normalisiereMahlzeit({ ...m, kcal: -1 }), /Kalorien/);
  assert.throws(() => normalisiereMahlzeit({ ...m, tag: 'gestern' }), /Datum/);
  assert.throws(() => normalisiereMahlzeit({ ...m, zeit: 'jetzt' }), /Zeit/);
  assert.throws(() => normalisiereMahlzeit({ ...m, mahlzeit: 'x' }), /Mahlzeit/);
  assert.throws(() => normalisiereMahlzeit('x'), /Eintrag/);
});
