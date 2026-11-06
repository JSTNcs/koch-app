// Platzhalter für Bildschirme, die noch nicht gebaut sind.
export function leer(text) {
  return {
    render(container) {
      const p = document.createElement('p');
      p.className = 'leer-text';
      p.textContent = text;
      container.append(p);
    },
  };
}
