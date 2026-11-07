import { h } from '../dom.js';
import { alle, speichere, loesche, datenSchuetzen } from '../db.js';
import { ladeHinweis } from '../sicherung.js';
import { schlageZutatVor, zutatVonEintrag, findeZutat } from '../zutaten.js';
import { zutatenDatalist, ZUTATEN_LISTE_ID } from '../zutaten-ui.js';
import {
  neuerEintrag,
  mengeAendern,
  setzeDa,
  sortiere,
  formatMenge,
  parseZahl,
  schritt,
} from '../pantry.js';

export async function render(container) {
  datenSchuetzen();
  let liste = [];

  let sicherungsHinweis = null;
  let produkteListe = [];

  async function laden() {
    liste = sortiere(await alle('vorrat'));
    produkteListe = await alle('produkte');
    sicherungsHinweis = await ladeHinweis();
  }

  async function aendern(eintrag) {
    await speichere('vorrat', eintrag);
    await laden();
    zeigeListe();
  }

  function zeigeListe(fehler = '') {
    const kopf = h(
      'div',
      { class: 'zeile' },
      h('button', { onclick: scannen }, '📷 Scannen'),
      h('button', { class: 'zweit', onclick: () => zeigeFormular(null) }, '＋ Von Hand')
    );

    const inhalt = liste.length
      ? h('ul', { class: 'liste' }, liste.map(eintragKarte))
      : h('p', { class: 'leer-text' }, 'Dein Vorrat ist leer. Tippe auf „Scannen“ oder „Von Hand“.');

    const erinnerung = sicherungsHinweis
      ? h(
          'div',
          { class: 'hinweis warnung' },
          h('p', { style: 'margin:0 0 10px' }, sicherungsHinweis),
          h('button', { class: 'zweit voll', onclick: () => (location.hash = '#/einstellungen') }, 'Jetzt sichern')
        )
      : null;
    const teile = [kopf, erinnerung, fehler ? h('p', { class: 'hinweis fehler' }, fehler) : null, inhalt].filter(Boolean);
    container.replaceChildren(...teile);
  }

  function eintragKarte(e) {
    const knoepfe =
      e.art === 'menge'
        ? [
            h('button', { class: 'zweit', 'aria-label': 'weniger', onclick: () => aendern(mengeAendern(e, -1)) }, `− ${schritt(e.einheit)}`),
            h('button', { class: 'zweit', 'aria-label': 'mehr', onclick: () => aendern(mengeAendern(e, +1)) }, `+ ${schritt(e.einheit)}`),
          ]
        : [h('button', { class: 'zweit', onclick: () => aendern(setzeDa(e, !e.da)) }, e.da ? 'Ist leer' : 'Wieder da')];

    return h(
      'li',
      { class: 'eintrag' },
      h(
        'div',
        { class: 'kopf' },
        h('span', { class: 'name' }, e.name),
        h('span', { class: 'menge' }, e.art === 'menge' ? formatMenge(e.menge, e.einheit) : e.da ? 'da' : 'leer')
      ),
      e.ablauf ? h('div', { class: 'menge' }, `Haltbar bis ${datumDeutsch(e.ablauf)}`) : null,
      h(
        'div',
        { class: 'knoepfe' },
        ...knoepfe,
        h('button', { class: 'zweit', onclick: () => zeigeFormular(e) }, 'Ändern'),
        h('button', { class: 'gefahr', onclick: () => loeschen(e) }, 'Löschen')
      )
    );
  }

  async function scannen() {
    // Erst jetzt laden, damit der Vorrat schnell aufgeht und die Kamera-Bibliothek nur bei Bedarf läuft.
    const { starteScan } = await import('./scan.js');
    starteScan(container, {
      fertig: async () => {
        await laden();
        zeigeListe();
      },
    });
  }

  async function loeschen(e) {
    if (!confirm(`„${e.name}“ wirklich löschen?`)) return;
    await loesche('vorrat', e.id);
    await laden();
    zeigeListe();
  }

  function zeigeFormular(alt, vorbelegung = {}) {
    const start = { name: '', art: 'menge', menge: '', einheit: 'g', ablauf: '', ...vorbelegung, ...(alt || {}) };
    const name = h('input', { type: 'text', value: start.name, autocomplete: 'off', placeholder: 'z. B. Nudeln' });
    const art = h(
      'select',
      {},
      h('option', { value: 'menge', selected: start.art === 'menge' }, 'Abgemessen (g, ml oder Stück)'),
      h('option', { value: 'da_leer', selected: start.art === 'da_leer' }, 'Gewürz, Öl, Salz: nur da / leer')
    );
    const menge = h('input', {
      type: 'text',
      inputmode: 'decimal',
      value: start.menge === null || start.menge === '' ? '' : String(start.menge).replace('.', ','),
      placeholder: 'z. B. 500',
    });
    const einheit = h(
      'select',
      {},
      h('option', { value: 'g', selected: start.einheit === 'g' }, 'Gramm (g)'),
      h('option', { value: 'ml', selected: start.einheit === 'ml' }, 'Milliliter (ml)'),
      h('option', { value: 'stk', selected: start.einheit === 'stk' }, 'Stück')
    );
    const ablauf = h('input', { type: 'date', value: start.ablauf || '' });
    // Zutat für Rezepte: gesetzte Zutat, sonst der Vorschlag aus der eingebauten Liste (nur wenn er etwas Bekanntes trifft)
    const vorschlag = alt
      ? zutatVonEintrag(alt, produkteListe)
      : { zutat: '', geraten: true };
    const zutat = h('input', {
      type: 'text',
      list: ZUTATEN_LISTE_ID,
      value: !vorschlag.geraten || findeZutat(vorschlag.zutat) ? vorschlag.zutat : '',
      placeholder: 'z. B. Spaghetti',
      autocomplete: 'off',
    });
    // Wird der Name geändert und die Zutat ist noch leer, kommt der Vorschlag automatisch
    name.addEventListener('change', () => {
      if (!zutat.value.trim()) zutat.value = schlageZutatVor(name.value) || '';
    });
    const fehlerBox = h('div');
    const mengeBlock = h('div', {}, h('label', {}, 'Menge'), menge, h('label', {}, 'Einheit'), einheit);

    const umschalten = () => (mengeBlock.hidden = art.value === 'da_leer');
    art.addEventListener('change', umschalten);
    umschalten();

    function speichern() {
      try {
        const neu = neuerEintrag(
          {
            name: name.value,
            art: art.value,
            menge: art.value === 'menge' ? parseZahl(menge.value) : null,
            einheit: einheit.value,
            ablauf: ablauf.value,
            barcode: start.barcode,
            zutat: zutat.value,
          },
          { id: alt?.id }
        );
        if (alt && alt.art === 'da_leer' && neu.art === 'da_leer') neu.da = alt.da;
        aendern(neu);
      } catch (e) {
        fehlerBox.replaceChildren(h('p', { class: 'hinweis fehler' }, e.message));
      }
    }

    container.replaceChildren(
      zutatenDatalist(),
      h('h2', {}, alt ? 'Eintrag ändern' : 'Neuer Eintrag'),
      h('label', {}, 'Name'),
      name,
      h('label', {}, 'Zutat für Rezepte (freiwillig)'),
      zutat,
      h('label', {}, 'Art'),
      art,
      mengeBlock,
      h('label', {}, 'Haltbar bis (freiwillig)'),
      ablauf,
      fehlerBox,
      h(
        'div',
        { class: 'zeile', style: 'margin-top:20px' },
        h('button', { class: 'zweit', onclick: () => zeigeListe() }, 'Abbrechen'),
        h('button', { onclick: speichern }, 'Speichern')
      )
    );
    if (!alt) name.focus();
  }

  try {
    await laden();
    zeigeListe();
  } catch (e) {
    container.replaceChildren(h('p', { class: 'hinweis fehler' }, `Der Speicher geht nicht: ${e.message}`));
  }
}

function datumDeutsch(iso) {
  const [j, m, t] = iso.split('-');
  return `${t}.${m}.${j}`;
}
