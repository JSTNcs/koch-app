// Rezepte: anlegen, prüfen, mit dem Vorrat abgleichen. Reine Logik (ohne Bildschirm und Datenbank).
//
// Rezept: { id, name, portionen, dauerMinuten|null, zutaten[], schritte[], quelle|null }
// Zutat im Rezept: { zutat, art ('menge' | 'da_leer'), menge|null, einheit|null, optional, notiz|null }
import { EINHEITEN, formatMenge } from './pantry.js';
import { norm, schluessel, kanonName, zutatVonEintrag, zutatVonProdukt } from './zutaten.js';
import { neuerProduktEintrag, neuerFreiEintrag } from './einkauf.js';

const DATEI_FORMAT = 'koch-app-rezepte';
const DATEI_VERSION = 1;
const eps = 1e-9;
const runde2 = (n) => Math.round(n * 100) / 100;

function slug(name) {
  return norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Prüft die Eingaben und baut ein sauberes Rezept. Wirft einen Fehler mit deutscher Meldung.
export function neuesRezept(eingabe) {
  const name = String(eingabe?.name ?? '').trim();
  if (!name) throw new Error('Bitte einen Namen eintragen.');
  const p = eingabe.portionen;
  if (!Number.isInteger(p) || p < 1 || p > 99) throw new Error('Bitte die Portionen als ganze Zahl (1 oder mehr) eintragen.');
  const dauer = eingabe.dauerMinuten ?? null;
  if (dauer !== null && (!Number.isInteger(dauer) || dauer < 1)) throw new Error('Die Dauer muss eine ganze Zahl über 0 sein (Minuten).');

  if (!Array.isArray(eingabe.zutaten) || !eingabe.zutaten.length) throw new Error('Bitte mindestens eine Zutat eintragen.');
  const zutaten = eingabe.zutaten.map((roh, i) => {
    const nr = `Zutat ${i + 1}`;
    if (!roh || typeof roh !== 'object') throw new Error(`${nr} ist ungültig.`);
    const zutat = String(roh.zutat ?? '').trim();
    if (!zutat) throw new Error(`${nr}: Bitte einen Namen eintragen.`);
    const art = roh.art ?? (roh.menge !== undefined && roh.menge !== null ? 'menge' : 'da_leer');
    if (!['menge', 'da_leer'].includes(art)) throw new Error(`${nr}: Ungültige Art (Menge oder nach Bedarf).`);
    const gemeinsam = {
      zutat,
      art,
      optional: roh.optional === true,
      notiz: typeof roh.notiz === 'string' && roh.notiz.trim() ? roh.notiz.trim() : null,
    };
    if (art === 'da_leer') return { ...gemeinsam, menge: null, einheit: null };
    if (typeof roh.menge !== 'number' || !Number.isFinite(roh.menge) || roh.menge <= 0) {
      throw new Error(`${nr}: Bitte eine Menge größer als 0 eintragen.`);
    }
    if (!EINHEITEN.includes(roh.einheit)) throw new Error(`${nr}: Ungültige Einheit (g, ml oder Stück).`);
    return { ...gemeinsam, menge: roh.menge, einheit: roh.einheit };
  });

  const schritte = (Array.isArray(eingabe.schritte) ? eingabe.schritte : []).map((s) => String(s ?? '').trim()).filter(Boolean);
  if (!schritte.length) throw new Error('Bitte mindestens einen Schritt eintragen.');

  const id = typeof eingabe.id === 'string' && eingabe.id.trim() ? eingabe.id.trim() : slug(name) || crypto.randomUUID();
  const quelle = typeof eingabe.quelle === 'string' && eingabe.quelle.trim() ? eingabe.quelle.trim() : null;
  return { id, name, portionen: p, dauerMinuten: dauer, zutaten, schritte, quelle };
}

// "200 g", "1 Stück" oder "nach Bedarf"
export function mengeText(zutat) {
  return zutat.art === 'menge' && zutat.menge ? formatMenge(zutat.menge, zutat.einheit) : 'nach Bedarf';
}
export function rezeptTexte(zutat) {
  return { titel: zutat.zutat, menge: mengeText(zutat) };
}

function skaliereMenge(menge, einheit) {
  if (einheit === 'stk') return Math.round(menge * 2) / 2; // halbe Stücke sind ok
  return menge >= 10 ? Math.round(menge) : Math.round(menge * 10) / 10;
}

// Zutaten für eine andere Anzahl Portionen (Original bleibt unverändert).
export function skaliere(rezept, portionen) {
  const faktor = portionen / rezept.portionen;
  return rezept.zutaten.map((z) => (z.art === 'menge' ? { ...z, menge: skaliereMenge(z.menge * faktor, z.einheit) } : { ...z }));
}

// ---------- Abgleich mit dem Vorrat ----------

// Ordnet jeden Vorratseintrag seiner Zutat zu. Einmal bauen, für alle Rezepte benutzen.
export function baueIndex(vorrat, produkte) {
  const index = new Map();
  for (const e of vorrat) {
    const key = schluessel(zutatVonEintrag(e, produkte).zutat);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(e);
  }
  return index;
}

const hatEtwas = (e) => (e.art === 'da_leer' ? e.da === true : e.menge > 0);

// Status je Zutat:
//   da          reicht
//   teils       ist etwas da, aber zu wenig (fehlt = Rest)
//   fehlt       nicht da (bei Gewürzen nur, wenn ausdrücklich "leer" eingetragen)
//   unklar      im Vorrat in einer anderen Einheit, lässt sich nicht vergleichen (zählt nicht als fehlend)
//   angenommen  Gewürz ohne Eintrag im Vorrat, wird als vorhanden angenommen
export function pruefeRezept(rezept, ctx, { portionen = rezept.portionen } = {}) {
  const index = ctx.index || baueIndex(ctx.vorrat, ctx.produkte);
  const mengen = skaliere(rezept, portionen);
  const zutaten = rezept.zutaten.map((z, i) => {
    const braucht = z.art === 'menge' ? mengen[i].menge : null;
    const eintraege = index.get(schluessel(z.zutat)) || [];
    let status;
    let habe = null;
    let fehlt = null;

    if (z.art === 'da_leer') {
      status = !eintraege.length ? 'angenommen' : eintraege.some(hatEtwas) ? 'da' : 'fehlt';
    } else {
      const gleich = eintraege.filter((e) => e.art === 'menge' && e.einheit === z.einheit);
      habe = runde2(gleich.reduce((s, e) => s + e.menge, 0));
      const andere = eintraege.some((e) => e.art === 'menge' && e.einheit !== z.einheit && e.menge > 0);
      const gewuerzDa = eintraege.some((e) => e.art === 'da_leer' && e.da === true);
      if (habe >= braucht - eps || gewuerzDa) status = 'da';
      else if (habe === 0 && andere) status = 'unklar';
      else if (habe > 0) status = 'teils';
      else status = 'fehlt';
      if (status === 'teils' || status === 'fehlt') fehlt = runde2(braucht - habe);
    }
    return { zutat: z.zutat, art: z.art, optional: z.optional, notiz: z.notiz, einheit: z.einheit, braucht, habe, fehlt, status };
  });
  const fehlend = zutaten.filter((z) => !z.optional && (z.status === 'fehlt' || z.status === 'teils')).length;
  const kategorie = fehlend === 0 ? 'alles' : fehlend <= 2 ? 'wenig' : 'mehr';
  return { portionen, zutaten, fehlend, kategorie };
}

// Für "Was koche ich?": [{ rezept, pruefung }] -> { alles, wenig, mehr }, jeweils sortiert.
export function gruppiereVorschlaege(liste) {
  const gruppen = { alles: [], wenig: [], mehr: [] };
  for (const x of liste) gruppen[x.pruefung.kategorie].push(x);
  const nachName = (a, b) => a.rezept.name.localeCompare(b.rezept.name, 'de', { sensitivity: 'base' });
  for (const g of Object.values(gruppen)) g.sort((a, b) => a.pruefung.fehlend - b.pruefung.fehlend || nachName(a, b));
  return gruppen;
}

// Was fehlt, als Einträge für die Einkaufsliste: ein bekanntes Produkt mit passender Anzahl Packungen
// (bevorzugt eines, das im Vorrat liegt), sonst Freitext mit der fehlenden Menge.
export function fehlendFuerListe(pruefung, { vorrat, produkte }) {
  const imVorrat = new Set(vorrat.map((e) => e.barcode).filter(Boolean));
  const eintraege = [];
  for (const z of pruefung.zutaten) {
    if (z.optional || (z.status !== 'fehlt' && z.status !== 'teils')) continue;
    const key = schluessel(z.zutat);
    const passend = produkte
      .filter(
        (p) =>
          schluessel(zutatVonProdukt(p).zutat) === key &&
          p.art === z.art &&
          (z.art === 'da_leer' || p.einheit === z.einheit)
      )
      .sort((a, b) => Number(imVorrat.has(b.barcode)) - Number(imVorrat.has(a.barcode)) || a.name.localeCompare(b.name, 'de'));
    const wahl = passend[0];
    const zutat = kanonName(z.zutat);
    if (wahl) {
      const anzahl = z.art === 'menge' ? Math.max(1, Math.ceil(z.fehlt / wahl.packung - eps)) : 1;
      eintraege.push(neuerProduktEintrag({ ...wahl, zutat }, anzahl));
    } else if (z.art === 'menge') {
      eintraege.push(neuerFreiEintrag({ name: z.zutat, anzahl: z.fehlt, einheit: z.einheit, zutat }));
    } else {
      eintraege.push(neuerFreiEintrag({ name: z.zutat, anzahl: 1, einheit: 'stk', zutat }));
    }
  }
  return eintraege;
}

// ---------- Rezeptdatei (Import) ----------

// Liest den Text einer Rezeptdatei und prüft jedes Rezept. Wirft Fehler mit deutscher Meldung.
export function pruefeRezeptDatei(text) {
  let s;
  try {
    s = JSON.parse(text);
  } catch {
    throw new Error('Die Datei konnte nicht gelesen werden. Sie ist keine Rezeptdatei der Koch-App.');
  }
  if (!s || typeof s !== 'object' || Array.isArray(s) || s.format !== DATEI_FORMAT || !Number.isInteger(s.version) || s.version < 1) {
    throw new Error('Diese Datei ist keine Rezeptdatei der Koch-App.');
  }
  if (s.version > DATEI_VERSION) throw new Error('Diese Rezeptdatei stammt von einer neueren Version der App. Bitte aktualisiere zuerst die App.');
  if (!Array.isArray(s.rezepte)) throw new Error('In der Datei fehlen die Rezepte.');
  if (!s.rezepte.length) throw new Error('In der Datei sind keine Rezepte.');

  const ids = new Set();
  return s.rezepte.map((roh, i) => {
    let r;
    try {
      r = neuesRezept(roh);
    } catch (fehler) {
      const titel = roh && typeof roh.name === 'string' && roh.name.trim() ? ` („${roh.name.trim()}“)` : '';
      throw new Error(`Rezept ${i + 1}${titel}: ${fehler.message}`);
    }
    if (ids.has(r.id)) throw new Error(`Die Kennung „${r.id}“ kommt in der Datei doppelt vor.`);
    ids.add(r.id);
    return r;
  });
}

// Was passiert beim Import? Gleiche Kennung ersetzt das vorhandene Rezept, alles andere kommt neu dazu.
export function planeImport(bestehende, neue) {
  const vorhanden = new Set(bestehende.map((r) => r.id));
  return { neu: neue.filter((r) => !vorhanden.has(r.id)), ersetzt: neue.filter((r) => vorhanden.has(r.id)) };
}
