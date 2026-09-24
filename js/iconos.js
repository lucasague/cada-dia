// Iconos SVG inline (trazo 1.8, 24x24).
const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;

export const I = {
  hoy: s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  lista: s('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  calendario: s('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  ajustes: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  check: s('<path d="M5 12.5l4.5 4.5L19 7"/>', ''),
  atras: s('<path d="M15 5l-7 7 7 7"/>'),
  adelante: s('<path d="M9 5l7 7-7 7"/>'),
  libro: s('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>'),
  campana: s('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  mas: s('<path d="M12 5v14M5 12h14"/>'),
  menos: s('<path d="M5 12h14"/>'),
  nube: s('<path d="M17.5 19a4.5 4.5 0 0 0 .4-9A7 7 0 0 0 4.3 12.5 3.5 3.5 0 0 0 6 19z"/>'),
  llama: `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="gLlama" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d9502a"/><stop offset=".55" stop-color="#f0a23a"/><stop offset="1" stop-color="#ffd86b"/></linearGradient></defs><path fill="url(#gLlama)" d="M12 2c.6 3.5-2.5 5-2.5 8 0 1.4.8 2.4 1.8 2.9-.3-1.7.7-2.9 1.7-3.9 0 2.4 4 3.5 4 7.5A5 5 0 0 1 7 16.5C7 12.5 12 11 12 2z"/><path fill="#fff4c2" opacity=".9" d="M12 13.5c1.3 1.4 2.5 2.4 2.5 4A2.5 2.5 0 0 1 9.5 17.5c0-1.7 1.3-2.6 2.5-4z"/></svg>`,
  marca: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4.5" fill="currentColor"/></svg>`,
};
