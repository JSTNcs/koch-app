// Tab "Was koche ich?": Rezepte nach dem, was im Vorrat ist (alles da / 1–2 fehlen / mehr fehlt).
import { h, ersetze } from '../dom.js';
import { alle, schreibeAlles } from '../db.js';
import { baueIndex, pruefeRezept, gruppiereVorschlaege, fehlendFuerListe, mengeText } from '../rezepte.js';
import { fuegeHinzu } from '../einkauf.js';
import { formatMenge } from '../pantry.js';
import { holeStartpaketText, planeImportAusText, fuehreImportAus } from '../rezeptspeicher.js';

export async function render(container) {
  let rezepte = [];
  let vorrat = [];
  let produkte = [];
  let index = new Map();

  async function laden() {
    [rezepte, vorrat, produkte] = await Promise.all([alle('rezepte'), alle('vorrat'), alle('produkte')]);
    index = baueIndex(vorrat, produkte);
  }

  const pruefe = (r, portionen) => pruefeRezept(r, { index }, portionen ? { portionen } : {});
  const fehlendText = (p) => {
    const namen = p.zutaten.filter((z) => !z.optional && (z.status === 'fehlt' || z.status === 'teils')).map((z) => z.zutat);
    return namen.length <= 3 ? namen.join(', ') : `${namen.slice(0, 3).join(', ')} und ${namen.length - 3} weitere`;
  };

  // ---------- Übersicht ----------
  function zeigeUebersicht(meldung = null) {
    if (!rezepte.length) {
      return ersetze(
        container,
        meldung ? h('p', { class: `hinweis ${meldung.typ || ''}` }, meldung.text) : null,
        h('p', { class: 'leer-text' }, 'Es gibt noch keine Rezepte.'),
        h('button', { class: 'voll', onclick: () => startpaket().catch(zeigeFehler) }, '📥 Startpaket laden'),
        h('p', { class: 'menge', style: 'text-align:center;margin-top:12px' }, 'Eigene Rezepte legst du unter „Mehr“ an.')
      );
    }
    const gruppen = gruppiereVorschlaege(rezepte.map((rezept) => ({ rezept, pruefung: pruefe(rezept) })));

    const karte = ({ rezept, pruefung }) =>
      h(
        'li',
        {},
        h(
          'button',
          { class: 'zweit voll rezeptkarte', onclick: () => zeigeRezept(rezept) },
          h('span', { class: 'titel' }, rezept.name),
          h(
            'span',
            { class: 'untertitel' },
            [pruefung.kategorie === 'alles' ? 'Alles da' : `Fehlt: ${fehlendText(pruefung)}`, rezept.dauerMinuten ? `${rezept.dauerMinuten} Min.` : null]
              .filter(Boolean)
              .join(' · ')
          )
        )
      );
    const abschnitt = (titel, liste) =>
      liste.length ? [h('h2', {}, `${titel} (${liste.length})`), h('ul', { class: 'liste' }, liste.map(karte))] : null;

    ersetze(
      container,
      meldung ? h('p', { class: `hinweis ${meldung.typ || ''}` }, meldung.text) : null,
      abschnitt('✔ Alles da', gruppen.alles),
      abschnitt('1–2 Zutaten fehlen', gruppen.wenig),
      gruppen.mehr.length
        ? h('details', {}, h('summary', {}, `Mehr fehlt (${gruppen.mehr.length})`), h('ul', { class: 'liste' }, gruppen.mehr.map(karte)))
        : null,
      !gruppen.alles.length && !gruppen.wenig.length
        ? h('p', { class: 'hinweis' }, 'Aus deinem Vorrat lässt sich gerade kein Rezept mit höchstens 2 fehlenden Zutaten kochen. Unten stehen alle Rezepte.')
        : null
    );
  }

  async function startpaket() {
    const plan = await planeImportAusText(await holeStartpaketText());
    await fuehreImportAus(plan);
    await laden();
    zeigeUebersicht({ typ: '', text: `✔ ${plan.alle.length} Rezepte aus dem Startpaket geladen.` });
  }

  function zeigeFehler(e) {
    ersetze(container, h('p', { class: 'hinweis fehler' }, `Das hat nicht geklappt: ${e.message}`), h('button', { class: 'zweit voll', onclick: () => zeigeUebersicht() }, 'Zurück'));
  }

  // ---------- Ein Rezept ----------
  function zeigeRezept(rezept, portionen = rezept.portionen, meldung = null) {
    const p = pruefe(rezept, portionen);

    const symbol = { da: '✔', teils: '◐', fehlt: '✘', unklar: '❓', angenommen: '○' };
    const hinweis = (z) => {
      switch (z.status) {
        case 'da': return z.art === 'menge' ? `Du hast ${formatMenge(z.habe, z.einheit)}.` : 'Ist da.';
        case 'teils': return `Du hast ${formatMenge(z.habe, z.einheit)}, es fehlen ${formatMenge(z.fehlt, z.einheit)}.`;
        case 'fehlt': return z.art === 'menge' ? `Fehlt (${formatMenge(z.fehlt, z.einheit)}).` : 'Ist leer.';
        case 'unklar': return 'Im Vorrat in anderer Einheit, bitte selbst prüfen.';
        default: return 'Nicht im Vorrat eingetragen, ich nehme an, du hast es.';
      }
    };
    const zeile = (z) =>
      h(
        'li',
        { class: `zutat ${z.status}${z.optional ? ' freiwillig' : ''}` },
        h('span', { class: 'symbol', 'aria-hidden': 'true' }, symbol[z.status]),
        h(
          'span',
          { class: 'texte' },
          h('span', { class: 'titel' }, z.zutat, z.optional ? h('span', { class: 'marke' }, ' freiwillig') : null),
          h('span', { class: 'untertitel' }, hinweis(z) + (z.notiz ? ` (${z.notiz})` : ''))
        ),
        h('span', { class: 'menge-rechts' }, mengeText({ art: z.art, menge: z.braucht, einheit: z.einheit }))
      );

    const aendereP = (neu) => zeigeRezept(rezept, Math.min(30, Math.max(1, neu)));

    async function aufDieListe() {
      let aktuell = await alle('einkauf');
      const neu = [];
      let schonDa = 0;
      for (const e of fehlendFuerListe(p, { vorrat, produkte })) {
        const r = fuegeHinzu(aktuell, e);
        // Steht es schon auf der Liste, bleibt es wie es ist (sonst würde die Menge bei jedem Tippen wachsen)
        if (r.zusammengefuehrt) schonDa++;
        else {
          aktuell = r.liste;
          neu.push(r.eintrag);
        }
      }
      await schreibeAlles({ einkauf: { put: neu } });
      const teile = [];
      if (neu.length) teile.push(`✔ ${neu.length} ${neu.length === 1 ? 'Eintrag steht' : 'Einträge stehen'} jetzt auf der Einkaufsliste.`);
      if (schonDa) teile.push(`${schonDa} ${schonDa === 1 ? 'stand' : 'standen'} schon drauf.`);
      zeigeRezept(rezept, portionen, { typ: '', text: teile.join(' ') });
    }

    ersetze(
      container,
      h('button', { class: 'zweit', style: 'margin-bottom:8px', onclick: () => zeigeUebersicht() }, '← Zurück'),
      h('h2', {}, rezept.name),
      h('p', { class: 'menge' }, [rezept.dauerMinuten ? `${rezept.dauerMinuten} Min.` : null, rezept.quelle].filter(Boolean).join(' · ')),
      meldung ? h('p', { class: `hinweis ${meldung.typ || ''}` }, meldung.text) : null,
      h(
        'div',
        { class: 'portionen' },
        h('button', { class: 'zweit klein', 'aria-label': 'weniger Portionen', onclick: () => aendereP(portionen - 1) }, '−'),
        h('span', { class: 'wert' }, `${portionen} ${portionen === 1 ? 'Portion' : 'Portionen'}`),
        h('button', { class: 'zweit klein', 'aria-label': 'mehr Portionen', onclick: () => aendereP(portionen + 1) }, '+')
      ),
      p.kategorie === 'alles'
        ? h('p', { class: 'hinweis' }, '✔ Alles da, du kannst es kochen.')
        : h('p', { class: 'hinweis warnung' }, `Es fehlen ${p.fehlend} ${p.fehlend === 1 ? 'Zutat' : 'Zutaten'}.`),
      h('h2', {}, 'Zutaten'),
      h('ul', { class: 'zutatenliste' }, p.zutaten.map(zeile)),
      p.fehlend > 0
        ? h('button', { class: 'voll', style: 'margin:12px 0', onclick: () => aufDieListe().catch(zeigeFehler) }, `🛒 Fehlendes auf die Einkaufsliste (${fehlendFuerListe(p, { vorrat, produkte }).length})`)
        : null,
      h('h2', {}, 'Zubereitung'),
      h('ol', { class: 'schritte' }, rezept.schritte.map((s) => h('li', {}, s)))
    );
    window.scrollTo(0, 0);
  }

  try {
    await laden();
    zeigeUebersicht();
  } catch (e) {
    ersetze(container, h('p', { class: 'hinweis fehler' }, `Der Speicher geht nicht: ${e.message}`));
  }
}
