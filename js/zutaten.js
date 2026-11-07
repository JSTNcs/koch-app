// Eingebaute Zutatenliste und Vorschlag "Welche Zutat ist das?". Reine Logik.
//
// Eine Zutat ist der allgemeine Name, den Rezepte benutzen ("Spaghetti"). Produkte im Vorrat haben Marken
// ("Barilla Spaghetti N.5"). Damit ein Rezept jede Marke findet, hat jedes Produkt eine Zutat.
//
// art "menge":   wird gemessen (g, ml oder Stück)
// art "da_leer": Gewürze, Öl, Salz und Ähnliches: nur "da" oder "leer"

const m = (name, einheit, ...synonyme) => ({ name, art: 'menge', einheit, synonyme });
const d = (name, ...synonyme) => ({ name, art: 'da_leer', einheit: null, synonyme });

export const ZUTATEN = [
  // Nudeln, Reis, Getreide, Brot
  m('Spaghetti', 'g', 'Spaghettini', 'Spaghetti N.5'),
  m('Penne', 'g', 'Penne Rigate'),
  m('Nudeln', 'g', 'Fusilli', 'Farfalle', 'Makkaroni', 'Rigatoni', 'Tagliatelle', 'Bandnudeln', 'Spirelli', 'Hörnchennudeln', 'Eiernudeln', 'Pasta', 'Maccheroni', 'Orecchiette', 'Linguine'),
  m('Lasagneplatten', 'g', 'Lasagne Platten'),
  m('Reis', 'g', 'Basmatireis', 'Langkornreis', 'Jasminreis', 'Parboiled Reis', 'Rundkornreis'),
  m('Risottoreis', 'g', 'Arborio', 'Arborio Reis'),
  m('Couscous', 'g'),
  m('Haferflocken', 'g', 'Haferflocken Zart', 'Kernige Haferflocken'),
  m('Mehl', 'g', 'Weizenmehl', 'Mehl Type 405', 'Type 405', 'Dinkelmehl'),
  m('Brot', 'stk', 'Toastbrot', 'Vollkornbrot', 'Mischbrot', 'Toast'),
  m('Wraps', 'stk', 'Tortillas', 'Tortilla Wraps', 'Weizentortillas'),
  m('Semmelbrösel', 'g', 'Paniermehl', 'Panko'),
  m('Kartoffeln', 'g', 'Kartoffel', 'Speisekartoffeln', 'Festkochende Kartoffeln', 'Mehligkochende Kartoffeln'),
  // Gemüse und Hülsenfrüchte
  m('Zwiebeln', 'stk', 'Zwiebel', 'Speisezwiebeln', 'Gemüsezwiebel', 'Haushaltszwiebeln'),
  m('Knoblauch', 'stk', 'Knoblauchzehen', 'Knoblauchzehe'),
  m('Karotten', 'stk', 'Möhren', 'Karotte', 'Mohrrüben', 'Möhre'),
  m('Paprika', 'stk', 'Paprikaschoten', 'Spitzpaprika'),
  m('Tomaten', 'stk', 'Strauchtomaten', 'Cherrytomaten', 'Rispentomaten', 'Kirschtomaten', 'Cocktailtomaten'),
  m('Dosentomaten', 'g', 'Gehackte Tomaten', 'Stückige Tomaten', 'Tomaten in Dosen', 'Pizzatomaten', 'Geschälte Tomaten', 'Tomaten gehackt'),
  m('Passierte Tomaten', 'g', 'Tomaten passiert', 'Passata'),
  m('Gurke', 'stk', 'Salatgurke', 'Gurken'),
  m('Zucchini', 'stk', 'Zucchinis'),
  m('Brokkoli', 'g', 'Broccoli'),
  m('Blumenkohl', 'g'),
  m('Spinat', 'g', 'Blattspinat'),
  m('Champignons', 'g', 'Pilze', 'Champignon', 'Egerlinge'),
  m('Lauch', 'stk', 'Porree'),
  m('Frühlingszwiebeln', 'stk', 'Lauchzwiebeln'),
  m('Aubergine', 'stk', 'Auberginen'),
  m('Mais', 'g', 'Dosenmais', 'Gemüsemais', 'Zuckermais'),
  m('Erbsen', 'g', 'Tiefkühlerbsen', 'Gartenerbsen'),
  m('Kichererbsen', 'g'),
  m('Kidneybohnen', 'g', 'Kidney Bohnen', 'Rote Bohnen'),
  m('Linsen', 'g', 'Rote Linsen', 'Tellerlinsen', 'Berglinsen'),
  m('Salat', 'stk', 'Eisbergsalat', 'Kopfsalat', 'Romanasalat'),
  m('Ingwer', 'g'),
  m('Süßkartoffeln', 'stk', 'Süßkartoffel'),
  m('Kürbis', 'g', 'Hokkaido', 'Hokkaidokürbis'),
  m('Tiefkühlgemüse', 'g', 'TK Gemüse', 'Pfannengemüse', 'Buntes Gemüse'),
  // Obst
  m('Äpfel', 'stk', 'Apfel'),
  m('Bananen', 'stk', 'Banane'),
  m('Zitrone', 'stk', 'Zitronen'),
  // Fleisch und Fisch
  m('Hähnchenbrust', 'g', 'Hähnchenbrustfilet', 'Hühnerbrust', 'Hühnchenbrust', 'Geflügelbrust', 'Hähnchenfilet'),
  m('Hähnchenschenkel', 'g', 'Hühnerschenkel', 'Hähnchenkeulen'),
  m('Putenbrust', 'g', 'Putenschnitzel', 'Putenfilet'),
  m('Hackfleisch', 'g', 'Hack', 'Rinderhack', 'Rinderhackfleisch', 'Gehacktes', 'Gemischtes Hack', 'Hackfleisch gemischt', 'Schweinehack'),
  m('Schweinefilet', 'g', 'Schweineschnitzel'),
  m('Rindfleisch', 'g', 'Rindergulasch', 'Gulasch', 'Rinderstreifen', 'Rinderbraten'),
  m('Speck', 'g', 'Speckwürfel', 'Bacon', 'Frühstücksspeck', 'Schinkenspeck', 'Bauchspeck'),
  m('Schinken', 'g', 'Kochschinken', 'Schinkenwürfel', 'Katenschinken'),
  m('Würstchen', 'stk', 'Wiener Würstchen', 'Wiener', 'Bockwurst', 'Bratwurst'),
  m('Lachs', 'g', 'Lachsfilet', 'Räucherlachs'),
  m('Thunfisch', 'g', 'Thunfisch Dose', 'Thunfisch in Wasser', 'Thunfisch in Öl'),
  m('Fischstäbchen', 'stk'),
  m('Garnelen', 'g', 'Shrimps', 'Scampi'),
  // Milch, Eier, Käse
  m('Milch', 'ml', 'Vollmilch', 'Frischmilch', 'H-Milch', 'Milch 3,5%', 'Fettarme Milch', 'Haltbare Milch', 'Kuhmilch'),
  m('Sahne', 'ml', 'Schlagsahne', 'Kochsahne', 'Sahne zum Kochen'),
  m('Butter', 'g', 'Süßrahmbutter', 'Markenbutter'),
  m('Eier', 'stk', 'Ei', 'Eier Freiland', 'Freilandeier', 'Bio Eier'),
  m('Joghurt', 'g', 'Naturjoghurt', 'Joghurt Natur', 'Griechischer Joghurt', 'Joghurt 3,5%'),
  m('Quark', 'g', 'Magerquark', 'Speisequark', 'Quark 20%'),
  m('Käse', 'g', 'Gouda', 'Emmentaler', 'Reibekäse', 'Geriebener Käse', 'Schnittkäse', 'Edamer', 'Cheddar', 'Streukäse', 'Bergkäse'),
  m('Parmesan', 'g', 'Grana Padano', 'Parmigiano', 'Parmesan gerieben'),
  m('Mozzarella', 'g'),
  m('Feta', 'g', 'Hirtenkäse', 'Schafskäse', 'Salatkäse'),
  m('Frischkäse', 'g', 'Doppelrahmfrischkäse', 'Philadelphia', 'Frischkäse natur'),
  m('Crème fraîche', 'g', 'Creme Fraiche'),
  m('Schmand', 'g', 'Saure Sahne'),
  m('Kokosmilch', 'ml', 'Kokosnussmilch', 'Kokosmilch Dose'),
  // Vorrat, gemessen
  m('Zucker', 'g', 'Haushaltszucker', 'Kristallzucker', 'Raffinade'),
  m('Honig', 'g'),
  m('Speisestärke', 'g', 'Maisstärke', 'Stärke'),
  m('Pesto', 'g', 'Pesto Rosso', 'Basilikumpesto', 'Pesto Genovese'),
  // Gewürze, Öl, Salz und Ähnliches: nur da / leer
  d('Salz', 'Speisesalz', 'Jodsalz', 'Meersalz'),
  d('Pfeffer', 'Schwarzer Pfeffer', 'Pfeffer gemahlen'),
  d('Olivenöl', 'Olivenöl extra vergine', 'Olivenöl nativ'),
  d('Öl', 'Sonnenblumenöl', 'Rapsöl', 'Pflanzenöl', 'Speiseöl', 'Bratöl'),
  d('Essig', 'Balsamico', 'Balsamicoessig', 'Apfelessig', 'Weißweinessig', 'Rotweinessig', 'Haushaltsessig'),
  d('Paprikapulver', 'Paprika edelsüß', 'Paprika geräuchert'),
  d('Currypulver', 'Curry'),
  d('Oregano'),
  d('Basilikum'),
  d('Thymian'),
  d('Rosmarin'),
  d('Petersilie'),
  d('Muskat', 'Muskatnuss'),
  d('Zimt'),
  d('Chili', 'Chilipulver', 'Chiliflocken', 'Cayennepfeffer'),
  d('Kreuzkümmel', 'Cumin'),
  d('Brühe', 'Gemüsebrühe', 'Hühnerbrühe', 'Brühwürfel', 'Instantbrühe', 'Rinderbrühe'),
  d('Senf', 'Dijonsenf', 'Mittelscharfer Senf'),
  d('Ketchup', 'Tomatenketchup'),
  d('Sojasauce', 'Sojasoße', 'Soja Sauce'),
  d('Mayonnaise', 'Mayo'),
  d('Vanillezucker', 'Vanillinzucker'),
  d('Tomatenmark', 'Tomatenmark Tube'),
  d('Backpulver'),
  d('Lorbeer', 'Lorbeerblätter'),
  d('Italienische Kräuter', 'Pizzagewürz'),
];

// Kleinschreibung ohne Akzente und Umlaut-Punkte ("Günstig" -> "gunstig")
export function norm(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const woerter = (text) => norm(text).split(/[^a-z0-9]+/).filter(Boolean);

// Nachschlage-Tabellen (einmal gebaut): normalisierter Name oder Synonym -> Zutat
const VOLLE_NAMEN = new Map();
const SCHLUESSEL = []; // { woerter, zutat } für den Vorschlag
for (const z of ZUTATEN) {
  for (const k of [z.name, ...z.synonyme]) {
    VOLLE_NAMEN.set(norm(k), z);
    SCHLUESSEL.push({ woerter: woerter(k), zutat: z });
  }
}

export function findeZutat(name) {
  return VOLLE_NAMEN.get(norm(name)) || null;
}

// Vergleichsschlüssel: gleiche Zutat (auch über Synonyme) ergibt den gleichen Schlüssel.
export function schluessel(name) {
  const z = findeZutat(name);
  return norm(z ? z.name : name);
}

// Der Name der Zutat, wie er in Rezepten steht (aus der Liste, sonst wie eingegeben).
export function kanonName(name) {
  return findeZutat(name)?.name ?? String(name ?? '').trim();
}

function wortPasst(gesucht, wort) {
  if (wort === gesucht) return true;
  // Endungen wie Kartoffel/Kartoffeln erlauben, aber nicht "Milch" in "Buttermilch" oder "Reis" in "Reiswaffeln"
  return gesucht.length >= 4 && wort.startsWith(gesucht) && wort.length - gesucht.length <= 2;
}

// Schlägt anhand eines Produktnamens die Zutat vor (Name aus der Liste) oder gibt null zurück.
export function schlageZutatVor(text) {
  const w = woerter(text);
  if (!w.length) return null;
  let bester = null;
  let besterWert = 0;
  for (const { woerter: kw, zutat } of SCHLUESSEL) {
    if (!kw.every((g) => w.some((x) => wortPasst(g, x)))) continue;
    const wert = kw.join('').length; // je genauer (länger) der Treffer, desto besser
    if (wert > besterWert) {
      besterWert = wert;
      bester = zutat;
    }
  }
  return bester ? bester.name : null;
}

// { zutat, geraten }: gesetzt (vom Nutzer oder aus der Sicherung) oder aus dem Namen geraten.
export function zutatVonProdukt(produkt) {
  if (produkt.zutat) return { zutat: produkt.zutat, geraten: false };
  return { zutat: schlageZutatVor(produkt.name) || String(produkt.name ?? '').trim(), geraten: true };
}

// Zutat eines Vorratseintrags: eigene Angabe, dann Produkt, dann gleichwertiges Produkt (gleiche Gruppe), dann Vermutung.
export function zutatVonEintrag(eintrag, produkte) {
  if (eintrag.zutat) return { zutat: eintrag.zutat, geraten: false };
  const p = eintrag.barcode ? produkte.find((x) => x.barcode === eintrag.barcode) : null;
  if (p?.zutat) return { zutat: p.zutat, geraten: false };
  if (p?.gruppe) {
    const verwandt = produkte.find((x) => x.gruppe === p.gruppe && x.zutat);
    if (verwandt) return { zutat: verwandt.zutat, geraten: false };
  }
  return { zutat: schlageZutatVor(eintrag.name) || String(eintrag.name ?? '').trim(), geraten: true };
}
