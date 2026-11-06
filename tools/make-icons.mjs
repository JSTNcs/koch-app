// Erzeugt die App-Symbole (PNG) ohne Zusatzprogramme. Aufruf: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const GRUEN = [0x2e, 0x7d, 0x32];
const WEISS = [255, 255, 255];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(typ, daten) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(daten.length);
  const teil = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(teil));
  return Buffer.concat([len, teil, crc]);
}

// Form: ein Kochtopf in Koordinaten von 0 bis 1
function imTopf(x, y) {
  const rechteck = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const kreis = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  return (
    rechteck(0.27, 0.46, 0.73, 0.72) || // Körper
    rechteck(0.23, 0.41, 0.77, 0.46) || // Deckel
    kreis(0.5, 0.36, 0.045) || // Knauf
    rechteck(0.16, 0.5, 0.27, 0.55) || // Griff links
    rechteck(0.73, 0.5, 0.84, 0.55) // Griff rechts
  );
}

function png(groesse) {
  const ss = 3; // Glättung
  const zeilen = [];
  for (let py = 0; py < groesse; py++) {
    const zeile = Buffer.alloc(1 + groesse * 3);
    for (let px = 0; px < groesse; px++) {
      let treffer = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++)
          if (imTopf((px + (sx + 0.5) / ss) / groesse, (py + (sy + 0.5) / ss) / groesse)) treffer++;
      const a = treffer / (ss * ss);
      for (let i = 0; i < 3; i++) zeile[1 + px * 3 + i] = Math.round(GRUEN[i] * (1 - a) + WEISS[i] * a);
    }
    zeilen.push(zeile);
  }
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(groesse, 0);
  kopf.writeUInt32BE(groesse, 4);
  kopf[8] = 8; // 8 Bit
  kopf[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', kopf),
    chunk('IDAT', deflateSync(Buffer.concat(zeilen))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/apple-touch-icon.png', png(180));
writeFileSync('icons/icon-192.png', png(192));
writeFileSync('icons/icon-512.png', png(512));
console.log('Symbole erzeugt.');
