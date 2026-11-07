import { h, ersetze } from '../dom.js';
import { alle, schreibeAlles } from '../db.js';
import {
  sucheProdukte,
  neuerProduktEintrag,
  neuerFreiEintrag,
  fuegeHinzu,
  aendereAnzahl,
  schalteHaken,
  sortiereListe,
  eintragTexte,
  einraeumen,
} from '../einkauf.js';
import { parseZahl } from '../pantry.js';
import { findeZutat } from '../zutaten.js';
import { zutatenDatalist, ZUTATEN_LISTE_ID } from '../zutaten-ui.js';

export async function render(container) {
  let liste = [];
  let produkte = [];
  let meldung = null; // { typ, text }

  async function laden() {
    [liste, produkte] = await Promise.all([alle('einkauf'), alle('produkte')]);
  }

  // ---------- Hauptbildschirm ----------
  function zeigeHaupt(neueMeldung = null) {
    meldung = neueMeldung;
    container.classList.remove('mit-leiste');

    const suche = h('input', {
      type: 'text',
      placeholder: 'Produkt suchen (z. B. Spaghetti)',
      autocomplete: 'off',
      enterkeyhint: 'search',
      'aria-label': 'Produkt suchen',
    });
    const trefferBox = h('div');
    const meldungBox = h('div');
    const listeBox = h('div');
    const leiste = h('div');

    const fehler = (e) => zeigeMeldung({ typ: 'fehler', text: `Das hat nicht geklappt: ${e.message}` });

    function zeigeMeldung(m) {
      meldung = m;
      ersetze(meldungBox, m ? h('p', { class: `hinweis ${m.typ || ''}` }, m.text) : null);
    }

    // --- Treffer in den eigenen Produkten ---
    function zeichneTreffer() {
      const text = suche.value;
      if (!text.trim()) return ersetze(trefferBox);
      const treffer = sucheProdukte(produkte, text);
      if (!treffer.length) {
        return ersetze(
          trefferBox,
          h('p', { class: 'hinweis' }, 'Nichts gefunden. Scanne das Produkt mit „📷 Zur Liste“ oder schreibe es mit „＋ Ohne Marke“ auf.')
        );
      }
      ersetze(
        trefferBox,
        h(
          'ul',
          { class: 'liste' },
          treffer.map((p) => {
            const t = eintragTexte(neuerProduktEintrag(p, 1));
            return h(
              'li',
              {},
              h(
                'button',
                { class: 'zweit voll treffer', onclick: () => hinzufuegenProdukt(p).catch(fehler) },
                h('span', { class: 'texte' }, h('span', { class: 'titel' }, t.titel), t.untertitel ? h('span', { class: 'untertitel' }, t.untertitel) : null),
                h('span', { class: 'plus' }, '＋')
              )
            );
          })
        )
      );
    }
    suche.addEventListener('input', zeichneTreffer);

    async function hinzufuegenProdukt(p) {
      const r = fuegeHinzu(liste, neuerProduktEintrag(p, 1));
      await schreibeAlles({ einkauf: { put: [r.eintrag] } });
      liste = r.liste;
      suche.value = '';
      ersetze(trefferBox);
      const t = eintragTexte(r.eintrag);
      zeigeMeldung({ typ: '', text: r.zusammengefuehrt ? `${p.name} stand schon drauf, jetzt ${t.menge}.` : `✔ ${p.name} steht auf der Liste.` });
      zeichneListe();
    }

    // --- Die Liste ---
    async function speichereEintrag(e) {
      await schreibeAlles({ einkauf: { put: [e] } });
      liste = liste.map((x) => (x.id === e.id ? e : x));
      zeichneListe();
    }

    async function entfernen(e) {
      await schreibeAlles({ einkauf: { loesche: [e.id] } });
      liste = liste.filter((x) => x.id !== e.id);
      zeichneListe();
    }

    function zeile(e) {
      const t = eintragTexte(e);
      return h(
        'li',
        { class: 'einkauf-zeile' + (e.erledigt ? ' erledigt' : '') },
        h(
          'button',
          {
            class: 'einkauf-inhalt',
            'aria-pressed': String(e.erledigt),
            onclick: () => speichereEintrag(schalteHaken(e)).catch(fehler),
          },
          h('span', { class: 'kaestchen' }, e.erledigt ? '✔' : ''),
          h('span', { class: 'texte' }, h('span', { class: 'titel' }, t.titel), t.untertitel ? h('span', { class: 'untertitel' }, t.untertitel) : null)
        ),
        h(
          'div',
          { class: 'anzahl' },
          h('button', { class: 'zweit klein', 'aria-label': 'weniger', onclick: () => speichereEintrag(aendereAnzahl(e, -1)).catch(fehler) }, '−'),
          h('span', { class: 'wert' }, t.menge),
          h('button', { class: 'zweit klein', 'aria-label': 'mehr', onclick: () => speichereEintrag(aendereAnzahl(e, +1)).catch(fehler) }, '+')
        ),
        h('button', { class: 'weg', 'aria-label': `${t.titel} entfernen`, onclick: () => entfernen(e).catch(fehler) }, '✕')
      );
    }

    function zeichneListe() {
      const sortiert = sortiereListe(liste);
      ersetze(
        listeBox,
        sortiert.length
          ? h('ul', { class: 'liste' }, sortiert.map(zeile))
          : h('p', { class: 'leer-text' }, 'Die Liste ist leer. Suche oben ein Produkt oder scanne eins.')
      );

      const abgehakt = liste.filter((e) => e.erledigt).length;
      container.classList.toggle('mit-leiste', abgehakt > 0);
      ersetze(
        leiste,
        abgehakt
          ? h('div', { class: 'aktionsleiste' }, h('button', { class: 'voll', onclick: () => raeumeEin().catch(fehler) }, `✔ ${abgehakt} Abgehakte in den Vorrat`))
          : null
      );
    }

    async function raeumeEin() {
      const r = einraeumen(liste, await alle('vorrat'));
      await schreibeAlles({ vorrat: { put: r.zuSpeichern }, einkauf: { loesche: r.zuLoeschen } });
      liste = liste.filter((e) => !r.zuLoeschen.includes(e.id));
      zeigeMeldung({ typ: '', text: `✔ ${r.anzahl} ${r.anzahl === 1 ? 'Eintrag liegt' : 'Einträge liegen'} jetzt im Vorrat.` });
      zeichneListe();
    }

    // --- Knöpfe ---
    async function scannen(modus) {
      container.classList.remove('mit-leiste');
      const { starteScan } = await import('./scan.js');
      starteScan(container, {
        modus,
        fertig: async () => {
          await laden();
          zeigeHaupt();
        },
      });
    }

    ersetze(
      container,
      suche,
      trefferBox,
      h('button', { class: 'voll', style: 'margin-top:12px', onclick: () => scannen('einkaufen') }, '📷 Einkauf scannen'),
      h(
        'div',
        { class: 'zeile', style: 'margin-top:8px' },
        h('button', { class: 'zweit', onclick: () => scannen('liste') }, '📷 Zur Liste'),
        h('button', { class: 'zweit', onclick: () => zeigeFreitext() }, '＋ Ohne Marke')
      ),
      meldungBox,
      listeBox,
      leiste
    );
    zeigeMeldung(meldung);
    zeichneListe();
  }

  // ---------- Freitext (Dinge ohne Marke) ----------
  function zeigeFreitext() {
    container.classList.remove('mit-leiste');
    const name = h('input', { type: 'text', list: ZUTATEN_LISTE_ID, placeholder: 'z. B. Zwiebeln', autocomplete: 'off' });
    const menge = h('input', { type: 'text', inputmode: 'decimal', value: '1' });
    const einheit = h(
      'select',
      {},
      h('option', { value: 'stk', selected: true }, 'Stück'),
      h('option', { value: 'g' }, 'Gramm (g)'),
      h('option', { value: 'ml' }, 'Milliliter (ml)')
    );
    const fehlerBox = h('div');
    // Bekannte Zutat: die übliche Einheit wird vorgeschlagen (Hähnchenbrust -> g)
    name.addEventListener('change', () => {
      const z = findeZutat(name.value);
      if (z && z.art === 'menge') einheit.value = z.einheit;
    });

    async function hinzufuegen() {
      try {
        const neu = neuerFreiEintrag({ name: name.value, anzahl: parseZahl(menge.value), einheit: einheit.value, zutat: findeZutat(name.value)?.name ?? null });
        const r = fuegeHinzu(liste, neu);
        await schreibeAlles({ einkauf: { put: [r.eintrag] } });
        liste = r.liste;
        const t = eintragTexte(r.eintrag);
        zeigeHaupt({ typ: '', text: r.zusammengefuehrt ? `${r.eintrag.name} stand schon drauf, jetzt ${t.menge}.` : `✔ ${r.eintrag.name} steht auf der Liste.` });
      } catch (e) {
        ersetze(fehlerBox, h('p', { class: 'hinweis fehler' }, e.message));
      }
    }

    ersetze(
      container,
      zutatenDatalist(),
      h('h2', {}, 'Ohne Marke aufschreiben'),
      h('p', { class: 'menge' }, 'Für Dinge ohne Barcode, zum Beispiel Zwiebeln oder Hähnchenbrust.'),
      h('label', {}, 'Was?'),
      name,
      h('label', {}, 'Menge'),
      h('div', { class: 'zeile' }, menge, einheit),
      fehlerBox,
      h(
        'div',
        { class: 'zeile', style: 'margin-top:20px' },
        h('button', { class: 'zweit', onclick: () => zeigeHaupt() }, 'Abbrechen'),
        h('button', { onclick: hinzufuegen }, 'Auf die Liste')
      )
    );
    name.focus();
  }

  try {
    await laden();
    zeigeHaupt();
  } catch (e) {
    ersetze(container, h('p', { class: 'hinweis fehler' }, `Der Speicher geht nicht: ${e.message}`));
  }
}
