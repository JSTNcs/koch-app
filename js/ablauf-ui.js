// Schnellknöpfe unter einem Datumsfeld "Haltbar bis": +3 Tage, +1 Woche, +1 Monat (weniger Tippen im Laden).
import { h } from './dom.js';
import { datumInTagen, datumInMonaten } from './ablauf.js';

export function ablaufSchnellknoepfe(eingabe) {
  const setze = (berechne) => () => {
    eingabe.value = berechne();
    eingabe.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return h(
    'div',
    { class: 'zeile', style: 'margin-top:8px' },
    h('button', { class: 'zweit', onclick: setze(() => datumInTagen(3)) }, '+3 Tage'),
    h('button', { class: 'zweit', onclick: setze(() => datumInTagen(7)) }, '+1 Woche'),
    h('button', { class: 'zweit', onclick: setze(() => datumInMonaten(1)) }, '+1 Monat')
  );
}
