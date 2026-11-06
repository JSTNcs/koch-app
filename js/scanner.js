// Kamera + Barcode lesen. Die Bibliothek liegt lokal in lib/ (kein CDN).
import { BarcodeDetector, prepareZXingModule } from '../lib/barcode-detector/ponyfill.js';

const FORMATE = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
let vorbereitet = false;

// Sagt der Bibliothek, dass ihre .wasm-Datei aus lib/zxing-wasm/ kommt (nicht von jsDelivr).
// Muss vor dem ersten "new BarcodeDetector" passieren.
export function bibliothekVorbereiten() {
  if (vorbereitet) return;
  prepareZXingModule({
    overrides: {
      locateFile: (pfad, vorspann) =>
        pfad.endsWith('.wasm') ? new URL(`../lib/zxing-wasm/${pfad}`, import.meta.url).href : vorspann + pfad,
    },
  });
  vorbereitet = true;
}

export function erzeugeDetektor() {
  bibliothekVorbereiten();
  return new BarcodeDetector({ formats: FORMATE });
}

export function kameraFehlerText(fehler) {
  if (!navigator.mediaDevices?.getUserMedia) return 'Die Kamera geht nur über eine sichere Verbindung (https).';
  switch (fehler?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Die Kamera ist nicht erlaubt. Erlaube sie in den iPhone-Einstellungen (Einstellungen → Safari → Kamera) oder tippe den Barcode ein.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Es wurde keine Kamera gefunden. Du kannst den Barcode eintippen.';
    case 'NotReadableError':
      return 'Die Kamera wird gerade von einer anderen App benutzt.';
    default:
      return 'Die Kamera konnte nicht gestartet werden. Du kannst den Barcode eintippen.';
  }
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Startet die Kamera im <video>-Element und sucht laufend nach Barcodes.
// beiCode(text) bekommt jeden gelesenen Code. Gibt es true zurück, stoppt der Scanner von selbst.
// Rückgabe: { stop() }. Wirft einen Fehler mit deutscher Meldung, wenn die Kamera nicht startet.
export async function starteScanner(video, beiCode) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error(kameraFehlerText());
  let strom;
  try {
    strom = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    throw new Error(kameraFehlerText(e));
  }

  let laeuft = true;
  const stop = () => {
    laeuft = false;
    strom.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  try {
    video.setAttribute('playsinline', ''); // sonst öffnet iOS die Kamera im Vollbild
    video.muted = true;
    video.srcObject = strom;
    await video.play();
    const detektor = erzeugeDetektor();
    (async () => {
      while (laeuft) {
        try {
          if (video.readyState >= 2) {
            for (const treffer of await detektor.detect(video)) {
              if (laeuft && beiCode(treffer.rawValue)) {
                stop();
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Scan-Durchlauf fehlgeschlagen:', e);
        }
        await warte(150);
      }
    })();
  } catch (e) {
    stop();
    throw new Error(kameraFehlerText(e));
  }
  return { stop };
}
