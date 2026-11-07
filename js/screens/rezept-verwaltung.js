// Unter "Mehr": eigene Rezepte eintippen und ändern, Startpaket laden, Rezeptdatei einlesen.
import { h, ersetze } from '../dom.js';
import { alle, speichere, loesche } from '../db.js';
import { neuesRezept } from '../rezepte.js';
import { parseZahl } from '../pantry.js';
import { findeZutat } from '../zutaten.js';
import { zutatenDatalist, ZUTATEN_LISTE_ID } from '../zutaten-ui.js';
import { holeStartpaketText, planeImportAusText, fuehreImportAus } from '../rezeptspeicher.js';

// zurueck(): zurück zu den Einstellungen
export async function render(container, { zurueck }) {
  let rezepte = [];

  async function laden() {
    rezepte = (await alle('rezepte')).sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
  }

  function fehlerBox(e) {
    return h('p', { class: 'hinweis fehler' }, `Das hat nicht geklappt: ${e.message}`);
  }

  // ---------- Liste ----------
  function zeigeListe(meldung = null) {
    const dateiWahl = h('input', {
      type: 'file',
      accept: 'application/json,.json',
      hidden: true,
      onchange: async () => {
        const datei = dateiWahl.files[0];
        dateiWahl.value = '';
        if (!datei) return;
        try {
          zeigeImportRueckfrage(await planeImportAusText(await datei.text()), `Datei „${datei.name}“`);
        } catch (e) {
          zeigeListe({ typ: 'fehler', text: e.message });
        }
      },
    });

    const zeile = (r) =>
      h(
        'li',
        { class: 'eintrag' },
        h('div', { class: 'kopf' }, h('span', { class: 'name' }, r.name), h('span', { class: 'menge' }, `${r.portionen} ${r.portionen === 1 ? 'Portion' : 'Portionen'}`)),
        h('div', { class: 'menge' }, `${r.zutaten.length} Zutaten${r.dauerMinuten ? ` · ${r.dauerMinuten} Min.` : ''}${r.quelle ? ` · ${r.quelle}` : ''}`),
        h(
          'div',
          { class: 'knoepfe' },
          h('button', { class: 'zweit', onclick: () => zeigeEditor(r) }, 'Ändern'),
          h(
            'button',
            {
              class: 'gefahr',
              onclick: async () => {
                if (!confirm(`„${r.name}“ wirklich löschen?`)) return;
                await loesche('rezepte', r.id);
                await laden();
                zeigeListe({ typ: '', text: `„${r.name}“ wurde gelöscht.` });
              },
            },
            'Löschen'
          )
        )
      );

    ersetze(
      container,
      h('button', { class: 'zweit', style: 'margin-bottom:8px', onclick: zurueck }, '← Zurück'),
      h('h2', {}, 'Meine Rezepte'),
      meldung ? h('p', { class: `hinweis ${meldung.typ || ''}` }, meldung.text) : null,
      h('button', { class: 'voll', style: 'margin-bottom:8px', onclick: () => zeigeEditor(null) }, '＋ Rezept eintippen'),
      h(
        'div',
        { class: 'zeile', style: 'margin-bottom:12px' },
        h('button', { class: 'zweit', onclick: () => startpaket().catch((e) => zeigeListe({ typ: 'fehler', text: e.message })) }, '📥 Startpaket'),
        h('button', { class: 'zweit', onclick: () => dateiWahl.click() }, '📂 Rezeptdatei')
      ),
      dateiWahl,
      rezepte.length ? h('ul', { class: 'liste' }, rezepte.map(zeile)) : h('p', { class: 'leer-text' }, 'Noch keine Rezepte. Lade das Startpaket oder tippe ein Rezept ein.')
    );
  }

  // ---------- Import (Startpaket und Rezeptdatei) ----------
  async function startpaket() {
    zeigeImportRueckfrage(await planeImportAusText(await holeStartpaketText()), 'Startpaket');
  }

  function zeigeImportRueckfrage(plan, woher) {
    const namen = (liste) => liste.map((r) => r.name).join(', ');
    ersetze(
      container,
      h('h2', {}, 'Rezepte einlesen?'),
      h('p', { class: 'hinweis' }, `${woher}: ${plan.alle.length} ${plan.alle.length === 1 ? 'Rezept' : 'Rezepte'}, davon ${plan.neu.length} neu.`),
      plan.neu.length ? h('p', { class: 'menge' }, `Neu: ${namen(plan.neu)}`) : null,
      plan.ersetzt.length
        ? h('p', { class: 'hinweis warnung' }, `${plan.ersetzt.length} ${plan.ersetzt.length === 1 ? 'schon vorhandenes Rezept wird' : 'schon vorhandene Rezepte werden'} ersetzt (eigene Änderungen daran gehen verloren): ${namen(plan.ersetzt)}`)
        : null,
      h(
        'div',
        { class: 'zeile', style: 'margin-top:16px' },
        h('button', { class: 'zweit', onclick: () => zeigeListe() }, 'Abbrechen'),
        h(
          'button',
          {
            onclick: async () => {
              try {
                await fuehreImportAus(plan);
                await laden();
                zeigeListe({ typ: '', text: `✔ ${plan.alle.length} ${plan.alle.length === 1 ? 'Rezept' : 'Rezepte'} eingelesen.` });
              } catch (e) {
                zeigeListe({ typ: 'fehler', text: `Das Einlesen hat nicht geklappt: ${e.message}` });
              }
            },
          },
          'Einlesen'
        )
      )
    );
  }

  // ---------- Rezept eintippen / ändern ----------
  function zeigeEditor(alt) {
    const start = alt || { name: '', portionen: 2, dauerMinuten: null, zutaten: [], schritte: [], quelle: null };
    const name = h('input', { type: 'text', value: start.name, autocomplete: 'off', placeholder: 'z. B. Spaghetti mit Tomatensauce' });
    const portionen = h('input', { type: 'text', inputmode: 'numeric', value: String(start.portionen) });
    const dauer = h('input', { type: 'text', inputmode: 'numeric', value: start.dauerMinuten ? String(start.dauerMinuten) : '', placeholder: 'freiwillig' });
    const schritte = h('textarea', { rows: '6', placeholder: 'Ein Schritt pro Zeile' });
    schritte.value = start.schritte.join('\n');
    const quelle = h('input', { type: 'text', value: start.quelle || '', placeholder: 'freiwillig' });
    const zutatenBox = h('div', { class: 'zutaten-editor' });
    const fehler = h('div');
    const zeilen = []; // { zutat, menge, einheit, optional, notiz }

    const zahlText = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

    function neueZeile(z = {}) {
      const zutat = h('input', { type: 'text', list: ZUTATEN_LISTE_ID, value: z.zutat || '', placeholder: 'Zutat', autocomplete: 'off', 'aria-label': 'Zutat' });
      const menge = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(z.menge), placeholder: 'Menge', 'aria-label': 'Menge' });
      const einheit = h(
        'select',
        { 'aria-label': 'Einheit' },
        h('option', { value: 'g', selected: z.einheit === 'g' }, 'g'),
        h('option', { value: 'ml', selected: z.einheit === 'ml' }, 'ml'),
        h('option', { value: 'stk', selected: z.einheit === 'stk' || (z.art === 'menge' && !z.einheit) }, 'Stück'),
        h('option', { value: 'bedarf', selected: z.art === 'da_leer' }, 'nach Bedarf')
      );
      const optional = h('input', { type: 'checkbox', checked: z.optional ? true : false, 'aria-label': 'freiwillig' });
      const zeile = { zutat, menge, einheit, optional, notiz: z.notiz || null };
      const box = h(
        'div',
        { class: 'zutat-zeile' },
        h('div', { class: 'zeile' }, zutat),
        h(
          'div',
          { class: 'zeile' },
          menge,
          einheit
        ),
        h(
          'div',
          { class: 'zeile', style: 'align-items:center' },
          h('label', { class: 'kasten' }, optional, ' freiwillig'),
          h('button', { class: 'gefahr', onclick: () => { zeilen.splice(zeilen.indexOf(zeile), 1); box.remove(); } }, 'Entfernen')
        )
      );
      // Passt der Name zu einer bekannten Zutat, wird die übliche Einheit vorgeschlagen
      zutat.addEventListener('change', () => {
        const f = findeZutat(zutat.value);
        if (f && !menge.value.trim()) einheit.value = f.art === 'da_leer' ? 'bedarf' : f.einheit;
      });
      zeile.box = box;
      zeilen.push(zeile);
      zutatenBox.append(box);
      return zeile;
    }
    (start.zutaten.length ? start.zutaten : [{}, {}, {}]).forEach((z) => neueZeile(z));

    async function speichern() {
      try {
        const eingabe = {
          id: alt?.id,
          name: name.value,
          portionen: parseZahl(portionen.value),
          dauerMinuten: dauer.value.trim() ? parseZahl(dauer.value) : null,
          zutaten: zeilen
            .filter((z) => z.zutat.value.trim() || z.menge.value.trim())
            .map((z) =>
              z.einheit.value === 'bedarf'
                ? { zutat: z.zutat.value, art: 'da_leer', optional: z.optional.checked, notiz: z.notiz }
                : { zutat: z.zutat.value, art: 'menge', menge: parseZahl(z.menge.value), einheit: z.einheit.value, optional: z.optional.checked, notiz: z.notiz }
            ),
          schritte: schritte.value.split('\n'),
          quelle: quelle.value,
        };
        let r = neuesRezept(eingabe);
        if (!alt) {
          // Neues Rezept mit gleichem Namen soll kein vorhandenes überschreiben
          const basis = r.id;
          let n = 2;
          while (rezepte.some((x) => x.id === r.id)) r = { ...r, id: `${basis}-${n++}` };
        }
        await speichere('rezepte', r);
        await laden();
        zeigeListe({ typ: '', text: `✔ „${r.name}“ gespeichert.` });
      } catch (e) {
        ersetze(fehler, h('p', { class: 'hinweis fehler' }, e.message));
        fehler.scrollIntoView({ block: 'center' });
      }
    }

    ersetze(
      container,
      zutatenDatalist(),
      h('h2', {}, alt ? 'Rezept ändern' : 'Neues Rezept'),
      h('label', {}, 'Name'),
      name,
      h('div', { class: 'zeile' }, h('div', {}, h('label', {}, 'Portionen'), portionen), h('div', {}, h('label', {}, 'Dauer (Min.)'), dauer)),
      h('h2', { style: 'margin-top:20px' }, 'Zutaten'),
      h('p', { class: 'menge' }, 'Gewürze, Öl und Salz: „nach Bedarf“ wählen, dann braucht es keine Menge.'),
      zutatenBox,
      h('button', { class: 'zweit voll', style: 'margin-top:8px', onclick: () => neueZeile().zutat.focus() }, '＋ Zutat'),
      h('label', {}, 'Zubereitung'),
      schritte,
      h('label', {}, 'Quelle'),
      quelle,
      fehler,
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
    ersetze(container, fehlerBox(e));
  }
}
