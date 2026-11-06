# Stand

**Phase 1 ist abgeschlossen und am echten iPhone getestet** (Version v5).
Nächste Phase: 2 (Einkaufsliste).

## Wo läuft was
- App im Netz: https://jstncs.github.io/koch-app/ (GitHub Pages, Zweig `main`, Ordner `/`)
- Code: https://github.com/JSTNcs/koch-app (öffentlich; darin nur Code, keine Daten)
- Commits laufen unter JSTNcs mit der GitHub-„noreply"-Adresse, nicht mit der privaten E-Mail.

## Was Phase 1 kann
- 6 Bildschirme mit unterer Navigation (Vorrat, Einkauf, Was koche ich?, Kochen, Tagebuch, Mehr = Einstellungen).
  Nur Vorrat und Einstellungen sind gebaut, die anderen zeigen einen Platzhalter.
- Installierbar auf dem Home-Bildschirm, läuft offline (Service Worker `sw.js`).
- Vorrat: anlegen, Menge ändern (± 50 g/ml, ± 1 Stück), löschen. Art `menge` (g, ml, Stück) oder `da_leer` (Gewürze).
- Scan: Kamera liest Barcode, Open Food Facts liefert Name, Packungsgröße, Nährwerte (nur der Barcode geht raus).
  Unbekannte Produkte von Hand eintragen, die App merkt sie sich (Tabelle `produkte`, auch offline).
  Gleiches Produkt erneut: Menge wird addiert.
- Sicherung (Tab Mehr): Export über das Teilen-Menü oder als Download, Import mit Prüfung und Rückfrage (ersetzt alles),
  Hinweis im Vorrat, wenn die letzte Sicherung älter als 7 Tage ist oder fehlt.

## Wie der Code aufgebaut ist
- Kein Build-Schritt. `index.html` lädt `js/app.js`; Bildschirme in `js/screens/`, Routen in `js/routes.js`.
- Reine Logik (gut testbar): `js/pantry.js` (Vorrat, Mengen), `js/produkt.js` (Produkte, Open-Food-Facts-Antwort),
  `js/barcode.js` (Prüfziffer), `js/backup.js` (Sicherung prüfen/erzeugen).
- Mit Browser verbunden: `js/db.js` (IndexedDB: Tabellen `vorrat`, `produkte`, `einstellungen`),
  `js/off.js` (Netzwerk), `js/scanner.js` (Kamera), `js/sicherung.js`.
- Bibliotheken lokal in `lib/` (MIT und Apache-2.0, siehe `lib/README.md`).

## Tests
- `npm test`: 70 Logik-Tests im Ordner `tests/` (Node, keine Installation nötig; die Browser-Skripte in `tools/` laufen nicht dabei mit).
- Browser-Tests im Handy-Format (390 px): erst `python -m http.server 8080` im Projektordner starten, dann
  `node tools/browser-test.mjs tools/browser-test.html` (Vorrat, 12 Prüfungen),
  `tools/scan-test.html` (Scan, 26, braucht Internet) und `tools/backup-test.html` (Sicherung, 28).
  Das Skript startet Edge unsichtbar und beendet ihn danach selbst.

## So veröffentlichst du eine Änderung
1. In `sw.js` `VERSION` hochzählen und in `js/version.js` `APP_VERSION` auf denselben Wert (ein Test prüft das).
   Neue App-Dateien in die Liste `ASSETS` in `sw.js` eintragen (ein Test meldet vergessene Dateien).
2. `npm test`, dann `git add -A`, `git commit`, `git push`. Nach ca. 1 Minute ist die Version online.
3. Am iPhone: App öffnen, kurz warten, ganz schließen, neu öffnen. Version steht unten in Mehr.

## Offene Punkte / Bekanntes
- Design bewusst schlicht, kommt in Phase 6.
- Die gescannten Daten von Open Food Facts sind nicht immer vollständig (Packungsgröße oder Name können fehlen,
  dann trägt der Nutzer sie im Prüf-Formular nach).
- iOS kann die Kamera-Erlaubnis in der Home-Bildschirm-App gelegentlich neu abfragen.
- Daten liegen nur im Browser-Speicher des iPhones: regelmäßig sichern (Datei z. B. in iCloud Drive).
