// Vorschlagsliste für Eingabefelder "Zutat": <input list="zutaten-liste"> zeigt beim Tippen passende Zutaten.
import { h } from './dom.js';
import { ZUTATEN } from './zutaten.js';

export const ZUTATEN_LISTE_ID = 'zutaten-liste';

export function zutatenDatalist() {
  const namen = [...ZUTATEN].map((z) => z.name).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  return h('datalist', { id: ZUTATEN_LISTE_ID }, namen.map((n) => h('option', { value: n })));
}
