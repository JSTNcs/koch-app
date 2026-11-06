// Sicherung: Daten in eine Datei packen und aus einer Datei prüfen. Reine Logik (ohne Datenbank, ohne Bildschirm).
import { neuerEintrag } from './pantry.js';
import { neuesProdukt } from './produkt.js';

const APP = 'koch-app';
const VERSION = 1;
const NICHT_SICHERN = ['letzteSicherung']; // gehört zu diesem Handy, nicht zu den Daten
const TAG_MS = 86400000;

export function erzeugeSicherung({ vorrat, produkte, einstellungen }, jetzt = new Date()) {
  return {
    app: APP,
    version: VERSION,
    erstelltAm: jetzt.toISOString(),
    daten: {
      vorrat,
      produkte,
      einstellungen: (einstellungen || []).filter((e) => !NICHT_SICHERN.includes(e.key)),
    },
  };
}

export function sicherungsDateiname(jetzt = new Date()) {
  const zwei = (n) => String(n).padStart(2, '0');
  return `koch-app-sicherung-${jetzt.getFullYear()}-${zwei(jetzt.getMonth() + 1)}-${zwei(jetzt.getDate())}.json`;
}

const KEINE_SICHERUNG = 'Diese Datei ist keine Sicherung der Koch-App.';

// Liest den Text einer Sicherungsdatei, prüft jeden Eintrag und gibt saubere Daten zurück.
// Bei jedem Problem: Fehler mit deutscher Meldung. Es wird nichts verändert, bevor alles geprüft ist.
export function pruefeSicherung(text) {
  let s;
  try {
    s = JSON.parse(text);
  } catch {
    throw new Error(`Die Datei konnte nicht gelesen werden. ${KEINE_SICHERUNG}`);
  }
  if (!s || typeof s !== 'object' || Array.isArray(s) || s.app !== APP) throw new Error(KEINE_SICHERUNG);
  if (!Number.isInteger(s.version) || s.version < 1) throw new Error(KEINE_SICHERUNG);
  if (s.version > VERSION) {
    throw new Error('Diese Sicherung stammt von einer neueren Version der App. Bitte aktualisiere zuerst die App.');
  }
  const d = s.daten;
  if (!d || typeof d !== 'object') throw new Error('In der Datei fehlen die Daten.');
  if (!Array.isArray(d.vorrat)) throw new Error('Der Vorrat in der Datei ist beschädigt.');
  if (!Array.isArray(d.produkte)) throw new Error('Die Produkte in der Datei sind beschädigt.');

  const ids = new Set();
  const vorrat = d.vorrat.map((roh, i) => {
    const nr = `Vorrat, Eintrag ${i + 1}`;
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) throw new Error(`${nr} ist kein gültiger Eintrag.`);
    if (typeof roh.id !== 'string' || !roh.id) throw new Error(`${nr}: Die Kennung (id) fehlt.`);
    let e;
    try {
      e = neuerEintrag(roh, { id: roh.id });
    } catch (fehler) {
      throw new Error(`${nr}: ${fehler.message}`);
    }
    if (e.art === 'da_leer' && typeof roh.da === 'boolean') e.da = roh.da;
    if (ids.has(e.id)) throw new Error('Im Vorrat kommt eine Kennung doppelt vor.');
    ids.add(e.id);
    return e;
  });

  const barcodes = new Set();
  const produkte = d.produkte.map((roh, i) => {
    const nr = `Produkt ${i + 1}`;
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) throw new Error(`${nr} ist kein gültiges Produkt.`);
    let p;
    try {
      p = neuesProdukt(roh);
    } catch (fehler) {
      throw new Error(`${nr}: ${fehler.message}`);
    }
    if (barcodes.has(p.barcode)) throw new Error('Bei den Produkten kommt ein Barcode doppelt vor.');
    barcodes.add(p.barcode);
    return p;
  });

  const einstellungen = (Array.isArray(d.einstellungen) ? d.einstellungen : []).filter(
    (e) => e && typeof e.key === 'string' && !NICHT_SICHERN.includes(e.key) && 'value' in e
  );
  return { vorrat, produkte, einstellungen, erstelltAm: typeof s.erstelltAm === 'string' ? s.erstelltAm : null };
}

// Volle Tage seit einem Zeitpunkt. Kaputtes oder fehlendes Datum: null.
export function tageSeit(iso, jetzt = new Date()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((jetzt.getTime() - t) / TAG_MS));
}

// Text für die Erinnerung oder null, wenn alles in Ordnung ist.
// Erinnert nur, wenn es überhaupt Daten gibt und die letzte Sicherung älter als 7 Tage ist.
export function sicherungsHinweis({ letzte, hatDaten, jetzt = new Date() }) {
  if (!hatDaten) return null;
  const t = Date.parse(letzte);
  if (Number.isNaN(t)) return 'Du hast noch keine Sicherung gemacht. Sichere deine Daten, damit nichts verloren geht.';
  if (jetzt.getTime() - t <= 7 * TAG_MS) return null;
  return `Deine letzte Sicherung war vor ${tageSeit(letzte, jetzt)} Tagen. Sichere deine Daten, damit nichts verloren geht.`;
}
