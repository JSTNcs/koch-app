# Stand

**Phase 1 und 2 sind abgeschlossen und am iPhone getestet. Phase 3 (Rezepte, „Was koche ich?") ist gebaut und online
(Version v7), der Test am echten iPhone steht noch aus.** Danach: Phase 4 (Kochen-Modus mit Abziehen und Resten).
Vorher Plan zeigen und OK abwarten.

## Wo läuft was
- App im Netz: https://jstncs.github.io/koch-app/ (GitHub Pages, Zweig `main`, Ordner `/`)
- Code: https://github.com/JSTNcs/koch-app (öffentlich; darin nur Code, keine Daten)
- Commits laufen unter JSTNcs mit der GitHub-„noreply"-Adresse, nicht mit der privaten E-Mail.

## Was die App kann
- 6 Bildschirme mit unterer Navigation. Gebaut: Vorrat, Einkauf, Was koche ich?, Mehr (Einstellungen). Rest: Platzhalter (Kochen, Tagebuch).
- Installierbar auf dem Home-Bildschirm, läuft offline (Service Worker `sw.js`).
- **Vorrat:** anlegen, Menge ändern, löschen. Art `menge` (g, ml, Stück) oder `da_leer` (Gewürze). Feld „Zutat für Rezepte".
- **Scan:** Kamera liest Barcode, Open Food Facts liefert Name, Größe, Nährwerte (nur der Barcode geht raus). Unbekanntes Produkt von
  Hand eintragen, die App merkt es sich. Das Formular schlägt die Zutat vor (z. B. „Barilla Spaghetti N.5" → „Spaghetti").
- **Einkaufsliste:** Produkte (Marke, Barcode, Anzahl Packungen) oder Freitext; Suche in eigenen Produkten, „📷 Zur Liste", „＋ Ohne Marke";
  abhaken, dann „Abgehakte in den Vorrat"; „📷 Einkauf scannen" nimmt Gescanntes von der Liste (gleicher Barcode, gleichwertiges Produkt
  oder gleiche Zutat bei Freitext), sonst Frage „Ist das Ersatz für …?". In den Vorrat kommt immer das GESCANNTE Produkt.
- **Was koche ich? (Phase 3):**
  - Rezepte in drei Gruppen: „Alles da", „1–2 Zutaten fehlen", „Mehr fehlt" (eingeklappt). Freiwillige Zutaten zählen nie als fehlend.
  - Rezept-Ansicht: Zutaten mit Status (✔ da, ◐ zu wenig, ✘ fehlt, ❓ andere Einheit im Vorrat, ○ nicht erfasst), Portionen mit −/+
    (Mengen rechnen sich um), Zubereitung, Knopf „🛒 Fehlendes auf die Einkaufsliste" (bekanntes Produkt mit passender Anzahl Packungen,
    sonst Freitext; Gewürze nur, wenn ausdrücklich „leer"; nichts doppelt).
  - Abgleich über das Feld **Zutat**: Eintrag-Zutat, sonst Produkt-Zutat, sonst gleichwertiges Produkt, sonst Vermutung aus dem Namen.
    Gleiche Einheit wird addiert und verglichen; andere Einheit (Rezept „1 Zwiebel", Vorrat „1 kg") gilt als „unklar" (nicht fehlend).
    Gewürze/Öl/Salz ohne Eintrag im Vorrat gelten als vorhanden (nur „leer" zählt als fehlend).
- **Rezepte verwalten** (Mehr > „📖 Rezepte verwalten"): eintippen und ändern (Zutatenvorschläge, Einheit passend zur Zutat), löschen,
  **Startpaket** (28 Alltagsrezepte für 2 Portionen, gemischt mit Fleisch und Fisch, eigene Texte, `daten/startpaket.json`),
  **Rezeptdatei** einlesen (Rückfrage: was ist neu, was wird ersetzt; gleiche Kennung ersetzt).
- **Sicherung** (Mehr): Vorrat, Produkte, Einkaufsliste, Rezepte; Export per Teilen-Menü oder Download, Import mit Prüfung und Rückfrage
  (ersetzt alles), Erinnerung nach über 7 Tagen. Ältere Sicherungen bleiben einlesbar.

## Rezepte am PC importieren
- `node tools/rezept-aus-link.mjs <Link>` liest die maschinenlesbaren Rezeptdaten (schema.org/Recipe) und schreibt
  `rezepte/importe/<name>.json`; „Bitte prüfen"-Hinweise im Terminal. Datei per AirDrop/iCloud/E-Mail aufs iPhone, in der App einlesen.
- Format und Ablauf: `rezepte/README.md`. Aus Text oder Foto baut Claude Code die Datei nach diesem Format.
- `rezepte/importe/` steht in der `.gitignore` (Urheberrecht, nie ins öffentliche Repository).
- Noch nicht an einer echten Rezeptseite ausprobiert (nur mit einer nachgebauten Testseite und Tests). Beim ersten echten Link prüfen.

## Wie der Code aufgebaut ist
- Kein Build-Schritt. `index.html` lädt `js/app.js`; Bildschirme in `js/screens/`, Routen in `js/routes.js`.
- Reine Logik (gut testbar): `js/pantry.js` (Vorrat), `js/produkt.js` (Produkte, Open-Food-Facts-Antwort, Gruppen), `js/einkauf.js`
  (Liste, Zuordnung beim Scan), `js/zutaten.js` (Zutatenliste mit 99 Zutaten, Vorschlag), `js/rezepte.js` (Rezepte, Abgleich, Dateiformat),
  `js/barcode.js`, `js/backup.js`.
- Mit Browser verbunden: `js/db.js` (IndexedDB Version 3: `vorrat`, `produkte`, `einkauf`, `rezepte`, `einstellungen`; `schreibeAlles` schreibt
  mehrere Tabellen in einem Rutsch), `js/off.js`, `js/scanner.js`, `js/sicherung.js`, `js/rezeptspeicher.js`, `js/zutaten-ui.js`.
- Scan-Ablauf `js/screens/scan.js` hat drei Betriebsarten: `vorrat`, `liste`, `einkaufen`.
- PC-Werkzeuge in `tools/`: `rezeptimport.mjs`, `rezept-aus-link.mjs`, `baue-startpaket.mjs` (Quelle des Startpakets: danach
  `node tools/baue-startpaket.mjs` ausführen), `make-icons.mjs`, Browser-Tests.
- Bibliotheken lokal in `lib/` (MIT und Apache-2.0, siehe `lib/README.md`).

## Tests
- `npm test`: 184 Logik-Tests im Ordner `tests/` (Node, keine Installation nötig).
- Browser-Tests im Handy-Format (390 px): `python -m http.server 8080` im Projektordner starten, dann
  `node tools/browser-test.mjs tools/<seite>.html [bild.png]` mit `browser-test.html` (Vorrat, 12 Prüfungen), `scan-test.html` (Scan, 26,
  braucht Internet), `backup-test.html` (Sicherung, 28), `einkauf-test.html` (Einkaufsliste, 60), `rezepte-test.html` (Rezepte, 61, inkl.
  Umstellung der Datenbank von Version 2 auf 3). Das Skript startet Edge unsichtbar und beendet ihn selbst. Danach den Testserver beenden.
- Die Browser-Tests greifen Formularfelder nach Position an: Wird ein Feld in einem Formular eingefügt, die Positionen anpassen.

## So veröffentlichst du eine Änderung
1. In `sw.js` `VERSION` hochzählen und in `js/version.js` `APP_VERSION` auf denselben Wert (ein Test prüft das).
   Neue App-Dateien in die Liste `ASSETS` in `sw.js` eintragen (ein Test meldet vergessene Dateien).
2. `npm test`, dann `git add -A`, `git commit`, `git push`. Nach ca. 1 Minute ist die Version online.
3. Am iPhone: App öffnen, kurz warten, ganz schließen, neu öffnen. Version steht unten in Mehr.

## Entscheidungen und Erkenntnisse
- Produktsuche im Internet (Open Food Facts) geht aus der App heraus NICHT (geprüft am 06.11.2026: klassische Suche liefert 503, die neue
  Suche erlaubt keine fremden Webseiten, CORS). Nur mit eigenem Vermittler-Server möglich: nur nach Rückfrage. Es gilt „nur der Barcode
  verlässt das Handy".
- Einkaufsliste: Gescannte Einträge werden von der Liste GENOMMEN (nicht nur abgehakt), sonst würde „Abgehakte einräumen" doppelt einräumen.
- Import einer Sicherung ersetzt alle Daten (kein Mischen). Rezeptdatei: gleiche Kennung ersetzt das Rezept.
- Phase 3 (mit dem Nutzer entschieden): Zutat per Vorschlag plus einmal korrigieren; Gewürze ohne Eintrag gelten als vorhanden;
  Startpaket gemischt mit Fleisch und Fisch, für 2 Portionen; Rezepte werden unter „Mehr" verwaltet, „Was koche ich?" ist der Tab.
- Zutaten im Rezept in EL/TL/Prise gibt es nicht: Gewürze „nach Bedarf" (Menge als Hinweis), gemessene Zutaten rechnet der Import ungefähr um.

## Offen / Bekanntes
- Phase 3: Test am iPhone (Startpaket laden, „Was koche ich?", Portionen, Fehlendes auf die Liste, eigenes Rezept eintippen, Rezeptdatei).
- Echter Link-Import noch nicht an einer echten Seite geprüft; manche Seiten blockieren Programme (dann Text oder Foto an Claude Code).
- Einheiten werden nicht umgerechnet (Zwiebel in Stück gegen kg im Vorrat: „unklar"). Möglich später: Gewichte pro Stück je Zutat.
- Design bewusst schlicht, kommt in Phase 6. Bei vielen Rezepten ist die Gruppe „1–2 fehlen" lang; Sortierung nach ablaufenden Zutaten kommt in Phase 6.
- Open-Food-Facts-Daten sind nicht immer vollständig; dann im Prüf-Formular ergänzen.
- Daten liegen nur im Browser-Speicher des iPhones: regelmäßig sichern (Datei z. B. in iCloud Drive).
- Idee für später: leere Vorräte direkt „auf die Liste".
