// Skill icons, drawn in code (24×24, stroke uses currentColor so they follow the theme).
const svg = (body: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS: Record<string, string> = {
  thermometer: svg('<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>'),
  joint: svg('<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M8.8 8.8l6.4 6.4"/><path d="M4 12h3M12 4v3"/>'),
  drop: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 15a3 3 0 0 0 3 3"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8.5 12h2l1-2 1.5 4 1-2h1.5"/>'),
  scale: svg('<path d="M12 4v16M7 20h10"/><path d="M5 8h14"/><path d="M5 8l-2.5 5a2.5 2.5 0 0 0 5 0z"/><path d="M19 8l-2.5 5a2.5 2.5 0 0 0 5 0z"/>'),
  flask: svg('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>'),
  pill: svg('<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M9.6 8.6l4.8 6.8"/>'),
  head: svg('<path d="M7 20v-3.5a6.5 6.5 0 1 1 9.5-5.8l1.5 3.3h-2V17a2 2 0 0 1-2 2h-1v1"/><path d="M8 9.5h8"/>'),
  shield: svg('<path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
  window: svg('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M4 12h16"/><path d="M15 8l2-2"/>'),
};
