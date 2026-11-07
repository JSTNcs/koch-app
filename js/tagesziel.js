// Tagesziel aus Körperdaten: Grundumsatz nach Mifflin-St-Jeor, Aktivitätsfaktor, moderates Ziel. Reine Logik.
//
// Regeln (aus CLAUDE.md): Der Vorschlag liegt nie unter dem Grundumsatz, ein Defizit bleibt moderat
// (höchstens 15 % oder 500 kcal, das Kleinere). Die App bewertet nichts, sie rechnet nur vor.

export const GESCHLECHTER = [
  { id: 'm', label: 'Männlich' },
  { id: 'w', label: 'Weiblich' },
  { id: 'd', label: 'Keine Angabe (Mittelwert)' },
];

export const AKTIVITAETEN = [
  { id: 'sitzend', faktor: 1.2, kurz: 'überwiegend sitzend', label: 'Überwiegend sitzend (Büro, kaum Sport)' },
  { id: 'leicht', faktor: 1.375, kurz: 'leicht aktiv', label: 'Leicht aktiv (1 bis 3 Mal Sport pro Woche)' },
  { id: 'mittel', faktor: 1.55, kurz: 'mäßig aktiv', label: 'Mäßig aktiv (3 bis 5 Mal Sport pro Woche)' },
  { id: 'hoch', faktor: 1.725, kurz: 'sehr aktiv', label: 'Sehr aktiv (6 bis 7 Mal Sport pro Woche)' },
  { id: 'sehrhoch', faktor: 1.9, kurz: 'extrem aktiv', label: 'Extrem aktiv (körperliche Arbeit und Sport)' },
];

export const ZIELE = [
  { id: 'halten', label: 'Gewicht halten' },
  { id: 'abnehmen', label: 'Langsam abnehmen' },
  { id: 'zunehmen', label: 'Langsam zunehmen' },
];

const KONSTANTE = { m: 5, w: -161, d: -78 }; // d: Mittelwert aus Mann und Frau
const MAX_DEFIZIT_PROZENT = 0.15;
const MAX_DEFIZIT_KCAL = 500;
const UEBERSCHUSS_PROZENT = 0.1;
const EIWEISS_G_PRO_KG = 1.4;
const FETT_ANTEIL = 0.3;

const komma = (n) => String(n).replace('.', ',');
const zahl = (x) => {
  if (typeof x === 'number') return x;
  const t = String(x ?? '').trim();
  return t === '' ? NaN : Number(t.replace(',', '.'));
};

export const alterAus = (geburtsjahr, jetzt = new Date()) => jetzt.getFullYear() - geburtsjahr;

// Prüft die Körperdaten und gibt saubere Werte zurück. Wirft einen Fehler mit deutscher Meldung.
export function pruefeKoerperdaten(eingabe, jetzt = new Date()) {
  if (!GESCHLECHTER.some((g) => g.id === eingabe?.geschlecht)) throw new Error('Bitte das Geschlecht wählen.');
  const geburtsjahr = zahl(eingabe.geburtsjahr);
  const alter = alterAus(geburtsjahr, jetzt);
  if (!Number.isInteger(geburtsjahr) || alter < 14 || alter > 100) {
    throw new Error('Bitte ein gültiges Geburtsjahr eintragen (zum Beispiel 1995). Die App ist für Personen ab 14 Jahren gedacht.');
  }
  const groesseCm = zahl(eingabe.groesseCm);
  if (!(groesseCm >= 120 && groesseCm <= 230)) throw new Error('Die Größe muss zwischen 120 und 230 cm liegen.');
  const gewichtKg = zahl(eingabe.gewichtKg);
  if (!(gewichtKg >= 30 && gewichtKg <= 250)) throw new Error('Das Gewicht muss zwischen 30 und 250 kg liegen.');
  if (!AKTIVITAETEN.some((a) => a.id === eingabe.aktivitaet)) throw new Error('Bitte die Aktivität wählen.');
  if (!ZIELE.some((z) => z.id === eingabe.ziel)) throw new Error('Bitte ein Ziel wählen.');
  return { geschlecht: eingabe.geschlecht, geburtsjahr, groesseCm, gewichtKg, aktivitaet: eingabe.aktivitaet, ziel: eingabe.ziel };
}

// Grundumsatz in kcal pro Tag (Mifflin-St-Jeor): 10 × kg + 6,25 × cm − 5 × Alter + Konstante
export function grundumsatz(k, jetzt = new Date()) {
  return Math.round(10 * k.gewichtKg + 6.25 * k.groesseCm - 5 * alterAus(k.geburtsjahr, jetzt) + KONSTANTE[k.geschlecht]);
}

const faktorVon = (id) => AKTIVITAETEN.find((a) => a.id === id);

export function gesamtbedarf(k, jetzt = new Date()) {
  return Math.round(grundumsatz(k, jetzt) * faktorVon(k.aktivitaet).faktor);
}

const rundeAuf10 = (n) => Math.round(n / 10) * 10;

// Vorschlag fürs Tagesziel mit Rechenweg zum Erklären. Es wird nichts gespeichert.
export function schlageZielVor(k, jetzt = new Date()) {
  const alter = alterAus(k.geburtsjahr, jetzt);
  const hinweise = [];
  let ziel = k.ziel;
  if (alter < 18) {
    ziel = 'halten';
    hinweise.push('Du bist unter 18: Die App schlägt dafür kein Abnehmen vor, sondern nur den Bedarf zum Halten. Sprich bei Fragen zum Gewicht mit einer Ärztin oder einem Arzt.');
  }

  const bmr = grundumsatz(k, jetzt);
  const akt = faktorVon(k.aktivitaet);
  const tdee = gesamtbedarf(k, jetzt);

  let roh = tdee;
  let zielZeile;
  if (ziel === 'abnehmen') {
    const defizit = Math.min(MAX_DEFIZIT_KCAL, Math.round(MAX_DEFIZIT_PROZENT * tdee));
    roh = tdee - defizit;
  } else if (ziel === 'zunehmen') {
    roh = Math.round(tdee * (1 + UEBERSCHUSS_PROZENT));
  }
  let kcal = rundeAuf10(roh);
  if (roh < bmr || kcal < bmr) {
    kcal = Math.ceil(bmr / 10) * 10; // nie unter dem Grundumsatz
    hinweise.push('Das Defizit wurde begrenzt, damit du nicht unter deinem Grundumsatz landest.');
  }

  const eiweiss = Math.round(EIWEISS_G_PRO_KG * k.gewichtKg);
  const fett = Math.round((FETT_ANTEIL * kcal) / 9);
  const kohlenhydrate = Math.max(0, Math.round((kcal - 4 * eiweiss - 9 * fett) / 4));

  if (ziel === 'abnehmen') zielZeile = `Ziel „langsam abnehmen“: 15 % weniger (höchstens 500 kcal), aber nie unter dem Grundumsatz = ${kcal} kcal`;
  else if (ziel === 'zunehmen') zielZeile = `Ziel „langsam zunehmen“: 10 % mehr = ${kcal} kcal`;
  else zielZeile = `Ziel „Gewicht halten“: kein Auf- oder Abschlag = ${kcal} kcal`;

  const s = KONSTANTE[k.geschlecht];
  const rechenweg = [
    `Grundumsatz (Formel nach Mifflin-St-Jeor): 10 × ${komma(k.gewichtKg)} kg + 6,25 × ${komma(k.groesseCm)} cm − 5 × ${alter} Jahre ${s >= 0 ? '+' : '−'} ${Math.abs(s)} = ${bmr} kcal`,
    `Gesamtbedarf: ${bmr} × ${komma(akt.faktor)} (${akt.kurz}) = ${tdee} kcal`,
    zielZeile,
    `Eiweiß: ${komma(EIWEISS_G_PRO_KG)} g pro kg Körpergewicht = ${eiweiss} g`,
    `Fett: 30 % der Kalorien = ${fett} g`,
    `Kohlenhydrate: der Rest der Kalorien = ${kohlenhydrate} g`,
  ];

  return { grundumsatz: bmr, gesamtbedarf: tdee, kcal, eiweiss, kohlenhydrate, fett, zielWirksam: ziel, hinweise, rechenweg };
}

// Prüft ein gespeichertes Profil (z. B. aus einer Sicherung).
export function normalisiereProfil(roh, jetzt = new Date()) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) throw new Error('Das Profil ist ungültig.');
  const koerper = pruefeKoerperdaten(roh, jetzt);
  const t = roh.tagesziel;
  const felder = ['kcal', 'eiweiss', 'kohlenhydrate', 'fett'];
  if (!t || typeof t !== 'object' || felder.some((f) => typeof t[f] !== 'number' || !Number.isFinite(t[f]) || t[f] < 0)) {
    throw new Error('Das Tagesziel ist ungültig.');
  }
  return { ...koerper, tagesziel: { kcal: t.kcal, eiweiss: t.eiweiss, kohlenhydrate: t.kohlenhydrate, fett: t.fett }, manuell: roh.manuell === true };
}
