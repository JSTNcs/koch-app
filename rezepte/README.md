# Rezepte: Format und Import

Die App liest Rezepte aus einer **Rezeptdatei** (JSON). Dieselbe Datei nutzt das Startpaket
(`daten/startpaket.json`, erzeugt aus `tools/baue-startpaket.mjs`) und jeder Import am PC.

## Wie kommt ein Rezept in die App?
1. **Eintippen** in der App: Mehr > Rezepte verwalten > „Rezept eintippen".
2. **Startpaket:** Mehr > Rezepte verwalten > „Startpaket" (28 Alltagsrezepte, eigene Texte).
3. **Aus einem Link** (am PC): `node tools/rezept-aus-link.mjs <Link>`. Das Programm liest die maschinenlesbaren
   Rezeptdaten der Seite (schema.org/Recipe), erkennt Zutatenzeilen wie „200 g Mehl" und schreibt
   `rezepte/importe/<name>.json`. Hinweise („Bitte prüfen") zeigt es im Terminal.
4. **Aus Text oder Foto:** Claude Code liest den Text oder das Foto und baut die Datei nach dem Format unten.
5. **Datei aufs iPhone:** AirDrop, iCloud Drive oder E-Mail an dich selbst, dann in der App
   Mehr > Rezepte verwalten > „Rezeptdatei". Die App zeigt vorher, was neu ist und was ersetzt wird.

## Urheberrecht und Datenschutz
- Importierte Rezepte sind **nur für deinen privaten Gebrauch**. Der Ordner `rezepte/importe/` steht in der
  `.gitignore`, die Dateien werden also **nicht** auf GitHub (öffentlich) hochgeladen. Nicht committen.
- Das Programm ruft nur die eine Seite ab, die du angibst, mit einem allgemeinen Programmnamen, ohne persönliche Angaben.
- Das Startpaket besteht aus eigenen Texten und darf im Repository liegen.

## Das Format
```json
{
  "format": "koch-app-rezepte",
  "version": 1,
  "rezepte": [
    {
      "id": "spaghetti-tomatensauce",
      "name": "Spaghetti mit Tomatensauce",
      "portionen": 2,
      "dauerMinuten": 25,
      "zutaten": [
        { "zutat": "Spaghetti", "menge": 200, "einheit": "g" },
        { "zutat": "Zwiebeln", "menge": 1, "einheit": "stk" },
        { "zutat": "Parmesan", "menge": 30, "einheit": "g", "optional": true },
        { "zutat": "Salz" },
        { "zutat": "Brühe", "notiz": "ca. 300 ml heiße Brühe" }
      ],
      "schritte": ["Zwiebel hacken und anbraten.", "Nudeln kochen."],
      "quelle": "https://beispiel.de/rezept"
    }
  ]
}
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | nein | Kennung. Fehlt sie, wird sie aus dem Namen gebaut. **Gleiche Kennung ersetzt** ein vorhandenes Rezept beim Einlesen. |
| `name` | ja | Name des Rezepts |
| `portionen` | ja | Ganze Zahl (1 oder mehr), für wie viele Portionen die Mengen gelten |
| `dauerMinuten` | nein | Ganze Zahl |
| `zutaten` | ja | Mindestens eine Zutat |
| `schritte` | ja | Mindestens ein Schritt, jeder Schritt ein Text |
| `quelle` | nein | Link oder Hinweis, woher das Rezept stammt |

**Zutat:** `zutat` (Name), dazu entweder `menge` und `einheit` (`g`, `ml` oder `stk`) **oder** keine Menge:
dann gilt die Zutat als „nach Bedarf" (Gewürze, Öl, Salz, Kräuter). `optional: true` markiert freiwillige Zutaten
(zählen beim „Was koche ich?" nie als fehlend). `notiz` ist ein freier Hinweis zur Anzeige.

## Zutatennamen
Die App kennt rund 100 übliche Zutaten (`js/zutaten.js`, mit Synonymen wie „Möhren" = „Karotten"). Damit ein
Rezept den passenden Vorrat findet, sollen die Zutatennamen aus dieser Liste kommen, zum Beispiel „Spaghetti",
„Hackfleisch", „Dosentomaten". Eine andere Zutat ist erlaubt, findet aber nur etwas im Vorrat, wenn bei dem
Produkt dieselbe Zutat eingetragen ist. Gewürze, Öl und Salz stehen in der Liste als „nach Bedarf".

## Mengen-Regel
Gemessen wird in Gramm, Milliliter oder Stück. EL, TL und Prise gibt es nicht als Einheit: Bei Gewürzen steht keine
Menge (die Angabe gehört in `notiz`), bei gemessenen Zutaten rechnet das Importprogramm ungefähr um (1 EL ≈ 15 g oder ml,
1 TL ≈ 5) und merkt sich die Originalangabe in `notiz`.
