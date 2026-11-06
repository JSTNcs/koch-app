// Open Food Facts abfragen. Das Einzige, was dabei das Handy verlässt, ist der Barcode
// (und was jede Web-Anfrage mitbringt: die IP-Adresse). Kein Cookie, keine Herkunftsadresse.
import { produktAusOff } from './produkt.js';
import { normalisiereBarcode } from './barcode.js';

const BASIS = 'https://world.openfoodfacts.org/api/v2/product/';
const FELDER =
  'code,product_name,product_name_de,generic_name,generic_name_de,brands,quantity,product_quantity,product_quantity_unit,nutriments';

// Ergebnis ist immer eines von:
//   { status: 'gefunden', produkt }
//   { status: 'unbekannt' }              (Open Food Facts kennt den Barcode nicht)
//   { status: 'fehler', grund }          (keine Verbindung, Zeitüberschreitung, Serverfehler)
export async function sucheBeiOff(barcode, { fetchFn = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const code = normalisiereBarcode(barcode);
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), timeoutMs);
  try {
    const antwort = await fetchFn(`${BASIS}${encodeURIComponent(code)}.json?fields=${FELDER}`, {
      signal: abbruch.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (antwort.status === 404) return { status: 'unbekannt' };
    if (!antwort.ok) return { status: 'fehler', grund: `Server meldet Fehler ${antwort.status}.` };
    const produkt = produktAusOff(await antwort.json(), code);
    return produkt ? { status: 'gefunden', produkt } : { status: 'unbekannt' };
  } catch (e) {
    const grund = e?.name === 'AbortError' ? 'Die Suche hat zu lange gedauert.' : 'Keine Verbindung zum Internet.';
    return { status: 'fehler', grund };
  } finally {
    clearTimeout(uhr);
  }
}
