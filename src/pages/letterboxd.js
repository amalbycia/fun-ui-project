// ─── PAGE: LETTERBOXD ────────────────────────────────────────────────────────

import { state }                           from '../state.js';
import { THEME, AMBER, AMBER_DIM, AMBER_GLOW } from '../theme.js';
import { typeReveal, pgGlow, pgGlowOff, regHit, drawSubLink } from '../utils.js';
import { SPEED }                           from '../constants.js';
import { LB_USER, LB_FILMS }              from '../data.js';

// Poster image cache — module-level (only used here)
const lbPosterCache = {};

export function loadLbPosters() {
  LB_FILMS.forEach((film, i) => {
    if (lbPosterCache[i]) return;
    lbPosterCache[i] = 'loading';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { lbPosterCache[i] = img; };
    img.onerror = () => { lbPosterCache[i] = 'error'; };
    img.src = film.poster;
  });
}

export function drawPageLetterboxd(ctx, x, y, w, h, elapsed) {
  const PAD = w * 0.055;
  const fs  = Math.min(h / 20, w / 24);
  const lh  = fs * 1.45;
  const cx  = x + PAD;
  let   cy  = y + PAD * 0.8;
  let   t   = 0;
  const Q   = 10 / SPEED;

  ctx.font         = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';

  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  const titleFS = fs * 2.1;
  ctx.font = `${titleFS}px VT323`;
  cy += lh * 1.55;
  pgGlow(ctx, 32); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('LETTERBOXD', elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);
  t = 0.06 + 10 / SPEED;

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.1;
  const subStr = `USER: @${LB_USER}  —  FILM DIARY`;
  pgGlow(ctx, 8); ctx.fillStyle = AMBER_DIM;
  ctx.fillText(typeReveal(subStr, elapsed, t), cx, cy);
  pgGlowOff(ctx);
  t += subStr.length / SPEED + Q;

  cy += lh * 1.35;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.4)`;
  ctx.fillText(typeReveal('─'.repeat(42), elapsed, t), cx, cy);
  t += 42 / SPEED; cy += lh * 1.1;

  // Scrollable area
  const listStartY = cy;
  const listH      = (y + h) - listStartY - PAD;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listStartY, w, listH);
  ctx.clip();

  cy -= state.lbScrollY;

  const pW = fs * 3.4;
  const pH = fs * 4.8;
  const textCol = cx + pW + fs * 1.0;

  LB_FILMS.forEach((film, fi) => {
    const filmStart = t;
    const filmY     = cy + fi * (pH + lh * 0.55);
    const rowId     = 'lb_film_' + fi;
    const hs        = state.subHoverState[rowId] || 0;

    if (hs > 0) {
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs * 0.15})`;
      ctx.fillRect(cx - 8, filmY - 8, w - PAD * 2 + 16, pH + 16);
    }
    if (elapsed > filmStart) regHit(cx - 8, filmY - 8, w - PAD * 2 + 16, pH + 16, rowId);

    if (elapsed > filmStart + 0.04) {
      const a = Math.min((elapsed - filmStart - 0.04) * 5, 1);
      ctx.globalAlpha = a;

      const poster = lbPosterCache[fi];
      if (poster && poster !== 'loading' && poster !== 'error') {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(poster, cx, filmY, pW, pH);
        ctx.imageSmoothingEnabled = false;
        try {
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = `rgba(${THEME.r},${Math.floor(THEME.g * 0.81)},${Math.floor(THEME.b * 0.55)},0.22)`;
          ctx.fillRect(cx, filmY, pW, pH);
        } finally { ctx.globalCompositeOperation = 'source-over'; }
      } else {
        ctx.fillStyle = film.color;
        ctx.fillRect(cx, filmY, pW, pH);
      }

      const pvg = ctx.createLinearGradient(cx, filmY + pH * 0.55, cx, filmY + pH);
      pvg.addColorStop(0, 'rgba(0,0,0,0)'); pvg.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = pvg; ctx.fillRect(cx, filmY, pW, pH);

      ctx.fillStyle = AMBER; pgGlow(ctx, 12); ctx.font = `${fs * 0.72}px VT323`;
      ctx.fillText(film.rating, cx + 4, filmY + pH - fs);
      pgGlowOff(ctx);
      ctx.globalAlpha = 1; ctx.font = `${fs}px VT323`;
    }

    const titleShown = typeReveal(film.title, elapsed, filmStart);
    ctx.fillStyle = hs > 0 ? '#fff' : AMBER; pgGlow(ctx, hs > 0 ? 24 : 18);
    ctx.font = `${fs * 1.08}px VT323`;
    ctx.fillText(titleShown, textCol, filmY);
    t += film.title.length / SPEED + Q;

    const dirStr   = `${film.dir}  ·  ${film.year}`;
    ctx.fillStyle  = AMBER_DIM; ctx.font = `${fs}px VT323`; pgGlow(ctx, 6);
    ctx.fillText(typeReveal(dirStr, elapsed, t), textCol, filmY + lh * 1.1);
    t += dirStr.length / SPEED + Q * 2.5; pgGlowOff(ctx);
  });

  // Footer
  cy = cy + LB_FILMS.length * (pH + lh * 0.55) + lh * 0.9;
  const desc = [
    'Letterboxd is a global social network for film lovers.',
    `Track films you've seen. Save films you want to see.`,
    `→  letterboxd.com/psfo`,
  ];
  ctx.font = `${fs}px VT323`;
  desc.forEach((line, li) => {
    if (li === 2) {
      const linkW = ctx.measureText(line).width + fs;
      drawSubLink(ctx, line, cx, cy + li * lh, linkW, lh, 'lb_link', elapsed, t);
      t += line.length / SPEED + Q; return;
    }
    pgGlow(ctx, 8); ctx.fillStyle = AMBER_DIM;
    ctx.fillText(typeReveal(line, elapsed, t), cx, cy + li * lh);
    t += line.length / SPEED + Q;
  });
  pgGlowOff(ctx);

  const totalContentH = (cy + desc.length * lh) - (listStartY - state.lbScrollY);
  state.lbScrollMax = Math.max(0, totalContentH - listH);
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
