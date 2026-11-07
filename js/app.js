import { ROUTES, routeFuerHash } from './routes.js';

const screenEl = document.getElementById('screen');
const titleEl = document.getElementById('title');
const tabbarEl = document.getElementById('tabbar');

// Untere Navigation aufbauen
for (const route of ROUTES) {
  const a = document.createElement('a');
  a.href = `#/${route.id}`;
  a.dataset.id = route.id;
  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.textContent = route.icon;
  const label = document.createElement('span');
  label.textContent = route.label;
  a.append(icon, label);
  tabbarEl.append(a);
}

async function zeigeBildschirm() {
  const route = routeFuerHash(location.hash);
  titleEl.textContent = route.title;
  for (const a of tabbarEl.children) {
    if (a.dataset.id === route.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  screenEl.className = ''; // Zusatz-Klassen des vorigen Bildschirms entfernen
  screenEl.replaceChildren();
  try {
    const bildschirm = await route.load();
    await bildschirm.render(screenEl);
  } catch (fehler) {
    console.error(fehler);
    const p = document.createElement('p');
    p.className = 'hinweis fehler';
    p.textContent = 'Dieser Bildschirm konnte nicht geladen werden.';
    screenEl.replaceChildren(p);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', zeigeBildschirm);
zeigeBildschirm();

// Offline-Fähigkeit: Service Worker anmelden und auf neue App-Versionen achten
if ('serviceWorker' in navigator) {
  const updateBanner = document.getElementById('update');
  const updateKnopf = document.getElementById('update-knopf');
  let schonNeuGeladen = false;
  let aktualisierenAngefordert = false; // der Nutzer hat auf "Jetzt aktualisieren" getippt
  // Gab es beim Start schon einen Service Worker? Dann ist ein späterer Wechsel ein Update.
  const warSchonInstalliert = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Die neue Version ist aktiv geworden: einmal neu laden (aber nicht beim allerersten Start).
    if (schonNeuGeladen || !(warSchonInstalliert || aktualisierenAngefordert)) return;
    schonNeuGeladen = true;
    location.reload();
  });
  // Eine neue Version wartet: Hinweis zeigen. Erst der Tipp darauf schaltet um und lädt neu.
  const zeigeUpdate = (worker) => {
    updateBanner.hidden = false;
    updateKnopf.disabled = false;
    updateKnopf.onclick = () => {
      updateKnopf.disabled = true;
      aktualisierenAngefordert = true;
      worker.postMessage('skipWaiting');
    };
  };
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) zeigeUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const neu = reg.installing;
        neu?.addEventListener('statechange', () => {
          if (neu.state === 'installed' && navigator.serviceWorker.controller) zeigeUpdate(neu);
        });
      });
      // Das iPhone fragt von selbst selten nach: beim Öffnen und beim Zurückkehren in die App nachsehen
      const pruefen = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') pruefen();
      });
      pruefen();
    })
    .catch((e) => console.warn('Service Worker:', e));
}
