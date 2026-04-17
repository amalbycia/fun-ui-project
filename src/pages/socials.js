// ─── PAGE: SOCIALS  +  TWITTER ERROR ─────────────────────────────────────────

import { state }                              from '../state.js';
import { THEME, AMBER, AMBER_DIM, AMBER_GLOW } from '../theme.js';
import { typeReveal, pgGlow, pgGlowOff, regHit, drawSubLink } from '../utils.js';
import { SPEED }                              from '../constants.js';
import { SOCIALS, LB_USER }                  from '../data.js';

export function drawPageSocials(ctx, x, y, w, h, elapsed) {
  const PAD = w * 0.055;
  const fs  = Math.min(h / 18, w / 22);
  const lh  = fs * 1.5;
  const cx  = x + PAD;
  const cw  = w - PAD * 2;
  let   cy  = y + PAD * 0.8;
  let   t   = 0;
  const Q   = 8 / SPEED;

  ctx.font         = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';

  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, cw * 0.28, lh, 'back', elapsed, 0);

  const titleFS = fs * 2.1;
  ctx.font = `${titleFS}px VT323`;
  cy += lh * 1.55;
  pgGlow(ctx, 30); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('LINKS & HANDLES', elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);
  t = 0.06 + 15 / SPEED;

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.15;
  pgGlow(ctx, 8); ctx.fillStyle = AMBER_DIM;
  ctx.fillText(typeReveal('where to find me on the internet', elapsed, t), cx, cy);
  pgGlowOff(ctx);
  t += 32 / SPEED + Q * 3;

  cy += lh * 1.6;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.4)`;
  ctx.fillText(typeReveal('─'.repeat(40), elapsed, t), cx, cy);
  t += 40 / SPEED; cy += lh * 1.4;

  const listStartY = cy;
  const listH      = (y + h) - listStartY - PAD;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listStartY, w, listH);
  ctx.clip();

  cy -= state.lbScrollY;

  const keyW = cw * 0.36;
  const btnW = cw * 0.30;
  const btnX = cx + cw - btnW;

  SOCIALS.forEach((s) => {
    const rowY     = cy;
    pgGlow(ctx, 18); ctx.fillStyle = AMBER;
    ctx.font = `${fs * 1.1}px VT323`;
    ctx.fillText(typeReveal(s.label, elapsed, t), cx, rowY);
    t += s.label.length / SPEED + Q;

    pgGlow(ctx, 8); ctx.fillStyle = AMBER_DIM; ctx.font = `${fs}px VT323`;
    ctx.fillText(typeReveal(s.handle, elapsed, t), cx + keyW, rowY);
    t += s.handle.length / SPEED + Q;

    const btnLabel = s.url ? '[ CONNECT ]' : '[ DEAD LINK ]';
    if (elapsed > t) {
      const alpha = Math.min((elapsed - t) * SPEED / btnLabel.length, 1);
      const hs    = state.subHoverState[s.id] || 0;
      ctx.globalAlpha = alpha;
      if (hs > 0) {
        pgGlowOff(ctx);
        ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs})`;
        ctx.fillRect(btnX - 4, rowY - lh * 0.1, btnW + 8, lh * 0.88);
      }
      const rr = Math.round(THEME.r - (THEME.r - 13) * hs);
      const gg = Math.round(THEME.g - (THEME.g - 8)  * hs);
      const bb = Math.round(THEME.b - THEME.b         * hs);
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      pgGlow(ctx, s.url ? 20 : 10); ctx.font = `${fs * 1.05}px VT323`;
      ctx.fillText(btnLabel, btnX, rowY);
      pgGlowOff(ctx); ctx.globalAlpha = 1;
      if (alpha >= 1) regHit(btnX - 4, rowY - lh * 0.1, btnW + 8, lh * 0.88, s.id);
    }
    t += btnLabel.length / SPEED + Q * 5;
    cy += lh * 1.8;
  });
  pgGlowOff(ctx);

  const totalContentH = cy - (listStartY - state.lbScrollY);
  state.lbScrollMax   = Math.max(0, totalContentH - listH);
  ctx.restore();

  if (state.lbScrollMax > 0 && elapsed > t * 0.5) {
    const barX   = x + w - PAD * 0.5;
    const thumbH = Math.max(20, (listH / totalContentH) * listH);
    const thumbY = listStartY + (state.lbScrollY / state.lbScrollMax) * (listH - thumbH);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.15)`;
    ctx.fillRect(barX, listStartY, 4, listH);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
    ctx.fillRect(barX, thumbY, 4, thumbH);
  }
}

export function drawPageTwitterError(ctx, x, y, w, h, elapsed) {
  const PAD = w * 0.055;
  const fs  = Math.min(h / 18, w / 22);
  const lh  = fs * 1.52;
  const cx  = x + PAD;
  let   cy  = y + PAD * 0.8;
  let   t   = 0;
  const Q   = 5 / SPEED;

  ctx.font         = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';

  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  const titleFS = fs * 1.9;
  ctx.font = `${titleFS}px VT323`;
  cy += lh * 1.7;
  ctx.shadowColor = 'rgba(255,80,80,0.85)'; ctx.shadowBlur = 30;
  ctx.fillStyle   = '#ff6b6b';
  ctx.fillText(typeReveal('ERROR ─ SIGNAL_NOT_FOUND', elapsed, 0.04), cx, cy);
  pgGlowOff(ctx);
  t = 0.04 + 22 / SPEED;
  ctx.font = `${fs}px VT323`; cy += titleFS * 1.3;

  const listStartY = cy;
  const listH      = (y + h) - listStartY - PAD;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listStartY, w, listH);
  ctx.clip();

  cy -= state.lbScrollY;

  const lines = [
    `ERR_404: @${LB_USER} — HANDLE NOT LOCATED`, '',
    'This user has not established a presence',
    'on the bird site. Or its successor.',
    "Or whatever it's called this week.", '',
    '"Sometimes the best option is to not tweet."',
    '  — probably someone very wise', '',
    '>> ATTEMPTING RECONNECT . . .',
    '>> ROUTE 1: twitter.com . . . . . . FAILED',
    '>> ROUTE 2: x.com . . . . . . . . . FAILED',
    '>> ROUTE 3: . . . . . . . . . TIMED OUT', '',
    '[ SIGNAL LOST  —  NO CARRIER ]',
  ];

  lines.forEach((line, li) => {
    if (!line) { t += Q * 3; return; }
    const shown  = typeReveal(line, elapsed, t);
    const isErr  = line.startsWith('ERR') || line.startsWith('>>') || line.startsWith('[');
    const isQuote = line.startsWith('"') || line.startsWith('  —');
    if (isErr)        { ctx.shadowColor = 'rgba(255,80,80,0.75)'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff8888'; }
    else if (isQuote) { pgGlow(ctx, 8);  ctx.fillStyle = AMBER_DIM; }
    else              { pgGlow(ctx, 10); ctx.fillStyle = AMBER; }
    ctx.fillText(shown, cx, cy + li * lh); pgGlowOff(ctx);
    t += line.length / SPEED + Q;
  });

  const totalContentH = (cy + lines.length * lh) - (listStartY - state.lbScrollY);
  state.lbScrollMax   = Math.max(0, totalContentH - listH);
  ctx.restore();

  if (state.lbScrollMax > 0 && elapsed > t * 0.5) {
    const barX   = x + w - PAD * 0.5;
    const thumbH = Math.max(20, (listH / totalContentH) * listH);
    const thumbY = listStartY + (state.lbScrollY / state.lbScrollMax) * (listH - thumbH);
    ctx.fillStyle = 'rgba(255,100,100,0.15)';
    ctx.fillRect(barX, listStartY, 4, listH);
    ctx.fillStyle = 'rgba(255,100,100,0.6)';
    ctx.fillRect(barX, thumbY, 4, thumbH);
  }
}
