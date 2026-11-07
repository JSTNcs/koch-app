# Stand

**Phase 1 bis 4 und Phase 5, Teil 1 (Tagesziel und Tagebuch, Version v9) sind abgeschlossen und am iPhone getestet.
Phase 5 ist in zwei Teile aufgeteilt (so entschieden): Als Nächstes kommt Teil 2 (siehe unten), mit eigenem Test am iPhone.**

## Wo läuft was
- App im Netz: https://jstncs.github.io/koch-app/ (GitHub Pages, Zweig `main`, Ordner `/`)
- Code: https://github.com/JSTNcs/koch-app (öffentlich; darin nur Code, keine Daten)
- Commits laufen unter JSTNcs mit der GitHub-„noreply"-Adresse, nicht mit der privaten E-Mail.

## Was die App kann
- 6 Bildschirme mit unterer Navigation, alle gebaut: Vorrat, Einkauf, Was koche ich?, Kochen, Tagebuch, Mehr (Einstellungen).
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
- **Kochen (Phase 4):**
  - Start über „🍳 Kochen" in der Rezeptansicht (Was koche ich?) oder im Tab Kochen (Rezept wählen, Portionen). Auch mit fehlenden Zutaten, mit Hinweis.
  - Ablauf: Zutaten bereitlegen (abhaken) → Schritte (ein Schritt pro Bildschirm, große Schrift, Bildschirm bleibt an per Wake Lock) →
    Portionen (insgesamt entstanden, gegessen, Rest) → Vorrat anpassen → Ergebnis mit „↩ Rückgängig".
  - Der Kochstand wird laufend gespeichert (`einstellungen`, Schlüssel `kochen`, nicht in der Sicherung): Nach einem Wechsel in eine andere
    App oder einem Tabwechsel geht es genau da weiter. „Kochen abbrechen" lässt den Vorrat unverändert.
  - Abzug (`js/kochen.js`, `planeAbzug`): Zutat über das Feld Zutat; bald ablaufende Einträge zuerst, bei gleichem Datum die kleinere Menge,
    ohne Datum zuletzt; leer gewordene Einträge werden entfernt; nie unter 0 (Hinweis „Es waren nur … da"); Mengen änderbar; Vorrat in anderer
    Einheit (Rezept „1 Zwiebel", Vorrat „1 kg"): Menge selbst eintragen oder überspringen; freiwillige Zutaten nur auf Wunsch;
    Gewürze/Öl/Salz werden nicht abgezogen, man kann sie auf „leer" setzen. Alles wird in EINER Transaktion gespeichert.
  - Reste: Tabelle `reste`, im Vorrat-Tab oben unter „🍲 Reste" mit Portionen und „heute/gestern/vor N Tagen gekocht", „1 Portion gegessen", „Entfernen".
  - Kochprotokoll: Tabelle `gekocht` (merkt den Vorrat vor dem Abzug, daher „Rückgängig"; Phase 5 nutzt die gegessenen Portionen).
- **Tagesziel (Phase 5, Teil 1)** unter Mehr > „🎯 Körperdaten und Tagesziel": Geschlecht, Geburtsjahr, Größe, Gewicht, Aktivität, Ziel → „Vorschlag berechnen"
  mit aufklappbarem Rechenweg („So wird gerechnet", mit den eigenen Zahlen) → vier Zahlen (kcal, Eiweiß, Kohlenhydrate, Fett) von Hand änderbar → Speichern
  (`einstellungen`, Schlüssel `profil`, `manuell` merkt, ob angepasst). Regeln und Formel: `js/tagesziel.js`, Zusammenfassung in CLAUDE.md.
- **Tagebuch (Phase 5, Teil 1):** Tagesansicht mit ◀ ▶ (nicht in die Zukunft), Summe und Balken gegen das Ziel (nur Zahlen, „Noch X kcal" oder „X kcal mehr
  als das Ziel", keine Wertung), Einträge gruppiert in Frühstück, Mittag, Abend, Snacks (Vorschlag nach Uhrzeit, änderbar). Eintragen per:
  „🥫 Aus dem Vorrat" (Menge, Nährwerte pro 100 g/ml oder pro Stück, Haken „aus dem Vorrat abziehen" vorangehakt, „Ganze Packung"), „📷 Scannen"
  (Scan-Ablauf mit `beiProdukt`, Nährwerte von Open Food Facts, Vorrat-Haken wenn das Produkt im Vorrat liegt), „✏️ Frei eintippen" (Essen außer Haus)
  und „Zuletzt gegessen" (Vorlage). Einträge ändern und löschen. Hat ein bekanntes Produkt noch keine Nährwerte, merkt es sich die eingetragenen.
  Fehlende Nährwerte zählen als 0 und der Eintrag bekommt „ca.".
- **Rezepte verwalten** (Mehr > „📖 Rezepte verwalten"): eintippen und ändern (Zutatenvorschläge, Einheit passend zur Zutat), löschen,
  **Startpaket** (28 Alltagsrezepte für 2 Portionen, gemischt mit Fleisch und Fisch, eigene Texte, `daten/startpaket.json`),
  **Rezeptdatei** einlesen (Rückfrage: was ist neu, was wird ersetzt; gleiche Kennung ersetzt).
- **Sicherung** (Mehr): Vorrat, Produkte, Einkaufsliste, Rezepte, Reste, Kochprotokoll; Export per Teilen-Menü oder Download, Import mit Prüfung und Rückfrage
  (ersetzt alles), Erinnerung nach über 7 Tagen. Ältere Sicherungen bleiben einlesbar.

## Rezepte am PC importieren
- `node tools/rezept-aus-link.mjs <Link>` liest die maschinenlesbaren Rezeptdaten (schema.org/Recipe) und schreibt
  `rezepte/importe/<name>.json`; „Bitte prüfen"-Hinweise im Terminal. Datei per AirDrop/iCloud/E-Mail aufs iPhone, in der App einlesen.
- Format und Ablauf: `rezepte/README.md`. Aus Text oder Foto baut Claude Code die Datei nach diesem Format.
- `rezepte/importe/` steht in der `.gitignore` (Urheberrecht, nie ins öffentliche Repository).
- Noch nicht an einer echten Rezeptseite ausprobiert (nur mit einer nachgebauten Testseite und Tests). Beim ersten echten Link prüfen.

## Wie der Code aufgebaut ist
- Kein Build-Schritt. `index.html` lädt `js/app.js`; Bildschirme in `js/screens/`, Routen in `js/routes.js`.
- Reine Logik (gut testbar): `js/tagesziel.js` (Grundumsatz, Vorschlag, Rechenweg), `js/tagebuch.js` (Einträge, Tage, Summen, Abziehen, zuletzt gegessen), `js/pantry.js` (Vorrat), `js/produkt.js` (Produkte, Open-Food-Facts-Antwort, Gruppen), `js/einkauf.js`
  (Liste, Zuordnung beim Scan), `js/zutaten.js` (Zutatenliste mit 99 Zutaten, Vorschlag), `js/rezepte.js` (Rezepte, Abgleich, Dateiformat),
  `js/kochen.js` (Abzug, Reste, Protokoll, Rückgängig), `js/barcode.js`, `js/backup.js`.
- Mit Browser verbunden: `js/db.js` (IndexedDB Version 5: `vorrat`, `produkte`, `einkauf`, `rezepte`, `reste`, `gekocht`, `tagebuch`, `einstellungen`; `schreibeAlles` schreibt
  mehrere Tabellen in einem Rutsch), `js/off.js`, `js/scanner.js`, `js/sicherung.js`, `js/rezeptspeicher.js`, `js/zutaten-ui.js`, `js/kochstand.js` (laufender Kochvorgang), `js/wachhalten.js`, `js/profil.js` (Körperdaten).
- Scan-Ablauf `js/screens/scan.js` hat drei Betriebsarten: `vorrat`, `liste`, `einkaufen`.
- PC-Werkzeuge in `tools/`: `rezeptimport.mjs`, `rezept-aus-link.mjs`, `baue-startpaket.mjs` (Quelle des Startpakets: danach
  `node tools/baue-startpaket.mjs` ausführen), `make-icons.mjs`, Browser-Tests.
- Bibliotheken lokal in `lib/` (MIT und Apache-2.0, siehe `lib/README.md`).

## Tests
- `npm test`: 253 Logik-Tests im Ordner `tests/` (Node, keine Installation nötig).
- Browser-Tests im Handy-Format (390 px): `python -m http.server 8080` im Projektordner starten, dann
  `node tools/browser-test.mjs tools/<seite>.html [bild.png]` mit `browser-test.html` (Vorrat, 12 Prüfungen), `scan-test.html` (Scan, 26,
  braucht Internet), `backup-test.html` (Sicherung, 28), `einkauf-test.html` (Einkaufsliste, 60), `rezepte-test.html` (Rezepte, 61, inkl.
  Umstellung der Datenbank von Version 2 auf 3), `kochen-test.html` (Kochen, 57, inkl. Umstellung von Version 3 auf 4), `tagebuch-test.html` (Tagesziel und Tagebuch, 63, inkl. Umstellung von Version 4 auf 5). Das Skript startet Edge unsichtbar und beendet ihn selbst. Danach den Testserver beenden.
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
- Phase 4 (mit dem Nutzer entschieden): beim Abzug bald ablaufende Einträge zuerst, dann die angebrochene (kleinere Menge); leer gewordene Einträge
  werden automatisch entfernt (mit „Rückgängig" zurückholbar); Kochen ist auch bei fehlenden Zutaten erlaubt (Hinweis). Reste stehen als eigener
  Bereich oben im Vorrat. Keine Timer in den Schritten (Idee für später).
- Zutaten im Rezept in EL/TL/Prise gibt es nicht: Gewürze „nach Bedarf" (Menge als Hinweis), gemessene Zutaten rechnet der Import ungefähr um.

- Phase 5 (mit dem Nutzer entschieden): Aufteilung in Teil 1 (Tagesziel, Tagebuch mit Vorrat, Scan, frei, zuletzt gegessen) und Teil 2; Nährwerte für Rezepte aus einer
  eingebauten USDA-Tabelle plus eigenen Produktdaten (eigene haben Vorrang); gekochte Portionen kommen automatisch ins Tagebuch (vorangehakt, mit Hinweis und
  Rückgängig); Essen aus dem Vorrat zieht ab (mit Haken zum Abwählen).

## Phase 5, Teil 2 (nächster Schritt, noch nicht gebaut; Details vor dem Bauen mit dem Nutzer abstimmen)
- **Nährwert-Tabelle** für die 99 Zutaten aus `js/zutaten.js`: Quelle USDA FoodData Central, **Lizenz geprüft am 07.11.2026: gemeinfrei, CC0 1.0** (laut USDA
  „public domain, not copyrighted"; Zitat: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov). Dateien frei
  abrufbar, z. B. `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip` (6 MB) und `..._foundation_food_csv_2025-12-18.zip`.
  Plan: Skript `tools/baue-naehrwerte.mjs` ordnet jede Zutat einem USDA-Eintrag zu (Zuordnung mit ID im Skript dokumentieren) und schreibt `daten/naehrwerte.json`
  (pro 100 g: kcal, Eiweiß, Kohlenhydrate, Fett; dazu Gewicht pro Stück und Dichte bei ml). Lizenz dann in CLAUDE.md bei „Lose Zutaten" eintragen.
- **Rezept-Nährwerte pro Portion** (Näherung, „ca."): Summe der Zutaten (Produktdaten des Nutzers haben Vorrang vor der Tabelle). Für „nach Bedarf"-Öl feste Richtmenge
  (ca. 5 g pro Portion), sonst fehlt es in der Rechnung.
- **Anbindung:** Am Ende des Kochens vorangehakter Punkt „Gegessene Portionen ins Tagebuch" (nutzt das Kochprotokoll), bei „Reste: 1 Portion gegessen" automatischer Eintrag
  mit Hinweis und Rückgängig. Außerdem Stück-Gewichte für Vorrats-Snacks (Eier, Bananen), damit die Nährwerte vorausgefüllt sind.

## Offen / Bekanntes
- Nichts offen aus Phase 1 bis 5 Teil 1.
- Echter Link-Import noch nicht an einer echten Seite geprüft; manche Seiten blockieren Programme (dann Text oder Foto an Claude Code).
- Einheiten werden nicht umgerechnet (Zwiebel in Stück gegen kg im Vorrat: „unklar"). Möglich später: Gewichte pro Stück je Zutat.
- Design bewusst schlicht, kommt in Phase 6. Bei vielen Rezepten ist die Gruppe „1–2 fehlen" lang; Sortierung nach ablaufenden Zutaten kommt in Phase 6.
- Open-Food-Facts-Daten sind nicht immer vollständig; dann im Prüf-Formular ergänzen.
- Daten liegen nur im Browser-Speicher des iPhones: regelmäßig sichern (Datei z. B. in iCloud Drive).
- Idee für später: leere Vorräte direkt „auf die Liste".
