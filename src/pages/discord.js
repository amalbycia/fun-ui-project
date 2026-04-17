// ─── PAGE: DISCORD ───────────────────────────────────────────────────────────

import { state }                              from '../state.js';
import { THEME, AMBER, AMBER_DIM, AMBER_GLOW } from '../theme.js';
import { typeReveal, pgGlow, pgGlowOff, regHit, drawSubLink } from '../utils.js';

export function drawPageDiscord(ctx, x, y, w, h, elapsed) {
  const PAD      = w * 0.055;
  const fs       = Math.min(h / 24, w / 28);
  const lh       = fs * 1.45;
  const cx       = x + PAD;
  const contentW = w - PAD * 2;
  let   cy       = y + PAD * 0.7;

  ctx.font         = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';

  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  cy += lh * 1.4;
  const titleFS = fs * 1.7;
  ctx.font = `${titleFS}px VT323`;
  pgGlow(ctx, 26); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('DISCORD', elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 0.95;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
  ctx.fillText(typeReveal('─'.repeat(42), elapsed, 0.10), cx, cy);
  cy += lh * 1.5;

  if (elapsed < 0.22) return;

  const available = (y + h) - cy - lh * 2.8;
  const cardW     = Math.min(contentW * 0.68, 460);
  const cardX     = cx;
  const cardY     = cy;
  const bannerH   = Math.min(fs * 2.0, available * 0.20);
  const bodyH     = Math.min(available * 0.70, available - bannerH);
  const avSize    = Math.min(bodyH * 0.80, cardW * 0.28);

  // Banner
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.04)`;
  ctx.fillRect(cardX, cardY, cardW, bannerH);
  for (let sy = cardY + 2; sy < cardY + bannerH; sy += 4) {
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.07)`;
    ctx.fillRect(cardX, sy, cardW, 1.5);
  }
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.4)`;
  ctx.lineWidth   = 1;
  ctx.strokeRect(cardX, cardY, cardW, bannerH);

  ctx.font      = `${fs * 0.7}px VT323`;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
  ctx.textAlign = 'right';
  ctx.fillText('@zetiva', cardX + cardW - fs * 0.8, cardY + bannerH * 0.25);
  ctx.textAlign = 'left';

  // Card body
  const bodyY = cardY + bannerH;
  ctx.fillStyle   = `rgba(${THEME.r},${THEME.g},${THEME.b},0.035)`;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
  ctx.lineWidth   = 1;
  ctx.fillRect(cardX, bodyY, cardW, bodyH);
  ctx.beginPath();
  ctx.moveTo(cardX, bodyY); ctx.lineTo(cardX, bodyY + bodyH);
  ctx.lineTo(cardX + cardW, bodyY + bodyH); ctx.lineTo(cardX + cardW, bodyY);
  ctx.stroke();

  // Avatar
  const avPad = fs * 0.9;
  const avX   = cardX + avPad;
  const avY   = bodyY + (bodyH - avSize) * 0.5;

  ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},0.45)`; ctx.shadowBlur = 14;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.65)`; ctx.lineWidth  = 1.5;
  ctx.strokeRect(avX, avY, avSize, avSize);
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = `rgba(${THEME.r},${THEME.g},${THEME.b},0.08)`;
  ctx.fillRect(avX + 1, avY + 1, avSize - 2, avSize - 2);

  ctx.font         = `${avSize * 0.52}px VT323`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  pgGlow(ctx, 22); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.65)`;
  ctx.fillText('#', avX + avSize / 2, avY + avSize / 2);
  pgGlowOff(ctx);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';

  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.15)`;
  ctx.fillRect(avX + avSize + avPad * 0.6, bodyY + bodyH * 0.12, 1, bodyH * 0.76);

  // Info column
  const infoX       = avX + avSize + avPad * 1.4;
  const infoW       = cardX + cardW - infoX - avPad * 0.5;
  const infoBlockH  = fs * 1.5 + lh * 1.0 + lh * 0.8 + lh * 1.4;
  let   iy          = bodyY + (bodyH - infoBlockH) / 2;

  ctx.font = `${fs * 1.45}px VT323`;
  pgGlow(ctx, 22); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('@zetiva', elapsed, 0.28), infoX, iy);
  pgGlowOff(ctx);
  iy += fs * 1.65;

  ctx.font      = `${fs * 0.9}px VT323`;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.45)`;
  ctx.fillText(typeReveal('DISCORD USER', elapsed, 0.34), infoX, iy);
  iy += lh * 1.1;

  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.20)`;
  ctx.fillRect(infoX, iy, Math.min(infoW, fs * 14), 1);
  iy += lh * 0.8;

  drawSubLink(ctx, '↗  come say hi', infoX, iy, infoW, lh * 1.4, 'discord-link', elapsed, 0.40);
  regHit(infoX - 4, iy - 4, infoW + 8, lh * 1.4 + 8, 'discord-link');

  cy = bodyY + bodyH + lh * 1.2;
  ctx.font      = `${fs}px VT323`;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.30)`;
  ctx.fillText(typeReveal("i'm usually around — send a message.", elapsed, 0.50), cx, cy);
}
