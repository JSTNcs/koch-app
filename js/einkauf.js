// Einkaufsliste: reine Logik (ohne Bildschirm und Datenbank, damit sie leicht testbar ist).
//
// Ein Listeneintrag ist entweder
//   typ "produkt": ein bestimmtes Produkt (Marke, Barcode, Packungsgröße) mit Anzahl Packungen, oder
//   typ "frei":    Freitext ohne Marke (Zwiebeln, Hähnchenbrust) mit Menge und Einheit.
// "erledigt" bedeutet: im Laden abgehakt.
import { EINHEITEN, neuerEintrag, hinzufuegenOderErhoehen, schritt, formatMenge } from './pantry.js';
import { eintragAusProdukt, gruppeVon } from './produkt.js';
import { schluessel, zutatVonProdukt } from './zutaten.js';

const runde = (n) => Math.round(n * 100) / 100;
const zahlDeutsch = (n) => String(runde(n)).replace('.', ',');
const istPositiv = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

// Kleinschreibung ohne Akzente und Umlaut-Punkte, damit "gunstig" auch "Günstig" findet.
function norm(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
const woerter = (text) => norm(text).split(/[^a-z0-9]+/).filter(Boolean);

// ---------- Einträge anlegen ----------

export function neuerProduktEintrag(produkt, anzahl = 1, { id = crypto.randomUUID() } = {}) {
  if (!istPositiv(anzahl)) throw new Error('Bitte eine Anzahl größer als 0 eintragen.');
  if (!produkt?.barcode) throw new Error('Es fehlt der Barcode.');
  const menge = produkt.art === 'menge';
  return {
    id,
    typ: 'produkt',
    barcode: produkt.barcode,
    name: produkt.name,
    marke: produkt.marke ?? null,
    produktArt: produkt.art,
    packung: menge ? produkt.packung : null,
    einheit: menge ? produkt.einheit : null,
    anzahl,
    erledigt: false,
    zutat: produkt.zutat || null,
  };
}

export function neuerFreiEintrag({ name, anzahl = 1, einheit = 'stk', zutat = null }, { id = crypto.randomUUID() } = {}) {
  const n = String(name ?? '').trim();
  if (!n) throw new Error('Bitte einen Namen eintragen.');
  if (!EINHEITEN.includes(einheit)) throw new Error('Ungültige Einheit (g, ml oder Stück).');
  if (!istPositiv(anzahl)) throw new Error('Bitte eine Menge größer als 0 eintragen.');
  return {
    id,
    typ: 'frei',
    barcode: null,
    name: n,
    marke: null,
    produktArt: null,
    packung: null,
    einheit,
    anzahl,
    erledigt: false,
    zutat: zutat ? String(zutat).trim() || null : null,
  };
}

// ---------- Liste pflegen ----------

function gleicherEintrag(a, b) {
  if (a.typ !== b.typ) return false;
  if (a.typ === 'produkt') return a.barcode === b.barcode;
  return a.einheit === b.einheit && norm(a.name).trim() === norm(b.name).trim();
}

// Steht es schon drauf, wird nur die Anzahl erhöht. War es abgehakt, ist es wieder offen und zählt neu.
// Rückgabe: { liste, eintrag (der geänderte oder neue Eintrag), zusammengefuehrt }
export function fuegeHinzu(liste, neu) {
  const i = liste.findIndex((alt) => gleicherEintrag(alt, neu));
  if (i === -1) return { liste: [...liste, neu], eintrag: neu, zusammengefuehrt: false };
  const alt = liste[i];
  const zusammen = { ...alt, anzahl: runde(alt.erledigt ? neu.anzahl : alt.anzahl + neu.anzahl), erledigt: false };
  const kopie = [...liste];
  kopie[i] = zusammen;
  return { liste: kopie, eintrag: zusammen, zusammengefuehrt: true };
}

// richtung: +1 oder -1. Die Anzahl geht nie auf 0 oder darunter (zum Entfernen gibt es das ✕).
export function aendereAnzahl(eintrag, richtung) {
  const schrittweite = eintrag.typ === 'frei' ? schritt(eintrag.einheit) : 1;
  const neu = runde(eintrag.anzahl + richtung * schrittweite);
  return neu <= 0 ? { ...eintrag } : { ...eintrag, anzahl: neu };
}

export function schalteHaken(eintrag) {
  return { ...eintrag, erledigt: !eintrag.erledigt };
}

// Offene zuerst, Abgehakte unten, jeweils nach Name.
export function sortiereListe(liste) {
  return [...liste].sort(
    (a, b) => Number(a.erledigt) - Number(b.erledigt) || a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
  );
}

// ---------- Suche in den eigenen (schon bekannten) Produkten ----------

export function sucheProdukte(produkte, text, grenze = 20) {
  const gesucht = woerter(text);
  if (!gesucht.length) return [];
  return produkte
    .filter((p) => {
      const heu = norm([p.name, p.marke, p.packung ? formatMenge(p.packung, p.einheit) : ''].join(' '));
      return gesucht.every((w) => heu.includes(w));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
    .slice(0, grenze);
}

// ---------- Anzeige ----------

export function eintragTexte(e) {
  if (e.typ === 'frei') return { titel: e.name, untertitel: '', menge: formatMenge(e.anzahl, e.einheit) };
  const marke = e.marke && !norm(e.name).includes(norm(e.marke)) ? e.marke : '';
  const packung = e.packung ? formatMenge(e.packung, e.einheit) : '';
  return { titel: e.name, untertitel: [marke, packung].filter(Boolean).join(' · '), menge: `${zahlDeutsch(e.anzahl)}×` };
}

// ---------- Von der Liste in den Vorrat ----------

export function produktAusEintrag(e) {
  return { barcode: e.barcode, name: e.name, marke: e.marke, art: e.produktArt, packung: e.packung, einheit: e.einheit, zutat: e.zutat ?? null };
}

function zuVorratEintrag(e) {
  if (e.typ === 'produkt') return eintragAusProdukt(produktAusEintrag(e), { anzahl: e.anzahl });
  return neuerEintrag({ name: e.name, art: 'menge', menge: e.anzahl, einheit: e.einheit, zutat: e.zutat });
}

// Alle abgehakten Einträge werden in den Vorrat gelegt (Menge = Packungsgröße mal Anzahl).
// Rückgabe: was gespeichert und was von der Liste gelöscht werden muss. Es wird nichts verändert.
export function einraeumen(liste, vorrat) {
  const erledigte = liste.filter((e) => e.erledigt);
  let aktuell = [...vorrat];
  const geaendert = new Map();
  for (const e of erledigte) {
    const r = hinzufuegenOderErhoehen(aktuell, zuVorratEintrag(e));
    aktuell = r.liste;
    geaendert.set(r.eintrag.id, r.eintrag);
  }
  return { zuSpeichern: [...geaendert.values()], zuLoeschen: erledigte.map((e) => e.id), anzahl: erledigte.length };
}

// ---------- Scan: gehört das gescannte Produkt zu einem Listeneintrag? ----------

// Gleicher Barcode, als gleichwertig gemerkt (gleiche Gruppe) oder bei Freitext gleicher Name.
// Offene Einträge haben Vorrang vor abgehakten. Kein Treffer: null.
export function findeTreffer(liste, gescannt, alleProdukte) {
  const gruppe = gescannt.gruppe || gruppeVon(gescannt.barcode, alleProdukte);
  const zutat = schluessel(zutatVonProdukt(gescannt).zutat);
  const passt = (e) => {
    if (e.typ === 'frei') {
      // Freitext passt zu jedem Produkt derselben Zutat (Rezept: "Spaghetti", gescannt: "Barilla Spaghetti")
      if (e.zutat && schluessel(e.zutat) === zutat) return true;
      return norm(e.name).trim() === norm(gescannt.name).trim();
    }
    if (e.barcode === gescannt.barcode) return true;
    return Boolean(gruppe) && gruppeVon(e.barcode, alleProdukte) === gruppe;
  };
  const treffer = liste.filter(passt);
  return treffer.find((e) => !e.erledigt) || treffer[0] || null;
}

// Offene Einträge, für die das gescannte Produkt Ersatz sein könnte. Ähnliche (gleiches Wort im Namen) zuerst.
export function kandidaten(liste, gescannt) {
  const mein = new Set(woerter(gescannt.name).filter((w) => w.length >= 3));
  return liste
    .filter((e) => !e.erledigt)
    .map((eintrag) => ({ eintrag, aehnlich: woerter(eintrag.name).some((w) => mein.has(w)) }))
    .sort(
      (a, b) =>
        Number(b.aehnlich) - Number(a.aehnlich) ||
        a.eintrag.name.localeCompare(b.eintrag.name, 'de', { sensitivity: 'base' })
    );
}

// Was passiert mit dem Listeneintrag, wenn "anzahl" Packungen gekauft (gescannt) wurden?
// { loeschen: id } oder { aendern: neuerEintrag } (es fehlen noch welche) oder {} (nichts gekauft).
export function verbucheScan(eintrag, anzahl) {
  if (!(anzahl > 0)) return {};
  if (eintrag.erledigt || anzahl >= eintrag.anzahl) return { loeschen: eintrag.id };
  return { aendern: { ...eintrag, anzahl: runde(eintrag.anzahl - anzahl) } };
}

// ---------- Prüfen beim Einlesen einer Sicherung ----------

export function normalisiereListeneintrag(roh) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) throw new Error('Der Eintrag ist ungültig.');
  if (!['produkt', 'frei'].includes(roh.typ)) throw new Error('Ungültige Art des Eintrags (Produkt oder Freitext).');
  if (typeof roh.id !== 'string' || !roh.id) throw new Error('Die Kennung (id) fehlt.');
  if (roh.erledigt !== undefined && typeof roh.erledigt !== 'boolean') throw new Error('Der Haken (erledigt) ist ungültig.');
  const name = String(roh.name ?? '').trim();
  if (!name) throw new Error('Bitte einen Namen eintragen.');
  if (!istPositiv(roh.anzahl)) throw new Error('Die Anzahl muss größer als 0 sein.');
  const basis = {
    id: roh.id,
    typ: roh.typ,
    name,
    anzahl: roh.anzahl,
    erledigt: roh.erledigt === true,
    zutat: typeof roh.zutat === 'string' && roh.zutat.trim() ? roh.zutat.trim() : null,
  };

  if (roh.typ === 'frei') {
    if (!EINHEITEN.includes(roh.einheit)) throw new Error('Ungültige Einheit (g, ml oder Stück).');
    return { ...basis, barcode: null, marke: null, produktArt: null, packung: null, einheit: roh.einheit };
  }

  if (typeof roh.barcode !== 'string' || !roh.barcode) throw new Error('Es fehlt der Barcode.');
  if (!['menge', 'da_leer'].includes(roh.produktArt)) throw new Error('Ungültige Art des Produkts.');
  const menge = roh.produktArt === 'menge';
  if (menge && (!istPositiv(roh.packung) || !EINHEITEN.includes(roh.einheit))) {
    throw new Error('Packungsgröße oder Einheit sind ungültig.');
  }
  return {
    ...basis,
    barcode: roh.barcode,
    marke: typeof roh.marke === 'string' && roh.marke ? roh.marke : null,
    produktArt: roh.produktArt,
    packung: menge ? roh.packung : null,
    einheit: menge ? roh.einheit : null,
  };
}
