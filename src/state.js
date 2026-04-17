// ─── Shared Mutable State ────────────────────────────────────────────────────
// Single source of truth for all runtime state. Import `state` everywhere.
// Never duplicate these — always mutate via state.fieldName = value.

import { THEMES } from './constants.js';

const _saved = parseInt(localStorage.getItem('crt-theme') || '0', 10);
const _idx   = (isNaN(_saved) || _saved >= THEMES.length) ? 0 : _saved;

export const state = {
  // ── Theme ──────────────────────────────────────────────────────────────────
  themeIdx:    _idx,
  windowTheme: THEMES[_idx],
  themeMenuOpen: false,

  // ── Boot ───────────────────────────────────────────────────────────────────
  bootStartTime: null,
  BOOT_DONE:     false,

  // ── DOM references (set in boot) ───────────────────────────────────────────
  bgVideo: null,

  // ── ASCII / panel fallback ─────────────────────────────────────────────────
  asciiLines: ['LOADING...'],
  asciiImg:   null,
  fontReady:  false,
  asciiCache: { canvas: null, w: -1, h: -1 },

  // ── Gradient cache (rebuilt on resize/theme change) ────────────────────────
  gradCache: { W: -1, H: -1, ambient: null, vig: null },

  // ── Sidebar ────────────────────────────────────────────────────────────────
  menuHitAreas: [],
  hoveredItem:  -1,
  clickFlash:   {},
  hoverState:   {},

  // ── Page system ────────────────────────────────────────────────────────────
  activePage:    null,
  pageEnterTime: 0,
  pageHitAreas:  [],
  globalHitAreas: [],
  globalHoverId:  null,
  subHoverId:     null,
  subHoverState:  {},

  // ── Scroll ─────────────────────────────────────────────────────────────────
  lbScrollY:    0,
  lbScrollMax:  0,
  menuScrollY:  0,
  menuScrollMax: 0,

  // ── Library ────────────────────────────────────────────────────────────────
  libOpenFolder: null,  // null = folder grid; string = open folder id

  // ── Doom ───────────────────────────────────────────────────────────────────
  doomCanvas:   null,
  doomCtx:      null,
  doomReady:    false,
  doomLoading:  false,
  doomError:    null,
  doomReadyTime: 0,

  // ── Mario ──────────────────────────────────────────────────────────────────
  pagePrev:         null,
  marioFrame:       null,
  marioControlsDiv: null,

  // ── Music ──────────────────────────────────────────────────────────────────
  musicPollTimer: null,

  // ── Touch / scroll inertia ─────────────────────────────────────────────────
  touchStartX:  0,
  touchStartY:  0,
  touchLastY:   0,
  touchLastTime: 0,
  scrollVel:    0,
  scrollTarget: 'page',
  lastPortrait: null,   // initialised in boot()

  // ── Battery ────────────────────────────────────────────────────────────────
  battery: { level: 1.0, charging: false },
};
