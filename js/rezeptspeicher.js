// Rezepte mit der Datenbank verbinden: Startpaket laden, Rezeptdatei einlesen (die Logik steht in rezepte.js).
import { alle, schreibeAlles } from './db.js';
import { pruefeRezeptDatei, planeImport } from './rezepte.js';

// Prüft den Text einer Rezeptdatei und sagt, was passieren würde. Es wird noch nichts gespeichert.
export async function planeImportAusText(text) {
  const neue = pruefeRezeptDatei(text);
  const plan = planeImport(await alle('rezepte'), neue);
  return { ...plan, alle: neue };
}

// Speichert alle Rezepte aus dem Plan (neue und ersetzte) auf einmal.
export async function fuehreImportAus(plan) {
  await schreibeAlles({ rezepte: { put: plan.alle } });
}

// Das mitgelieferte Startpaket (liegt in der App, funktioniert auch offline).
export async function holeStartpaketText() {
  const antwort = await fetch('daten/startpaket.json');
  if (!antwort.ok) throw new Error('Das Startpaket konnte nicht geladen werden.');
  return antwort.text();
}
