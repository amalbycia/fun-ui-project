// ─── Utility Helpers ─────────────────────────────────────────────────────────
// Pure helpers + canvas drawing primitives shared across all pages/renderer.

import { state }      from './state.js';
import { THEME, AMBER_GLOW } from './theme.js';
import { SPEED }      from './constants.js';

// ── Orientation ───────────────────────────────────────────────────────────────
export function isPortrait() { return window.innerHeight > window.innerWidth; }
export const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ── Canvas helpers ────────────────────────────────────────────────────────────
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── WebGL helpers ─────────────────────────────────────────────────────────────
export function buildProgram(gl, vSrc, fSrc) {
  const vs = _compile(gl, gl.VERTEX_SHADER, vSrc);
  const fs = _compile(gl, gl.FRAGMENT_SHADER, fSrc);
  const p  = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function _compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}

// ── Page drawing helpers ──────────────────────────────────────────────────────

export function glowText(ctx, radius = 22) {
  ctx.shadowColor = AMBER_GLOW;
  ctx.shadowBlur  = Math.max(radius, 10);
}

export function typeReveal(text, elapsed, startAt) {
  const t = elapsed - startAt;
  if (t <= 0) return '';
  return text.slice(0, Math.floor(t * SPEED));
}

export function pgGlow(ctx, blur = 18) {
  ctx.shadowColor = AMBER_GLOW;
  ctx.shadowBlur  = blur;
}

export function pgGlowOff(ctx) {
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

// Register a hit area into the current page's hit list.
export function regHit(x, y, w, h, id, url = null) {
  state.pageHitAreas.push({ x, y, w, h, id, url });
}

// Animated sub-link with hover highlight + hit registration.
export function drawSubLink(ctx, label, x, y, rowW, lineH, id, elapsed, startAt) {
  const shown = typeReveal(label, elapsed, startAt);
  if (!shown) return;
  const hs = state.subHoverState[id] || 0;
  if (hs > 0) {
    pgGlowOff(ctx);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs})`;
    ctx.fillRect(x - 4, y - lineH * 0.1, rowW + 8, lineH * 0.88);
  }
  const rr = Math.round(THEME.r - (THEME.r - 13) * hs);
  const gg = Math.round(THEME.g - (THEME.g - 8)  * hs);
  const bb = Math.round(THEME.b - THEME.b         * hs);
  ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
  pgGlow(ctx, Math.round(16 * (1 - hs)));
  ctx.fillText(shown, x, y);
  pgGlowOff(ctx);
  if (shown.length >= label.length)
    regHit(x - 4, y - lineH * 0.1, rowW + 8, lineH * 0.88, id);
}
