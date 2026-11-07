// Hält den Bildschirm beim Kochen an (Wake Lock). Wo das Gerät es nicht kann, passiert einfach nichts.
export function haltWach() {
  let sperre = null;
  let aktiv = true;
  async function anfordern() {
    try {
      if (aktiv && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        sperre = await navigator.wakeLock.request('screen');
      }
    } catch {
      // nicht erlaubt oder nicht unterstützt: ist in Ordnung
    }
  }
  document.addEventListener('visibilitychange', anfordern); // nach Wechsel in eine andere App neu anfordern
  anfordern();
  return {
    loslassen() {
      aktiv = false;
      document.removeEventListener('visibilitychange', anfordern);
      sperre?.release?.().catch(() => {});
      sperre = null;
    },
  };
}
