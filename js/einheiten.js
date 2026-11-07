// Einheiten umrechnen (Stück, Gramm, Milliliter) mit den Gewichten aus der Nährwert-Tabelle. Reine Logik.
// Beispiel: "1 Zwiebel" im Rezept und "1 kg Zwiebeln" im Vorrat werden vergleichbar (1 Zwiebel = 90 g).
import { tabellenEintrag, gramm } from './naehrwerte.js';

// Rechnet eine Menge von einer Einheit in eine andere um. Nicht möglich (keine Tabelle, unbekannte Zutat,
// kein Stückgewicht): null. Gleiche Einheit bleibt unverändert, auch ohne Tabelle.
export function umrechnen(menge, von, nach, zutat, tabelle) {
  if (von === nach) return menge;
  const e = tabellenEintrag(tabelle, zutat);
  if (!e) return null;
  const g = gramm(menge, von, e);
  if (g === null) return null;
  if (nach === 'g') return g;
  if (nach === 'ml') return g / (e.dichte || 1);
  if (nach === 'stk') return e.stueckG ? g / e.stueckG : null;
  return null;
}
