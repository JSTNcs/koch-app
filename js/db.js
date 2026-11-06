// Speicher auf dem Handy (IndexedDB). Hier liegen alle Daten, nichts geht ins Internet.
//
// Tabellen ("stores"):
//  - vorrat:         Einträge im Vorrat (Schlüssel: id)
//  - produkte:       bekannte Produkte per Barcode, auch von Hand eingetragene (Schlüssel: barcode)
//  - einstellungen:  z. B. Datum der letzten Sicherung (Schlüssel: key)

const DB_NAME = 'koch-app';
const DB_VERSION = 1;
export const TABELLEN = {
  vorrat: 'id',
  produkte: 'barcode',
  einstellungen: 'key',
};

let dbPromise = null;

export function oeffneDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('Dieser Browser kann keine Daten speichern.'));
      return;
    }
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      for (const [name, schluessel] of Object.entries(TABELLEN)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: schluessel });
      }
    };
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
  // Bei einem Fehler beim nächsten Mal neu versuchen
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

async function lauf(tabelle, modus, aktion) {
  const db = await oeffneDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tabelle, modus);
    const anfrage = aktion(tx.objectStore(tabelle));
    tx.oncomplete = () => resolve(anfrage?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const alle = (tabelle) => lauf(tabelle, 'readonly', (s) => s.getAll());
export const hole = (tabelle, schluessel) => lauf(tabelle, 'readonly', (s) => s.get(schluessel));
export const speichere = (tabelle, objekt) => lauf(tabelle, 'readwrite', (s) => s.put(objekt));
export const loesche = (tabelle, schluessel) => lauf(tabelle, 'readwrite', (s) => s.delete(schluessel));
export const leere = (tabelle) => lauf(tabelle, 'readwrite', (s) => s.clear());

// Bittet den Browser, die Daten nicht von selbst zu löschen.
export async function datenSchuetzen() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
