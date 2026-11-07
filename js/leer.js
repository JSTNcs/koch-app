// Leere und fast leere Vorräte erkennen und für die Einkaufsliste vorbereiten. Reine Logik.
import { neuerProduktEintrag, neuerFreiEintrag } from './einkauf.js';

export const FAST_LEER_ANTEIL = 0.2; // unter einem Fünftel der Packungsgröße gilt ein Eintrag als "fast leer"

// 'leer', 'fast' oder null
export function leerStatus(eintrag, produkte) {
  if (eintrag.art === 'da_leer') return eintrag.da === false ? 'leer' : null;
  if (eintrag.menge <= 0) return 'leer';
  const p = eintrag.barcode ? produkte.find((x) => x.barcode === eintrag.barcode) : null;
  if (p && p.art === 'menge' && p.einheit === eintrag.einheit && p.packung && eintrag.menge < FAST_LEER_ANTEIL * p.packung) return 'fast';
  return null;
}

// Listeneintrag für "Auf die Liste": das bekannte Produkt (Anzahl 1) oder sonst Freitext mit Name und Zutat
export function listeneintragFuerLeer(eintrag, produkte) {
  const p = eintrag.barcode ? produkte.find((x) => x.barcode === eintrag.barcode) : null;
  if (p) return neuerProduktEintrag({ ...p, zutat: p.zutat || eintrag.zutat || null }, 1);
  return neuerFreiEintrag({ name: eintrag.name, anzahl: 1, einheit: 'stk', zutat: eintrag.zutat || null });
}
