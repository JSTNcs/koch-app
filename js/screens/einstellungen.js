import { h, ersetze } from '../dom.js';
import { alleDaten } from '../db.js';
import { erstelleSicherung, merkeSicherung, letzteSicherung, liesSicherung, stelleWiederHer, ladeHinweis } from '../sicherung.js';
import { tageSeit } from '../backup.js';
import { APP_VERSION } from '../version.js';

function datumUhrzeit(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function herunterladen(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function render(container) {
  async function zeige(meldung = null) {
    let sicherung;
    let letzte = null;
    let hinweis = null;
    try {
      // Die Datei wird schon beim Öffnen gebaut: Das "Teilen" am iPhone muss direkt auf den Tipp folgen.
      sicherung = await erstelleSicherung();
      letzte = await letzteSicherung();
      hinweis = await ladeHinweis();
    } catch (e) {
      ersetze(container, h('p', { class: 'hinweis fehler' }, `Der Speicher geht nicht: ${e.message}`));
      return;
    }

    const datei = new File([sicherung.text], sicherung.name, { type: 'application/json' });
    const kannTeilen = Boolean(navigator.canShare?.({ files: [datei] }));
    const statusBox = h('div');

    async function sichern(modus) {
      try {
        if (modus === 'teilen') {
          try {
            await navigator.share({ files: [datei], title: 'Koch-App Sicherung' });
          } catch (e) {
            if (e?.name === 'AbortError') return; // Nutzer hat das Teilen-Menü geschlossen
            throw e;
          }
        } else {
          herunterladen(sicherung.text, sicherung.name);
        }
        await merkeSicherung();
        await zeige({ typ: '', text: `✔ Sicherung erstellt (${sicherung.anzahlVorrat} Vorrat, ${sicherung.anzahlProdukte} Produkte, ${sicherung.anzahlEinkauf} auf der Einkaufsliste). Bewahre die Datei sicher auf, zum Beispiel in iCloud Drive.` });
      } catch (e) {
        ersetze(statusBox, h('p', { class: 'hinweis fehler' }, `Das Sichern hat nicht geklappt: ${e.message}`));
      }
    }

    const dateiWahl = h('input', {
      type: 'file',
      accept: 'application/json,.json',
      hidden: true,
      onchange: async () => {
        const gewaehlt = dateiWahl.files[0];
        dateiWahl.value = '';
        if (!gewaehlt) return;
        try {
          zeigeBestaetigung(liesSicherung(await gewaehlt.text()), sicherung);
        } catch (e) {
          ersetze(statusBox, h('p', { class: 'hinweis fehler' }, e.message));
          statusBox.scrollIntoView({ block: 'center' });
        }
      },
    });

    const tage = letzte ? tageSeit(letzte) : null;
    const letzteText = letzte
      ? `Letzte Sicherung: ${datumUhrzeit(letzte)}${tage === 0 ? ' (heute)' : tage === 1 ? ' (gestern)' : ` (vor ${tage} Tagen)`}`
      : 'Letzte Sicherung: noch nie';

    ersetze(
      container,
      h('h2', {}, 'Sicherung'),
      h('p', {}, 'Alle deine Daten liegen nur auf diesem iPhone. Geht es verloren oder wird die App gelöscht, sind sie weg. Mit der Sicherung hast du eine Kopie als Datei.'),
      meldung ? h('p', { class: `hinweis ${meldung.typ}` }, meldung.text) : null,
      hinweis ? h('p', { class: 'hinweis warnung' }, hinweis) : null,
      h('p', { class: 'menge' }, letzteText),
      kannTeilen
        ? h('button', { class: 'voll', style: 'margin-bottom:12px', onclick: () => sichern('teilen') }, '💾 Sicherung speichern')
        : null,
      h('button', { class: kannTeilen ? 'zweit voll' : 'voll', onclick: () => sichern('download') }, kannTeilen ? 'Als Datei herunterladen' : '💾 Sicherung herunterladen'),
      h('h2', { style: 'margin-top:28px' }, 'Sicherung einspielen'),
      h('p', {}, 'Wähle eine Sicherungsdatei aus. Die App prüft sie zuerst und zeigt dir, was drin ist.'),
      h('button', { class: 'zweit voll', onclick: () => dateiWahl.click() }, '📂 Sicherungsdatei wählen'),
      dateiWahl,
      statusBox,
      h('p', { class: 'menge', style: 'margin-top:32px' }, `Version ${APP_VERSION}`)
    );
  }

  function zeigeBestaetigung(geprueft, aktuell) {
    const von = geprueft.erstelltAm ? datumUhrzeit(geprueft.erstelltAm) : 'unbekanntem Datum';
    ersetze(
      container,
      h('h2', {}, 'Sicherung einspielen?'),
      h('p', { class: 'hinweis' }, `Sicherung vom ${von}: ${geprueft.vorrat.length} Vorrat, ${geprueft.produkte.length} Produkte, ${geprueft.einkauf.length} auf der Einkaufsliste.`),
      h(
        'p',
        { class: 'hinweis warnung' },
        `Das ersetzt deine jetzigen Daten (${aktuell.anzahlVorrat} Vorrat, ${aktuell.anzahlProdukte} Produkte, ${aktuell.anzahlEinkauf} auf der Einkaufsliste). Das lässt sich nicht rückgängig machen. Mach vorher eine Sicherung, falls du dir nicht sicher bist.`
      ),
      h(
        'div',
        { class: 'zeile', style: 'margin-top:16px' },
        h('button', { class: 'zweit', onclick: () => zeige() }, 'Abbrechen'),
        h(
          'button',
          {
            class: 'gefahr',
            onclick: async () => {
              try {
                await stelleWiederHer(geprueft);
                const jetzt = await alleDaten();
                await zeige({ typ: '', text: `✔ Eingespielt: ${jetzt.vorrat.length} Vorrat, ${jetzt.produkte.length} Produkte, ${jetzt.einkauf.length} auf der Einkaufsliste.` });
              } catch (e) {
                await zeige({ typ: 'fehler', text: `Das Einspielen hat nicht geklappt, deine Daten sind unverändert: ${e.message}` });
              }
            },
          },
          'Ja, ersetzen'
        )
      )
    );
  }

  await zeige();
}
