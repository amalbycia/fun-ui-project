// ─── PAGE: LIBRARY ───────────────────────────────────────────────────────────
// Folder grid → click a folder → scrollable site list inside.

import { state }                          from '../state.js';
import { THEME, AMBER, AMBER_DIM, AMBER_GLOW } from '../theme.js';
import { typeReveal, pgGlow, pgGlowOff, regHit, drawSubLink } from '../utils.js';
import { LIBRARY_FOLDERS, LIBRARY_DATA }  from '../data.js';

// ── Folder icon ───────────────────────────────────────────────────────────────
function drawFolder(ctx, fx, fy, fw, fh, label, id, elapsed, startAt) {
  if (elapsed - startAt <= 0) return;

  const hs       = state.subHoverState[id] || 0;
  const tabW     = fw * 0.38;
  const tabH     = fh * 0.14;
  const bodyY    = fy + tabH;
  const bodyH    = fh - tabH;
  const radius   = fw * 0.045;
  const baseAlpha = 0.13 + hs * 0.10;
  const rimAlpha  = 0.55 + hs * 0.35;
  const glowBlur  = 10  + hs * 22;

  ctx.save();

  // Tab
  ctx.beginPath();
  ctx.moveTo(fx + radius, fy);
  ctx.lineTo(fx + tabW - radius, fy);
  ctx.quadraticCurveTo(fx + tabW, fy, fx + tabW, fy + radius);
  ctx.lineTo(fx + tabW, bodyY);
  ctx.lineTo(fx, bodyY);
  ctx.lineTo(fx, fy + radius);
  ctx.quadraticCurveTo(fx, fy, fx + radius, fy);
  ctx.closePath();
  ctx.fillStyle   = `rgba(${THEME.r},${THEME.g},${THEME.b},${baseAlpha + 0.04})`;
  ctx.fill();
  ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},${rimAlpha})`;
  ctx.shadowBlur  = glowBlur;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${rimAlpha})`;
  ctx.lineWidth   = 1.2;
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(fx + radius, bodyY);
  ctx.lineTo(fx + fw - radius, bodyY);
  ctx.quadraticCurveTo(fx + fw, bodyY, fx + fw, bodyY + radius);
  ctx.lineTo(fx + fw, fy + fh - radius);
  ctx.quadraticCurveTo(fx + fw, fy + fh, fx + fw - radius, fy + fh);
  ctx.lineTo(fx + radius, fy + fh);
  ctx.quadraticCurveTo(fx, fy + fh, fx, fy + fh - radius);
  ctx.lineTo(fx, bodyY);
  ctx.closePath();
  ctx.fillStyle   = `rgba(${THEME.r},${THEME.g},${THEME.b},${baseAlpha})`;
  ctx.fill();
  ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},${rimAlpha})`;
  ctx.shadowBlur  = glowBlur;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${rimAlpha})`;
  ctx.lineWidth   = 1.2;
  ctx.stroke();

  // Inner crease
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.10 + hs * 0.08})`;
  ctx.lineWidth   = 1;
  const inset     = fw * 0.055;
  ctx.beginPath();
  ctx.moveTo(fx + inset, bodyY + bodyH * 0.38);
  ctx.lineTo(fx + fw - inset, bodyY + bodyH * 0.38);
  ctx.stroke();

  // Label below folder
  const lfs = fw * 0.195;
  ctx.font         = `${lfs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'center';
  ctx.shadowColor  = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.8 + hs * 0.2})`;
  ctx.shadowBlur   = 8 + hs * 10;
  ctx.fillStyle    = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.8 + hs * 0.2})`;
  ctx.fillText(label, fx + fw * 0.5, fy + fh + lfs * 0.35);

  ctx.restore();

  regHit(fx - 4, fy - 4, fw + 8, fh + lfs * 2.2, id);
}

// ── Folder contents (site list) ───────────────────────────────────────────────
function drawFolderContents(ctx, x, y, w, h, elapsed) {
  const folder = LIBRARY_DATA[state.libOpenFolder];
  if (!folder) return;

  const PAD = w * 0.055;
  const fs  = Math.min(h / 20, w / 24);
  const lh  = fs * 1.45;
  const cx  = x + PAD;
  let   cy  = y + PAD * 0.8;

  ctx.font         = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';

  // Back to folder grid
  drawSubLink(ctx, '[←] BACK TO LIBRARY', cx, cy, w * 0.42, lh, 'lib-folder-back', elapsed, 0);

  // Title
  cy += lh * 1.55;
  const titleFS = fs * 1.8;
  ctx.font = `${titleFS}px VT323`;
  pgGlow(ctx, 28); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal(folder.title, elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.1;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.3)`;
  ctx.fillText(typeReveal('─'.repeat(38), elapsed, 0.14), cx, cy);
  cy += lh * 1.6;

  // Scrollable site list
  const listStartY = cy;
  const listH      = (y + h) - listStartY - PAD * 0.5;
  const rowH       = lh * 2.0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listStartY, w, listH);
  ctx.clip();

  const scrolledY = cy - state.lbScrollY;
  let t = 0.18;
  const Q = 8 / 200;

  folder.sites.forEach((site, i) => {
    const ry    = scrolledY + i * rowH;
    const rowId = `lib-site-${state.libOpenFolder}-${i}`;
    const hs    = state.subHoverState[rowId] || 0;

    // Row hover bg
    if (hs > 0) {
      pgGlowOff(ctx);
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs * 0.12})`;
      ctx.fillRect(cx - 4, ry - lh * 0.1, w - PAD * 2 + 8, rowH * 0.88);
    }

    // Row prefix glyph
    ctx.font = `${fs * 0.85}px VT323`;
    pgGlow(ctx, hs > 0 ? 0 : 6);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.38 + hs * 0.3})`;
    ctx.fillText(typeReveal('▸', elapsed, t), cx, ry);
    t += 1 / 200 + Q;

    // Site name — glowing, clickable
    const nameX = cx + fs * 1.4;
    const shown = typeReveal(site.name, elapsed, t);
    if (shown) {
      const rr = Math.round(THEME.r - (THEME.r - 13) * hs);
      const gg = Math.round(THEME.g - (THEME.g - 8)  * hs);
      const bb = Math.round(THEME.b - THEME.b         * hs);
      ctx.font      = `${fs * 1.05}px VT323`;
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      pgGlow(ctx, Math.round(18 * (1 - hs)));
      ctx.fillText(shown, nameX, ry);
      pgGlowOff(ctx);
      if (shown.length >= site.name.length) {
        const hitW = ctx.measureText(site.name).width + fs * 2;
        regHit(cx - 4, ry - lh * 0.1, hitW + 8, rowH * 0.88, rowId, site.url);
      }
    }
    t += site.name.length / 200 + Q * 3;
  });

  pgGlowOff(ctx);

  // Compute max scroll
  const totalH = folder.sites.length * rowH;
  state.lbScrollMax = Math.max(0, totalH - listH);
  ctx.restore();

  // Scrollbar
  if (state.lbScrollMax > 0) {
    const barX   = x + w - PAD * 0.5;
    const thumbH = Math.max(20, (listH / totalH) * listH);
    const thumbY = listStartY + (state.lbScrollY / state.lbScrollMax) * (listH - thumbH);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.15)`;
    ctx.fillRect(barX, listStartY, 4, listH);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
    ctx.fillRect(barX, thumbY, 4, thumbH);
  }
}

// ── Main library page ─────────────────────────────────────────────────────────
export function drawPageLibrary(ctx, x, y, w, h, elapsed) {
  // If a folder is open, show its contents instead of the grid
  if (state.libOpenFolder) {
    drawFolderContents(ctx, x, y, w, h, elapsed);
    return;
  }

  const PAD = w * 0.055;
  const fs  = Math.min(h / 20, w / 24);
  const lh  = fs * 1.45;
  const cx  = x + PAD;
  let   cy  = y + PAD * 0.8;

  ctx.font         = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';

  // Back
  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  // Title
  cy += lh * 1.55;
  const titleFS = fs * 1.8;
  ctx.font = `${titleFS}px VT323`;
  pgGlow(ctx, 28); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('LIBRARY', elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.1;
  pgGlow(ctx, 7); ctx.fillStyle = AMBER_DIM;
  ctx.fillText(typeReveal('SELECT A FOLDER TO EXPLORE', elapsed, 0.15), cx, cy);
  pgGlowOff(ctx);

  cy += lh * 1.3;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.3)`;
  ctx.fillText(typeReveal('─'.repeat(38), elapsed, 0.18), cx, cy);
  cy += lh * 1.6;

  // Folder grid
  const availW  = w - PAD * 2;
  const fCols   = Math.min(LIBRARY_FOLDERS.length, 5);
  const fGap    = availW * 0.04;
  const fW      = (availW - fGap * (fCols - 1)) / fCols;
  const fH      = fW * 0.72;
  const revStep = 0.20;

  LIBRARY_FOLDERS.forEach((f, i) => {
    const col = i % fCols;
    const row = Math.floor(i / fCols);
    const fx  = cx + col * (fW + fGap);
    const fy  = cy + row * (fH * 1.58);
    drawFolder(ctx, fx, fy, fW, fH, f.label, f.id, elapsed, 0.22 + i * revStep);
  });
}
