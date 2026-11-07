// Körperdaten und Tagesziel speichern und laden (Tabelle "einstellungen", Schlüssel "profil").
import { hole, speichere } from './db.js';
import { normalisiereProfil } from './tagesziel.js';

// Gibt das gespeicherte Profil zurück oder null (nichts gespeichert oder unlesbar).
export async function ladeProfil() {
  try {
    const eintrag = await hole('einstellungen', 'profil');
    return eintrag ? normalisiereProfil(eintrag.value) : null;
  } catch {
    return null;
  }
}

export async function speichereProfil(profil) {
  await speichere('einstellungen', { key: 'profil', value: normalisiereProfil(profil) });
}
