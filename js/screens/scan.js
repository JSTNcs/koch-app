// Scan-Ablauf im Vorrat: Kamera -> Barcode -> Produkt suchen -> prüfen -> in den Vorrat.
import { h, ersetze } from '../dom.js';
import { alle, hole, speichere } from '../db.js';
import { starteScanner } from '../scanner.js';
import { barcodeGueltig, bereinigeBarcode, normalisiereBarcode } from '../barcode.js';
import { sucheBeiOff } from '../off.js';
import { neuesProdukt, eintragAusProdukt } from '../produkt.js';
import { hinzufuegenOderErhoehen, parseZahl, formatMenge } from '../pantry.js';

// fertig(): wird aufgerufen, wenn der Nutzer zurück zum Vorrat will.
export function starteScan(container, { fertig }) {
  let scanner = null;
  let beendet = false;

  function aufraeumen() {
    beendet = true;
    scanner?.stop();
    scanner = null;
  }
  // Wechselt der Nutzer den Tab, muss die Kamera ausgehen.
  window.addEventListener('hashchange', aufraeumen, { once: true });

  function zurueck() {
    aufraeumen();
    window.removeEventListener('hashchange', aufraeumen);
    fertig();
  }

  function hinweisBox(typ, text) {
    return text ? h('p', { class: `hinweis ${typ || ''}` }, text) : null;
  }

  // ---------- 1. Kamera ----------
  async function zeigeKamera(meldung = null) {
    beendet = false;
    const video = h('video', { playsinline: true, muted: true, autoplay: true });
    const status = h('p', { class: 'hinweis' }, 'Kamera wird gestartet …');
    const eingabe = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Barcode-Nummer', autocomplete: 'off' });
    const fehlerBox = h('div');

    function sucheMitEingabe() {
      const code = bereinigeBarcode(eingabe.value);
      if (!barcodeGueltig(code)) {
        ersetze(fehlerBox, 
          hinweisBox('fehler', 'Diese Nummer ist kein gültiger Barcode (8, 12 oder 13 Ziffern, Prüfziffer stimmt nicht). Bitte noch einmal prüfen.')
        );
        return;
      }
      aufraeumen();
      verarbeite(normalisiereBarcode(code));
    }

    ersetze(container, 
      h('h2', {}, 'Barcode scannen'),
      hinweisBox('', meldung),
      h('div', { class: 'scanner' }, video, h('div', { class: 'zielhilfe' })),
      status,
      h(
        'details',
        {},
        h('summary', {}, 'Barcode eintippen'),
        h('label', {}, 'Nummer unter dem Barcode'),
        eingabe,
        fehlerBox,
        h('button', { class: 'voll', style: 'margin-top:10px', onclick: sucheMitEingabe }, 'Suchen')
      ),
      h('button', { class: 'zweit voll', style: 'margin-top:16px', onclick: zurueck }, 'Abbrechen')
    );

    try {
      const s = await starteScanner(video, (roh) => {
        const code = bereinigeBarcode(roh);
        if (!barcodeGueltig(code)) return false; // falsch gelesen: weiter suchen
        setTimeout(() => verarbeite(normalisiereBarcode(code)), 0);
        return true;
      });
      if (beendet) s.stop();
      else {
        scanner = s;
        status.textContent = 'Halte den Barcode ruhig vor die Kamera.';
      }
    } catch (e) {
      status.className = 'hinweis warnung';
      status.textContent = e.message;
    }
  }

  // ---------- 2. Produkt suchen ----------
  async function verarbeite(code) {
    aufraeumen();
    beendet = false;
    ersetze(container, h('h2', {}, 'Barcode gelesen'), h('p', {}, code), h('p', { class: 'hinweis' }, 'Produkt wird gesucht …'));

    let produkt = null;
    let hinweis;
    try {
      produkt = (await hole('produkte', code)) || null;
    } catch (e) {
      console.warn('Produktspeicher:', e);
    }

    if (produkt) {
      hinweis = { typ: '', text: 'Dieses Produkt kennt die App schon. Prüfe nur kurz die Anzahl.' };
    } else {
      const r = await sucheBeiOff(code);
      if (r.status === 'gefunden') {
        produkt = r.produkt;
        hinweis = { typ: '', text: 'Gefunden bei Open Food Facts. Bitte kurz prüfen.' };
        if (!produkt.name || produkt.packung === null) {
          hinweis = { typ: 'warnung', text: 'Gefunden, aber Name oder Packungsgröße fehlen. Bitte ergänzen.' };
        }
      } else {
        hinweis = {
          typ: 'warnung',
          text:
            r.status === 'fehler'
              ? `${r.grund} Du kannst das Produkt jetzt von Hand eintragen, die App merkt es sich.`
              : 'Dieses Produkt ist unbekannt. Trage es einmal von Hand ein, die App merkt es sich.',
        };
      }
    }
    if (!produkt) {
      produkt = { barcode: code, name: '', marke: null, art: 'menge', packung: null, einheit: 'g', naehrwerte: null, quelle: 'manuell' };
    }
    zeigeFormular(produkt, hinweis);
  }

  // ---------- 3. Prüfen und eintragen ----------
  function zeigeFormular(start, hinweis) {
    const zahlText = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));
    const nw = start.naehrwerte || {};

    const name = h('input', { type: 'text', value: start.name || '', autocomplete: 'off', placeholder: 'z. B. Spaghetti' });
    const art = h(
      'select',
      {},
      h('option', { value: 'menge', selected: start.art === 'menge' }, 'Abgemessen (g, ml oder Stück)'),
      h('option', { value: 'da_leer', selected: start.art === 'da_leer' }, 'Gewürz, Öl, Salz: nur da / leer')
    );
    const packung = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(start.packung), placeholder: 'z. B. 500' });
    const einheit = h(
      'select',
      {},
      h('option', { value: 'g', selected: start.einheit === 'g' }, 'Gramm (g)'),
      h('option', { value: 'ml', selected: start.einheit === 'ml' }, 'Milliliter (ml)'),
      h('option', { value: 'stk', selected: start.einheit === 'stk' }, 'Stück')
    );
    const anzahl = h('input', { type: 'text', inputmode: 'decimal', value: '1' });
    const ablauf = h('input', { type: 'date' });
    const kcal = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(nw.kcal) });
    const eiweiss = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(nw.eiweiss) });
    const kh = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(nw.kohlenhydrate) });
    const fett = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(nw.fett) });
    const fehlerBox = h('div');

    const mengeBlock = h(
      'div',
      {},
      h('label', {}, 'Packungsgröße'),
      h('div', { class: 'zeile' }, packung, einheit),
      h('label', {}, 'Anzahl Packungen'),
      anzahl
    );
    const umschalten = () => (mengeBlock.hidden = art.value === 'da_leer');
    art.addEventListener('change', umschalten);
    umschalten();

    const leerOderZahl = (feld) => (feld.value.trim() === '' ? null : parseZahl(feld.value));

    async function speichern() {
      try {
        const produkt = neuesProdukt({
          barcode: start.barcode,
          name: name.value,
          marke: start.marke,
          art: art.value,
          packung: art.value === 'menge' ? parseZahl(packung.value) : null,
          einheit: einheit.value,
          naehrwerte: { kcal: leerOderZahl(kcal), eiweiss: leerOderZahl(eiweiss), kohlenhydrate: leerOderZahl(kh), fett: leerOderZahl(fett) },
          quelle: start.quelle,
        });
        const neu = eintragAusProdukt(produkt, { anzahl: parseZahl(anzahl.value), ablauf: ablauf.value });

        await speichere('produkte', produkt); // merkt sich das Produkt für das nächste Mal
        const r = hinzufuegenOderErhoehen(await alle('vorrat'), neu);
        await speichere('vorrat', r.eintrag);
        zeigeErgebnis(produkt, neu, r);
      } catch (e) {
        ersetze(fehlerBox, hinweisBox('fehler', e.message));
        fehlerBox.scrollIntoView({ block: 'center' });
      }
    }

    ersetze(container, 
      h('h2', {}, 'Produkt prüfen'),
      h('p', { class: 'menge' }, `Barcode ${start.barcode}`),
      hinweisBox(hinweis?.typ, hinweis?.text),
      h('label', {}, 'Name'),
      name,
      h('label', {}, 'Art'),
      art,
      mengeBlock,
      h('label', {}, 'Haltbar bis (freiwillig)'),
      ablauf,
      h(
        'details',
        { style: 'margin-top:12px' },
        h('summary', {}, 'Nährwerte pro 100 g / 100 ml (freiwillig)'),
        h('label', {}, 'Kalorien (kcal)'),
        kcal,
        h('label', {}, 'Eiweiß (g)'),
        eiweiss,
        h('label', {}, 'Kohlenhydrate (g)'),
        kh,
        h('label', {}, 'Fett (g)'),
        fett
      ),
      fehlerBox,
      h(
        'div',
        { class: 'zeile', style: 'margin-top:20px' },
        h('button', { class: 'zweit', onclick: zurueck }, 'Abbrechen'),
        h('button', { onclick: speichern }, 'Zum Vorrat')
      )
    );
  }

  // ---------- 4. Ergebnis ----------
  function zeigeErgebnis(produkt, neu, r) {
    const zugefuegt = neu.art === 'menge' ? formatMenge(neu.menge, neu.einheit) : 'da';
    const jetzt =
      r.zusammengefuehrt && r.eintrag.art === 'menge' ? ` Im Vorrat sind jetzt ${formatMenge(r.eintrag.menge, r.eintrag.einheit)}.` : '';
    ersetze(container, 
      h('h2', {}, '✔ Hinzugefügt'),
      h('p', { class: 'hinweis' }, `${produkt.name}: ${zugefuegt}.${jetzt}`),
      h('button', { class: 'voll', style: 'margin-bottom:12px', onclick: () => zeigeKamera() }, '📷 Nächstes Produkt scannen'),
      h('button', { class: 'zweit voll', onclick: zurueck }, 'Fertig')
    );
  }

  zeigeKamera();
}
