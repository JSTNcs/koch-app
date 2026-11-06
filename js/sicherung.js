// Sicherung mit der Datenbank verbinden (die reine Logik steht in backup.js).
import { alleDaten, ersetzeDaten, hole, speichere } from './db.js';
import { erzeugeSicherung, pruefeSicherung, sicherungsDateiname, sicherungsHinweis } from './backup.js';

// Baut die Sicherungsdatei aus den aktuellen Daten.
export async function erstelleSicherung(jetzt = new Date()) {
  const daten = await alleDaten();
  const sicherung = erzeugeSicherung(daten, jetzt);
  return {
    text: JSON.stringify(sicherung, null, 2),
    name: sicherungsDateiname(jetzt),
    anzahlVorrat: daten.vorrat.length,
    anzahlProdukte: daten.produkte.length,
  };
}

export async function merkeSicherung(jetzt = new Date()) {
  await speichere('einstellungen', { key: 'letzteSicherung', value: jetzt.toISOString() });
}

export async function letzteSicherung() {
  return (await hole('einstellungen', 'letzteSicherung'))?.value ?? null;
}

// Prüft den Text einer Datei. Noch wird nichts verändert.
export function liesSicherung(text) {
  return pruefeSicherung(text);
}

// Ersetzt die Daten auf diesem Handy durch den Inhalt der geprüften Sicherung.
export async function stelleWiederHer(geprueft) {
  await ersetzeDaten(geprueft);
}

// Text der Erinnerung (oder null). Fehler im Speicher dürfen den Vorrat nie blockieren.
export async function ladeHinweis(jetzt = new Date()) {
  try {
    const daten = await alleDaten();
    const letzte = daten.einstellungen.find((e) => e.key === 'letzteSicherung')?.value ?? null;
    return sicherungsHinweis({ letzte, hatDaten: daten.vorrat.length + daten.produkte.length > 0, jetzt });
  } catch {
    return null;
  }
}
