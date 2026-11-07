import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AKTIVITAETEN, ZIELE, pruefeKoerperdaten, alterAus, grundumsatz, gesamtbedarf, schlageZielVor, normalisiereProfil } from '../js/tagesziel.js';

const JETZT = new Date('2026-06-15T12:00:00');
const mann = (o = {}) => ({ geschlecht: 'm', geburtsjahr: 1996, groesseCm: 180, gewichtKg: 80, aktivitaet: 'leicht', ziel: 'abnehmen', ...o });

// --- Eingaben prüfen ---
test('pruefeKoerperdaten: gültige Eingaben, Zahlen mit Komma als Text sind erlaubt', () => {
  assert.deepEqual(pruefeKoerperdaten(mann(), JETZT), mann());
  const r = pruefeKoerperdaten({ ...mann(), groesseCm: '180,5', gewichtKg: '79,5', geburtsjahr: '1996' }, JETZT);
  assert.equal(r.groesseCm, 180.5);
  assert.equal(r.gewichtKg, 79.5);
  assert.equal(r.geburtsjahr, 1996);
});
test('pruefeKoerperdaten: Fehler mit deutscher Meldung', () => {
  assert.throws(() => pruefeKoerperdaten(mann({ geschlecht: '' }), JETZT), /Geschlecht/);
  assert.throws(() => pruefeKoerperdaten(mann({ geburtsjahr: 'abc' }), JETZT), /Geburtsjahr/);
  assert.throws(() => pruefeKoerperdaten(mann({ geburtsjahr: 1850 }), JETZT), /Geburtsjahr/);
  assert.throws(() => pruefeKoerperdaten(mann({ geburtsjahr: 2020 }), JETZT), /Geburtsjahr/); // unter 14
  assert.throws(() => pruefeKoerperdaten(mann({ groesseCm: 90 }), JETZT), /Größe/);
  assert.throws(() => pruefeKoerperdaten(mann({ groesseCm: NaN }), JETZT), /Größe/);
  assert.throws(() => pruefeKoerperdaten(mann({ gewichtKg: 10 }), JETZT), /Gewicht/);
  assert.throws(() => pruefeKoerperdaten(mann({ gewichtKg: 400 }), JETZT), /Gewicht/);
  assert.throws(() => pruefeKoerperdaten(mann({ aktivitaet: 'x' }), JETZT), /Aktivität/);
  assert.throws(() => pruefeKoerperdaten(mann({ ziel: 'x' }), JETZT), /Ziel/);
});
test('Listen: fünf Aktivitätsstufen mit aufsteigendem Faktor, drei Ziele', () => {
  assert.deepEqual(AKTIVITAETEN.map((a) => a.faktor), [1.2, 1.375, 1.55, 1.725, 1.9]);
  assert.deepEqual(ZIELE.map((z) => z.id), ['halten', 'abnehmen', 'zunehmen']);
});

// --- Grundumsatz nach Mifflin-St-Jeor ---
test('alterAus: aus dem Geburtsjahr', () => {
  assert.equal(alterAus(1996, JETZT), 30);
  assert.equal(alterAus(2010, JETZT), 16);
});
test('grundumsatz: Mann, Frau und "keine Angabe"', () => {
  // Mann: 10*80 + 6,25*180 - 5*30 + 5 = 1780
  assert.equal(grundumsatz(mann(), JETZT), 1780);
  // Frau: 10*60 + 6,25*165 - 5*25 - 161 = 1345,25 -> 1345
  assert.equal(grundumsatz({ geschlecht: 'w', geburtsjahr: 2001, groesseCm: 165, gewichtKg: 60 }, JETZT), 1345);
  // Mittelwert: Konstante -78
  assert.equal(grundumsatz(mann({ geschlecht: 'd' }), JETZT), 1780 - 5 - 78);
});
test('gesamtbedarf: Grundumsatz mal Aktivitätsfaktor', () => {
  assert.equal(gesamtbedarf(mann(), JETZT), Math.round(1780 * 1.375));
  assert.equal(gesamtbedarf(mann({ aktivitaet: 'sitzend' }), JETZT), Math.round(1780 * 1.2));
  assert.equal(gesamtbedarf(mann({ aktivitaet: 'sehrhoch' }), JETZT), Math.round(1780 * 1.9));
});

// --- Vorschlag fürs Tagesziel ---
test('schlageZielVor: langsam abnehmen = 15 % weniger, Beispiel mit Eiweiß, Fett, Kohlenhydraten', () => {
  const v = schlageZielVor(mann(), JETZT);
  assert.equal(v.grundumsatz, 1780);
  assert.equal(v.gesamtbedarf, 2448);
  assert.equal(v.kcal, 2080); // 2448 - 367 = 2081, auf 10 gerundet
  assert.equal(v.eiweiss, 112); // 1,4 g pro kg
  assert.equal(v.fett, 69); // 30 % der Kalorien
  assert.equal(v.kohlenhydrate, 253); // der Rest
  assert.equal(v.zielWirksam, 'abnehmen');
  assert.deepEqual(v.hinweise, []);
});
test('schlageZielVor: halten und zunehmen', () => {
  assert.equal(schlageZielVor(mann({ ziel: 'halten' }), JETZT).kcal, 2450);
  assert.equal(schlageZielVor(mann({ ziel: 'zunehmen' }), JETZT).kcal, 2690); // 2448 * 1,10 = 2692,8 -> 2690
});
test('schlageZielVor: nie unter dem Grundumsatz, das Defizit ist höchstens 15 % oder 500 kcal', () => {
  for (const geschlecht of ['m', 'w', 'd']) {
    for (const aktivitaet of AKTIVITAETEN.map((a) => a.id)) {
      for (const gewichtKg of [45, 60, 80, 100, 140]) {
        for (const geburtsjahr of [1960, 1985, 2005]) {
          const k = { geschlecht, geburtsjahr, groesseCm: 170, gewichtKg, aktivitaet, ziel: 'abnehmen' };
          const v = schlageZielVor(k, JETZT);
          assert.ok(v.kcal >= v.grundumsatz - 5, `${JSON.stringify(k)}: ${v.kcal} < Grundumsatz ${v.grundumsatz}`); // 5: Rundung auf 10
          assert.ok(v.gesamtbedarf - v.kcal <= 505, 'Defizit zu groß');
          assert.ok(v.gesamtbedarf - v.kcal <= 0.15 * v.gesamtbedarf + 5, 'Defizit über 15 %');
        }
      }
    }
  }
});
test('schlageZielVor: unter 18 kein Abnehmen, nur Halten mit Hinweis', () => {
  const v = schlageZielVor(mann({ geburtsjahr: 2010 }), JETZT);
  assert.equal(v.zielWirksam, 'halten');
  assert.equal(v.kcal, schlageZielVor(mann({ geburtsjahr: 2010, ziel: 'halten' }), JETZT).kcal);
  assert.equal(v.hinweise.length, 1);
  assert.match(v.hinweise[0], /18/);
  assert.deepEqual(schlageZielVor(mann({ geburtsjahr: 2010, ziel: 'halten' }), JETZT).hinweise.length, 1); // der Hinweis gilt für alle unter 18
});
test('schlageZielVor: Kohlenhydrate werden nie negativ', () => {
  const v = schlageZielVor({ geschlecht: 'w', geburtsjahr: 2001, groesseCm: 150, gewichtKg: 180, aktivitaet: 'sitzend', ziel: 'abnehmen' }, JETZT);
  assert.ok(v.kohlenhydrate >= 0);
});
test('schlageZielVor: Rechenweg erklärt jeden Schritt mit den eigenen Zahlen', () => {
  const v = schlageZielVor(mann(), JETZT);
  const text = v.rechenweg.join('\n');
  assert.match(text, /Mifflin-St-Jeor/);
  assert.match(text, /10 × 80 kg \+ 6,25 × 180 cm − 5 × 30 Jahre \+ 5 = 1780 kcal/);
  assert.match(text, /1780 × 1,375 .*= 2448 kcal/);
  assert.match(text, /15 %/);
  assert.match(text, /Grundumsatz/);
  assert.match(text, /2080 kcal/);
  assert.match(text, /Eiweiß.*112 g/);
  assert.match(text, /Fett.*69 g/);
  assert.match(text, /Kohlenhydrate.*253 g/);
  const frau = schlageZielVor({ geschlecht: 'w', geburtsjahr: 2001, groesseCm: 165, gewichtKg: 60, aktivitaet: 'leicht', ziel: 'halten' }, JETZT).rechenweg.join('\n');
  assert.match(frau, /− 161/);
});

// --- Gespeichertes Profil prüfen ---
const profil = (o = {}) => ({ ...mann(), tagesziel: { kcal: 2080, eiweiss: 112, kohlenhydrate: 253, fett: 69 }, manuell: false, ...o });
test('normalisiereProfil: Hin und zurück, fremde Felder fallen weg', () => {
  assert.deepEqual(normalisiereProfil(JSON.parse(JSON.stringify(profil())), JETZT), profil());
  assert.equal('boese' in normalisiereProfil({ ...profil(), boese: 1 }, JETZT), false);
});
test('normalisiereProfil: Fehler bei Körperdaten und Ziel', () => {
  assert.throws(() => normalisiereProfil(profil({ gewichtKg: 5 }), JETZT), /Gewicht/);
  assert.throws(() => normalisiereProfil(profil({ tagesziel: { kcal: -1, eiweiss: 1, kohlenhydrate: 1, fett: 1 } }), JETZT), /Tagesziel/);
  assert.throws(() => normalisiereProfil(profil({ tagesziel: { kcal: 2000 } }), JETZT), /Tagesziel/);
  assert.throws(() => normalisiereProfil(profil({ tagesziel: null }), JETZT), /Tagesziel/);
  assert.throws(() => normalisiereProfil('x', JETZT), /Profil/);
});
test('normalisiereProfil: "manuell" ist ein Wahrheitswert, Standard false', () => {
  assert.equal(normalisiereProfil({ ...profil(), manuell: undefined }, JETZT).manuell, false);
  assert.equal(normalisiereProfil(profil({ manuell: true }), JETZT).manuell, true);
});
