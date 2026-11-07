// Nährwerte für Zutaten, Rezepte und Vorrat. Reine Logik (ohne Bildschirm und Datenbank).
//
// Die Tabelle (daten/naehrwerte.json, USDA FoodData Central, gemeinfrei) gilt pro 100 g, roh bzw. trocken.
// Eigene Produktdaten (aus dem Scan) haben Vorrang vor der Tabelle. Alles sind Näherungen.
import { kanonName, schluessel, zutatVonEintrag, zutatVonProdukt } from './zutaten.js';

const WERTE = ['kcal', 'eiweiss', 'kohlenhydrate', 'fett'];
// Das kleine Plus verhindert, dass Halbwerte wegen Rechenungenauigkeit falsch gerundet werden (3,4999999 -> 3,5)
const runde1 = (n) => Math.round(n * 10 + 1e-9) / 10;
const runde2 = (n) => Math.round(n * 100 + 1e-9) / 100;
const istZahl = (n) => typeof n === 'number' && Number.isFinite(n);

export function tabellenEintrag(tabelle, zutat) {
  const name = kanonName(zutat);
  return tabelle?.zutaten && Object.hasOwn(tabelle.zutaten, name) ? tabelle.zutaten[name] : null;
}

// Gewicht in Gramm: g wie angegeben, ml mit Dichte (Standard 1), Stück mit Stückgewicht (sonst null)
export function gramm(menge, einheit, eintrag) {
  if (einheit === 'g') return menge;
  if (einheit === 'ml') return menge * (eintrag?.dichte || 1);
  if (einheit === 'stk') return eintrag?.stueckG ? menge * eintrag.stueckG : null;
  return null;
}

const hatAlleWerte = (n) => n && WERTE.every((f) => istZahl(n[f]));

// Eigenes Produkt mit Nährwerten für diese Zutat (bevorzugt eines, das im Vorrat liegt)
function eigenesProdukt(produkte, key, vorrat) {
  const imVorrat = new Set(vorrat.map((e) => e.barcode).filter(Boolean));
  return (
    produkte
      .filter((p) => p.art === 'menge' && p.einheit !== 'stk' && hatAlleWerte(p.naehrwerte) && schluessel(zutatVonProdukt(p).zutat) === key)
      .sort((a, b) => Number(imVorrat.has(b.barcode)) - Number(imVorrat.has(a.barcode)) || a.name.localeCompare(b.name, 'de'))[0] ?? null
  );
}

// Nährwerte einer Menge einer Zutat: { kcal, eiweiss, kohlenhydrate, fett, quelle: 'produkt' | 'tabelle' } oder null
export function naehrwerteFuerZutat(tabelle, produkte, zutat, menge, einheit, vorrat = []) {
  const skaliert = (pro, g, quelle) => {
    const faktor = g / 100;
    return { ...Object.fromEntries(WERTE.map((f) => [f, runde2(pro[f] * faktor)])), quelle };
  };
  if (einheit === 'g' || einheit === 'ml') {
    const p = eigenesProdukt(produkte, schluessel(zutat), vorrat);
    if (p) return skaliert(p.naehrwerte, menge, 'produkt');
  }
  const eintrag = tabellenEintrag(tabelle, zutat);
  if (!eintrag) return null;
  const g = gramm(menge, einheit, eintrag);
  return g === null ? null : skaliert(eintrag, g, 'tabelle');
}

// Nährwerte pro Portion eines Rezepts (Näherung).
// fehlend: Zutaten, die sich nicht berechnen lassen (nicht in der Tabelle, kein Stückgewicht).
// geschaetzt: "nach Bedarf"-Zutaten mit fester Richtmenge pro Portion (Öl, Mayonnaise).
// Freiwillige Zutaten und Gewürze ohne Richtmenge zählen nicht. proPortion ist null, wenn nichts berechenbar war.
export function rezeptNaehrwerte(rezept, { tabelle, produkte = [], vorrat = [] }) {
  const summe = Object.fromEntries(WERTE.map((f) => [f, 0]));
  const fehlend = [];
  const geschaetzt = [];
  let berechnet = 0;
  for (const z of rezept.zutaten) {
    if (z.optional) continue;
    if (z.art === 'da_leer') {
      const e = tabellenEintrag(tabelle, z.zutat);
      if (e?.richtmengeG) {
        for (const f of WERTE) summe[f] += (e[f] * e.richtmengeG * rezept.portionen) / 100;
        geschaetzt.push(z.zutat);
      }
      continue;
    }
    const n = naehrwerteFuerZutat(tabelle, produkte, z.zutat, z.menge, z.einheit, vorrat);
    if (!n) {
      fehlend.push(z.zutat);
      continue;
    }
    for (const f of WERTE) summe[f] += n[f];
    berechnet++;
  }
  const pro = (f) => summe[f] / rezept.portionen;
  return {
    proPortion: berechnet === 0 ? null : { kcal: Math.round(pro('kcal')), eiweiss: runde1(pro('eiweiss')), kohlenhydrate: runde1(pro('kohlenhydrate')), fett: runde1(pro('fett')) },
    gesamt: { kcal: Math.round(summe.kcal), eiweiss: runde1(summe.eiweiss), kohlenhydrate: runde1(summe.kohlenhydrate), fett: runde1(summe.fett) },
    fehlend,
    geschaetzt,
    vollstaendig: fehlend.length === 0,
  };
}

// Nährwerte aus der Tabelle in der Einheit, in der man isst: pro 100 g, pro 100 ml oder pro Stück. Sonst null.
export function tabellenProEinheit(tabelle, zutat, einheit) {
  const e = tabellenEintrag(tabelle, zutat);
  if (!e) return null;
  let faktor;
  if (einheit === 'g') faktor = 1;
  else if (einheit === 'ml') faktor = e.dichte || 1;
  else if (einheit === 'stk' && e.stueckG) faktor = e.stueckG / 100;
  else return null;
  return { kcal: Math.round(e.kcal * faktor), eiweiss: runde1(e.eiweiss * faktor), kohlenhydrate: runde1(e.kohlenhydrate * faktor), fett: runde1(e.fett * faktor) };
}

// Vorschlag für die Eingabe im Tagebuch: aus der Zutat eines Vorratseintrags bzw. eines gescannten Produkts
export function proFuerEintrag(tabelle, eintrag, produkte) {
  if (eintrag.art !== 'menge') return null;
  return tabellenProEinheit(tabelle, zutatVonEintrag(eintrag, produkte).zutat, eintrag.einheit);
}
export function proFuerProdukt(tabelle, produkt, einheit) {
  return tabellenProEinheit(tabelle, zutatVonProdukt(produkt).zutat, einheit);
}

// Eingabe für einen Tagebucheintrag aus gegessenen Rezept-Portionen (immer als Näherung "ca.")
export function mahlzeitAusPortionen({ name, rezeptId, proPortion, anzahl, quelle }) {
  return {
    name,
    kcal: Math.round(proPortion.kcal * anzahl),
    eiweiss: runde1(proPortion.eiweiss * anzahl),
    kohlenhydrate: runde1(proPortion.kohlenhydrate * anzahl),
    fett: runde1(proPortion.fett * anzahl),
    menge: `${anzahl} ${anzahl === 1 ? 'Portion' : 'Portionen'}`,
    ca: true,
    quelle,
    rezeptId,
  };
}
