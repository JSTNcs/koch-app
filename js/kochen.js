// Kochen: Abzug aus dem Vorrat planen, Reste, Kochprotokoll und Rückgängig. Reine Logik (ohne Bildschirm und Datenbank).
import { normalisiereEintrag } from './pantry.js';
import { skaliere } from './rezepte.js';
import { schluessel, zutatVonEintrag } from './zutaten.js';

const eps = 1e-9;
const runde = (n) => Math.round(n * 100) / 100;
const TAG_MS = 86400000;
const gueltigesDatum = (t) => typeof t === 'string' && !Number.isNaN(Date.parse(t));

// ---------- Abzug planen ----------

// Plan, was beim Kochen aus dem Vorrat abgezogen wird. Es wird nichts verändert.
//   opts.optionalBenutzt: Nummern freiwilliger Zutaten, die benutzt wurden
//   opts.mengen:          vom Nutzer geänderte Mengen { Nummer der Zutat: Menge }
// Je Zutat eine Zeile, art:
//   abzug    gleiche Einheit im Vorrat vorhanden: wird abgezogen (bald ablaufende zuerst, dann die kleinere Menge)
//   unklar   Vorrat nur in anderer Einheit: der Nutzer gibt die Menge an (Vorgabe 0)
//   gewuerz  nach Bedarf: nichts wird abgezogen, kandidaten sind Einträge, die der Nutzer auf "leer" setzen kann
//   nichtDa  nichts im Vorrat: nichts abzuziehen, fehlt = Menge
export function planeAbzug(rezept, portionen, { vorrat, produkte }, { optionalBenutzt = [], mengen = {} } = {}) {
  const skaliert = skaliere(rezept, portionen);
  const arbeit = new Map(vorrat.map((e) => [e.id, e.art === 'menge' ? e.menge : 0])); // Restmenge während des Planens
  const index = new Map();
  for (const e of vorrat) {
    const key = schluessel(zutatVonEintrag(e, produkte).zutat);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(e);
  }

  const zeilen = rezept.zutaten.map((z, i) => {
    const eintraege = index.get(schluessel(z.zutat)) || [];
    const benutzt = !z.optional || optionalBenutzt.includes(i);
    const basis = { index: i, zutat: z.zutat, optional: z.optional, benutzt, einheit: z.einheit, standard: null, betrag: 0, quellen: [], fehlt: 0, kandidaten: [] };
    const gewuerzDa = eintraege.filter((e) => e.art === 'da_leer');

    if (z.art === 'da_leer') return { ...basis, art: 'gewuerz', kandidaten: gewuerzDa };

    const standard = skaliert[i].menge;
    if (!benutzt) return { ...basis, art: 'abzug', standard };

    const gleiche = eintraege.filter((e) => e.art === 'menge' && e.einheit === z.einheit && arbeit.get(e.id) > eps);
    const andere = eintraege.filter((e) => e.art === 'menge' && e.einheit !== z.einheit && arbeit.get(e.id) > eps);
    let art;
    let einheit = z.einheit;
    let quellenEintraege = gleiche;
    let vorgabe = standard;
    let kandidaten = [];
    if (gleiche.length) art = 'abzug';
    else if (andere.length) {
      art = 'unklar';
      einheit = andere[0].einheit;
      quellenEintraege = andere.filter((e) => e.einheit === einheit);
      kandidaten = andere;
      vorgabe = null;
    } else if (gewuerzDa.length) return { ...basis, art: 'gewuerz', kandidaten: gewuerzDa };
    else art = 'nichtDa';

    const eigene = mengen[i];
    const betrag = Number.isFinite(eigene) && eigene >= 0 ? eigene : vorgabe ?? 0;
    const sortiert = [...quellenEintraege].sort(
      (a, b) =>
        (a.ablauf ? 0 : 1) - (b.ablauf ? 0 : 1) ||
        (a.ablauf || '').localeCompare(b.ablauf || '') ||
        arbeit.get(a.id) - arbeit.get(b.id) ||
        a.name.localeCompare(b.name, 'de')
    );
    let offen = betrag;
    const quellen = [];
    for (const e of sortiert) {
      if (offen <= eps) break;
      const hat = arbeit.get(e.id);
      const nimm = Math.min(offen, hat);
      const nachher = runde(hat - nimm);
      quellen.push({ eintrag: e, abziehen: runde(nimm), nachher, entfernt: nachher <= eps });
      arbeit.set(e.id, nachher);
      offen -= nimm;
    }
    return { ...basis, art, einheit, standard: vorgabe, betrag, quellen, fehlt: runde(Math.max(0, offen)), kandidaten };
  });
  return { portionen, zeilen };
}

// Macht aus dem Plan die Änderungen am Vorrat: was gespeichert, was gelöscht und wie es vorher aussah (für "Rückgängig").
// opts.gewuerzLeer: Nummern von "nach Bedarf"-Zutaten, die jetzt leer sind.
export function wendeAn(plan, { gewuerzLeer = [] } = {}) {
  const puts = new Map();
  const loesche = new Set();
  const vorher = new Map();
  const merke = (e) => {
    if (!vorher.has(e.id)) vorher.set(e.id, e);
  };
  for (const z of plan.zeilen) {
    if (!z.benutzt) continue;
    for (const q of z.quellen) {
      merke(q.eintrag);
      if (q.entfernt) {
        loesche.add(q.eintrag.id);
        puts.delete(q.eintrag.id);
      } else {
        puts.set(q.eintrag.id, { ...q.eintrag, menge: q.nachher });
      }
    }
  }
  for (const nummer of gewuerzLeer) {
    const z = plan.zeilen.find((x) => x.index === nummer && x.art === 'gewuerz');
    for (const e of z?.kandidaten ?? []) {
      if (e.art === 'da_leer' && e.da === true) {
        merke(e);
        puts.set(e.id, { ...e, da: false });
      }
    }
  }
  return { vorratPut: [...puts.values()], vorratLoesche: [...loesche], vorher: [...vorher.values()] };
}

// ---------- Portionen und Reste ----------

// gesamt: wie viele Portionen sind entstanden, gegessen: wie viele davon hast du gegessen. Ergebnis: Rest.
export function berechneRest(gesamt, gegessen) {
  if (!Number.isInteger(gesamt) || gesamt < 1 || gesamt > 99) throw new Error('Bitte die Portionen insgesamt als ganze Zahl (1 oder mehr) angeben.');
  if (!Number.isInteger(gegessen) || gegessen < 0) throw new Error('Bitte die gegessenen Portionen als ganze Zahl (0 oder mehr) angeben.');
  if (gegessen > gesamt) throw new Error('Du kannst nicht mehr Portionen gegessen haben, als es gibt.');
  return gesamt - gegessen;
}

// Nährwerte pro Portion (oder null): { kcal, eiweiss, kohlenhydrate, fett }, werden beim Kochen gemerkt,
// damit "1 Portion gegessen" später ohne Rechnung ins Tagebuch kann.
function pruefeNaehrwerte(n) {
  if (n === null || n === undefined) return null;
  const felder = ['kcal', 'eiweiss', 'kohlenhydrate', 'fett'];
  if (typeof n !== 'object' || felder.some((f) => typeof n[f] !== 'number' || !Number.isFinite(n[f]) || n[f] < 0)) {
    throw new Error('Die Nährwerte des Rests sind ungültig.');
  }
  return { kcal: n.kcal, eiweiss: n.eiweiss, kohlenhydrate: n.kohlenhydrate, fett: n.fett };
}

export function neuerRest({ rezeptId = null, name, portionen, naehrwerte = null, jetzt = new Date() }, { id = crypto.randomUUID() } = {}) {
  const n = String(name ?? '').trim();
  if (!n) throw new Error('Bitte einen Namen eintragen.');
  if (!Number.isInteger(portionen) || portionen < 1) throw new Error('Die Portionen müssen eine ganze Zahl über 0 sein.');
  return { id, rezeptId, name: n, portionen, gekochtAm: jetzt.toISOString(), naehrwerte: pruefeNaehrwerte(naehrwerte) };
}

// Eine Portion gegessen: { rest } mit einer Portion weniger oder { loeschen: id }, wenn nichts mehr übrig ist.
export function esseRestPortion(rest) {
  return rest.portionen <= 1 ? { loeschen: rest.id } : { rest: { ...rest, portionen: rest.portionen - 1 } };
}

export function restAlterText(rest, jetzt = new Date()) {
  const tage = Math.max(0, Math.floor((jetzt.getTime() - Date.parse(rest.gekochtAm)) / TAG_MS));
  return tage === 0 ? 'heute gekocht' : tage === 1 ? 'gestern gekocht' : `vor ${tage} Tagen gekocht`;
}

// ---------- Kochprotokoll und Rückgängig ----------

// tagebuchId: Kennung des Tagebucheintrags, der beim Kochen für die gegessenen Portionen angelegt wurde (oder weggelassen)
export function neuesProtokoll({ rezept, portionen, gesamt, gegessen, rest, tagebuchId = null, wirkung, jetzt = new Date(), zusammenfassung = [] }, { id = crypto.randomUUID() } = {}) {
  return {
    id,
    rezeptId: rezept.id,
    name: rezept.name,
    datum: jetzt.toISOString(),
    portionen,
    gesamt,
    gegessen,
    restId: rest?.id ?? null,
    tagebuchId,
    vorher: wirkung.vorher,
    zusammenfassung,
  };
}

export function macheRueckgaengig(protokoll) {
  return { vorratPut: protokoll.vorher, restLoeschen: protokoll.restId, tagebuchLoeschen: protokoll.tagebuchId ?? null, protokollLoeschen: protokoll.id };
}

// ---------- Prüfen beim Einlesen einer Sicherung ----------

export function normalisiereRest(roh) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) throw new Error('Der Rest ist ungültig.');
  if (typeof roh.id !== 'string' || !roh.id) throw new Error('Die Kennung (id) fehlt.');
  const name = String(roh.name ?? '').trim();
  if (!name) throw new Error('Bitte einen Namen eintragen.');
  if (!Number.isInteger(roh.portionen) || roh.portionen < 1) throw new Error('Die Portionen müssen eine ganze Zahl über 0 sein.');
  if (!gueltigesDatum(roh.gekochtAm)) throw new Error('Ungültiges Datum bei „gekocht am“.');
  return { id: roh.id, rezeptId: typeof roh.rezeptId === 'string' ? roh.rezeptId : null, name, portionen: roh.portionen, gekochtAm: roh.gekochtAm, naehrwerte: pruefeNaehrwerte(roh.naehrwerte) };
}

export function normalisiereProtokoll(roh) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) throw new Error('Das Kochprotokoll ist ungültig.');
  if (typeof roh.id !== 'string' || !roh.id) throw new Error('Die Kennung (id) fehlt.');
  const name = String(roh.name ?? '').trim();
  if (!name) throw new Error('Bitte einen Namen eintragen.');
  if (!gueltigesDatum(roh.datum)) throw new Error('Ungültiges Datum.');
  if (!Number.isInteger(roh.portionen) || roh.portionen < 1) throw new Error('Die Portionen müssen eine ganze Zahl über 0 sein.');
  if (!Number.isInteger(roh.gesamt) || roh.gesamt < 1) throw new Error('Die Portionen insgesamt müssen eine ganze Zahl über 0 sein.');
  if (!Number.isInteger(roh.gegessen) || roh.gegessen < 0 || roh.gegessen > roh.gesamt) throw new Error('Die gegessenen Portionen sind ungültig.');
  if (!Array.isArray(roh.vorher)) throw new Error('Der Vorrat im Protokoll ist beschädigt.');
  return {
    id: roh.id,
    rezeptId: typeof roh.rezeptId === 'string' ? roh.rezeptId : null,
    name,
    datum: roh.datum,
    portionen: roh.portionen,
    gesamt: roh.gesamt,
    gegessen: roh.gegessen,
    restId: typeof roh.restId === 'string' ? roh.restId : null,
    tagebuchId: typeof roh.tagebuchId === 'string' ? roh.tagebuchId : null,
    vorher: roh.vorher.map(normalisiereEintrag),
    zusammenfassung: (Array.isArray(roh.zusammenfassung) ? roh.zusammenfassung : []).filter((z) => typeof z === 'string'),
  };
}

// ---------- Laufender Kochvorgang ----------

// Der Stand wird gespeichert, damit man nach einem Wechsel in eine andere App genau da weitermacht, wo man war.
// phase: 'zutaten' (bereitlegen) -> 'schritte' -> 'fertig' (Portionen) -> 'abzug' (Vorrat anpassen)
export function neuerKochstand(rezept, portionen, jetzt = new Date()) {
  return {
    rezeptId: rezept.id,
    portionen,
    phase: 'zutaten',
    schritt: 0,
    bereit: [],
    gesamt: portionen,
    gegessen: Math.min(1, portionen),
    optionalBenutzt: [],
    mengen: {},
    gewuerzLeer: [],
    gestartet: jetzt.toISOString(),
  };
}
