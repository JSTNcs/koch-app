// Tab "Tagebuch": Tagesansicht mit Tageswerten gegen das Ziel, Einträge aus dem Vorrat, per Scan, frei und "zuletzt gegessen".
// Die App bewertet nichts: Überschreitungen sind nur Zahlen.
import { h, ersetze } from '../dom.js';
import { alle, schreibeAlles } from '../db.js';
import {
  MAHLZEITEN,
  tagVon,
  verschiebeTag,
  tagText,
  mahlzeitVorschlag,
  neueMahlzeit,
  naehrwerteFuerMenge,
  summiere,
  gruppiereTag,
  fortschritt,
  zieheAb,
  zuletztGegessen,
} from '../tagebuch.js';
import { ladeProfil } from '../profil.js';
import { formatMenge, parseZahl } from '../pantry.js';
import { norm } from '../zutaten.js';
import { ladeNaehrwerteTabelle } from '../naehrwerte-laden.js';
import { proFuerEintrag, proFuerProdukt } from '../naehrwerte.js';

export async function render(container) {
  let eintraege = [];
  let produkte = [];
  let vorrat = [];
  let profil = null;
  let tabelle = null;
  let tag = tagVon(new Date());

  const heute = () => tagVon(new Date());
  const zahlText = (n) => (n === null || n === undefined || Number.isNaN(n) ? '' : String(n).replace('.', ','));
  const de = (n) => String(n).replace('.', ','); // Zahlen im Text mit Komma
  const leerOderZahl = (feld) => (feld.value.trim() === '' ? null : parseZahl(feld.value));
  const nullAlsLeer = (feld) => (feld.value.trim() === '' ? 0 : parseZahl(feld.value));

  async function laden() {
    [eintraege, produkte, vorrat] = await Promise.all([alle('tagebuch'), alle('produkte'), alle('vorrat')]);
    profil = await ladeProfil();
    tabelle = await ladeNaehrwerteTabelle();
  }

  const meldungBox = (m) => (m ? h('p', { class: `hinweis ${m.typ || ''}` }, m.text) : null);
  const mahlzeitAuswahl = (wert) => h('select', { 'aria-label': 'Mahlzeit' }, MAHLZEITEN.map((m) => h('option', { value: m.id, selected: m.id === wert }, m.label)));

  // ---------- Tagesansicht ----------
  function zeigeTag(meldung = null) {
    const liste = eintraege.filter((m) => m.tag === tag);
    const summe = summiere(liste);
    const f = profil ? fortschritt(summe, profil.tagesziel) : null;
    const gruppen = gruppiereTag(liste);

    const balken = (anteil) => h('div', { class: 'balken-aussen' }, h('div', { class: 'balken-innen', style: `width:${Math.min(100, Math.round(anteil * 100))}%` }));
    const makro = (label, feld) =>
      h('div', { class: 'makro' }, h('div', { class: 'makro-kopf' }, h('span', {}, label), h('span', {}, f ? `${de(summe[feld])} / ${de(f[feld].ziel)} g` : `${de(summe[feld])} g`)), f ? balken(f[feld].anteil) : null);

    const eintragZeile = (m) =>
      h(
        'li',
        {},
        h(
          'button',
          { class: 'zweit voll eintrag-knopf', onclick: () => zeigeAbsolutForm({ alt: m }) },
          h(
            'span',
            { class: 'texte' },
            h('span', { class: 'titel' }, m.name),
            h('span', { class: 'untertitel' }, [m.menge, m.ca ? 'ca.' : null, `E ${de(m.eiweiss)} · KH ${de(m.kohlenhydrate)} · F ${de(m.fett)} g`].filter(Boolean).join(' · '))
          ),
          h('span', { class: 'menge-rechts' }, `${m.kcal} kcal`)
        )
      );
    const gruppeBlock = (g) => {
      const eintr = gruppen[g.id];
      if (!eintr.length) return null;
      return [h('h2', {}, `${g.label} · ${summiere(eintr).kcal} kcal`), h('ul', { class: 'liste' }, eintr.map(eintragZeile))];
    };

    ersetze(
      container,
      h(
        'div',
        { class: 'tag-nav' },
        h('button', { class: 'zweit klein', 'aria-label': 'Vorheriger Tag', onclick: () => { tag = verschiebeTag(tag, -1); zeigeTag(); } }, '◀'),
        h('button', { class: 'tag-name', onclick: () => { tag = heute(); zeigeTag(); } }, tagText(tag)),
        h('button', { class: 'zweit klein', 'aria-label': 'Nächster Tag', disabled: tag >= heute(), onclick: () => { tag = verschiebeTag(tag, 1); zeigeTag(); } }, '▶')
      ),
      meldungBox(meldung),
      !profil
        ? h(
            'div',
            { class: 'hinweis' },
            h('p', { style: 'margin:0 0 10px' }, 'Lege dein Tagesziel an, dann zeigt das Tagebuch deine Tageswerte gegen das Ziel.'),
            h('button', { class: 'zweit voll', onclick: () => zeigeZiel() }, '🎯 Tagesziel anlegen')
          )
        : null,
      h(
        'div',
        { class: 'summe-karte' },
        h('div', { class: 'summe-gross' }, String(summe.kcal), h('span', { class: 'summe-von' }, f ? ` von ${f.kcal.ziel} kcal` : ' kcal')),
        f ? balken(f.kcal.anteil) : null,
        f ? h('div', { class: 'menge' }, f.kcal.rest >= 0 ? `Noch ${f.kcal.rest} kcal` : `${-f.kcal.rest} kcal mehr als das Ziel`) : null,
        h('div', { class: 'makros' }, makro('Eiweiß', 'eiweiss'), makro('Kohlenhydrate', 'kohlenhydrate'), makro('Fett', 'fett'))
      ),
      h('button', { class: 'voll gross', style: 'margin:12px 0', onclick: () => zeigeWahl() }, '＋ Eintragen'),
      liste.length ? MAHLZEITEN.map(gruppeBlock) : h('p', { class: 'leer-text' }, 'Für diesen Tag steht noch nichts im Tagebuch.')
    );
  }

  async function zeigeZiel() {
    const { render: zeigeMaske } = await import('./tagesziel.js');
    await zeigeMaske(container, {
      zurueck: async () => {
        await laden();
        zeigeTag();
      },
    });
  }

  // ---------- Was hast du gegessen? ----------
  function zeigeWahl() {
    const zuletzt = zuletztGegessen(eintraege, 8);
    ersetze(
      container,
      h('button', { class: 'zweit', style: 'margin-bottom:8px', onclick: () => zeigeTag() }, '← Zurück'),
      h('h2', {}, `Was hast du gegessen? (${tagText(tag)})`),
      h('button', { class: 'voll', style: 'margin-bottom:8px', onclick: () => zeigeVorratAuswahl() }, '🥫 Aus dem Vorrat'),
      h('button', { class: 'voll', style: 'margin-bottom:8px', onclick: () => scannen() }, '📷 Scannen'),
      h('button', { class: 'voll', style: 'margin-bottom:8px', onclick: () => zeigeAbsolutForm() }, '✏️ Frei eintippen'),
      zuletzt.length
        ? [
            h('h2', {}, 'Zuletzt gegessen'),
            h(
              'ul',
              { class: 'liste' },
              zuletzt.map((m) =>
                h(
                  'li',
                  {},
                  h(
                    'button',
                    { class: 'zweit voll eintrag-knopf', onclick: () => zeigeAbsolutForm({ vorlage: m }) },
                    h('span', { class: 'texte' }, h('span', { class: 'titel' }, m.name), h('span', { class: 'untertitel' }, m.menge ?? '')),
                    h('span', { class: 'menge-rechts' }, `${m.kcal} kcal`)
                  )
                )
              )
            ),
          ]
        : null
    );
  }

  // ---------- Frei eintippen, Ändern, Zuletzt gegessen ----------
  function zeigeAbsolutForm({ alt = null, vorlage = null } = {}) {
    const start = alt || vorlage || { name: '', kcal: null, eiweiss: null, kohlenhydrate: null, fett: null, menge: null, mahlzeit: mahlzeitVorschlag(new Date()) };
    const name = h('input', { type: 'text', value: start.name, autocomplete: 'off', placeholder: 'z. B. Pizza im Restaurant', 'aria-label': 'Name' });
    const mahlzeit = mahlzeitAuswahl(alt ? alt.mahlzeit : mahlzeitVorschlag(new Date()));
    const feld = (wert, label) => h('input', { type: 'text', inputmode: 'decimal', value: zahlText(wert), 'aria-label': label });
    const kcal = feld(start.kcal, 'Kalorien');
    const eiweiss = feld(start.eiweiss, 'Eiweiß');
    const kohlenhydrate = feld(start.kohlenhydrate, 'Kohlenhydrate');
    const fett = feld(start.fett, 'Fett');
    const menge = h('input', { type: 'text', value: start.menge ?? '', autocomplete: 'off', placeholder: 'freiwillig, z. B. 1 Stück', 'aria-label': 'Menge' });
    const fehlerBox = h('div');

    async function speichern() {
      try {
        const m = neueMahlzeit(
          {
            name: name.value,
            kcal: parseZahl(kcal.value),
            eiweiss: nullAlsLeer(eiweiss),
            kohlenhydrate: nullAlsLeer(kohlenhydrate),
            fett: nullAlsLeer(fett),
            menge: menge.value,
            mahlzeit: mahlzeit.value,
            tag: alt ? alt.tag : tag,
            zeit: alt?.zeit,
            quelle: alt?.quelle ?? vorlage?.quelle ?? 'frei',
            barcode: alt?.barcode ?? vorlage?.barcode,
            rezeptId: alt?.rezeptId ?? vorlage?.rezeptId,
            ca: alt?.ca ?? vorlage?.ca ?? false,
          },
          { id: alt?.id }
        );
        await schreibeAlles({ tagebuch: { put: [m] } });
        await laden();
        zeigeTag({ typ: '', text: `✔ ${m.name} ${alt ? 'geändert' : 'eingetragen'} (${m.kcal} kcal).` });
      } catch (e) {
        ersetze(fehlerBox, h('p', { class: 'hinweis fehler' }, e.message));
        fehlerBox.scrollIntoView({ block: 'center' });
      }
    }

    async function loeschen() {
      if (!confirm(`„${alt.name}“ wirklich aus dem Tagebuch löschen?`)) return;
      await schreibeAlles({ tagebuch: { loesche: [alt.id] } });
      await laden();
      zeigeTag({ typ: '', text: `„${alt.name}“ wurde gelöscht.` });
    }

    ersetze(
      container,
      h('h2', {}, alt ? 'Eintrag ändern' : 'Frei eintragen'),
      h('p', { class: 'menge' }, 'Zum Beispiel Essen außer Haus. Trage ein, was du weißt, oder schätze.'),
      h('label', {}, 'Was?'),
      name,
      h('label', {}, 'Mahlzeit'),
      mahlzeit,
      h('label', {}, 'Kalorien (kcal)'),
      kcal,
      h('label', {}, 'Eiweiß (g)'),
      eiweiss,
      h('label', {}, 'Kohlenhydrate (g)'),
      kohlenhydrate,
      h('label', {}, 'Fett (g)'),
      fett,
      h('label', {}, 'Menge (freiwillig)'),
      menge,
      fehlerBox,
      h(
        'div',
        { class: 'zeile', style: 'margin-top:20px' },
        h('button', { class: 'zweit', onclick: () => zeigeTag() }, 'Abbrechen'),
        h('button', { onclick: speichern }, alt ? 'Speichern' : 'Eintragen')
      ),
      alt ? h('button', { class: 'gefahr voll', style: 'margin-top:12px', onclick: loeschen }, 'Löschen') : null
    );
    if (!alt && !vorlage) name.focus();
  }

  // ---------- Aus dem Vorrat ----------
  function zeigeVorratAuswahl() {
    const such = h('input', { type: 'text', placeholder: 'Im Vorrat suchen …', autocomplete: 'off', 'aria-label': 'Im Vorrat suchen' });
    const box = h('div');
    const zeichne = () => {
      const q = norm(such.value);
      const treffer = vorrat
        .filter((e) => e.art === 'menge' && e.menge > 0 && norm(e.name).includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
      ersetze(
        box,
        treffer.length
          ? h(
              'ul',
              { class: 'liste', style: 'margin-top:12px' },
              treffer.map((e) =>
                h(
                  'li',
                  {},
                  h(
                    'button',
                    { class: 'zweit voll eintrag-knopf', onclick: () => zeigeVorratProdukt(e) },
                    h('span', { class: 'texte' }, h('span', { class: 'titel' }, e.name)),
                    h('span', { class: 'menge-rechts' }, formatMenge(e.menge, e.einheit))
                  )
                )
              )
            )
          : h('p', { class: 'leer-text' }, vorrat.length ? 'Nichts gefunden.' : 'Dein Vorrat ist leer.')
      );
    };
    such.addEventListener('input', zeichne);
    ersetze(container, h('button', { class: 'zweit', style: 'margin-bottom:8px', onclick: () => zeigeWahl() }, '← Zurück'), h('h2', {}, 'Aus dem Vorrat'), such, box);
    zeichne();
  }

  function zeigeVorratProdukt(e) {
    const produkt = e.barcode ? produkte.find((p) => p.barcode === e.barcode) : null;
    // Eigene Produktdaten haben Vorrang, sonst schlägt die Tabelle die Nährwerte der Zutat vor (ca.)
    const eigenePro = e.einheit !== 'stk' ? produkt?.naehrwerte ?? null : null;
    const tabellenPro = !eigenePro && tabelle ? proFuerEintrag(tabelle, e, produkte) : null;
    zeigeProForm({
      name: e.name,
      nameFest: true,
      einheit: e.einheit,
      einheitWahl: false,
      pro: eigenePro ?? tabellenPro,
      tabelleCa: Boolean(tabellenPro),
      packung: produkt && produkt.einheit === e.einheit ? produkt.packung : null,
      mengeStart: e.einheit === 'stk' ? 1 : 100,
      quelle: 'vorrat',
      barcode: e.barcode,
      vorratEintrag: e,
      produkt,
      hinweis: `Im Vorrat: ${formatMenge(e.menge, e.einheit)}.${tabellenPro ? ' Die Nährwerte stammen aus der Tabelle (ca.), ändere sie, wenn dein Produkt anders ist.' : ''}`,
    });
  }

  // ---------- Scannen ----------
  async function scannen() {
    const { starteScan } = await import('./scan.js');
    starteScan(container, {
      modus: 'tagebuch',
      fertig: async () => {
        await laden();
        zeigeTag();
      },
      // Statt des Vorrats-Formulars zeigt das Tagebuch seine eigene Eingabe
      beiProdukt: (p, hinweis) => {
        const einheit = p.einheit === 'ml' ? 'ml' : 'g';
        const eintrag = p.barcode
          ? vorrat
              .filter((x) => x.barcode === p.barcode && x.art === 'menge' && x.einheit === einheit && x.menge > 0)
              .sort((a, b) => (a.ablauf ? 0 : 1) - (b.ablauf ? 0 : 1) || (a.ablauf || '').localeCompare(b.ablauf || '') || a.menge - b.menge)[0] ?? null
          : null;
        const bekannt = produkte.find((x) => x.barcode === p.barcode) ?? null;
        const hatEigene = p.naehrwerte && ['kcal', 'eiweiss', 'kohlenhydrate', 'fett'].every((f) => typeof p.naehrwerte[f] === 'number');
        const tabellenPro = !hatEigene && tabelle ? proFuerProdukt(tabelle, p, einheit) : null;
        zeigeProForm({
          name: p.name,
          nameFest: false,
          einheit,
          einheitWahl: true,
          pro: hatEigene ? p.naehrwerte : tabellenPro ?? p.naehrwerte ?? null,
          tabelleCa: Boolean(tabellenPro),
          packung: p.packung && p.einheit === einheit ? p.packung : null,
          mengeStart: 100,
          quelle: 'produkt',
          barcode: p.barcode,
          vorratEintrag: eintrag,
          produkt: bekannt,
          hinweis: [hinweis?.text, tabellenPro ? 'Die Nährwerte stammen aus der Tabelle (ca.).' : null].filter(Boolean).join(' '),
        });
      },
    });
  }

  // ---------- Eingabe mit Menge und Nährwerten pro 100 g/ml (oder pro Stück) ----------
  function zeigeProForm(opt) {
    const name = opt.nameFest ? h('p', { class: 'titel' }, opt.name) : h('input', { type: 'text', value: opt.name || '', autocomplete: 'off', placeholder: 'Name des Produkts', 'aria-label': 'Name' });
    const einheitSelect = opt.einheitWahl
      ? h('select', { 'aria-label': 'Einheit' }, h('option', { value: 'g', selected: opt.einheit === 'g' }, 'Gramm (g)'), h('option', { value: 'ml', selected: opt.einheit === 'ml' }, 'Milliliter (ml)'))
      : null;
    const einheit = () => (einheitSelect ? einheitSelect.value : opt.einheit);
    const menge = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(opt.mengeStart), 'aria-label': 'Menge' });
    const feld = (wert, label) => h('input', { type: 'text', inputmode: 'decimal', value: zahlText(wert), 'aria-label': label });
    const kcal = feld(opt.pro?.kcal, 'Kalorien pro 100');
    const eiweiss = feld(opt.pro?.eiweiss, 'Eiweiß pro 100');
    const kohlenhydrate = feld(opt.pro?.kohlenhydrate, 'Kohlenhydrate pro 100');
    const fett = feld(opt.pro?.fett, 'Fett pro 100');
    const mahlzeit = mahlzeitAuswahl(mahlzeitVorschlag(new Date()));
    const abziehen = opt.vorratEintrag ? h('input', { type: 'checkbox', checked: true, 'aria-label': 'Aus dem Vorrat abziehen' }) : null;
    const vorschau = h('p', { class: 'hinweis' });
    const proLabel = h('label', {});
    const fehlerBox = h('div');

    const proText = () => (einheit() === 'stk' ? 'Nährwerte pro Stück' : `Nährwerte pro 100 ${einheit()}`);
    const aktualisiere = () => {
      proLabel.textContent = proText();
      try {
        const pro = { kcal: leerOderZahl(kcal), eiweiss: leerOderZahl(eiweiss), kohlenhydrate: leerOderZahl(kohlenhydrate), fett: leerOderZahl(fett) };
        const nw = naehrwerteFuerMenge(pro, parseZahl(menge.value), einheit());
        vorschau.textContent = `Das sind ${nw.kcal} kcal · Eiweiß ${de(nw.eiweiss)} g · Kohlenhydrate ${de(nw.kohlenhydrate)} g · Fett ${de(nw.fett)} g`;
      } catch {
        vorschau.textContent = 'Trage Menge und Kalorien ein, dann siehst du hier die Summe.';
      }
    };
    for (const el of [menge, kcal, eiweiss, kohlenhydrate, fett]) el.addEventListener('input', aktualisiere);
    einheitSelect?.addEventListener('change', aktualisiere);

    async function speichern() {
      try {
        const pro = { kcal: leerOderZahl(kcal), eiweiss: leerOderZahl(eiweiss), kohlenhydrate: leerOderZahl(kohlenhydrate), fett: leerOderZahl(fett) };
        if (pro.kcal === null || Number.isNaN(pro.kcal)) throw new Error(`Bitte die Kalorien ${einheit() === 'stk' ? 'pro Stück' : `pro 100 ${einheit()}`} eintragen.`);
        if ([pro.eiweiss, pro.kohlenhydrate, pro.fett].some((w) => w !== null && Number.isNaN(w))) throw new Error('Die Nährwerte müssen Zahlen sein.');
        // Hat der Nutzer die vorgeschlagenen Tabellenwerte geändert, sind es seine eigenen Zahlen
        const geaendert = !opt.tabelleCa || ['kcal', 'eiweiss', 'kohlenhydrate', 'fett'].some((f) => pro[f] !== (opt.pro?.[f] ?? null));
        const wert = parseZahl(menge.value);
        const nw = naehrwerteFuerMenge(pro, wert, einheit());
        const m = neueMahlzeit({
          name: opt.nameFest ? opt.name : name.value,
          kcal: nw.kcal,
          eiweiss: nw.eiweiss,
          kohlenhydrate: nw.kohlenhydrate,
          fett: nw.fett,
          menge: formatMenge(wert, einheit()),
          ca: nw.unvollstaendig || (opt.tabelleCa === true && !geaendert),
          quelle: opt.quelle,
          barcode: opt.barcode,
          tag,
          mahlzeit: mahlzeit.value,
        });
        const aenderung = { tagebuch: { put: [m] } };
        let abgezogen = 0;
        if (abziehen?.checked && opt.vorratEintrag && opt.vorratEintrag.einheit === einheit()) {
          const r = zieheAb(opt.vorratEintrag, wert);
          abgezogen = r.abgezogen;
          aenderung.vorrat = r.loeschen ? { loesche: [r.loeschen] } : { put: [r.put] };
        }
        // Hat das bekannte Produkt noch keine Nährwerte, merkt es sich die eingetragenen
        if (opt.produkt && !opt.produkt.naehrwerte && einheit() !== 'stk' && geaendert && Object.values(pro).every((w) => w !== null)) {
          aenderung.produkte = { put: [{ ...opt.produkt, naehrwerte: pro }] };
        }
        await schreibeAlles(aenderung);
        await laden();
        zeigeTag({ typ: '', text: `✔ ${m.name} eingetragen (${m.kcal} kcal).${abgezogen ? ` ${formatMenge(abgezogen, einheit())} aus dem Vorrat abgezogen.` : ''}` });
      } catch (e) {
        ersetze(fehlerBox, h('p', { class: 'hinweis fehler' }, e.message));
        fehlerBox.scrollIntoView({ block: 'center' });
      }
    }

    const schnellKnoepfe = opt.packung
      ? h(
          'div',
          { class: 'zeile', style: 'margin-top:8px' },
          h('button', { class: 'zweit', onclick: () => { menge.value = zahlText(opt.packung); aktualisiere(); } }, `Ganze Packung (${formatMenge(opt.packung, einheit())})`),
          h('button', { class: 'zweit', onclick: () => { menge.value = zahlText(opt.packung / 2); aktualisiere(); } }, 'Halbe Packung')
        )
      : null;

    ersetze(
      container,
      h('h2', {}, 'Eintragen'),
      opt.hinweis ? h('p', { class: 'hinweis' }, opt.hinweis) : null,
      name,
      h('label', {}, 'Wie viel hast du gegessen?'),
      h('div', { class: 'zeile', style: 'align-items:center' }, menge, einheitSelect ?? h('span', { class: 'menge' }, opt.einheit === 'stk' ? 'Stück' : opt.einheit)),
      schnellKnoepfe,
      h('label', {}, 'Mahlzeit'),
      mahlzeit,
      proLabel,
      h('div', { class: 'zeile' }, h('div', {}, h('label', {}, 'kcal'), kcal), h('div', {}, h('label', {}, 'Eiweiß g'), eiweiss)),
      h('div', { class: 'zeile' }, h('div', {}, h('label', {}, 'Kohlenhydr. g'), kohlenhydrate), h('div', {}, h('label', {}, 'Fett g'), fett)),
      abziehen ? h('label', { class: 'kasten', style: 'margin-top:12px' }, abziehen, ` Aus dem Vorrat abziehen (${formatMenge(opt.vorratEintrag.menge, opt.vorratEintrag.einheit)} da)`) : null,
      vorschau,
      fehlerBox,
      h('div', { class: 'zeile', style: 'margin-top:12px' }, h('button', { class: 'zweit', onclick: () => zeigeTag() }, 'Abbrechen'), h('button', { onclick: speichern }, 'Eintragen'))
    );
    aktualisiere();
  }

  try {
    await laden();
    zeigeTag();
  } catch (e) {
    ersetze(container, h('p', { class: 'hinweis fehler' }, `Der Speicher geht nicht: ${e.message}`));
  }
}
