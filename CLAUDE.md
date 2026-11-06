# Koch- & Einkaufs-App

Aktueller Stand: @STAND.md

## Worum es geht
Persönliche App für einen Nutzer (Justin), nur am iPhone. Einkäufe werden per Barcode in den
Vorrat gescannt, die App schlägt Rezepte aus dem Vorrat vor, beim Kochen werden die Zutaten
abgezogen, und ein Tagebuch zählt Kalorien und Nährwerte gegen ein persönliches Tagesziel.
Der Nutzer hat keine Programmiererfahrung: Antworten auf Deutsch, einfach erklärt, Schritt für Schritt.

## Fertig, wenn (Vorschlag, mit dem Nutzer abstimmen)
- Einkäufe landen per Barcode-Scan mit Menge im Vorrat
- „Was koche ich?“ zeigt Rezepte, für die alles da ist, und solche, bei denen 1–2 Zutaten fehlen
- Nach dem Kochen sind die Zutaten abgezogen, Reste stehen als Portionen im Vorrat
- Das Tagebuch zeigt Kalorien, Eiweiß, Kohlenhydrate und Fett gegen ein Tagesziel aus eigenen Daten

## Architektur (entschieden)
- **Web-App (PWA)**, die der Nutzer auf dem iPhone zum Home-Bildschirm hinzufügt. Offline-fähig.
- **Kein eigener Server.** Alle Daten liegen auf dem Handy im Browser-Speicher (IndexedDB).
- **Hosting:** statisch und kostenlos (z. B. GitHub Pages). HTTPS ist Pflicht, sonst gibt es keine Kamera.
- **Keine Kosten:** nur kostenlose Dienste und Bibliotheken.
- **Barcode:** über eine JS-Bibliothek mit der Kamera (Safari auf dem iPhone hat keinen eingebauten Barcode-Scanner im Browser).
  Entschieden und eingebaut: `barcode-detector` 3.2.3 (MIT) mit `zxing-wasm` 3.1.6 (MIT) und ZXing-C++ (Apache-2.0),
  lokal in `lib/`, Details und Lizenztexte in `lib/README.md`. Kein CDN.
- **Produktdaten:** Open Food Facts (Name, Packungsgröße, Nährwerte). Fehlt ein Produkt, trägt der Nutzer es von Hand ein und die App merkt es sich.
- **Lose Zutaten** (Zwiebel, Hähnchenbrust): eingebaute Tabelle mit Standard-Nährwerten aus einer frei nutzbaren Quelle (z. B. USDA FoodData Central; Lizenz vorher prüfen und hier eintragen).
- **Sicherung:** Export und Import als Datei per Knopfdruck. Hinweis in der App, wenn die letzte Sicherung älter als 7 Tage ist.

## Datenmodell (Grundgerüst)
- **Produkt:** Barcode, Name, Packungsgröße, Einheit, Nährwerte pro 100 g/ml, Gruppe (Produkte mit gleicher Gruppe gelten als
  gleichwertig, z. B. andere Marke, gleiches Produkt)
- **Einkaufsliste:** Eintrag ist ein Produkt (Marke, Barcode, Anzahl Packungen) oder Freitext ohne Marke (Menge, Einheit); abgehakt ja/nein.
  Gescannte Produkte werden von der Liste genommen, in den Vorrat kommt immer das gescannte Produkt.
- **Vorrat:** Produkt oder lose Zutat, Menge, Einheit, Ablaufdatum (optional), Art = `menge` oder `da_leer`
- **Rezept:** Name, Portionen, Zutaten (Zutat, Menge, Einheit, optional ja/nein), Schritte, Quelle
- **Mahlzeit:** Datum, Rezept oder Produkt, gegessene Menge/Portion, Nährwerte
- **Rest:** Rezept, Portionen übrig, gekocht am
- **Einstellungen:** Körperdaten für das Tagesziel, Tagesziel, letzte Sicherung

## Mengen-Regel (entschieden)
- Gramm, Milliliter oder Stück für alles, was ein Rezept abmisst (Nudeln, Fleisch, Milch, Eier).
- Nur „da / leer“ für Gewürze, Öl, Salz und Ähnliches. Diese werden beim Kochen nicht abgezogen.
- Packungsgröße kommt beim Scan aus Open Food Facts, der Nutzer korrigiert nur bei Bedarf.

## Rezepte (entschieden)
1. Eigene Rezepte: eintippen in der App oder Claude Code baut sie aus Text oder Foto als Rezeptdatei.
2. Startpaket: 20–30 einfache Alltagsrezepte auf Deutsch, eigene Texte.
3. Import per Link: Rezeptseiten enthalten meist maschinenlesbare Rezeptdaten (schema.org/Recipe).
   Wegen der Browser-Sicherheit (CORS) kann die App fremde Seiten nicht selbst abrufen. Deshalb läuft
   der Import zunächst am PC: Der Nutzer gibt Claude Code den Link, Claude Code erzeugt die Rezeptdatei,
   die App importiert sie. Ein Proxy oder Server kommt nur nach Rückfrage.

## Bildschirme (entschieden)
1. **Vorrat:** Was ist da, Mengen, Ablaufdatum, Scan-Knopf
2. **Einkaufsliste:** Abhaken im Laden, Gekauftes per Scan oder Haken in den Vorrat
3. **Was koche ich?:** alles da / 1–2 fehlen (Knopf „auf die Einkaufsliste“)
4. **Kochen:** Schritt für Schritt, am Ende Portionen gesamt und gegessene Portionen, Zutaten werden abgezogen, Rest wird gespeichert
5. **Tagebuch:** Mahlzeiten, Snacks, Essen außer Haus (auch per Barcode), Tageswerte gegen Ziel
6. **Einstellungen:** Körperdaten, Tagesziel, Sicherung, eigene Rezepte

## Tagesziel
- Berechnung aus den Daten des Nutzers (Alter, Größe, Gewicht, Aktivität, Ziel) mit einer
  anerkannten Formel (z. B. Mifflin-St-Jeor) und Aktivitätsfaktor. Formel in der App erklären.
- Der Nutzer kann das Ziel von Hand anpassen.
- Keine extremen Vorgaben: Das vorgeschlagene Ziel liegt nie unter dem berechneten Grundumsatz,
  ein Defizit bleibt moderat. Die App bewertet Essen nicht moralisch („gut/schlecht“), sie zeigt Zahlen.

## Phasen
1. Gerüst, Hosting, Vorrat, Barcode-Scan mit Open Food Facts, Sicherung
2. Einkaufsliste
3. Rezepte (eigene, Startpaket, Import am PC) und „Was koche ich?“
4. Kochen-Modus mit Abziehen und Resten
5. Tagebuch und Tagesziel
6. Feinschliff: Ablaufdatum-Hinweise (bald ablaufende Zutaten zuerst vorschlagen), Design

Jede Phase endet mit einem Test am echten iPhone, bevor die nächste beginnt.

## Regeln
- Nur kostenlose Dienste. Keine Zugangsdaten nötig; falls doch, nur in `.env`, nie committen.
- Keine Daten verlassen das Handy außer den Anfragen an Open Food Facts (nur Barcode).
- Bedienung für eine Hand im Laden: große Knöpfe, wenig Tippen, funktioniert offline.
- Kleine, getestete Schritte. Nach jeder Änderung im Browser am Handy-Format prüfen.
- Am Ende jeder Sitzung `STAND.md` aktualisieren (ersetzen, nicht anhängen) und einen kurzen Block
  „TERMINAL-UPDATE“ ausgeben (Erledigt, Jetzt dran, Als Nächstes, Entscheidungen).
