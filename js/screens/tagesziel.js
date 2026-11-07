// Unter "Mehr": Körperdaten eingeben, Tagesziel berechnen lassen (mit Erklärung) und von Hand anpassen.
import { h, ersetze } from '../dom.js';
import { GESCHLECHTER, AKTIVITAETEN, ZIELE, pruefeKoerperdaten, schlageZielVor } from '../tagesziel.js';
import { ladeProfil, speichereProfil } from '../profil.js';
import { parseZahl } from '../pantry.js';

// zurueck(): zurück zum Aufrufer
export async function render(container, { zurueck }) {
  const profil = await ladeProfil();
  const zahlText = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

  const auswahl = (liste, wert, platzhalter) =>
    h(
      'select',
      {},
      h('option', { value: '' }, platzhalter),
      liste.map((x) => h('option', { value: x.id, selected: x.id === wert }, x.label))
    );

  const geschlecht = auswahl(GESCHLECHTER, profil?.geschlecht, 'Bitte wählen');
  const geburtsjahr = h('input', { type: 'text', inputmode: 'numeric', value: zahlText(profil?.geburtsjahr), placeholder: 'z. B. 1995', 'aria-label': 'Geburtsjahr' });
  const groesse = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(profil?.groesseCm), placeholder: 'z. B. 180', 'aria-label': 'Größe in cm' });
  const gewicht = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(profil?.gewichtKg), placeholder: 'z. B. 80', 'aria-label': 'Gewicht in kg' });
  const aktivitaet = auswahl(AKTIVITAETEN, profil?.aktivitaet, 'Bitte wählen');
  const ziel = auswahl(ZIELE, profil?.ziel, 'Bitte wählen');

  const zielFeld = (wert, beschriftung) => h('input', { type: 'text', inputmode: 'decimal', value: zahlText(wert), 'aria-label': beschriftung });
  const kcal = zielFeld(profil?.tagesziel.kcal, 'Kalorien');
  const eiweiss = zielFeld(profil?.tagesziel.eiweiss, 'Eiweiß');
  const kohlenhydrate = zielFeld(profil?.tagesziel.kohlenhydrate, 'Kohlenhydrate');
  const fett = zielFeld(profil?.tagesziel.fett, 'Fett');

  const meldungBox = h('div');
  const erklaerBox = h('div');

  const liesKoerper = () =>
    pruefeKoerperdaten({ geschlecht: geschlecht.value, geburtsjahr: geburtsjahr.value, groesseCm: groesse.value, gewichtKg: gewicht.value, aktivitaet: aktivitaet.value, ziel: ziel.value });

  function zeigeErklaerung(v) {
    ersetze(
      erklaerBox,
      v.hinweise.map((t) => h('p', { class: 'hinweis warnung' }, t)),
      h(
        'details',
        { open: true },
        h('summary', {}, 'So wird gerechnet'),
        h('ol', { class: 'schritte' }, v.rechenweg.map((z) => h('li', {}, z))),
        h('p', { class: 'menge' }, 'Das sind Richtwerte, keine Vorgaben. Du kannst jede Zahl unten von Hand ändern.')
      )
    );
  }

  function berechnen() {
    try {
      const v = schlageZielVor(liesKoerper());
      kcal.value = zahlText(v.kcal);
      eiweiss.value = zahlText(v.eiweiss);
      kohlenhydrate.value = zahlText(v.kohlenhydrate);
      fett.value = zahlText(v.fett);
      zeigeErklaerung(v);
      ersetze(meldungBox, h('p', { class: 'hinweis' }, `Vorschlag: ${v.kcal} kcal pro Tag. Die Zahlen unten sind eingetragen, mit „Speichern“ übernimmst du sie.`));
    } catch (e) {
      ersetze(meldungBox, h('p', { class: 'hinweis fehler' }, e.message));
      meldungBox.scrollIntoView({ block: 'center' });
    }
  }

  async function speichern() {
    try {
      const koerper = liesKoerper();
      const vorschlag = schlageZielVor(koerper);
      const tagesziel = { kcal: parseZahl(kcal.value), eiweiss: parseZahl(eiweiss.value), kohlenhydrate: parseZahl(kohlenhydrate.value), fett: parseZahl(fett.value) };
      if (Object.values(tagesziel).some((w) => !Number.isFinite(w))) throw new Error('Bitte alle vier Zahlen des Tagesziels eintragen (Kalorien, Eiweiß, Kohlenhydrate, Fett).');
      const manuell = ['kcal', 'eiweiss', 'kohlenhydrate', 'fett'].some((f) => tagesziel[f] !== vorschlag[f]);
      await speichereProfil({ ...koerper, tagesziel, manuell });
      zeigeErklaerung(vorschlag);
      ersetze(meldungBox, h('p', { class: 'hinweis' }, `✔ Gespeichert: ${tagesziel.kcal} kcal pro Tag${manuell ? ' (von dir angepasst)' : ''}.`));
      meldungBox.scrollIntoView({ block: 'center' });
    } catch (e) {
      ersetze(meldungBox, h('p', { class: 'hinweis fehler' }, e.message));
      meldungBox.scrollIntoView({ block: 'center' });
    }
  }

  ersetze(
    container,
    h('button', { class: 'zweit', style: 'margin-bottom:8px', onclick: zurueck }, '← Zurück'),
    h('h2', {}, 'Körperdaten und Tagesziel'),
    h('p', { class: 'menge' }, 'Deine Körperdaten bleiben auf diesem iPhone. Sie stehen aber auch in der Sicherungsdatei, bewahre sie sicher auf.'),
    h('label', {}, 'Geschlecht'),
    geschlecht,
    h('label', {}, 'Geburtsjahr'),
    geburtsjahr,
    h('div', { class: 'zeile' }, h('div', {}, h('label', {}, 'Größe (cm)'), groesse), h('div', {}, h('label', {}, 'Gewicht (kg)'), gewicht)),
    h('label', {}, 'Aktivität im Alltag'),
    aktivitaet,
    h('label', {}, 'Ziel'),
    ziel,
    h('button', { class: 'zweit voll', style: 'margin-top:16px', onclick: berechnen }, 'Vorschlag berechnen'),
    erklaerBox,
    h('h2', { style: 'margin-top:24px' }, 'Dein Tagesziel'),
    h('p', { class: 'menge' }, 'Diese vier Zahlen zeigt das Tagebuch. Du kannst sie ändern.'),
    h('label', {}, 'Kalorien (kcal)'),
    kcal,
    h('label', {}, 'Eiweiß (g)'),
    eiweiss,
    h('label', {}, 'Kohlenhydrate (g)'),
    kohlenhydrate,
    h('label', {}, 'Fett (g)'),
    fett,
    meldungBox,
    h('button', { class: 'voll gross', style: 'margin-top:16px', onclick: speichern }, 'Speichern')
  );

  // Ist schon ein Profil da, steht die Erklärung gleich bereit
  if (profil) zeigeErklaerung(schlageZielVor(profil));
}
