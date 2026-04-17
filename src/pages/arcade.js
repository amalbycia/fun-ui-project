// ─── PAGE: ARCADE HUB ────────────────────────────────────────────────────────

import { state }                              from '../state.js';
import { THEME, AMBER, AMBER_DIM, AMBER_GLOW } from '../theme.js';
import { typeReveal, pgGlow, pgGlowOff, regHit, drawSubLink } from '../utils.js';
import { ARCADE_GAMES }                       from '../data.js';

// Poster image cache — module-level (only used here)
const arcadeImgs = {};

function loadArcadeImg(id, src) {
  if (arcadeImgs[id]) return;
  arcadeImgs[id] = 'loading';
  const img = new Image();
  img.onload  = () => { arcadeImgs[id] = img; };
  img.onerror = () => { arcadeImgs[id] = 'error'; };
  img.src = src;
}

export function drawPageArcade(ctx, x, y, w, h, elapsed) {
  const PAD = w * 0.05;
  const fs  = Math.min(h / 22, w / 26);
  const lh  = fs * 1.45;
  const cx  = x + PAD;
  const cw  = w - PAD * 2;

  ARCADE_GAMES.forEach(g => loadArcadeImg(g.id, g.poster));

  ctx.font         = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';

  let hy = y + PAD * 0.6;
  drawSubLink(ctx, '[ESC] ← BACK', cx, hy, w * 0.28, lh, 'back', elapsed, 0);

  const titleFS = fs * 2.0;
  ctx.font = `${titleFS}px VT323`;
  hy += lh * 1.5;
  pgGlow(ctx, 34); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('ARCADE', elapsed, 0.04), cx, hy);
  pgGlowOff(ctx);

  ctx.font = `${fs}px VT323`;
  hy += titleFS * 1.05;
  pgGlow(ctx, 6); ctx.fillStyle = AMBER_DIM;
  ctx.fillText(typeReveal('SELECT A GAME', elapsed, 0.18), cx, hy);
  pgGlowOff(ctx);
  hy += lh * 0.55;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.25)`;
  ctx.fillRect(cx, hy + lh * 0.7, cw, 1);
  hy += lh * 1.25;

  const headerH  = hy - y;
  const posterW  = cw * 0.28;
  const posterH  = posterW * 1.40;
  const cardH    = posterH;
  const cardGap  = lh * 1.6;

  state.lbScrollMax = Math.max(0, ARCADE_GAMES.length * (cardH + cardGap) - (h - headerH - PAD));

  const listTop = hy;
  const listH   = h - headerH - PAD * 0.5;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listTop, w, listH);
  ctx.clip();

  let cy = listTop - state.lbScrollY;

  ARCADE_GAMES.forEach((game, gi) => {
    if (cy + cardH < listTop || cy > listTop + listH) { cy += cardH + cardGap; return; }

    const hs  = state.subHoverState[game.id] || 0;
    const img = arcadeImgs[game.id];

    if (hs > 0) {
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs * 0.04})`;
      ctx.fillRect(cx - 4, cy - 4, cw + 8, cardH + 8);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, posterW, posterH);
    ctx.clip();

    if (img && img !== 'loading' && img !== 'error') {
      const ir = img.width / img.height;
      const br = posterW / posterH;
      let sx, sy, sw, sh;
      if (ir > br) { sh = img.height; sw = sh * br; sx = (img.width - sw) / 2; sy = 0; }
      else          { sw = img.width;  sh = sw / br; sy = (img.height - sh) / 2; sx = 0; }
      ctx.drawImage(img, sx, sy, sw, sh, cx, cy, posterW, posterH);
      try {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(${THEME.r},${Math.floor(THEME.g * 0.85)},${Math.floor(THEME.b * 0.4)},0.55)`;
        ctx.fillRect(cx, cy, posterW, posterH);
      } finally { ctx.globalCompositeOperation = 'source-over'; }
      const vig = ctx.createLinearGradient(cx, cy, cx, cy + posterH);
      vig.addColorStop(0, 'rgba(0,0,0,0.3)'); vig.addColorStop(0.3, 'rgba(0,0,0,0)');
      vig.addColorStop(0.7, 'rgba(0,0,0,0)'); vig.addColorStop(1,   'rgba(0,0,0,0.55)');
      ctx.fillStyle = vig; ctx.fillRect(cx, cy, posterW, posterH);
    } else {
      ctx.fillStyle = '#0a0800'; ctx.fillRect(cx, cy, posterW, posterH);
      ctx.font = `${fs * 0.8}px VT323`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillStyle = AMBER_DIM;
      ctx.fillText(img === 'error' ? 'NO IMAGE' : 'LOADING...', cx + posterW / 2, cy + posterH / 2);
      ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    }
    ctx.restore();

    ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.3 + hs * 0.45})`;
    ctx.lineWidth   = 1;
    ctx.strokeRect(cx, cy, posterW, posterH);

    const dx = cx + posterW + PAD * 0.85;
    const dw = cw - posterW - PAD * 0.85;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, cy, dw, cardH);
    ctx.clip();

    let dy     = cy;
    const nameFS = fs * 1.75;
    ctx.font     = `${nameFS}px VT323`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    pgGlow(ctx, 18 + hs * 8); ctx.fillStyle = AMBER;
    ctx.fillText(typeReveal(game.name, elapsed, 0.06 + gi * 0.08), dx, dy);
    pgGlowOff(ctx); dy += nameFS * 1.05;

    ctx.font = `${fs * 0.78}px VT323`; ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.4)`;
    ctx.fillText(`${game.genre}  ·  ${game.year}`, dx, dy); dy += lh * 0.75;

    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
    ctx.fillText(game.engine, dx, dy); dy += lh * 0.8;

    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.18)`;
    ctx.fillRect(dx, dy, dw * 0.9, 1); dy += lh * 0.7;

    ctx.font = `${fs * 0.85}px VT323`; ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.55)`;
    game.blurb.split('\n').forEach(line => { ctx.fillText(line, dx, dy); dy += lh * 0.88; });
    dy += lh * 0.45;

    ctx.font = `${fs * 0.72}px VT323`; ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.38)`;
    ctx.fillText(game.controls, dx, dy);

    const btnY = cy + cardH - lh * 1.55;
    const btnW = fs * 8;
    const btnH = lh * 1.1;
    ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.3 + hs * 0.55})`;
    ctx.lineWidth   = 1;
    ctx.strokeRect(dx, btnY, btnW, btnH);
    if (hs > 0) {
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs * 0.14})`;
      ctx.fillRect(dx, btnY, btnW, btnH);
    }
    ctx.font = `${fs * 0.82}px VT323`; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.6 + hs * 0.35})`;
    pgGlow(ctx, hs > 0.05 ? 10 : 0);
    ctx.fillText('[ LAUNCH ]', dx + fs * 0.5, btnY + btnH / 2);
    pgGlowOff(ctx);
    ctx.restore();

    if (elapsed > 0.3) regHit(cx - 4, cy - 4, cw + 8, cardH + 8, game.id);
    cy += cardH + cardGap;
    if (gi < ARCADE_GAMES.length - 1) {
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.1)`;
      ctx.fillRect(cx, cy - cardGap * 0.6, cw, 1);
    }
  });

  ctx.restore();
}
