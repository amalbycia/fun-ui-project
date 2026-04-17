// ─── App Data ────────────────────────────────────────────────────────────────
// Static data for pages. Edit here to update content.

// ── Letterboxd ───────────────────────────────────────────────────────────────
export const LB_USER = 'psfo';

export const LB_FILMS = [
  { title: 'Project Hail Mary',        dir: 'Lord & Miller',        year: '2026', rating: '★★★★★', color: '#1a3a5c', poster: 'https://image.tmdb.org/t/p/w342/yihdXomYb5kTeSivtFndMy5iDmf.jpg' },
  { title: 'One Battle After Another', dir: 'Paul Thomas Anderson', year: '2025', rating: '★★★★½', color: '#2a1a0a', poster: 'https://image.tmdb.org/t/p/w342/lbBWwxBht4JFP5PsuJ5onpMqugW.jpg' },
  { title: 'Sinners',                  dir: 'Ryan Coogler',         year: '2025', rating: '★★★★½', color: '#3a0808', poster: 'https://image.tmdb.org/t/p/w342/705nQHqe4JGdEisrQmVYmXyjs1U.jpg' },
  { title: 'Anora',                    dir: 'Sean Baker',           year: '2024', rating: '★★★★',  color: '#1a2a3a', poster: 'https://image.tmdb.org/t/p/w342/oN0o3owobFjePDc5vMdLRAd0jkd.jpg' },
  { title: 'The Brutalist',            dir: 'Brady Corbet',         year: '2024', rating: '★★★★',  color: '#2a2a1a', poster: 'https://image.tmdb.org/t/p/w342/vP7Yd6couiAaw9jgMd5cjMRj3hQ.jpg' },
];

// ── Socials ───────────────────────────────────────────────────────────────────
export const SOCIALS = [
  { id: 'instagram', label: '@INSTAGRAM', handle: 'alkexh',      url: 'https://instagram.com/alkexh' },
  { id: 'linkedin',  label: '@LINKEDIN',  handle: 'alkeshjames', url: 'https://linkedin.com/in/alkeshjames' },
  { id: 'twitter',   label: '@TWITTER',   handle: '___',         url: null },
];

// ── Arcade ────────────────────────────────────────────────────────────────────
export const ARCADE_GAMES = [
  {
    id:       'game-doom',
    name:     'DOOM',
    year:     '1993',
    genre:    'FPS',
    engine:   'WASM FREEDOOM',
    blurb:    'Descend into hell. Fight demons\nthrough fortresses and flesh.',
    controls: '↑↓←→  CTRL  SPACE  TAB',
    poster:   '/arcade/doom.jpg',
  },
  {
    id:       'game-mario',
    name:     'MARIO',
    year:     '1985',
    genre:    'PLATFORMER',
    engine:   'INFINITE MARIO HTML5',
    blurb:    'Run, jump, stomp through infinite\nprocedurally generated worlds.',
    controls: '←→  S (JUMP)  A (RUN / FIRE)',
    poster:   '/arcade/mario.jpg',
  },
];

// ── Library ───────────────────────────────────────────────────────────────────
// Each folder maps to a category from the design library.
export const LIBRARY_FOLDERS = [
  { id: 'lib-motion',  label: '~motion'  },
  { id: 'lib-inspo',   label: '~inspo'   },
  { id: 'lib-studios', label: '~studios' },
  { id: 'lib-dev',     label: '~dev'     },
  { id: 'lib-assets',  label: '~assets'  },
];

export const LIBRARY_DATA = {
  'lib-motion': {
    title: 'MOTION & 3D',
    sites: [
      { name: 'SPLINE.DESIGN',     url: 'https://spline.design'     },
      { name: 'UNICORN.STUDIO',    url: 'https://unicorn.studio'    },
      { name: 'JITTER.VIDEO',      url: 'https://jitter.video'      },
      { name: 'SHADERGRADIENT.CO', url: 'https://shadergradient.co' },
    ],
  },
  'lib-inspo': {
    title: 'INSPIRATION & GALLERIES',
    sites: [
      { name: 'LANDING.LOVE',     url: 'https://landing.love'     },
      { name: 'UNSECTION.COM',    url: 'https://unsection.com'    },
      { name: 'SCREENDESIGN.COM', url: 'https://screendesign.com' },
      { name: 'TOOLFOLIO.IO',     url: 'https://toolfolio.io'     },
      { name: 'CODEPEN.IO',       url: 'https://codepen.io'       },
    ],
  },
  'lib-studios': {
    title: 'REFERENCES / STUDIOS',
    sites: [
      { name: 'MANUS.IM',            url: 'https://manus.im'            },
      { name: 'ALMOSTNODE.DEV',      url: 'https://almostnode.dev'      },
      { name: 'MEETBLUEBERRY.COM',   url: 'https://meetblueberry.com'   },
      { name: 'ULTRACITE.AI',        url: 'https://ultracite.ai'        },
      { name: 'SUPERSET.SH',         url: 'https://superset.sh'         },
      { name: 'NUMENBYDESIGN.COM',   url: 'https://numenbydesign.com'   },
      { name: 'THEREFRAME.APP',      url: 'https://thereframe.app'      },
      { name: 'CARGO.SITE',          url: 'https://cargo.site'          },
    ],
  },
  'lib-dev': {
    title: 'COMPONENTS & DEV',
    sites: [
      { name: '21ST.DEV',            url: 'https://21st.dev'            },
      { name: 'MONOSKETCH.IO',       url: 'https://monosketch.io'       },
      { name: 'CONSTRAINT.SYSTEMS',  url: 'https://constraint.systems'  },
    ],
  },
  'lib-assets': {
    title: 'ASSETS & TEXTURES',
    sites: [
      { name: 'STICKERS.GALLERY', url: 'https://stickers.gallery'  },
      { name: 'BETA.BLKMARKET',   url: 'https://beta.blkmarket.com' },
      { name: 'FLAIR.AI',         url: 'https://flair.ai'          },
      { name: 'DEATHTOSTOCK.COM', url: 'https://deathtostock.com'  },
    ],
  },
};
