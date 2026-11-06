# Eingebundene Bibliotheken (lokal, kein CDN)

| Bibliothek | Version | Lizenz | Woher | Dateien hier |
|---|---|---|---|---|
| barcode-detector | 3.2.3 | MIT | npm `barcode-detector@3.2.3`, Ordner `dist/es` | `barcode-detector/ponyfill.js`, `barcode-detector/zxing-exported.js` |
| zxing-wasm (Reader) | 3.1.6 | MIT | npm `zxing-wasm@3.1.6`, Ordner `dist/reader` | `zxing-wasm/zxing_reader.wasm` |
| ZXing-C++ (steckt in der .wasm-Datei) | wie in zxing-wasm 3.1.6 | Apache-2.0 | github.com/zxing-cpp/zxing-cpp | `zxing-wasm/LICENSE-ZXing-cpp-Apache-2.0.txt` |

- Die Dateien sind unverändert aus den npm-Paketen kopiert (SHA-256 der `.wasm`-Datei stimmt mit
  `ZXING_WASM_SHA256` aus der Bibliothek überein: `5003fb4b88c4fbd1fd518a2fd8c8ad365c519e183a08c03a322dddfea3cea84e`).
- Die Bibliothek würde ihre `.wasm`-Datei standardmäßig von jsDelivr (CDN) laden. Das ist abgeschaltet:
  `js/scanner.js` setzt per `prepareZXingModule` den lokalen Pfad `lib/zxing-wasm/`.
- Alle drei Lizenzen erlauben private und kostenlose Nutzung. Die Lizenztexte liegen neben den Dateien.
- Aktualisieren: neue Version von npm holen, die gleichen Dateien ersetzen, Version und Prüfsumme hier eintragen.
