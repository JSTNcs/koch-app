// Tagebuch: Einträge, Tage, Summen und Fortschritt gegen das Tagesziel. Reine Logik (ohne Bildschirm und Datenbank).
//
// Ein Eintrag (Mahlzeit): { id, tag (JJJJ-MM-TT, Ortszeit), zeit (ISO), mahlzeit, name, menge (Text|null),
//   kcal, eiweiss, kohlenhydrate, fett (für den ganzen Eintrag), ca (Näherung), quelle, barcode|null, rezeptId|null }
// Die App bewertet nichts: Überschreitungen sind einfach negative Reste.

export const MAHLZEITEN = [
  { id: 'fruehstueck', label: 'Frühstück' },
  { id: 'mittag', label: 'Mittagessen' },
  { id: 'abend', label: 'Abendessen' },
  { id: 'snack', label: 'Snacks' },
];
const QUELLEN = ['frei', 'produkt', 'vorrat', 'rezept', 'rest'];
const WOCHENTAGE = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const WERTE = ['kcal', 'eiweiss', 'kohlenhydrate', 'fett'];

const zwei = (n) => String(n).padStart(2, '0');
const runde1 = (n) => Math.round(n * 10) / 10;
const runde2 = (n) => Math.round(n * 100) / 100;

// ---------- Tage ----------
export const tagVon = (datum) => `${datum.getFullYear()}-${zwei(datum.getMonth() + 1)}-${zwei(datum.getDate())}`;

export function tagZuDatum(tag, stunde = 12) {
  const [j, m, t] = tag.split('-').map(Number);
  return new Date(j, m - 1, t, stunde);
}

export const gueltigerTag = (tag) => typeof tag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tag) && tagVon(tagZuDatum(tag)) === tag;

export function verschiebeTag(tag, tage) {
  const d = tagZuDatum(tag, 12); // Mittag, damit die Zeitumstellung nichts verschiebt
  d.setDate(d.getDate() + tage);
  return tagVon(d);
}

export function tagText(tag, jetzt = new Date()) {
  const heute = tagVon(jetzt);
  if (tag === heute) return 'Heute';
  if (tag === verschiebeTag(heute, -1)) return 'Gestern';
  const d = tagZuDatum(tag);
  return `${WOCHENTAGE[d.getDay()]}, ${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Vorschlag, zu welcher Mahlzeit etwas gehört (der Nutzer kann ihn ändern)
export function mahlzeitVorschlag(datum) {
  const h = datum.getHours();
  if (h >= 5 && h <= 10) return 'fruehstueck';
  if (h >= 11 && h <= 14) return 'mittag';
  if (h >= 17 && h <= 21) return 'abend';
  return 'snack';
}

// ---------- Einträge ----------
export function neueMahlzeit(eingabe, { id = crypto.randomUUID(), jetzt = new Date() } = {}) {
  const name = String(eingabe?.name ?? '').trim();
  if (!name) throw new Error('Bitte einen Namen eintragen.');
  const kcal = eingabe.kcal;
  if (typeof kcal !== 'number' || !Number.isFinite(kcal) || kcal < 0) throw new Error('Bitte die Kalorien eintragen (0 oder mehr).');
  const werte = {};
  for (const feld of WERTE.slice(1)) {
    const v = eingabe[feld] ?? 0;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('Die Nährwerte müssen Zahlen ab 0 sein.');
    werte[feld] = runde1(v);
  }

  const tag = eingabe.tag ?? tagVon(jetzt);
  if (!gueltigerTag(tag)) throw new Error('Ungültiges Datum.');
  if (eingabe.zeit !== undefined && (typeof eingabe.zeit !== 'string' || Number.isNaN(Date.parse(eingabe.zeit)))) throw new Error('Ungültige Zeit.');
  const zeit = eingabe.zeit ?? (tag === tagVon(jetzt) ? jetzt : tagZuDatum(tag, 12)).toISOString();
  const mahlzeit = eingabe.mahlzeit ?? mahlzeitVorschlag(new Date(zeit));
  if (!MAHLZEITEN.some((m) => m.id === mahlzeit)) throw new Error('Bitte eine gültige Mahlzeit wählen.');
  const quelle = eingabe.quelle ?? 'frei';
  if (!QUELLEN.includes(quelle)) throw new Error('Ungültige Quelle des Eintrags.');

  return {
    id,
    tag,
    zeit,
    mahlzeit,
    name,
    menge: typeof eingabe.menge === 'string' && eingabe.menge.trim() ? eingabe.menge.trim() : null,
    kcal: Math.round(kcal),
    ...werte,
    ca: eingabe.ca === true,
    quelle,
    barcode: typeof eingabe.barcode === 'string' && eingabe.barcode ? eingabe.barcode : null,
    rezeptId: typeof eingabe.rezeptId === 'string' && eingabe.rezeptId ? eingabe.rezeptId : null,
  };
}

// Nährwerte für eine gegessene Menge: pro 100 g/ml oder pro Stück. Fehlende Werte zählen als 0 und werden gemeldet.
export function naehrwerteFuerMenge(pro, menge, einheit) {
  if (!['g', 'ml', 'stk'].includes(einheit)) throw new Error('Ungültige Einheit (g, ml oder Stück).');
  if (typeof menge !== 'number' || !Number.isFinite(menge) || menge <= 0) throw new Error('Bitte eine Menge größer als 0 eintragen.');
  const faktor = einheit === 'stk' ? menge : menge / 100;
  let unvollstaendig = false;
  const wert = (feld) => {
    const v = pro?.[feld];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      unvollstaendig = true;
      return 0;
    }
    return v * faktor;
  };
  const kcal = Math.round(wert('kcal'));
  const eiweiss = runde1(wert('eiweiss'));
  const kohlenhydrate = runde1(wert('kohlenhydrate'));
  const fett = runde1(wert('fett'));
  return { kcal, eiweiss, kohlenhydrate, fett, unvollstaendig };
}

// ---------- Summen und Fortschritt ----------
export function summiere(liste) {
  const s = { kcal: 0, eiweiss: 0, kohlenhydrate: 0, fett: 0 };
  for (const m of liste) for (const f of WERTE) s[f] += m[f];
  return { kcal: Math.round(s.kcal), eiweiss: runde1(s.eiweiss), kohlenhydrate: runde1(s.kohlenhydrate), fett: runde1(s.fett) };
}

export function gruppiereTag(liste) {
  const gruppen = Object.fromEntries(MAHLZEITEN.map((m) => [m.id, []]));
  for (const m of [...liste].sort((a, b) => a.zeit.localeCompare(b.zeit))) gruppen[m.mahlzeit].push(m);
  return gruppen;
}

// Ist, Ziel, Anteil (1 = erreicht) und Rest (negativ = darüber) je Wert. Ohne Ziel: null.
export function fortschritt(summe, ziel) {
  if (!ziel) return null;
  return Object.fromEntries(
    WERTE.map((f) => [f, { ist: summe[f], ziel: ziel[f], anteil: ziel[f] > 0 ? summe[f] / ziel[f] : 0, rest: f === 'kcal' ? Math.round(ziel[f] - summe[f]) : runde1(ziel[f] - summe[f]) }])
  );
}

// ---------- Aus dem Vorrat essen ----------
// Zieht eine Menge von einem Vorratseintrag ab. Rückgabe: { put (neuer Eintrag) | loeschen (id), abgezogen, fehlt }.
// Leer gewordene Einträge verschwinden, es geht nie unter 0. Gewürze (da / leer) werden nicht abgezogen.
export function zieheAb(eintrag, menge) {
  if (eintrag.art !== 'menge') return { abgezogen: 0, fehlt: 0 };
  if (menge >= eintrag.menge) return { loeschen: eintrag.id, abgezogen: eintrag.menge, fehlt: runde2(menge - eintrag.menge) };
  return { put: { ...eintrag, menge: runde2(eintrag.menge - menge) }, abgezogen: menge, fehlt: 0 };
}

// ---------- Zuletzt gegessen ----------
export function zuletztGegessen(liste, n = 8) {
  const gesehen = new Set();
  const ergebnis = [];
  for (const m of [...liste].sort((a, b) => b.zeit.localeCompare(a.zeit))) {
    const schluessel = `${m.quelle}|${m.name.trim().toLowerCase()}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    ergebnis.push(m);
    if (ergebnis.length >= n) break;
  }
  return ergebnis;
}

// ---------- Prüfen beim Einlesen einer Sicherung ----------
export function normalisiereMahlzeit(roh) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) throw new Error('Der Eintrag ist ungültig.');
  if (typeof roh.id !== 'string' || !roh.id) throw new Error('Die Kennung (id) fehlt.');
  if (typeof roh.zeit !== 'string') throw new Error('Ungültige Zeit.');
  return neueMahlzeit(roh, { id: roh.id });
}
