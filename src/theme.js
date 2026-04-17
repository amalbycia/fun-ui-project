// ─── Theme Accessors ─────────────────────────────────────────────────────────
// Live-reading proxies — always reflect the current windowTheme from state.
// Import THEME/AMBER* from here; never read state.windowTheme directly.

import { state } from './state.js';

export const THEME = new Proxy({}, {
  get: (_, p) => state.windowTheme[p],
});

export const AMBER       = { toString: () => state.windowTheme.hex };
export const AMBER_DIM   = { toString: () => `rgba(${state.windowTheme.r},${state.windowTheme.g},${state.windowTheme.b},0.4)` };
export const AMBER_GLOW  = { toString: () => `rgba(${state.windowTheme.r},${state.windowTheme.g},${state.windowTheme.b},0.9)` };
export const AMBER_STRONG = { toString: () => `rgba(${state.windowTheme.r},${state.windowTheme.g},${state.windowTheme.b},1.0)` };
