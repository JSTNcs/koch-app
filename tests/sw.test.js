import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const swText = readFileSync(join(root, 'sw.js'), 'utf8');

function assetListe() {
  const block = swText.match(/const ASSETS = \[([\s\S]*?)\];/)[1];
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function alleDateien(ordner) {
  const out = [];
  const pfad = join(root, ordner);
  if (!existsSync(pfad)) return out;
  for (const name of readdirSync(pfad)) {
    const voll = join(pfad, name);
    if (statSync(voll).isDirectory()) out.push(...alleDateien(join(ordner, name)));
    else out.push(relative(root, voll).replaceAll('\\', '/'));
  }
  return out;
}

test('jede Datei in der Offline-Liste existiert', () => {
  for (const a of assetListe()) {
    if (a === './') continue;
    assert.ok(existsSync(join(root, a)), `Fehlt auf der Platte: ${a}`);
  }
});

test('jede App-Datei steht in der Offline-Liste', () => {
  const liste = new Set(assetListe());
  const app = [...alleDateien('js'), ...alleDateien('css'), ...alleDateien('icons'), ...alleDateien('lib'), ...alleDateien('daten')];
  for (const datei of app) {
    // Lizenzdateien werden nicht von der App geladen
    if (/LICENSE|\.md$|\.txt$/i.test(datei)) continue;
    assert.ok(liste.has(datei), `Nicht in sw.js ASSETS: ${datei}`);
  }
});

test('Versionsnummer in sw.js und js/version.js ist gleich', () => {
  const sw = swText.match(/const VERSION = '([^']+)'/)[1];
  const app = readFileSync(join(root, 'js/version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  assert.equal(app, sw);
});

test('die Startdateien sind in der Offline-Liste', () => {
  const liste = new Set(assetListe());
  for (const d of ['index.html', 'manifest.webmanifest']) assert.ok(liste.has(d), d);
});
