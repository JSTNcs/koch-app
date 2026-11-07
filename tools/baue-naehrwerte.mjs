// Baut daten/naehrwerte.json aus den USDA-Daten (FoodData Central, SR Legacy, April 2018).
//
// Aufruf:  node tools/baue-naehrwerte.mjs <Ordner mit den entpackten CSV-Dateien>
// Die Daten laden:  https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
//
// Lizenz: USDA FoodData Central ist gemeinfrei (CC0 1.0 Universal), geprüft am 07.11.2026.
// Zitat:  U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov.
//
// Alle Werte gelten pro 100 g im rohen oder trockenen Zustand, so wie Rezepte die Mengen angeben (Nudeln und Reis trocken).
// Die Zuordnung "Zutat der App -> USDA-Eintrag" steht unten. Stückgewichte sind Richtwerte (übliche Größen), keine USDA-Werte.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ZUTATEN } from '../js/zutaten.js';

const ordner = process.argv[2];
if (!ordner) {
  console.error('Bitte den Ordner mit den entpackten USDA-Dateien angeben.');
  process.exit(1);
}

// [Zutat der App, USDA-Nummer (fdc_id), erwarteter USDA-Name (zur Kontrolle), Gewicht pro Stück in g, Dichte g/ml, Richtmenge g pro Portion]
const Z = (zutat, fdcId, usda, stueckG = null, dichte = null, richtmengeG = null) => ({ zutat, fdcId, usda, stueckG, dichte, richtmengeG });
const ZUORDNUNG = [
  // Nudeln, Reis, Getreide, Brot
  Z('Spaghetti', 169736, 'Pasta, dry, enriched'),
  Z('Penne', 169736, 'Pasta, dry, enriched'),
  Z('Nudeln', 169736, 'Pasta, dry, enriched'),
  Z('Lasagneplatten', 169736, 'Pasta, dry, enriched'),
  Z('Reis', 168877, 'Rice, white, long-grain, regular, raw, enriched'),
  Z('Risottoreis', 168879, 'Rice, white, medium-grain, raw, enriched'),
  Z('Couscous', 169699, 'Couscous, dry'),
  Z('Haferflocken', 173904, 'Cereals, oats, regular and quick, not fortified, dry'),
  Z('Mehl', 168894, 'Wheat flour, white, all-purpose, enriched, bleached'),
  Z('Brot', 167532, 'Bread, white wheat', 35),
  Z('Wraps', 167535, 'Tortillas, ready-to-bake or -fry, flour, shelf stable', 60),
  Z('Semmelbrösel', 174928, 'Bread, crumbs, dry, grated, plain'),
  Z('Kartoffeln', 170026, 'Potatoes, flesh and skin, raw'),
  // Gemüse und Hülsenfrüchte
  Z('Zwiebeln', 170000, 'Onions, raw', 90),
  Z('Knoblauch', 169230, 'Garlic, raw', 4),
  Z('Karotten', 170393, 'Carrots, raw', 80),
  Z('Paprika', 170108, 'Peppers, sweet, red, raw', 150),
  Z('Tomaten', 170457, 'Tomatoes, red, ripe, raw, year round average', 100),
  Z('Dosentomaten', 170051, 'Tomatoes, red, ripe, canned, packed in tomato juice'),
  Z('Passierte Tomaten', 170460, 'Tomato products, canned, puree, without salt added'),
  Z('Gurke', 168409, 'Cucumber, with peel, raw', 350),
  Z('Zucchini', 169291, 'Squash, summer, zucchini, includes skin, raw', 250),
  Z('Brokkoli', 170379, 'Broccoli, raw'),
  Z('Blumenkohl', 169986, 'Cauliflower, raw'),
  Z('Spinat', 168462, 'Spinach, raw'),
  Z('Champignons', 169251, 'Mushrooms, white, raw'),
  Z('Lauch', 169246, 'Leeks, (bulb and lower leaf-portion), raw', 200),
  Z('Frühlingszwiebeln', 170005, 'Onions, spring or scallions (includes tops and bulb), raw', 15),
  Z('Aubergine', 169228, 'Eggplant, raw', 300),
  Z('Mais', 169214, 'Corn, sweet, yellow, canned, whole kernel, drained solids'),
  Z('Erbsen', 170016, "Peas, green, frozen, unprepared (Includes foods for USDA's Food Distribution Program)"),
  Z('Kichererbsen', 173800, 'Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained solids'),
  Z('Kidneybohnen', 174285, 'Beans, kidney, red, mature seeds, canned, drained solids'),
  Z('Linsen', 172420, 'Lentils, raw'),
  Z('Salat', 169248, 'Lettuce, iceberg (includes crisphead types), raw', 450),
  Z('Ingwer', 169231, 'Ginger root, raw'),
  Z('Süßkartoffeln', 168482, "Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)", 200),
  Z('Kürbis', 170489, 'Squash, winter, all varieties, raw'),
  Z('Tiefkühlgemüse', 170471, 'Vegetables, mixed, frozen, unprepared'),
  // Obst
  Z('Äpfel', 171688, "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)", 180),
  Z('Bananen', 173944, 'Bananas, raw', 118),
  Z('Zitrone', 167746, 'Lemons, raw, without peel', 60),
  // Fleisch und Fisch
  Z('Hähnchenbrust', 171077, 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw'),
  Z('Hähnchenschenkel', 173614, 'Chicken, broilers or fryers, dark meat, drumstick, meat only, raw'),
  Z('Putenbrust', 171098, 'Turkey, whole, breast, meat only, raw'),
  Z('Hackfleisch', 174036, 'Beef, ground, 80% lean meat / 20% fat, raw'),
  Z('Schweinefilet', 168249, 'Pork, fresh, loin, tenderloin, separable lean only, raw'),
  Z('Rindfleisch', 171206, 'Beef, chuck for stew, separable lean and fat, all grades, raw'),
  Z('Speck', 168277, 'Pork, cured, bacon, unprepared'),
  Z('Schinken', 173864, 'Ham, sliced, regular (approximately 11% fat)'),
  Z('Würstchen', 172968, 'Frankfurter, meat', 50),
  Z('Lachs', 175167, 'Fish, salmon, Atlantic, farmed, raw'),
  Z('Thunfisch', 173709, "Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)"),
  Z('Fischstäbchen', 174195, 'Fish, fish sticks, frozen, prepared', 30),
  Z('Garnelen', 174210, 'Crustaceans, shrimp, mixed species, raw (may contain additives to retain moisture)'),
  // Milch, Eier, Käse
  Z('Milch', 171265, 'Milk, whole, 3.25% milkfat, with added vitamin D', null, 1.03),
  Z('Sahne', 170858, 'Cream, fluid, light whipping', null, 1.01),
  Z('Butter', 173410, 'Butter, salted'),
  Z('Eier', 171287, 'Egg, whole, raw, fresh', 50),
  Z('Joghurt', 171284, 'Yogurt, plain, whole milk'),
  Z('Quark', 172182, 'Cheese, cottage, lowfat, 2% milkfat'),
  Z('Käse', 171241, 'Cheese, gouda'),
  Z('Parmesan', 170848, 'Cheese, parmesan, hard'),
  Z('Mozzarella', 170845, 'Cheese, mozzarella, whole milk'),
  Z('Feta', 173420, 'Cheese, feta'),
  Z('Frischkäse', 173418, 'Cheese, cream'),
  Z('Crème fraîche', 171257, 'Cream, sour, cultured'),
  Z('Schmand', 171257, 'Cream, sour, cultured'),
  Z('Kokosmilch', 170173, 'Nuts, coconut milk, canned (liquid expressed from grated meat and water)', null, 0.97),
  // Vorrat, gemessen
  Z('Zucker', 169655, 'Sugars, granulated'),
  Z('Honig', 169640, 'Honey'),
  Z('Speisestärke', 169698, 'Cornstarch'),
  Z('Pesto', 171579, 'Sauce, pesto, ready-to-serve, refrigerated'),
  // "Nach Bedarf" mit nennenswerten Kalorien: feste Richtmenge in g pro Portion (geschätzt)
  Z('Öl', 172336, 'Oil, canola', null, 0.92, 5),
  Z('Olivenöl', 171413, 'Oil, olive, salad or cooking', null, 0.91, 5),
  Z('Mayonnaise', 171009, 'Salad dressing, mayonnaise, regular', null, null, 10),
];

// ---- USDA-Dateien lesen ----
const zeilen = (name) => readFileSync(join(ordner, name), 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
const gebraucht = new Set(ZUORDNUNG.map((z) => String(z.fdcId)));

const namen = new Map();
for (const z of zeilen('food.csv')) {
  const m = z.match(/^"([^"]*)","([^"]*)","((?:[^"]|"")*)"/);
  if (m && gebraucht.has(m[1])) namen.set(m[1], m[3].replace(/""/g, '"'));
}

// Nährstoff-Nummern: 1008 Energie (kcal), 1003 Eiweiß, 1005 Kohlenhydrate, 1004 Fett
const FELD = { 1008: 'kcal', 1003: 'eiweiss', 1005: 'kohlenhydrate', 1004: 'fett' };
const werte = new Map();
for (const z of zeilen('food_nutrient.csv')) {
  const m = z.match(/^"[^"]*","([^"]*)","([^"]*)","([^"]*)"/);
  if (!m || !gebraucht.has(m[1]) || !FELD[m[2]]) continue;
  if (!werte.has(m[1])) werte.set(m[1], {});
  werte.get(m[1])[FELD[m[2]]] = Math.round(Number(m[3]) * 10) / 10;
}

// ---- Prüfen und schreiben ----
const fehler = [];
const zutaten = {};
for (const z of ZUORDNUNG) {
  const id = String(z.fdcId);
  if (namen.get(id) !== z.usda) fehler.push(`${z.zutat}: USDA ${id} heißt "${namen.get(id)}", erwartet "${z.usda}"`);
  const w = werte.get(id) ?? {};
  for (const f of Object.values(FELD)) if (typeof w[f] !== 'number' || Number.isNaN(w[f])) fehler.push(`${z.zutat}: Wert "${f}" fehlt`);
  zutaten[z.zutat] = { fdcId: z.fdcId, usda: z.usda, kcal: w.kcal, eiweiss: w.eiweiss, kohlenhydrate: w.kohlenhydrate, fett: w.fett, stueckG: z.stueckG, dichte: z.dichte, richtmengeG: z.richtmengeG };
}

// Jede gemessene Zutat der App braucht einen Eintrag
const vorhanden = new Set(ZUORDNUNG.map((z) => z.zutat));
for (const z of ZUTATEN) if (z.art === 'menge' && !vorhanden.has(z.name)) fehler.push(`Zutat der App ohne Zuordnung: ${z.name}`);
for (const z of ZUORDNUNG) if (!ZUTATEN.some((k) => k.name === z.zutat)) fehler.push(`Zuordnung für unbekannte Zutat: ${z.zutat}`);
for (const z of ZUTATEN) if (z.art === 'menge' && z.einheit === 'stk' && !zutaten[z.name]?.stueckG) fehler.push(`Kein Stückgewicht für ${z.name}`);

if (fehler.length) {
  console.error('Fehler:\n- ' + fehler.join('\n- '));
  process.exit(1);
}

const datei = {
  quelle: 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov (SR Legacy, April 2018)',
  lizenz: 'Gemeinfrei, CC0 1.0 Universal (geprüft am 07.11.2026)',
  hinweis: 'Alle Werte pro 100 g, roh bzw. trocken. stueckG und richtmengeG sind Richtwerte. dichte in g pro ml. richtmengeG: feste Menge pro Portion für Zutaten "nach Bedarf" (geschätzt).',
  zutaten,
};
mkdirSync('daten', { recursive: true });
writeFileSync('daten/naehrwerte.json', JSON.stringify(datei, null, 2) + '\n');
console.log(`${Object.keys(zutaten).length} Zutaten nach daten/naehrwerte.json geschrieben.`);
