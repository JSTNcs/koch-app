# Stand

**Phase 1 ist abgeschlossen** (am iPhone getestet). **Phase 2 (Einkaufsliste) ist gebaut und online (Version v6),
der Test am echten iPhone steht noch aus.** Danach: Phase 3 (Rezepte, „Was koche ich?").

## Wo läuft was
- App im Netz: https://jstncs.github.io/koch-app/ (GitHub Pages, Zweig `main`, Ordner `/`)
- Code: https://github.com/JSTNcs/koch-app (öffentlich; darin nur Code, keine Daten)
- Commits laufen unter JSTNcs mit der GitHub-„noreply"-Adresse, nicht mit der privaten E-Mail.

## Was die App kann
- 6 Bildschirme mit unterer Navigation. Gebaut: Vorrat, Einkauf, Mehr (Einstellungen). Rest: Platzhalter.
- Installierbar auf dem Home-Bildschirm, läuft offline (Service Worker `sw.js`).
- **Vorrat:** anlegen, Menge ändern, löschen. Art `menge` (g, ml, Stück) oder `da_leer` (Gewürze).
- **Scan:** Kamera liest Barcode, Open Food Facts liefert Name, Größe, Nährwerte (nur der Barcode geht raus).
  Unbekanntes Produkt von Hand eintragen, die App merkt es sich (Tabelle `produkte`).
- **Einkaufsliste (Phase 2):**
  - Einträge sind Produkte (Marke, Barcode, Packungsgröße, Anzahl Packungen) oder Freitext ohne Marke (Menge + Einheit).
  - Hinzufügen: Suche in den eigenen Produkten, „📷 Zur Liste" (Scan), „＋ Ohne Marke" (Freitext). Nicht doppelt, Anzahl wird erhöht.
  - Abhaken = durchgestrichen, bleibt auf der Liste. Unten „✔ N Abgehakte in den Vorrat" legt genau diese Produkte
    (Packung × Anzahl) in den Vorrat und nimmt sie von der Liste.
  - „📷 Einkauf scannen": gleicher Barcode oder als gleichwertig gemerktes Produkt wird automatisch von der Liste genommen.
    Sonst Frage „Ist das Ersatz für …?" mit den offenen Einträgen (ähnliche zuerst). In den Vorrat kommt immer das GESCANNTE Produkt.
    Wurden weniger gekauft als gebraucht, bleibt der Rest auf der Liste. Der Normal-Scan im Vorrat-Tab fragt nichts zur Liste.
  - „Gleichwertig" wird gemerkt: Feld `gruppe` im Produkt (gleiche Gruppe = austauschbar). Nützlich auch für Phase 3.
- **Sicherung** (Tab Mehr): Export per Teilen-Menü oder Download, Import mit Prüfung und Rückfrage (ersetzt alles),
  Erinnerung im Vorrat nach über 7 Tagen. Enthält Vorrat, Produkte und Einkaufsliste; ältere Sicherungen bleiben einlesbar.

## Wie der Code aufgebaut ist
- Kein Build-Schritt. `index.html` lädt `js/app.js`; Bildschirme in `js/screens/`, Routen in `js/routes.js`.
- Reine Logik (gut testbar): `js/pantry.js` (Vorrat, Mengen), `js/produkt.js` (Produkte, Open-Food-Facts-Antwort, Gruppen),
  `js/einkauf.js` (Einkaufsliste, Zuordnung beim Scan), `js/barcode.js` (Prüfziffer), `js/backup.js` (Sicherung prüfen/erzeugen).
- Mit Browser verbunden: `js/db.js` (IndexedDB Version 2: `vorrat`, `produkte`, `einkauf`, `einstellungen`;
  `schreibeAlles` schreibt mehrere Tabellen in einem Rutsch), `js/off.js` (Netzwerk), `js/scanner.js` (Kamera), `js/sicherung.js`.
- Scan-Ablauf `js/screens/scan.js` hat drei Betriebsarten: `vorrat`, `liste`, `einkaufen`.
- Bibliotheken lokal in `lib/` (MIT und Apache-2.0, siehe `lib/README.md`).

## Tests
- `npm test`: 114 Logik-Tests im Ordner `tests/` (Node, keine Installation nötig).
- Browser-Tests im Handy-Format (390 px): `python -m http.server 8080` im Projektordner starten, dann
  `node tools/browser-test.mjs tools/<seite>.html [bild.png]` mit `browser-test.html` (Vorrat, 12 Prüfungen),
  `scan-test.html` (Scan, 26, braucht Internet), `backup-test.html` (Sicherung, 28), `einkauf-test.html` (Einkaufsliste, 60,
  inkl. Umstellung der Datenbank von Version 1 auf 2). Das Skript startet Edge unsichtbar und beendet ihn selbst.
  Danach den Testserver wieder beenden.

## So veröffentlichst du eine Änderung
1. In `sw.js` `VERSION` hochzählen und in `js/version.js` `APP_VERSION` auf denselben Wert (ein Test prüft das).
   Neue App-Dateien in die Liste `ASSETS` in `sw.js` eintragen (ein Test meldet vergessene Dateien).
2. `npm test`, dann `git add -A`, `git commit`, `git push`. Nach ca. 1 Minute ist die Version online.
3. Am iPhone: App öffnen, kurz warten, ganz schließen, neu öffnen. Version steht unten in Mehr.

## Entscheidungen und Erkenntnisse
- Produktsuche im Internet (Open Food Facts) geht aus der App heraus NICHT (geprüft am 06.11.2026): die klassische
  Such-Schnittstelle liefert Fehler 503, die neue (search.openfoodfacts.org) erlaubt keine Anfragen von fremden Webseiten (CORS).
  Nur mit eigenem Vermittler-Server möglich, der gegen „kein Server, keine Kosten" geht. Nur nach Rückfrage. Bis dahin:
  Produkte kommen per Scan oder Barcode-Eintippen in die App, die Liste sucht in diesen eigenen Produkten. Die Regel
  „nur der Barcode verlässt das Handy" bleibt.
- Einkaufsliste: Gescannte Einträge werden von der Liste GENOMMEN (nicht nur abgehakt), sonst würde „Abgehakte einräumen"
  das Produkt vom Zettel zusätzlich in den Vorrat legen.
- Import einer Sicherung ersetzt alle Daten (kein Mischen).

## Offen / Bekanntes
- Phase 2: Test am iPhone (Liste füllen, abhaken, einräumen, Einkauf scannen mit Ersatz-Frage, Sicherung).
- Design bewusst schlicht, kommt in Phase 6.
- Open-Food-Facts-Daten sind nicht immer vollständig; dann im Prüf-Formular ergänzen.
- Daten liegen nur im Browser-Speicher des iPhones: regelmäßig sichern (Datei z. B. in iCloud Drive).
- Idee für später: leere Vorräte direkt „auf die Liste" (Phase 3 macht das für fehlende Rezept-Zutaten).
