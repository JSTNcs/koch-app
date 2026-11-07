// Timer für Kochschritte: Zeiten im Text finden, Restzeit berechnen und anzeigen. Reine Logik.

const ZEIT = /(\d+)(?:\s*(?:-|–|bis)\s*(\d+))?\s*(Sekunden|Sekunde|Sek\.?|Minuten|Minute|Min\.?|Stunden|Stunde|Std\.?)(?![a-zäöü])/gi;
const FAKTOR = { s: 1, m: 60, h: 3600 };

// Zeiten wie "15 Minuten" oder "6 bis 8 Minuten" in einem Schritt. Bei Bereichen zählt die obere Zahl.
// Doppelte Zeiten kommen nur einmal vor, höchstens drei.
export function findeZeiten(text) {
  const ergebnis = [];
  for (const m of String(text ?? '').matchAll(ZEIT)) {
    const zahl = Number(m[2] ?? m[1]);
    const faktor = /^sek/i.test(m[3]) ? FAKTOR.s : /^min/i.test(m[3]) ? FAKTOR.m : FAKTOR.h; // Sekunden, Minuten, sonst Stunden
    const sekunden = zahl * faktor;
    if (sekunden > 0 && !ergebnis.some((z) => z.sekunden === sekunden)) ergebnis.push({ sekunden, text: m[0] });
    if (ergebnis.length === 3) break;
  }
  return ergebnis;
}

// Verbleibende ganze Sekunden bis zum Ende (Zeitpunkt in Millisekunden), aufgerundet, nie unter 0
export const restSekunden = (ende, jetzt = Date.now()) => Math.max(0, Math.ceil((ende - jetzt) / 1000));

const zwei = (n) => String(n).padStart(2, '0');

// "10:00" oder "1:02:05"
export function formatRest(sekunden) {
  const h = Math.floor(sekunden / 3600);
  const m = Math.floor((sekunden % 3600) / 60);
  const s = sekunden % 60;
  return h > 0 ? `${h}:${zwei(m)}:${zwei(s)}` : `${m}:${zwei(s)}`;
}

// Kurze Beschriftung für den Knopf: "45 Sek.", "15 Min.", "1 Std. 30 Min."
export function zeitText(sekunden) {
  if (sekunden < 60) return `${sekunden} Sek.`;
  const h = Math.floor(sekunden / 3600);
  const m = Math.round((sekunden % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} Std. ${m} Min.` : `${h} Std.`;
  return `${m} Min.`;
}
