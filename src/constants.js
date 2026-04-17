// ─── Constants ───────────────────────────────────────────────────────────────
// Immutable app-wide constants. Import from here — never hardcode elsewhere.

export const THEMES = [
  { name: 'AMBER', hex: '#F4C436', r: 244, g: 196, b: 54  },
  { name: 'GREEN', hex: '#4af626', r: 74,  g: 246, b: 38  },
  { name: 'CYAN',  hex: '#00e5ff', r: 0,   g: 229, b: 255 },
  { name: 'WHITE', hex: '#dcdcdc', r: 220, g: 220, b: 220 },
  { name: 'PINK',  hex: '#ff00aa', r: 255, g: 0,   b: 170 },
  { name: 'BLOOD', hex: '#ff1100', r: 255, g: 17,  b: 0   },
];

export const BG    = '#120d00';
export const BEZEL = '#050400';

export const SPEED    = 200;   // chars/sec typewriter
export const BOOT_DUR = 3.8;   // seconds for boot animation

export const DOOM_W = 640;
export const DOOM_H = 400;

export const LASTFM_KEY  = '0516e4e3bbe03d3dd814d45fc654d0f2';
export const LASTFM_USER = 'keznotkez';
export const LASTFM_POLL = 30_000;

export const MENU = [
  ['[≡]', '@library'],
  ['[◉]', '@letterboxd'],
  ['[#]', '@discord'],
  ['[♫]', '@music'],
  ['[▩]', '@images'],
  ['[§]', '@diary'],
  ['[►]', '@arcade'],
];

export const MENU_LINKS = {
  0: { type: 'page', page: 'library' },
  1: { type: 'page', page: 'letterboxd' },
  2: { type: 'page', page: 'discord' },
  3: { type: 'page', page: 'music' },
  4: null,
  5: null,
  6: { type: 'page', page: 'arcade' },
};

export const CLICKABLE = new Set([0, 1, 2, 3, 4, 5, 6]);
