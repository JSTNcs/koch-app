// Rezept-Import am PC (nicht Teil der App): Rezeptdaten aus einer Webseite lesen und in das Rezeptformat der App bringen.
// Viele Rezeptseiten enthalten maschinenlesbare Rezeptdaten (schema.org/Recipe als JSON-LD). Die lesen wir aus.
// Reine Logik ohne Netzwerk, damit sie testbar ist. Das Abrufen der Seite macht tools/rezept-aus-link.mjs.
import { findeZutat, schlageZutatVor, norm } from '../js/zutaten.js';

// ---------- Hilfen ----------
const ENTITAETEN = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function entschluessele(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITAETEN[n.toLowerCase()] ?? m);
}
// Block-Tags (Absatz, Zeilenumbruch ...) trennen Wörter, Format-Tags wie <b> verschwinden ohne Lücke
const bereinige = (text) =>
  entschluessele(
    String(text ?? '')
      .replace(/<\/?(?:p|br|li|div|ul|ol|h\d)[^>]*>/gi, ' ')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim();
const slug = (name) => norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const zahl = (t) => Number(String(t).replace(',', '.'));
const runde = (n) => Math.round(n * 100) / 100;

// ---------- Zutatenzeilen ----------
const BRUCH = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const BRUCH_ZEICHEN = Object.keys(BRUCH).join('');

// Einheiten, die sich genau umrechnen lassen
const GENAU = { kg: [1000, 'g'], g: [1, 'g'], gr: [1, 'g'], mg: [0.001, 'g'], l: [1000, 'ml'], ml: [1, 'ml'], cl: [10, 'ml'], dl: [100, 'ml'] };
// Stückartige Einheiten
const STUECK = new Set(['stück', 'stk', 'st', 'scheibe', 'scheiben', 'zehe', 'zehen', 'stange', 'stangen', 'kopf', 'köpfe', 'blatt', 'blätter']);
// Löffel: ungefähr 15 g / 5 g
const LOEFFEL = { el: 15, tl: 5 };
// Weiche Mengen: ungefähre Werte für gemessene Zutaten
const WEICH = { prise: 1, prisen: 1, msp: 1, messerspitze: 1, schuss: 20, handvoll: 30, bund: 30, zweig: 5, zweige: 5 };
// Behälter: Menge steht meist in Klammern ("1 Dose Tomaten (400 g)")
const BEHAELTER = new Set(['dose', 'dosen', 'packung', 'packungen', 'pck', 'pkg', 'becher', 'glas', 'gläser']);

const EINHEIT_RE = new RegExp(
  `^(${[...Object.keys(GENAU), ...STUECK, ...Object.keys(LOEFFEL), ...Object.keys(WEICH), ...BEHAELTER].sort((a, b) => b.length - a.length).join('|')})(?![a-zäöüß])\\.?`,
  'i'
);

function leseMenge(text) {
  // ca., etwa ... entfernen
  let rest = text.replace(/^(?:ca\.?|circa|etwa|ungefähr|zirka)\s*/i, '');
  rest = rest.replace(new RegExp(`(\\d)\\s*([${BRUCH_ZEICHEN}])`), '$1 $2');
  let m;
  if ((m = rest.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/))) {
    return { wert: zahl(m[2]), rest: rest.slice(m[0].length).trim(), bereich: `${m[1]}-${m[2]}` };
  }
  if ((m = rest.match(new RegExp(`^(\\d+)\\s+([${BRUCH_ZEICHEN}])`)))) {
    return { wert: Number(m[1]) + BRUCH[m[2]], rest: rest.slice(m[0].length).trim() };
  }
  if ((m = rest.match(/^(\d+)\s*\/\s*(\d+)/))) {
    return { wert: Number(m[1]) / Number(m[2]), rest: rest.slice(m[0].length).trim() };
  }
  if ((m = rest.match(new RegExp(`^([${BRUCH_ZEICHEN}])`)))) {
    return { wert: BRUCH[m[1]], rest: rest.slice(m[0].length).trim() };
  }
  if ((m = rest.match(/^(\d+(?:[.,]\d+)?)/))) {
    return { wert: zahl(m[1]), rest: rest.slice(m[0].length).trim() };
  }
  return null;
}

const KEIN_WASSER = /^(?:leitungs|mineral|kaltes|warmes|heißes|heisses|lauwarmes|kochendes)?\s*wasser$/i;

function kandidatenName(name) {
  return findeZutat(name)?.name ?? schlageZutatVor(name);
}

// Eine Zeile wie "200 g Mehl" wird zu 0, 1 oder 2 Zutaten im Rezeptformat.
export function parseZutatenzeile(zeile) {
  const text = bereinige(zeile);
  if (!text) return [];

  // "Salz und Pfeffer", "Salz, Pfeffer", "Salz & Pfeffer aus der Mühle": zwei Gewürze in einer Zeile
  if (!/^[\d½¼¾⅓⅔]/.test(text)) {
    const teile = text.split(/\s*(?:,|&|\bund\b)\s*/i).filter(Boolean);
    if (teile.length > 1 && teile.every((t) => kandidatenName(t))) return teile.flatMap((t) => parseZutatenzeile(t));
  }

  const menge = leseMenge(text);
  let rest = menge ? menge.rest : text;
  let einheitWort = null;
  let einheitText = '';
  if (menge) {
    const em = rest.match(EINHEIT_RE);
    if (em) {
      einheitWort = em[1].toLowerCase();
      einheitText = em[1];
      rest = rest.slice(em[0].length).trim();
    }
  }

  // Klammern: Mengenangabe ("(400 g)") oder Hinweis
  const notizen = [];
  let klammerMenge = null;
  rest = rest.replace(/\(([^)]*)\)/g, (_, inhalt) => {
    const km = inhalt.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
    if (km && !klammerMenge) klammerMenge = { wert: zahl(km[1]), einheit: km[2].toLowerCase() };
    else if (inhalt.trim()) notizen.push(inhalt.trim());
    return ' ';
  });
  // Hinweis nach dem Komma ("Zwiebeln, fein gewürfelt")
  const komma = rest.indexOf(',');
  if (komma >= 0) {
    const hinweis = rest.slice(komma + 1).trim();
    if (hinweis) notizen.push(hinweis);
    rest = rest.slice(0, komma);
  }
  const name = rest.replace(/\s+/g, ' ').replace(/^(?:von|vom|der|die|das)\s+/i, '').trim();
  if (!name || KEIN_WASSER.test(name)) return [];

  let zutat = kandidatenName(name);
  const imKatalog = Boolean(zutat);
  if (zutat === 'Tomaten' && einheitWort && BEHAELTER.has(einheitWort)) zutat = 'Dosentomaten';
  const katalog = imKatalog ? findeZutat(zutat) : null;
  if (!imKatalog) zutat = name;

  // Die Mengenangabe, wie sie im Rezept stand (z. B. "3 EL"), für den Hinweis
  const mengeText = menge ? [menge.bereich ?? String(runde(menge.wert)).replace('.', ','), einheitText].filter(Boolean).join(' ') : '';
  const grundNotiz = [];
  const ergebnis = (art, wert, einheit, extra = {}) => ({
    zutat,
    art,
    menge: art === 'menge' ? runde(wert) : null,
    einheit: art === 'menge' ? einheit : null,
    optional: false,
    notiz: [...grundNotiz, ...(menge?.bereich ? [menge.bereich] : []), ...notizen].join('; ') || null,
    unbekannt: !imKatalog,
    unsicher: false,
    ...extra,
  });

  // Ohne Zahl: nach Bedarf
  if (!menge) return [ergebnis('da_leer')];
  // Gewürze, Öl, Salz: immer "nach Bedarf", die genannte Menge bleibt als Hinweis
  if (katalog?.art === 'da_leer') {
    grundNotiz.push(mengeText);
    return [ergebnis('da_leer')];
  }

  let wert = menge.wert;
  if (klammerMenge && (!einheitWort || BEHAELTER.has(einheitWort))) {
    const [faktor, einheit] = GENAU[klammerMenge.einheit];
    return [ergebnis('menge', klammerMenge.wert * faktor * (einheitWort && BEHAELTER.has(einheitWort) ? wert : 1), einheit)];
  }
  if (einheitWort && GENAU[einheitWort]) {
    const [faktor, einheit] = GENAU[einheitWort];
    return [ergebnis('menge', wert * faktor, einheit)];
  }
  if (einheitWort && LOEFFEL[einheitWort]) {
    grundNotiz.push(mengeText);
    return [ergebnis('menge', wert * LOEFFEL[einheitWort], katalog?.einheit === 'ml' ? 'ml' : 'g')];
  }
  if (einheitWort && WEICH[einheitWort] !== undefined) {
    grundNotiz.push(mengeText);
    const einheit = katalog?.einheit ?? 'stk';
    return [ergebnis('menge', einheit === 'stk' ? wert : wert * WEICH[einheitWort], einheit)];
  }
  if (einheitWort && BEHAELTER.has(einheitWort)) {
    grundNotiz.push(mengeText);
    return [ergebnis('menge', wert, 'stk', { unsicher: true })];
  }
  // Stückzahl ("2 Eier", "3 Scheiben Toastbrot"); eine große Zahl ohne Einheit bei einer Zutat in g/ml ist vermutlich g/ml
  if (!einheitWort && katalog && katalog.einheit !== 'stk' && wert >= 10) return [ergebnis('menge', wert, katalog.einheit)];
  return [ergebnis('menge', wert, 'stk')];
}

// ---------- Webseite -> Rezept ----------
function sammleRezepte(knoten, ziel = []) {
  if (Array.isArray(knoten)) knoten.forEach((k) => sammleRezepte(k, ziel));
  else if (knoten && typeof knoten === 'object') {
    const typ = [].concat(knoten['@type'] ?? []);
    if (typ.includes('Recipe')) ziel.push(knoten);
    if (knoten['@graph']) sammleRezepte(knoten['@graph'], ziel);
    if (knoten.mainEntity) sammleRezepte(knoten.mainEntity, ziel);
  }
  return ziel;
}

function liesPortionen(y) {
  for (const teil of [].concat(y ?? [])) {
    const m = String(teil).match(/\d+/);
    if (m && Number(m[0]) >= 1) return Number(m[0]);
  }
  return null;
}

function liesDauer(iso) {
  const m = String(iso ?? '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const minuten = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return minuten > 0 ? minuten : null;
}

function liesSchritte(anleitung) {
  if (typeof anleitung === 'string') return anleitung.split(/\r?\n|<\/?(?:p|br|li|div)[^>]*>/i).map(bereinige).filter(Boolean);
  if (Array.isArray(anleitung)) return anleitung.flatMap(liesSchritte);
  if (anleitung && typeof anleitung === 'object') {
    if (anleitung.itemListElement) return liesSchritte(anleitung.itemListElement);
    return liesSchritte(anleitung.text ?? anleitung.name ?? '');
  }
  return [];
}

// Liest das erste Rezept aus dem HTML einer Seite. Rückgabe: { rezept (Eingabe für neuesRezept), warnungen }.
export function extrahiereRezept(html, url) {
  const funde = [];
  for (const m of String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      sammleRezepte(JSON.parse(m[1].trim()), funde);
    } catch {
      // kaputter Block: überspringen
    }
  }
  const roh = funde[0];
  if (!roh) throw new Error('Auf der Seite wurden keine maschinenlesbaren Rezeptdaten gefunden.');

  const warnungen = [];
  const name = bereinige(roh.name);
  let portionen = liesPortionen(roh.recipeYield);
  if (!portionen) {
    portionen = 2;
    warnungen.push('Die Portionen stehen nicht auf der Seite, ich habe 2 angenommen. Bitte prüfen.');
  }
  const dauerMinuten = liesDauer(roh.totalTime) ?? liesDauer(roh.cookTime) ?? liesDauer(roh.prepTime);

  const zutaten = [].concat(roh.recipeIngredient ?? []).flatMap((z) => parseZutatenzeile(z));
  if (!zutaten.length) throw new Error('Auf der Seite wurden keine Zutaten gefunden.');
  for (const z of zutaten) {
    if (z.unbekannt) warnungen.push(`Die Zutat „${z.zutat}“ steht nicht in der Zutatenliste der App. Sie wird übernommen, findet aber nur dann etwas im Vorrat, wenn du bei dem Produkt die Zutat „${z.zutat}“ einträgst.`);
    if (z.unsicher) warnungen.push(`Menge unklar bei „${z.zutat}“ (${z.notiz ?? 'Packung'}). Bitte prüfen.`);
  }

  const schritte = liesSchritte(roh.recipeInstructions);
  if (!schritte.length) warnungen.push('Es wurde keine Zubereitung gefunden. Bitte ergänzen.');

  return {
    rezept: { id: `link-${slug(name) || 'rezept'}`, name, portionen, dauerMinuten, zutaten, schritte: schritte.length ? schritte : ['(Zubereitung ergänzen)'], quelle: url },
    warnungen,
  };
}

// Rezepte in die Rezeptdatei der App packen (Hilfsfelder wie "unbekannt" fallen weg).
export function baueRezeptDatei(rezepte) {
  return {
    format: 'koch-app-rezepte',
    version: 1,
    rezepte: rezepte.map((r) => ({
      ...r,
      zutaten: r.zutaten.map(({ unbekannt, unsicher, ...z }) => ({ ...z, ...(z.optional ? {} : { optional: undefined }) })),
    })),
  };
}
