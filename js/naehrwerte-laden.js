// Die eingebaute Nährwert-Tabelle laden (liegt in der App, funktioniert auch offline).
let zwischenspeicher = null;

// Gibt die Tabelle zurück oder null, falls sie nicht geladen werden kann (dann gibt es einfach keine Vorschläge).
export async function ladeNaehrwerteTabelle() {
  if (zwischenspeicher) return zwischenspeicher;
  try {
    const antwort = await fetch('daten/naehrwerte.json');
    if (!antwort.ok) return null;
    zwischenspeicher = await antwort.json();
    return zwischenspeicher;
  } catch {
    return null;
  }
}
