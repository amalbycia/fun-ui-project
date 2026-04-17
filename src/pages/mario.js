// ─── PAGE: MARIO ─────────────────────────────────────────────────────────────

import { state }                          from '../state.js';
import { THEME, AMBER, AMBER_DIM }        from '../theme.js';
import { pgGlow, pgGlowOff }              from '../utils.js';

export function positionMarioFrame() {
  if (!state.marioFrame) return;
  const dpr    = Math.min(window.devicePixelRatio || 1, 2);
  const W      = window.innerWidth  * dpr;
  const H      = window.innerHeight * dpr;
  const BEZ    = W * 0.016;
  const iw     = W - BEZ * 2;
  const ih     = H - BEZ * 2;
  const SW     = iw * 0.24;
  const gap    = iw * 0.012;
  const FOOT   = ih * 0.10;
  const left   = (BEZ + SW + gap)              / dpr;
  const top    = BEZ                            / dpr;
  const width  = (iw - SW - gap * 1.5)         / dpr;
  const height = (ih - FOOT - ih * 0.02)       / dpr;
  state.marioFrame.style.left   = left   + 'px';
  state.marioFrame.style.top    = top    + 'px';
  state.marioFrame.style.width  = width  + 'px';
  state.marioFrame.style.height = height + 'px';
}

export function showMarioControls() {
  if (state.marioControlsDiv) { state.marioControlsDiv.remove(); state.marioControlsDiv = null; }

  const dpr    = Math.min(window.devicePixelRatio || 1, 2);
  const W      = window.innerWidth  * dpr;
  const H      = window.innerHeight * dpr;
  const BEZ    = W * 0.016;
  const iw     = W - BEZ * 2;
  const ih     = H - BEZ * 2;
  const SW     = iw * 0.24;
  const gap    = iw * 0.012;
  const FOOT   = ih * 0.10;
  const left   = (BEZ + SW + gap)              / dpr;
  const top    = BEZ                            / dpr;
  const width  = (iw - SW - gap * 1.5)         / dpr;
  const height = (ih - FOOT - ih * 0.02)       / dpr;

  const themeHex = state.windowTheme.hex;
  const themeRGB = `${state.windowTheme.r},${state.windowTheme.g},${state.windowTheme.b}`;

  const div = document.createElement('div');
  div.style.cssText = [
    `position:fixed`,
    `left:${left}px`, `top:${top}px`,
    `width:${width}px`, `height:${height}px`,
    `z-index:12`, `pointer-events:none`,
    `display:flex`, `align-items:flex-start`, `justify-content:flex-start`,
    `opacity:1`, `transition:opacity 1.2s ease`,
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    `margin:${height * 0.05}px 0 0 ${width * 0.04}px`,
    `background:rgba(0,0,0,0.78)`,
    `border-left:2px solid rgba(${themeRGB},0.7)`,
    `padding:${height * 0.03}px ${width * 0.05}px`,
    `font-family:VT323,monospace`,
    `color:${themeHex}`,
    `font-size:${Math.max(14, height * 0.038)}px`,
    `line-height:1.55`, `white-space:pre`,
    `text-shadow:0 0 8px rgba(${themeRGB},0.8)`,
  ].join(';');

  const rows = [
    ['CONTROLS', ''], ['─'.repeat(22), ''],
    ['← →', 'MOVE'],
    ['↓', 'DUCK  (when large)'],
    ['S', 'JUMP'],
    ['A', 'RUN  /  FIRE'],
    ['S', 'START  (title screen)'],
    ['─'.repeat(22), ''],
    ['TIP: click game if keys stop working', ''],
  ];
  panel.innerHTML = rows.map(([key, action]) => {
    if (!action) return `<span style="opacity:0.55">${key}</span>`;
    const keySpan = `<span style="color:${themeHex};min-width:7ch;display:inline-block">${key}</span>`;
    const actSpan = `<span style="opacity:0.55">${action}</span>`;
    return keySpan + actSpan;
  }).join('\n');

  div.appendChild(panel);
  document.body.appendChild(div);
  state.marioControlsDiv = div;

  const fadeTimer = setTimeout(() => {
    if (state.marioControlsDiv === div) div.style.opacity = '0';
  }, 7000);
  div.addEventListener('transitionend', () => {
    clearTimeout(fadeTimer);
    if (state.marioControlsDiv === div) { div.remove(); state.marioControlsDiv = null; }
  });
}

export function drawPageMario(ctx, x, y, w, h) {
  const fs = Math.min(h / 20, w / 24);
  ctx.font = `${fs}px VT323`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  pgGlow(ctx, 14); ctx.fillStyle = AMBER_DIM;
  ctx.fillText('LOADING MARIO . . .', x + w / 2, y + h / 2);
  pgGlowOff(ctx);

  ctx.textBaseline = 'top'; ctx.textAlign = 'right';
  const badgeFS = Math.min(h / 22, w / 28);
  ctx.font = `${badgeFS}px VT323`;
  pgGlow(ctx, 8); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
  ctx.fillText('[ESC] EXIT', x + w - badgeFS * 0.5, y + badgeFS * 0.4);
  pgGlowOff(ctx);
}
