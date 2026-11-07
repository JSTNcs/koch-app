// Rezept-Import am PC: holt eine Rezeptseite, liest die maschinenlesbaren Rezeptdaten aus und schreibt eine
// Rezeptdatei, die du in der App unter "Mehr > Rezepte verwalten > Rezeptdatei" einliest.
//
// Aufruf:  node tools/rezept-aus-link.mjs <Link zum Rezept> [Dateiname.json]
// Ergebnis: rezepte/importe/<name>.json (bleibt auf dem PC, wird nicht auf GitHub hochgeladen)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { extrahiereRezept, baueRezeptDatei } from './rezeptimport.mjs';
import { pruefeRezeptDatei } from '../js/rezepte.js';

const link = process.argv[2];
if (!link || !/^https?:\/\//i.test(link)) {
  console.error('Bitte einen Link angeben, zum Beispiel:\n  node tools/rezept-aus-link.mjs https://www.beispiel.de/rezepte/nudeln');
  process.exit(1);
}

let antwort;
try {
  antwort = await fetch(link, {
    // Ein allgemeiner Programmname, keine persönlichen Angaben
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Koch-App-Rezeptimport)', 'Accept-Language': 'de-DE,de;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
} catch (e) {
  console.error(`Die Seite konnte nicht geladen werden: ${e.message}`);
  process.exit(1);
}
if (!antwort.ok) {
  console.error(`Die Seite hat mit Fehler ${antwort.status} geantwortet. Manche Seiten blockieren Programme. Sag Claude Code Bescheid, dann bauen wir das Rezept aus dem Text.`);
  process.exit(1);
}

let ergebnis;
try {
  ergebnis = extrahiereRezept(await antwort.text(), antwort.url || link);
} catch (e) {
  console.error(`${e.message}\nSag Claude Code Bescheid: Aus dem Text der Seite oder einem Foto lässt sich trotzdem eine Rezeptdatei bauen.`);
  process.exit(1);
}

const datei = baueRezeptDatei([ergebnis.rezept]);
const geprueft = pruefeRezeptDatei(JSON.stringify(datei))[0]; // dieselbe Prüfung wie in der App
const ziel = process.argv[3] || `rezepte/importe/${geprueft.id}.json`;
mkdirSync(dirname(ziel), { recursive: true });
writeFileSync(ziel, JSON.stringify(datei, null, 2) + '\n');

console.log(`\n${geprueft.name}`);
console.log(`${geprueft.portionen} Portionen${geprueft.dauerMinuten ? `, ${geprueft.dauerMinuten} Min.` : ''}, ${geprueft.zutaten.length} Zutaten, ${geprueft.schritte.length} Schritte\n`);
for (const z of geprueft.zutaten) {
  const menge = z.art === 'menge' ? `${z.menge} ${z.einheit}` : 'nach Bedarf';
  console.log(`  - ${z.zutat}: ${menge}${z.notiz ? ` (${z.notiz})` : ''}`);
}
if (ergebnis.warnungen.length) {
  console.log('\nBitte prüfen:');
  for (const w of ergebnis.warnungen) console.log(`  ! ${w}`);
}
console.log(`\nGespeichert: ${ziel}`);
console.log('Aufs iPhone bringen (AirDrop, iCloud Drive oder E-Mail an dich selbst), dann in der App:');
console.log('Mehr > Rezepte verwalten > Rezeptdatei.');
