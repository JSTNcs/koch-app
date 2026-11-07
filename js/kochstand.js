// Den laufenden Kochvorgang speichern und laden (Tabelle "einstellungen", Schlüssel "kochen").
import { speichere, hole, loesche } from './db.js';
import { neuerKochstand } from './kochen.js';

const SCHLUESSEL = 'kochen';

export async function ladeKochstand() {
  return (await hole('einstellungen', SCHLUESSEL))?.value ?? null;
}
export async function speichereKochstand(stand) {
  await speichere('einstellungen', { key: SCHLUESSEL, value: stand });
}
export async function loescheKochstand() {
  await loesche('einstellungen', SCHLUESSEL);
}

// Startet das Kochen eines Rezepts und wechselt zum Tab "Kochen". Läuft schon ein Kochvorgang, wird vorher gefragt.
export async function beginneKochen(rezept, portionen) {
  const vorhanden = await ladeKochstand();
  if (vorhanden && !confirm(`Du kochst gerade schon etwas. Neu beginnen mit „${rezept.name}“?`)) {
    location.hash = '#/kochen';
    return;
  }
  await speichereKochstand(neuerKochstand(rezept, portionen));
  location.hash = '#/kochen';
}
