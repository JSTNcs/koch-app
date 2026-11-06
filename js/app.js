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

// Offline-Fähigkeit: Service Worker anmelden
if ('serviceWorker' in navigator) {
  let schonNeuGeladen = false;
  // Gab es beim Start schon einen Service Worker? Dann ist ein späterer Wechsel ein Update.
  const warSchonInstalliert = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Neue App-Version ist aktiv geworden: einmal neu laden (aber nicht beim allerersten Start).
    if (schonNeuGeladen || !warSchonInstalliert) return;
    schonNeuGeladen = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker:', e));
}
