// Tab "Kochen": Rezept wählen, Zutaten bereitlegen, Schritt für Schritt kochen, Portionen angeben,
// Vorrat anpassen (Zutaten abziehen, Rest speichern). Der Stand wird gespeichert, man kann jederzeit weitermachen.
import { h, ersetze } from '../dom.js';
import { alle, schreibeAlles } from '../db.js';
import { baueIndex, pruefeRezept, gruppiereVorschlaege, skaliere, mengeText } from '../rezepte.js';
import { planeAbzug, wendeAn, berechneRest, neuerRest, neuesProtokoll, macheRueckgaengig, neuerKochstand } from '../kochen.js';
import { ladeKochstand, speichereKochstand, loescheKochstand } from '../kochstand.js';
import { haltWach } from '../wachhalten.js';
import { formatMenge, parseZahl } from '../pantry.js';

export async function render(container) {
  let rezepte = [];
  let vorrat = [];
  let produkte = [];
  let index = new Map();
  let ks = null; // laufender Kochvorgang (oder null)
  let wach = null;

  const wachAn = () => (wach = wach || haltWach());
  const wachAus = () => {
    wach?.loslassen();
    wach = null;
  };
  window.addEventListener('hashchange', wachAus, { once: true }); // beim Tabwechsel den Bildschirm wieder freigeben

  async function laden() {
    [rezepte, vorrat, produkte] = await Promise.all([alle('rezepte'), alle('vorrat'), alle('produkte')]);
    index = baueIndex(vorrat, produkte);
    ks = await ladeKochstand();
  }

  const rezeptVon = (id) => rezepte.find((r) => r.id === id);
  const sichere = () => speichereKochstand(ks);
  const zeigeFehler = (e) =>
    ersetze(container, h('p', { class: 'hinweis fehler' }, `Das hat nicht geklappt: ${e.message}`), h('button', { class: 'zweit voll', onclick: () => zeige() }, 'Zurück'));
  const portionenText = (n) => `${n} ${n === 1 ? 'Portion' : 'Portionen'}`;
  const zahlText = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

  function stepper(wert, min, max, text, beiAenderung) {
    return h(
      'div',
      { class: 'portionen' },
      h('button', { class: 'zweit klein', 'aria-label': 'weniger', onclick: () => beiAenderung(Math.max(min, wert - 1)) }, '−'),
      h('span', { class: 'wert' }, text),
      h('button', { class: 'zweit klein', 'aria-label': 'mehr', onclick: () => beiAenderung(Math.min(max, wert + 1)) }, '+')
    );
  }

  async function abbrechen() {
    if (!confirm('Kochen abbrechen? Dein Vorrat bleibt unverändert.')) return;
    ks = null;
    await loescheKochstand();
    zeige();
  }

  // Zeigt je nach gespeichertem Stand die passende Ansicht.
  function zeige(meldung = null) {
    if (ks) {
      const rezept = rezeptVon(ks.rezeptId);
      if (!rezept) {
        ks = null;
        loescheKochstand();
      } else {
        const ansicht = { zutaten: zeigeZutaten, schritte: zeigeSchritt, fertig: zeigeFertig, abzug: zeigeAbzug }[ks.phase];
        if (ansicht) return ansicht(rezept);
      }
    }
    zeigeAuswahl(meldung);
  }

  // ---------- 1. Rezept wählen ----------
  function zeigeAuswahl(meldung = null) {
    wachAus();
    if (!rezepte.length) {
      return ersetze(
        container,
        meldung ? h('p', { class: `hinweis ${meldung.typ || ''}` }, meldung.text) : null,
        h('p', { class: 'leer-text' }, 'Es gibt noch keine Rezepte. Lade das Startpaket im Tab „Was koche ich?“.')
      );
    }
    const gruppen = gruppiereVorschlaege(rezepte.map((rezept) => ({ rezept, pruefung: pruefeRezept(rezept, { index }) })));
    const karte = ({ rezept, pruefung }) =>
      h(
        'li',
        {},
        h(
          'button',
          { class: 'zweit voll rezeptkarte', onclick: () => zeigeVorbereiten(rezept) },
          h('span', { class: 'titel' }, rezept.name),
          h('span', { class: 'untertitel' }, [pruefung.kategorie === 'alles' ? 'Alles da' : `${pruefung.fehlend} ${pruefung.fehlend === 1 ? 'Zutat fehlt' : 'Zutaten fehlen'}`, rezept.dauerMinuten ? `${rezept.dauerMinuten} Min.` : null].filter(Boolean).join(' · '))
        )
      );
    const abschnitt = (titel, liste) => (liste.length ? [h('h2', {}, `${titel} (${liste.length})`), h('ul', { class: 'liste' }, liste.map(karte))] : null);
    ersetze(
      container,
      meldung ? h('p', { class: `hinweis ${meldung.typ || ''}` }, meldung.text) : null,
      h('h2', {}, 'Was möchtest du kochen?'),
      abschnitt('✔ Alles da', gruppen.alles),
      abschnitt('1–2 Zutaten fehlen', gruppen.wenig),
      gruppen.mehr.length ? h('details', {}, h('summary', {}, `Mehr fehlt (${gruppen.mehr.length})`), h('ul', { class: 'liste' }, gruppen.mehr.map(karte))) : null
    );
  }

  // ---------- 2. Portionen wählen ----------
  function zeigeVorbereiten(rezept, portionen = rezept.portionen) {
    const p = pruefeRezept(rezept, { index }, { portionen });
    const fehlend = p.zutaten.filter((z) => !z.optional && (z.status === 'fehlt' || z.status === 'teils')).map((z) => z.zutat);
    ersetze(
      container,
      h('button', { class: 'zweit', style: 'margin-bottom:8px', onclick: () => zeigeAuswahl() }, '← Zurück'),
      h('h2', {}, rezept.name),
      h('p', { class: 'menge' }, [rezept.dauerMinuten ? `${rezept.dauerMinuten} Min.` : null, `${rezept.schritte.length} Schritte`].filter(Boolean).join(' · ')),
      h('p', {}, 'Für wie viele Portionen kochst du?'),
      stepper(portionen, 1, 30, portionenText(portionen), (neu) => zeigeVorbereiten(rezept, neu)),
      fehlend.length
        ? h('p', { class: 'hinweis warnung' }, `Laut Vorrat fehlt: ${fehlend.join(', ')}. Du kannst trotzdem kochen, beim Abziehen wird nur abgezogen, was da ist.`)
        : h('p', { class: 'hinweis' }, '✔ Laut Vorrat ist alles da.'),
      h(
        'button',
        {
          class: 'voll gross',
          onclick: async () => {
            ks = neuerKochstand(rezept, portionen);
            await sichere();
            zeige();
          },
        },
        '🍳 Los geht’s'
      )
    );
  }

  const zutatenZeilen = (rezept) =>
    skaliere(rezept, ks.portionen).map((z) => ({ z, text: mengeText(z) }));

  // ---------- 3. Zutaten bereitlegen ----------
  function zeigeZutaten(rezept) {
    wachAn();
    const zeilen = zutatenZeilen(rezept).map(({ z, text }, i) =>
      h(
        'li',
        { class: 'einkauf-zeile' + (ks.bereit[i] ? ' erledigt' : '') },
        h(
          'button',
          {
            class: 'einkauf-inhalt',
            'aria-pressed': String(Boolean(ks.bereit[i])),
            onclick: async () => {
              ks.bereit[i] = !ks.bereit[i];
              await sichere();
              zeigeZutaten(rezept);
            },
          },
          h('span', { class: 'kaestchen' }, ks.bereit[i] ? '✔' : ''),
          h('span', { class: 'texte' }, h('span', { class: 'titel' }, z.zutat, z.optional ? h('span', { class: 'marke' }, ' freiwillig') : null), z.notiz ? h('span', { class: 'untertitel' }, z.notiz) : null),
          h('span', { class: 'menge-rechts' }, text)
        )
      )
    );
    ersetze(
      container,
      h('h2', {}, rezept.name),
      h('p', { class: 'menge' }, `${portionenText(ks.portionen)} · Zutaten bereitlegen`),
      h('ul', { class: 'liste' }, zeilen),
      h(
        'button',
        {
          class: 'voll gross',
          onclick: async () => {
            ks.phase = 'schritte';
            ks.schritt = 0;
            await sichere();
            zeige();
          },
        },
        'Weiter: erster Schritt →'
      ),
      h('button', { class: 'zweit voll', style: 'margin-top:12px', onclick: abbrechen }, 'Kochen abbrechen')
    );
  }

  // ---------- 4. Schritt für Schritt ----------
  function zeigeSchritt(rezept) {
    wachAn();
    const n = rezept.schritte.length;
    const i = Math.min(Math.max(ks.schritt, 0), n - 1);
    const letzter = i === n - 1;
    const gehe = async (neuerSchritt, phase = 'schritte') => {
      ks.schritt = neuerSchritt;
      ks.phase = phase;
      await sichere();
      zeige();
    };
    ersetze(
      container,
      h('p', { class: 'menge' }, `${rezept.name} · Schritt ${i + 1} von ${n}`),
      h('div', { class: 'fortschritt' }, h('div', { class: 'balken', style: `width:${((i + 1) / n) * 100}%` })),
      h('p', { class: 'schritt-text' }, rezept.schritte[i]),
      h(
        'details',
        {},
        h('summary', {}, 'Zutaten ansehen'),
        h('ul', { class: 'zutatenliste' }, zutatenZeilen(rezept).map(({ z, text }) => h('li', { class: 'zutat da' }, h('span', { class: 'texte' }, h('span', { class: 'titel' }, z.zutat)), h('span', { class: 'menge-rechts' }, text))))
      ),
      h(
        'button',
        { class: 'voll gross', onclick: () => (letzter ? gehe(i, 'fertig') : gehe(i + 1)) },
        letzter ? 'Fertig gekocht ✔' : 'Weiter →'
      ),
      h('button', { class: 'zweit voll', style: 'margin-top:12px', onclick: () => (i > 0 ? gehe(i - 1) : gehe(0, 'zutaten')) }, '← Zurück'),
      h('button', { class: 'zweit voll', style: 'margin-top:12px', onclick: abbrechen }, 'Kochen abbrechen')
    );
    window.scrollTo(0, 0);
  }

  // ---------- 5. Portionen: entstanden und gegessen ----------
  function zeigeFertig(rezept) {
    wachAus();
    const gesamt = ks.gesamt;
    const gegessen = Math.min(ks.gegessen, gesamt);
    let restText;
    try {
      const rest = berechneRest(gesamt, gegessen);
      restText = rest > 0 ? `Rest: ${portionenText(rest)} kommen in den Vorrat.` : 'Kein Rest.';
    } catch (e) {
      restText = e.message;
    }
    const aendere = async (feld, wert) => {
      ks[feld] = wert;
      if (ks.gegessen > ks.gesamt) ks.gegessen = ks.gesamt;
      await sichere();
      zeigeFertig(rezept);
    };
    ersetze(
      container,
      h('h2', {}, '✔ Fertig gekocht'),
      h('p', { class: 'menge' }, rezept.name),
      h('p', {}, 'Wie viele Portionen sind insgesamt entstanden?'),
      stepper(gesamt, 1, 99, portionenText(gesamt), (neu) => aendere('gesamt', neu)),
      h('p', {}, 'Wie viele davon hast du gegessen?'),
      stepper(gegessen, 0, gesamt, portionenText(gegessen), (neu) => aendere('gegessen', neu)),
      h('p', { class: 'hinweis' }, restText),
      h(
        'button',
        {
          class: 'voll gross',
          onclick: async () => {
            ks.phase = 'abzug';
            await sichere();
            zeige();
          },
        },
        'Weiter: Vorrat anpassen →'
      ),
      h('button', { class: 'zweit voll', style: 'margin-top:12px', onclick: async () => { ks.phase = 'schritte'; ks.schritt = rezept.schritte.length - 1; await sichere(); zeige(); } }, '← Zurück zu den Schritten')
    );
  }

  // ---------- 6. Vorrat anpassen ----------
  function zeigeAbzug(rezept) {
    wachAus();
    const plan = planeAbzug(rezept, ks.portionen, { vorrat, produkte }, { optionalBenutzt: ks.optionalBenutzt, mengen: ks.mengen });

    const neuZeichnen = async () => {
      await sichere();
      zeigeAbzug(rezept);
    };
    const quellenText = (z) =>
      z.quellen.map((q) => `${q.eintrag.name}: ${formatMenge(q.eintrag.menge, q.eintrag.einheit)} → ${q.entfernt ? 'leer, wird entfernt' : formatMenge(q.nachher, z.einheit)}`);

    function mengenFeld(z) {
      const feld = h('input', {
        type: 'text',
        inputmode: 'decimal',
        value: z.betrag > 0 ? zahlText(z.betrag) : '',
        placeholder: z.art === 'unklar' ? `Menge in ${z.einheit}` : '0',
        'aria-label': `Menge ${z.zutat}`,
      });
      feld.addEventListener('change', async () => {
        const wert = feld.value.trim() === '' ? null : parseZahl(feld.value);
        if (wert === null || Number.isNaN(wert)) delete ks.mengen[z.index];
        else ks.mengen[z.index] = wert;
        await neuZeichnen();
      });
      return h('div', { class: 'zeile', style: 'align-items:center' }, feld, h('span', { class: 'menge' }, z.einheit === 'stk' ? 'Stück' : z.einheit));
    }

    const abzugZeile = (z) => {
      if (z.art === 'nichtDa') {
        return h('li', { class: 'eintrag' }, h('div', { class: 'kopf' }, h('span', { class: 'name' }, z.zutat), h('span', { class: 'menge' }, formatMenge(z.standard, z.einheit))), h('div', { class: 'info' }, 'Nicht im Vorrat, es wird nichts abgezogen.'));
      }
      return h(
        'li',
        { class: 'eintrag' },
        h('div', { class: 'kopf' }, h('span', { class: 'name' }, z.zutat), z.art === 'unklar' ? h('span', { class: 'menge' }, `Rezept: ${formatMenge(rezept.zutaten[z.index].menge * (ks.portionen / rezept.portionen), rezept.zutaten[z.index].einheit)}`) : null),
        mengenFeld(z),
        z.art === 'unklar' ? h('div', { class: 'info' }, `Im Vorrat in anderer Einheit (${z.kandidaten.map((e) => `${e.name}: ${formatMenge(e.menge, e.einheit)}`).join(', ')}). Trage ein, wie viel du verbraucht hast, oder lass das Feld leer.`) : null,
        quellenText(z).map((t) => h('div', { class: 'info' }, t)),
        z.fehlt > 0 ? h('div', { class: 'info', style: 'color:var(--rot)' }, `Es waren nur ${formatMenge(z.betrag - z.fehlt, z.einheit)} da, mehr kann nicht abgezogen werden.`) : null
      );
    };

    const freiwilligZeile = (z) =>
      h(
        'li',
        { class: 'eintrag' },
        h(
          'button',
          {
            class: 'einkauf-inhalt',
            'aria-pressed': String(z.benutzt),
            onclick: async () => {
              ks.optionalBenutzt = z.benutzt ? ks.optionalBenutzt.filter((x) => x !== z.index) : [...ks.optionalBenutzt, z.index];
              await neuZeichnen();
            },
          },
          h('span', { class: 'kaestchen' }, z.benutzt ? '✔' : ''),
          h('span', { class: 'texte' }, h('span', { class: 'titel' }, `${z.zutat} verwendet`), h('span', { class: 'untertitel' }, 'freiwillige Zutat'))
        ),
        z.benutzt ? [mengenFeld(z), quellenText(z).map((t) => h('div', { class: 'info' }, t))] : null
      );

    const leerZeile = (z) =>
      h(
        'li',
        { class: 'einkauf-zeile' + (ks.gewuerzLeer.includes(z.index) ? ' erledigt' : '') },
        h(
          'button',
          {
            class: 'einkauf-inhalt',
            'aria-pressed': String(ks.gewuerzLeer.includes(z.index)),
            onclick: async () => {
              ks.gewuerzLeer = ks.gewuerzLeer.includes(z.index) ? ks.gewuerzLeer.filter((x) => x !== z.index) : [...ks.gewuerzLeer, z.index];
              await neuZeichnen();
            },
          },
          h('span', { class: 'kaestchen' }, ks.gewuerzLeer.includes(z.index) ? '✔' : ''),
          h('span', { class: 'texte' }, h('span', { class: 'titel' }, `${z.zutat} ist jetzt leer`))
        )
      );

    const leerBar = plan.zeilen.filter((z) => z.art === 'gewuerz' && z.kandidaten.some((e) => e.da === true));
    const optionalListe = plan.zeilen.filter((z) => z.art !== 'gewuerz' && z.optional);

    ersetze(
      container,
      h('h2', {}, 'Vorrat anpassen'),
      h('p', { class: 'menge' }, `${rezept.name} · ${portionenText(ks.portionen)}. Die Mengen kannst du ändern.`),
      h('ul', { class: 'liste' }, plan.zeilen.filter((z) => z.art !== 'gewuerz' && !z.optional).map(abzugZeile)),
      optionalListe.length ? [h('h2', {}, 'Freiwillige Zutaten'), h('ul', { class: 'liste' }, optionalListe.map(freiwilligZeile))] : null,
      leerBar.length ? [h('h2', {}, 'Gewürze und Öl'), h('p', { class: 'menge' }, 'Gewürze werden nicht abgezogen. Ist etwas leer geworden?'), h('ul', { class: 'liste' }, leerBar.map(leerZeile))] : null,
      h('button', { class: 'voll gross', onclick: () => abschliessen(rezept, plan).catch(zeigeFehler) }, '✔ Vorrat anpassen'),
      h('button', { class: 'zweit voll', style: 'margin-top:12px', onclick: async () => { ks.phase = 'fertig'; await sichere(); zeige(); } }, '← Zurück')
    );
  }

  // ---------- 7. Alles auf einmal speichern ----------
  async function abschliessen(rezept, plan) {
    const restPortionen = berechneRest(ks.gesamt, ks.gegessen);
    const wirkung = wendeAn(plan, { gewuerzLeer: ks.gewuerzLeer });
    const rest = restPortionen > 0 ? neuerRest({ rezeptId: rezept.id, name: rezept.name, portionen: restPortionen }) : null;

    const zusammenfassung = [];
    for (const z of plan.zeilen) {
      if (!z.benutzt || !z.quellen.length) continue;
      const abgezogen = z.quellen.reduce((s, q) => s + q.abziehen, 0);
      zusammenfassung.push(`${z.zutat}: ${formatMenge(Math.round(abgezogen * 100) / 100, z.einheit)} abgezogen${z.fehlt > 0 ? ` (es waren nur ${formatMenge(abgezogen, z.einheit)} da)` : ''}`);
    }
    for (const nummer of ks.gewuerzLeer) {
      const z = plan.zeilen.find((x) => x.index === nummer);
      if (z) zusammenfassung.push(`${z.zutat}: jetzt leer`);
    }
    const protokoll = neuesProtokoll({ rezept, portionen: ks.portionen, gesamt: ks.gesamt, gegessen: ks.gegessen, rest, wirkung, zusammenfassung });

    await schreibeAlles({
      vorrat: { put: wirkung.vorratPut, loesche: wirkung.vorratLoesche },
      reste: { put: rest ? [rest] : [] },
      gekocht: { put: [protokoll] },
      einstellungen: { loesche: ['kochen'] },
    });
    ks = null;
    await laden();
    zeigeErgebnis(protokoll, rest);
  }

  function zeigeErgebnis(protokoll, rest) {
    wachAus();
    ersetze(
      container,
      h('h2', {}, '✔ Vorrat angepasst'),
      h('p', { class: 'menge' }, protokoll.name),
      protokoll.zusammenfassung.length
        ? h('ul', { class: 'liste' }, protokoll.zusammenfassung.map((z) => h('li', { class: 'eintrag' }, z)))
        : h('p', { class: 'hinweis' }, 'Es musste nichts aus dem Vorrat abgezogen werden.'),
      rest ? h('p', { class: 'hinweis' }, `🍲 Rest: ${portionenText(rest.portionen)}. Du findest ihn oben im Vorrat unter „Reste“.`) : h('p', { class: 'hinweis' }, 'Es ist kein Rest übrig.'),
      h('button', { class: 'voll gross', onclick: () => zeige() }, 'Fertig'),
      h('button', { class: 'zweit voll', style: 'margin-top:12px', onclick: () => rueckgaengig(protokoll).catch(zeigeFehler) }, '↩ Rückgängig')
    );
  }

  async function rueckgaengig(protokoll) {
    const r = macheRueckgaengig(protokoll);
    await schreibeAlles({
      vorrat: { put: r.vorratPut },
      reste: { loesche: r.restLoeschen ? [r.restLoeschen] : [] },
      gekocht: { loesche: [r.protokollLoeschen] },
    });
    await laden();
    zeigeAuswahl({ typ: '', text: '↩ Rückgängig gemacht: Vorrat und Reste sind wieder wie vorher.' });
  }

  try {
    await laden();
    zeige();
  } catch (e) {
    ersetze(container, h('p', { class: 'hinweis fehler' }, `Der Speicher geht nicht: ${e.message}`));
  }
}
