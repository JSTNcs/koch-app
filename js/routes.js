// Die 6 Bildschirme der App (Reihenfolge = Reihenfolge in der unteren Leiste).
// "load" lädt den Bildschirm erst, wenn er gebraucht wird.

const leer = (text) => async () => (await import('./screens/leer.js')).leer(text);

export const ROUTES = [
  {
    id: 'vorrat',
    label: 'Vorrat',
    title: 'Vorrat',
    icon: '🥫',
    load: () => import('./screens/vorrat.js'),
  },
  {
    id: 'einkauf',
    label: 'Einkauf',
    title: 'Einkaufsliste',
    icon: '🛒',
    load: leer('Die Einkaufsliste kommt in Phase 2.'),
  },
  {
    id: 'rezepte',
    label: 'Was koche ich?',
    title: 'Was koche ich?',
    icon: '💡',
    load: leer('Rezeptvorschläge kommen in Phase 3.'),
  },
  {
    id: 'kochen',
    label: 'Kochen',
    title: 'Kochen',
    icon: '🍳',
    load: leer('Der Kochen-Modus kommt in Phase 4.'),
  },
  {
    id: 'tagebuch',
    label: 'Tagebuch',
    title: 'Tagebuch',
    icon: '📒',
    load: leer('Das Tagebuch kommt in Phase 5.'),
  },
  {
    id: 'einstellungen',
    label: 'Mehr',
    title: 'Einstellungen',
    icon: '⚙️',
    load: leer('Hier kommen Sicherung und Einstellungen hin.'),
  },
];

export function routeFuerHash(hash) {
  const id = String(hash || '').replace(/^#\/?/, '');
  return ROUTES.find((r) => r.id === id) || ROUTES[0];
}
