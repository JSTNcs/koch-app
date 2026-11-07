// Scan-Ablauf: Kamera -> Barcode -> Produkt suchen -> prüfen -> eintragen.
//
// modus:
//   'vorrat'    (Standard) Produkt kommt in den Vorrat. Die Einkaufsliste bleibt unberührt.
//   'liste'     Produkt kommt auf die Einkaufsliste (z. B. die leere Packung zu Hause).
//   'einkaufen' Produkt kommt in den Vorrat UND wird von der Einkaufsliste genommen. Passt es zu keinem
//               Eintrag, fragt die App: "Ist das Ersatz für …?" (andere Firma, gleiches Produkt).
import { h, ersetze } from '../dom.js';
import { schlageZutatVor } from '../zutaten.js';
import { ablaufSchnellknoepfe } from '../ablauf-ui.js';
import { zutatenDatalist, ZUTATEN_LISTE_ID } from '../zutaten-ui.js';
import { alle, hole, schreibeAlles } from '../db.js';
import { starteScanner } from '../scanner.js';
import { barcodeGueltig, bereinigeBarcode, normalisiereBarcode } from '../barcode.js';
import { sucheBeiOff } from '../off.js';
import { neuesProdukt, eintragAusProdukt, gleichsetzen } from '../produkt.js';
import { hinzufuegenOderErhoehen, parseZahl, formatMenge } from '../pantry.js';
import { findeTreffer, kandidaten, verbucheScan, neuerProduktEintrag, fuegeHinzu, eintragTexte, produktAusEintrag } from '../einkauf.js';

const UEBERSCHRIFT = {
  vorrat: 'Barcode scannen',
  liste: 'Produkt für die Liste scannen',
  einkaufen: 'Einkauf scannen',
  tagebuch: 'Essen scannen',
};

// fertig(): wird aufgerufen, wenn der Nutzer zurück will.
// beiProdukt(produkt, hinweis): Wenn angegeben (Tagebuch), übernimmt der Aufrufer das Produkt statt des Vorrats-Formulars.
export function starteScan(container, { fertig, modus = 'vorrat', beiProdukt = null }) {
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
        ersetze(
          fehlerBox,
          hinweisBox('fehler', 'Diese Nummer ist kein gültiger Barcode (8, 12 oder 13 Ziffern, Prüfziffer stimmt nicht). Bitte noch einmal prüfen.')
        );
        return;
      }
      aufraeumen();
      verarbeite(normalisiereBarcode(code));
    }

    ersetze(
      container,
      h('h2', {}, UEBERSCHRIFT[modus]),
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
      produkt = { barcode: code, name: '', marke: null, art: 'menge', packung: null, einheit: 'g', naehrwerte: null, quelle: 'manuell', gruppe: null };
    }

    if (beiProdukt) return beiProdukt(produkt, hinweis);

    // Beim Einkaufen: Steht das Produkt (oder ein gleichwertiges) auf der Liste? Dann Anzahl vorausfüllen.
    let anzahlStart = 1;
    if (modus === 'einkaufen') {
      try {
        const [liste, alleProdukte] = await Promise.all([alle('einkauf'), alle('produkte')]);
        const treffer = findeTreffer(liste, produkt, alleProdukte);
        if (treffer) {
          const t = eintragTexte(treffer);
          if (treffer.typ === 'produkt') anzahlStart = treffer.anzahl;
          else if (treffer.einheit === produkt.einheit && produkt.packung) anzahlStart = Math.max(1, Math.ceil(treffer.anzahl / produkt.packung));
          hinweis = {
            typ: '',
            text: `Passt zu deiner Liste: ${t.titel} (${t.menge}). Nach dem Eintragen wird es von der Liste genommen. ${hinweis.text}`,
          };
        }
      } catch (e) {
        console.warn('Einkaufsliste:', e);
      }
    }
    zeigeFormular(produkt, hinweis, anzahlStart);
  }

  // ---------- 3. Prüfen und eintragen ----------
  function zeigeFormular(start, hinweis, anzahlStart = 1) {
    const zahlText = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));
    const nw = start.naehrwerte || {};
    const mitAblauf = modus !== 'liste';

    const name = h('input', { type: 'text', value: start.name || '', autocomplete: 'off', placeholder: 'z. B. Spaghetti' });
    const art = h(
      'select',
      {},
      h('option', { value: 'menge', selected: start.art === 'menge' }, 'Abgemessen (g, ml oder Stück)'),
      h('option', { value: 'da_leer', selected: start.art === 'da_leer' }, 'Gewürz, Öl, Salz: nur da / leer')
    );
    // Die Zutat verbindet das Produkt mit Rezepten ("Barilla Spaghetti" -> "Spaghetti"). Die App macht einen Vorschlag.
    const zutat = h('input', { type: 'text', list: ZUTATEN_LISTE_ID, value: start.zutat || schlageZutatVor(start.name) || '', placeholder: 'z. B. Spaghetti', autocomplete: 'off' });
    const packung = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(start.packung), placeholder: 'z. B. 500' });
    const einheit = h(
      'select',
      {},
      h('option', { value: 'g', selected: start.einheit === 'g' }, 'Gramm (g)'),
      h('option', { value: 'ml', selected: start.einheit === 'ml' }, 'Milliliter (ml)'),
      h('option', { value: 'stk', selected: start.einheit === 'stk' }, 'Stück')
    );
    const anzahl = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(anzahlStart) });
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
          gruppe: start.gruppe,
          zutat: zutat.value,
        });
        const anzahlWert = art.value === 'menge' ? parseZahl(anzahl.value) : 1;

        if (modus === 'liste') {
          const r = fuegeHinzu(await alle('einkauf'), neuerProduktEintrag(produkt, anzahlWert));
          await schreibeAlles({ produkte: { put: [produkt] }, einkauf: { put: [r.eintrag] } });
          zeigeListenErgebnis(produkt, r);
          return;
        }

        const neu = eintragAusProdukt(produkt, { anzahl: anzahlWert, ablauf: ablauf.value });
        if (modus === 'einkaufen') {
          const [liste, alleProdukte] = await Promise.all([alle('einkauf'), alle('produkte')]);
          const treffer = findeTreffer(liste, produkt, alleProdukte);
          if (treffer) return await buchen({ produkt, neu, anzahlWert, treffer, ersatz: false });
          const k = kandidaten(liste, produkt);
          if (k.length) return zeigeZuordnung({ produkt, neu, anzahlWert, k });
        }
        await buchen({ produkt, neu, anzahlWert, treffer: null, ersatz: false });
      } catch (e) {
        ersetze(fehlerBox, hinweisBox('fehler', e.message));
        fehlerBox.scrollIntoView({ block: 'center' });
      }
    }

    ersetze(
      container,
      h('h2', {}, 'Produkt prüfen'),
      h('p', { class: 'menge' }, `Barcode ${start.barcode}`),
      hinweisBox(hinweis?.typ, hinweis?.text),
      zutatenDatalist(),
      h('label', {}, 'Name'),
      name,
      h('label', {}, 'Zutat für Rezepte (Vorschlag, freiwillig)'),
      zutat,
      h('label', {}, 'Art'),
      art,
      mengeBlock,
      mitAblauf ? [h('label', {}, 'Haltbar bis (freiwillig)'), ablauf, ablaufSchnellknoepfe(ablauf)] : null,
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
        h('button', { onclick: speichern }, modus === 'liste' ? 'Auf die Liste' : 'Zum Vorrat')
      )
    );
  }

  // ---------- 3b. Nur beim Einkaufen: Ist das Ersatz für einen Listeneintrag? ----------
  function zeigeZuordnung({ produkt, neu, anzahlWert, k }) {
    const zeile = ({ eintrag, aehnlich }) => {
      const t = eintragTexte(eintrag);
      return h(
        'button',
        {
          class: 'zweit voll wahl',
          onclick: () => buchen({ produkt, neu, anzahlWert, treffer: eintrag, ersatz: true }).catch(zeigeFehler),
        },
        h('span', { class: 'wahl-titel' }, t.titel, aehnlich ? h('span', { class: 'marke' }, ' Vorschlag') : null),
        h('span', { class: 'wahl-info' }, [t.untertitel, t.menge].filter(Boolean).join(' · '))
      );
    };
    ersetze(
      container,
      h('h2', {}, 'Steht nicht auf der Liste'),
      h('p', {}, `„${produkt.name}“ steht nicht auf deiner Einkaufsliste. Ist es Ersatz für einen Eintrag? (Andere Firma, gleiches Produkt.)`),
      h('p', { class: 'menge' }, 'Das Produkt kommt in jedem Fall in den Vorrat. Wenn du einen Eintrag wählst, wird er von der Liste genommen und die App merkt sich, dass beide gleichwertig sind.'),
      h('div', { class: 'wahlliste' }, k.map(zeile)),
      h('button', { class: 'voll', style: 'margin-top:12px', onclick: () => buchen({ produkt, neu, anzahlWert, treffer: null, ersatz: false }).catch(zeigeFehler) }, 'Kein Ersatz, nur in den Vorrat'),
      h('button', { class: 'zweit voll', style: 'margin-top:12px', onclick: zurueck }, 'Abbrechen')
    );
  }

  function zeigeFehler(e) {
    ersetze(container, h('h2', {}, 'Das hat nicht geklappt'), h('p', { class: 'hinweis fehler' }, e.message), h('button', { class: 'zweit voll', onclick: zurueck }, 'Zurück'));
  }

  // ---------- 4. Alles auf einmal speichern ----------
  async function buchen({ produkt, neu, anzahlWert, treffer, ersatz }) {
    const [vorrat, alleProdukte] = await Promise.all([alle('vorrat'), alle('produkte')]);
    const r = hinzufuegenOderErhoehen(vorrat, neu);
    const aenderung = { vorrat: { put: [r.eintrag] }, produkte: { put: [produkt] }, einkauf: { put: [], loesche: [] } };
    const listenInfo = [];

    if (treffer) {
      // Freitext steht in g/ml/Stück ("Spaghetti 400 g"), gescannt wurden Packungen: dann Packung mal Anzahl verrechnen
      const gekauft =
        treffer.typ === 'frei'
          ? produkt.einheit && produkt.einheit === treffer.einheit
            ? produkt.packung * anzahlWert
            : treffer.anzahl
          : anzahlWert;
      const v = verbucheScan(treffer, gekauft);
      const t = eintragTexte(treffer);
      if (v.loeschen) {
        aenderung.einkauf.loesche.push(v.loeschen);
        listenInfo.push(`Von der Liste genommen: ${t.titel}.`);
      } else if (v.aendern) {
        aenderung.einkauf.put.push(v.aendern);
        listenInfo.push(`Auf der Liste fehlen noch ${eintragTexte(v.aendern).menge} ${t.titel}.`);
      }
      if (ersatz && treffer.typ === 'produkt') {
        // Merken: beide Produkte sind gleichwertig (andere Firma, gleiches Produkt)
        const listenProdukt =
          alleProdukte.find((p) => p.barcode === treffer.barcode) || neuesProdukt({ ...produktAusEintrag(treffer), quelle: 'manuell' });
        const geaendert = gleichsetzen([...alleProdukte.filter((p) => p.barcode !== produkt.barcode), produkt], listenProdukt, produkt);
        const zuSpeichern = new Map([[produkt.barcode, produkt]]);
        for (const g of geaendert) zuSpeichern.set(g.barcode, g);
        aenderung.produkte.put = [...zuSpeichern.values()];
        if (geaendert.length) listenInfo.push(`Gemerkt: „${produkt.name}“ gilt künftig als gleichwertig mit „${treffer.name}“.`);
      }
    }
    await schreibeAlles(aenderung);
    zeigeErgebnis(produkt, neu, r, listenInfo);
  }

  // ---------- 5. Ergebnis ----------
  function zeigeErgebnis(produkt, neu, r, listenInfo = []) {
    const zugefuegt = neu.art === 'menge' ? formatMenge(neu.menge, neu.einheit) : 'da';
    const jetzt =
      r.zusammengefuehrt && r.eintrag.art === 'menge' ? ` Im Vorrat sind jetzt ${formatMenge(r.eintrag.menge, r.eintrag.einheit)}.` : '';
    ersetze(
      container,
      h('h2', {}, '✔ Hinzugefügt'),
      h('p', { class: 'hinweis' }, `${produkt.name}: ${zugefuegt}.${jetzt}`),
      listenInfo.map((z) => h('p', { class: 'hinweis' }, z)),
      h('button', { class: 'voll', style: 'margin-bottom:12px', onclick: () => zeigeKamera() }, '📷 Nächstes Produkt scannen'),
      h('button', { class: 'zweit voll', onclick: zurueck }, 'Fertig')
    );
  }

  function zeigeListenErgebnis(produkt, r) {
    const t = eintragTexte(r.eintrag);
    ersetze(
      container,
      h('h2', {}, '✔ Auf der Liste'),
      h('p', { class: 'hinweis' }, `${produkt.name}: ${t.menge}${r.zusammengefuehrt ? ' (stand schon drauf, Anzahl erhöht)' : ''}.`),
      h('button', { class: 'voll', style: 'margin-bottom:12px', onclick: () => zeigeKamera() }, '📷 Nächstes Produkt scannen'),
      h('button', { class: 'zweit voll', onclick: zurueck }, 'Fertig')
    );
  }

  zeigeKamera();
}
