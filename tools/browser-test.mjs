// Startet Edge unsichtbar, öffnet tools/browser-test.html und gibt das Ergebnis aus.
// Voraussetzung: lokaler Server läuft (python -m http.server 8080 im Projektordner).
// Aufruf: node tools/browser-test.mjs [Seite, Standard tools/browser-test.html] [Bild.png]
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const seite = process.argv[2] || 'tools/browser-test.html';
const bild = process.argv[3];
const kandidaten = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const exe = kandidaten.find(existsSync);
if (!exe) throw new Error('Weder Edge noch Chrome gefunden.');

// Beendet alle Test-Browser dieses Skripts (erkennbar am Profilordner "koch-test-"), nie deinen normalen Edge.
function aufraeumen() {
  spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'koch-test-' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    ],
    { stdio: 'ignore' }
  );
}
aufraeumen();

const port = 9333;
const profil = mkdtempSync(join(tmpdir(), 'koch-test-'));
const browser = spawn(
  exe,
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--disable-gpu', '--disable-extensions', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-first-run', '--window-size=700,830', 'about:blank'],
  { stdio: 'ignore' }
);

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
let ziel;
for (let i = 0; i < 50 && !ziel; i++) {
  try {
    const liste = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    ziel = liste.find((t) => t.type === 'page');
  } catch {}
  if (!ziel) await warte(200);
}
if (!ziel) {
  browser.kill();
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
const cdp = (method, params = {}) =>
  new Promise((r) => {
    const id = ++nr;
    offen.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const auswerten = async (ausdruck) => (await cdp('Runtime.evaluate', { expression: ausdruck, returnByValue: true })).result?.result?.value;

await cdp('Page.enable');
await cdp('Page.navigate', { url: `http://localhost:8080/${seite}` });

let text = '';
for (let i = 0; i < 120; i++) {
  await warte(500);
  text = (await auswerten("document.getElementById('out')?.textContent || ''")) || '';
  if (text.includes('FERTIG')) break;
}
if (bild) {
  await auswerten("document.getElementById('out').style.display = 'none'"); // Bericht ausblenden, damit die App frei zu sehen ist
  const s = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(bild, Buffer.from(s.result.data, 'base64'));
}
console.log(text || '(keine Ausgabe)');
ws.close();
aufraeumen();
process.exit(/FAIL/.test(text) || !text.includes('FERTIG') ? 1 : 0);
