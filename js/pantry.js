// Logik für den Vorrat (ohne Bildschirm, ohne Datenbank, damit sie leicht testbar ist).
//
// Mengen-Regel aus CLAUDE.md:
//  - art "menge":   Gramm, Milliliter oder Stück (alles, was ein Rezept abmisst)
//  - art "da_leer": nur "da" oder "leer" (Gewürze, Öl, Salz) – keine Menge

export const EINHEITEN = ['g', 'ml', 'stk'];
export const ARTEN = ['menge', 'da_leer'];

// "1,5" oder "1.5" -> 1.5. Alles andere (leer, Buchstaben, negativ) -> NaN.
export function parseZahl(text) {
  const t = String(text ?? '').trim();
  if (!/^\d+([.,]\d+)?$/.test(t)) return NaN;
  return Number(t.replace(',', '.'));
}

function zahlDeutsch(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

export function formatMenge(menge, einheit) {
  if (einheit === 'g') return menge >= 1000 ? `${zahlDeutsch(menge / 1000)} kg` : `${zahlDeutsch(menge)} g`;
  if (einheit === 'ml') return menge >= 1000 ? `${zahlDeutsch(menge / 1000)} l` : `${zahlDeutsch(menge)} ml`;
  if (einheit === 'stk') return `${zahlDeutsch(menge)} Stück`;
  return String(menge);
}

function gueltigesDatum(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(text + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

// Prüft die Eingaben und baut einen sauberen Vorrats-Eintrag. Wirft einen Fehler mit deutscher Meldung.
export function neuerEintrag(eingabe, { id = crypto.randomUUID() } = {}) {
  const name = String(eingabe.name ?? '').trim();
  if (!name) throw new Error('Bitte einen Namen eintragen.');
  if (!ARTEN.includes(eingabe.art)) throw new Error('Ungültige Art (Menge oder da / leer).');

  const ablaufRoh = String(eingabe.ablauf ?? '').trim();
  if (ablaufRoh && !gueltigesDatum(ablaufRoh)) throw new Error('Ungültiges Datum für das Ablaufdatum.');
  const ablauf = ablaufRoh || null;
  const barcode = eingabe.barcode ? String(eingabe.barcode).trim() || null : null;
  const zutat = eingabe.zutat ? String(eingabe.zutat).trim() || null : null; // Zutat für Rezepte, z. B. "Spaghetti"

  if (eingabe.art === 'da_leer') {
    return { id, name, art: 'da_leer', menge: null, einheit: null, da: true, ablauf, barcode, zutat };
  }

  if (!EINHEITEN.includes(eingabe.einheit)) throw new Error('Ungültige Einheit (g, ml oder Stück).');
  if (typeof eingabe.menge !== 'number' || !Number.isFinite(eingabe.menge) || eingabe.menge < 0) {
    throw new Error('Bitte eine gültige Menge eintragen (0 oder mehr).');
  }
  return { id, name, art: 'menge', menge: eingabe.menge, einheit: eingabe.einheit, da: null, ablauf, barcode, zutat };
}

// Schrittgröße für die Plus/Minus-Knöpfe
export function schritt(einheit) {
  return einheit === 'stk' ? 1 : 50;
}

// richtung: +1 oder -1. Gibt einen neuen Eintrag zurück, die Menge geht nie unter 0.
export function mengeAendern(eintrag, richtung) {
  if (eintrag.art !== 'menge') throw new Error('Dieser Eintrag hat keine Menge, nur da / leer.');
  const neu = Math.max(0, eintrag.menge + richtung * schritt(eintrag.einheit));
  return { ...eintrag, menge: neu };
}

export function setzeDa(eintrag, da) {
  if (eintrag.art !== 'da_leer') throw new Error('Nur Einträge der Art da / leer haben diesen Schalter.');
  return { ...eintrag, da: Boolean(da) };
}

export function sortiere(liste) {
  return [...liste].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
}

function gleicherName(a, b) {
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}

function istDerselbe(alt, neu) {
  if (alt.art !== neu.art) return false;
  if (alt.art === 'menge' && alt.einheit !== neu.einheit) return false;
  if (neu.barcode && alt.barcode) return neu.barcode === alt.barcode;
  return gleicherName(alt, neu);
}

function fruehereres(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

// Beim Einkaufen: Gibt es den Artikel schon, wird die Menge addiert, sonst kommt er neu dazu.
// Rückgabe: { liste (neue Liste), zusammengefuehrt (true/false), eintrag (der Eintrag, der gespeichert werden muss) }
export function hinzufuegenOderErhoehen(liste, neu) {
  const i = liste.findIndex((alt) => istDerselbe(alt, neu));
  if (i === -1) return { liste: [...liste, neu], zusammengefuehrt: false, eintrag: neu };

  const alt = liste[i];
  const zusammen =
    alt.art === 'menge'
      ? { ...alt, menge: alt.menge + neu.menge, ablauf: fruehereres(alt.ablauf, neu.ablauf), barcode: alt.barcode || neu.barcode, zutat: alt.zutat || neu.zutat }
      : { ...alt, da: true, ablauf: fruehereres(alt.ablauf, neu.ablauf), zutat: alt.zutat || neu.zutat };
  const kopie = [...liste];
  kopie[i] = zusammen;
  return { liste: kopie, zusammengefuehrt: true, eintrag: zusammen };
}
