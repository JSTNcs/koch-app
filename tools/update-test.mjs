// Prüft den Hinweis bei neuer App-Version mit einem echten Versionswechsel:
// Kopie der App starten -> Version in der Kopie ändern -> der Hinweis muss erscheinen, die alte Version bleibt aktiv,
// erst der Tipp auf "Jetzt aktualisieren" schaltet um und lädt neu.
// Aufruf: node tools/update-test.mjs   (braucht Python und Edge oder Chrome, keinen Server)
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const quelle = fileURLToPath(new URL('..', import.meta.url));
const ZIEL_PORT = 8082;
const CDP_PORT = 9334;
const kandidaten = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const exe = kandidaten.find(existsSync);
if (!exe) throw new Error('Weder Edge noch Chrome gefunden.');

// Beendet alle Prozesse dieses Tests (erkennbar am Ordnernamen "koch-update-"), nie deinen normalen Browser.
function aufraeumen() {
  spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'koch-update-' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
}
aufraeumen();

const ergebnisse = [];
const pruefe = (bedingung, text) => {
  ergebnisse.push(bedingung);
  console.log((bedingung ? 'PASS ' : 'FAIL ') + text);
};
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Kopie der App in einem Wegwerf-Ordner
const seite = mkdtempSync(join(tmpdir(), 'koch-update-site-'));
for (const n of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons', 'lib', 'daten']) cpSync(join(quelle, n), join(seite, n), { recursive: true });
const version = readFileSync(join(seite, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];

// 2. Server und Browser
const server = spawn('python', ['-m', 'http.server', String(ZIEL_PORT), '--bind', '127.0.0.1', '--directory', seite], { stdio: 'ignore' });
const profil = mkdtempSync(join(tmpdir(), 'koch-update-profil-'));
spawn(exe, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profil}`, '--disable-gpu', '--disable-extensions', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

let ziel;
for (let i = 0; i < 60 && !ziel; i++) {
  try {
    ziel = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()).find((t) => t.type === 'page');
  } catch {}
  if (!ziel) await warte(250);
}
if (!ziel) {
  aufraeumen();
  throw new Error('Browser nicht erreichbar.');
}
const ws = new WebSocket(ziel.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nr = 0;
const offen = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && offen.has(d.id)) offen.get(d.id)(d);
};
const cdp = (method, params = {}) => new Promise((r) => { const id = ++nr; offen.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ausfuehren = async (ausdruck) => {
  try {
    return (await cdp('Runtime.evaluate', { expression: ausdruck, returnByValue: true, awaitPromise: true })).result?.result?.value;
  } catch {
    return undefined;
  }
};
const bis = async (ausdruck, ms = 20000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await ausfuehren(ausdruck)) return true;
    await warte(250);
  }
  return false;
};

try {
  await cdp('Page.enable');
  await cdp('Page.navigate', { url: `http://127.0.0.1:${ZIEL_PORT}/index.html` });

  // 3. Erste Version läuft und kontrolliert die Seite
  pruefe(await bis('!!navigator.serviceWorker.controller'), 'Erste Installation: Der Service Worker übernimmt die Seite');
  pruefe((await ausfuehren("document.getElementById('update').hidden")) === true, 'Erste Installation: kein Update-Hinweis');
  pruefe(JSON.stringify(await ausfuehren('caches.keys()')) === JSON.stringify([`koch-app-${version}`]), `Zwischenspeicher: nur koch-app-${version}`);

  // 4. Neue Version "veröffentlichen" (in der Kopie) und nachsehen
  const neu = `${version}-neu`;
  writeFileSync(join(seite, 'sw.js'), readFileSync(join(seite, 'sw.js'), 'utf8').replace(`const VERSION = '${version}'`, `const VERSION = '${neu}'`));
  await ausfuehren("window.__marker = 'alte-seite'");
  await ausfuehren('navigator.serviceWorker.getRegistration().then((r) => r.update()).then(() => true)');
  pruefe(await bis("document.getElementById('update').hidden === false"), 'Neue Version erkannt: Der Hinweis "Neue Version verfügbar" erscheint');
  pruefe(/Jetzt aktualisieren/.test(await ausfuehren("document.getElementById('update-knopf').textContent")), 'Der Hinweis hat den Knopf "Jetzt aktualisieren"');

  // 5. Ohne Tippen schaltet nichts von selbst um
  await warte(2500);
  pruefe((await ausfuehren('window.__marker')) === 'alte-seite', 'Ohne Tippen lädt die Seite nicht von selbst neu');
  const schluessel = await ausfuehren('caches.keys()');
  pruefe(schluessel.includes(`koch-app-${version}`) && schluessel.includes(`koch-app-${neu}`), 'Die neue Version liegt bereit, die alte ist noch da (zwei Zwischenspeicher)');

  // 6. Tipp auf "Jetzt aktualisieren": umschalten und neu laden
  await ausfuehren("document.getElementById('update-knopf').click()");
  pruefe(await bis("window.__marker === undefined && !!navigator.serviceWorker.controller"), 'Nach dem Tipp lädt die Seite neu');
  pruefe(await bis(`caches.keys().then((k) => k.length === 1 && k[0] === 'koch-app-${neu}')`), `Danach gilt nur noch koch-app-${neu}, der alte Zwischenspeicher ist gelöscht`);
  pruefe((await ausfuehren("document.getElementById('update').hidden")) === true, 'Nach dem Aktualisieren ist der Hinweis wieder weg');
  pruefe(await bis("document.querySelector('#screen')?.children.length > 0", 8000), 'Die App zeigt nach dem Neuladen ihren Bildschirm');
} finally {
  ws.close();
  aufraeumen();
  await warte(500);
  rmSync(seite, { recursive: true, force: true });
  rmSync(profil, { recursive: true, force: true });
}
const fehler = ergebnisse.filter((x) => !x).length;
console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Prüfungen bestanden.`);
process.exit(fehler ? 1 : 0);
