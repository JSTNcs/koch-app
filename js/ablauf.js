// Ablaufdatum: Hinweise für bald ablaufende Zutaten. Reine Logik (ohne Bildschirm und Datenbank).
//
// "Datum überschritten" heißt nicht automatisch "verdorben" (Mindesthaltbarkeitsdatum): Die App sagt das neutral und wertet nicht.

export const BALD_TAGE = 3; // bis zu 3 Tage vor dem Datum gilt ein Eintrag als "bald ablaufend"

const tagNummer = (j, m, t) => Date.UTC(j, m, t) / 86400000;
const zwei = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
const datumDeutsch = (s) => s.split('-').reverse().join('.');

// Ganze Kalendertage bis zum Datum (JJJJ-MM-TT) in Ortszeit: 0 = heute, negativ = schon überschritten.
export function tageBis(ablauf, jetzt = new Date()) {
  const [j, m, t] = ablauf.split('-').map(Number);
  return Math.round(tagNummer(j, m - 1, t) - tagNummer(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()));
}

export function kurzText(tage) {
  if (tage < 0) return 'überschritten';
  if (tage === 0) return 'heute';
  if (tage === 1) return 'morgen';
  return `in ${tage} Tagen`;
}

// { art: 'keins' | 'abgelaufen' | 'bald' | 'ok', tage, text }
export function ablaufStatus(ablauf, jetzt = new Date(), schwelle = BALD_TAGE) {
  if (!ablauf) return { art: 'keins', tage: null, text: '' };
  const tage = tageBis(ablauf, jetzt);
  if (tage < 0) return { art: 'abgelaufen', tage, text: tage === -1 ? 'Datum gestern überschritten' : `Datum seit ${-tage} Tagen überschritten` };
  if (tage <= schwelle) return { art: 'bald', tage, text: tage === 0 ? 'läuft heute ab' : tage === 1 ? 'läuft morgen ab' : `läuft in ${tage} Tagen ab` };
  return { art: 'ok', tage, text: `Haltbar bis ${datumDeutsch(ablauf)}` };
}

const istDa = (e) => (e.art === 'menge' ? e.menge > 0 : e.da === true);

// Vorhandene Einträge, die bald ablaufen oder deren Datum überschritten ist, die dringendsten zuerst.
export function baldAblaufend(vorrat, jetzt = new Date(), schwelle = BALD_TAGE) {
  return vorrat
    .filter((e) => e.ablauf && istDa(e))
    .map((eintrag) => ({ eintrag, status: ablaufStatus(eintrag.ablauf, jetzt, schwelle) }))
    .filter((x) => x.status.art === 'bald' || x.status.art === 'abgelaufen')
    .sort((a, b) => a.status.tage - b.status.tage || a.eintrag.name.localeCompare(b.eintrag.name, 'de'));
}

// Schnellknöpfe fürs Datum: heute plus Tage bzw. Monate (am Monatsende nicht über den Monat hinaus)
export function datumInTagen(n, jetzt = new Date()) {
  return iso(new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + n));
}

export function datumInMonaten(n, jetzt = new Date()) {
  const tageImZiel = new Date(jetzt.getFullYear(), jetzt.getMonth() + n + 1, 0).getDate();
  return iso(new Date(jetzt.getFullYear(), jetzt.getMonth() + n, Math.min(jetzt.getDate(), tageImZiel)));
}
