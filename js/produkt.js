// Produkte: Daten von Open Food Facts lesen, eigene Produkte prüfen, Produkt -> Vorrats-Eintrag.
// Reine Logik, kein Netzwerk und keine Datenbank (die liegen in off.js und db.js).
import { EINHEITEN, neuerEintrag } from './pantry.js';
import { bereinigeBarcode, normalisiereBarcode } from './barcode.js';

const ZAHL = '(\\d+(?:[.,]\\d+)?)';
const EINHEIT = '(kg|g|ml|cl|dl|l|stück|stk|st|pcs|pieces)';
const MAL = new RegExp(`^\\s*${ZAHL}\\s*[x×]\\s*${ZAHL}\\s*${EINHEIT}\\b`, 'i');
const EINZEL = new RegExp(`${ZAHL}\\s*${EINHEIT}\\b`, 'i');

function zahl(text) {
  return Number(String(text).replace(',', '.'));
}

function umrechnen(menge, einheit) {
  switch (einheit.toLowerCase()) {
    case 'kg': return { menge: menge * 1000, einheit: 'g' };
    case 'g': return { menge, einheit: 'g' };
    case 'l': return { menge: menge * 1000, einheit: 'ml' };
    case 'dl': return { menge: menge * 100, einheit: 'ml' };
    case 'cl': return { menge: menge * 10, einheit: 'ml' };
    case 'ml': return { menge, einheit: 'ml' };
    default: return { menge, einheit: 'stk' }; // Stück, stk, st, pcs, pieces
  }
}

// "500 g", "1,5 kg", "6 x 125 g", "75 cl" -> { menge, einheit } mit g, ml oder stk. Sonst null.
export function parseMengenText(text) {
  if (typeof text !== 'string') return null;
  const mal = MAL.exec(text);
  const treffer = mal || EINZEL.exec(text);
  if (!treffer) return null;
  const basis = mal ? zahl(mal[1]) * zahl(mal[2]) : zahl(treffer[1]);
  const einheit = mal ? mal[3] : treffer[2];
  const ergebnis = umrechnen(basis, einheit);
  ergebnis.menge = Math.round(ergebnis.menge * 100) / 100;
  return ergebnis.menge > 0 ? ergebnis : null;
}

function zahlOderNull(wert) {
  if (wert === null || wert === undefined || wert === '') return null;
  const n = Number(wert);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const runde1 = (n) => (n === null ? null : Math.round(n * 10) / 10);

function naehrwerteAusOff(n) {
  if (!n || typeof n !== 'object') return null;
  let kcal = zahlOderNull(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = zahlOderNull(n.energy_100g);
    kcal = kj === null ? null : kj / 4.184;
  }
  const werte = {
    kcal: runde1(kcal),
    eiweiss: runde1(zahlOderNull(n.proteins_100g)),
    kohlenhydrate: runde1(zahlOderNull(n.carbohydrates_100g)),
    fett: runde1(zahlOderNull(n.fat_100g)),
  };
  return Object.values(werte).every((v) => v === null) ? null : werte;
}

// Antwort von Open Food Facts -> unser Produkt. Nicht gefunden: null.
export function produktAusOff(antwort, barcode) {
  if (!antwort || antwort.status !== 1 || !antwort.product) return null;
  const p = antwort.product;
  const name = String(p.product_name_de || p.product_name || p.generic_name_de || p.generic_name || '').trim();
  const marke = String(p.brands || '').split(',')[0].trim() || null;

  let packung = parseMengenText(p.quantity);
  if (!packung) {
    const menge = zahlOderNull(p.product_quantity);
    const einheit = String(p.product_quantity_unit || '').toLowerCase();
    if (menge && ['g', 'ml'].includes(einheit)) packung = { menge, einheit };
  }

  return {
    barcode: normalisiereBarcode(barcode),
    name,
    marke,
    art: 'menge',
    packung: packung ? packung.menge : null,
    einheit: packung ? packung.einheit : null,
    naehrwerte: naehrwerteAusOff(p.nutriments),
    quelle: 'off',
    gruppe: null,
  };
}

// Prüft ein Produkt (z. B. von Hand eingetragen oder korrigiert). Wirft Fehler mit deutscher Meldung.
export function neuesProdukt(eingabe) {
  const barcode = normalisiereBarcode(bereinigeBarcode(eingabe.barcode));
  if (!barcode) throw new Error('Es fehlt der Barcode.');
  const name = String(eingabe.name ?? '').trim();
  if (!name) throw new Error('Bitte einen Namen eintragen.');
  if (!['menge', 'da_leer'].includes(eingabe.art)) throw new Error('Ungültige Art (Menge oder da / leer).');

  let packung = null;
  let einheit = null;
  if (eingabe.art === 'menge') {
    if (!EINHEITEN.includes(eingabe.einheit)) throw new Error('Ungültige Einheit (g, ml oder Stück).');
    if (typeof eingabe.packung !== 'number' || !Number.isFinite(eingabe.packung) || eingabe.packung <= 0) {
      throw new Error('Bitte eine Packungsgröße größer als 0 eintragen.');
    }
    packung = eingabe.packung;
    einheit = eingabe.einheit;
  }

  let naehrwerte = null;
  if (eingabe.naehrwerte) {
    const felder = ['kcal', 'eiweiss', 'kohlenhydrate', 'fett'];
    const werte = {};
    for (const feld of felder) {
      const roh = eingabe.naehrwerte[feld];
      if (roh === null || roh === undefined) {
        werte[feld] = null;
      } else if (typeof roh === 'number' && Number.isFinite(roh) && roh >= 0) {
        werte[feld] = roh;
      } else {
        throw new Error('Nährwerte müssen Zahlen ab 0 sein.');
      }
    }
    naehrwerte = Object.values(werte).every((v) => v === null) ? null : werte;
  }

  return {
    barcode,
    name,
    marke: eingabe.marke ? String(eingabe.marke) : null,
    art: eingabe.art,
    packung,
    einheit,
    naehrwerte,
    quelle: eingabe.quelle === 'off' ? 'off' : 'manuell',
    gruppe: eingabe.gruppe ? String(eingabe.gruppe) : null,
  };
}

// Aus einem Produkt und der gekauften Anzahl Packungen wird ein Vorrats-Eintrag.
export function eintragAusProdukt(produkt, { anzahl = 1, ablauf = '' } = {}, optionen = {}) {
  if (produkt.art === 'da_leer') {
    return neuerEintrag({ name: produkt.name, art: 'da_leer', ablauf, barcode: produkt.barcode }, optionen);
  }
  if (typeof anzahl !== 'number' || !Number.isFinite(anzahl) || anzahl <= 0) {
    throw new Error('Bitte eine Anzahl größer als 0 eintragen.');
  }
  return neuerEintrag(
    {
      name: produkt.name,
      art: 'menge',
      menge: Math.round(produkt.packung * anzahl * 100) / 100,
      einheit: produkt.einheit,
      ablauf,
      barcode: produkt.barcode,
    },
    optionen
  );
}

// ---------- Gleichwertige Produkte ("andere Firma, gleiches Produkt") ----------
// Produkte mit derselben "gruppe" gelten als austauschbar (z. B. Barilla Spaghetti und Gut & Günstig Spaghetti).

export function gruppeVon(barcode, alleProdukte) {
  return alleProdukte.find((p) => p.barcode === barcode)?.gruppe || null;
}

// Macht a und b gleichwertig. Rückgabe: alle Produkte, die sich dadurch ändern und gespeichert werden müssen.
// Haben beide schon verschiedene Gruppen, wandert die Gruppe von b komplett in die von a.
export function gleichsetzen(alleProdukte, a, b, { gruppe } = {}) {
  if (a.barcode === b.barcode) return [];
  const ga = a.gruppe || null;
  const gb = b.gruppe || null;
  if (ga && ga === gb) return [];
  const ziel = ga || gb || gruppe || crypto.randomUUID();
  const geaendert = new Map();
  const setze = (p) => {
    if ((p.gruppe || null) !== ziel) geaendert.set(p.barcode, { ...p, gruppe: ziel });
  };
  setze(a);
  setze(b);
  if (ga && gb) for (const p of alleProdukte) if (p.gruppe === gb) setze(p);
  return [...geaendert.values()];
}
