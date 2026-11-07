// Kleine Hilfe zum Bauen von Seitenelementen:  h('button', { class: 'zweit', onclick: ... }, 'Text')
export function h(tag, attribute = {}, ...kinder) {
  const el = document.createElement(tag);
  for (const [name, wert] of Object.entries(attribute || {})) {
    if (wert === false || wert == null) continue;
    if (name.startsWith('on') && typeof wert === 'function') el.addEventListener(name.slice(2), wert);
    else if (name === 'class') el.className = wert;
    else if (name === 'value') el.value = wert;
    else el.setAttribute(name, wert === true ? '' : wert);
  }
  for (const kind of kinder.flat(Infinity)) {
    if (kind == null || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return el;
}

// Ersetzt den Inhalt von "el". Leere Teile (null, false) werden ausgelassen statt als Text "null" gezeigt.
export function ersetze(el, ...kinder) {
  el.replaceChildren(...kinder.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
}
