// ─── 2D Terminal Renderer ────────────────────────────────────────────────────
// Paints the entire terminal UI onto an offscreen 2D canvas each frame.
// Called by the WebGL render loop in interaction.js.

import { state }                              from './state.js';
import { THEME, AMBER, AMBER_DIM, AMBER_GLOW } from './theme.js';
import { THEMES, BG, BEZEL, MENU, CLICKABLE, BOOT_DUR } from './constants.js';
import { roundRect, glowText, typeReveal, drawSubLink, pgGlow, pgGlowOff } from './utils.js';

// ── Social icon SVG cache (recoloured per theme) ──────────────────────────────
const _svgCache = {};
const _svgDefs = {
  instagram: `<svg fill="COLOR" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><g><path d="M22.3,8.4c-0.8,0-1.4,0.6-1.4,1.4c0,0.8,0.6,1.4,1.4,1.4c0.8,0,1.4-0.6,1.4-1.4C23.7,9,23.1,8.4,22.3,8.4z"/><path d="M16,10.2c-3.3,0-5.9,2.7-5.9,5.9s2.7,5.9,5.9,5.9s5.9-2.7,5.9-5.9S19.3,10.2,16,10.2z M16,19.9c-2.1,0-3.8-1.7-3.8-3.8c0-2.1,1.7-3.8,3.8-3.8c2.1,0,3.8,1.7,3.8,3.8C19.8,18.2,18.1,19.9,16,19.9z"/><path d="M20.8,4h-9.5C7.2,4,4,7.2,4,11.2v9.5c0,4,3.2,7.2,7.2,7.2h9.5c4,0,7.2-3.2,7.2-7.2v-9.5C28,7.2,24.8,4,20.8,4z M25.7,20.8c0,2.7-2.2,5-5,5h-9.5c-2.7,0-5-2.2-5-5v-9.5c0-2.7,2.2-5,5-5h9.5c2.7,0,5,2.2,5,5V20.8z"/></g></svg>`,
  discord:   `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.8944 4.34399C17.5184 3.71467 16.057 3.256 14.5317 3C14.3397 3.33067 14.1263 3.77866 13.977 4.13067C12.3546 3.89599 10.7439 3.89599 9.14394 4.13067C8.9946 3.77866 8.77059 3.33067 8.58925 3C7.05328 3.256 5.59194 3.71467 4.22555 4.34399C1.46289 8.41865 0.716219 12.3973 1.08955 16.3226C2.92421 17.6559 4.6949 18.4666 6.43463 19C6.86129 18.424 7.2453 17.8053 7.57597 17.1546C6.94663 16.92 6.3493 16.632 5.7733 16.2906C5.92263 16.184 6.07197 16.0667 6.21064 15.9493C9.68796 17.5387 13.4544 17.5387 16.889 15.9493C17.0383 16.0667 17.177 16.184 17.3263 16.2906C16.7503 16.632 16.153 16.92 15.5237 17.1546C15.8543 17.8053 16.2384 18.424 16.665 19C18.4037 18.4666 20.185 17.6559 22.0101 16.3226C22.4687 11.7787 21.2837 7.83202 18.8944 4.34399ZM8.05596 13.9013C7.01061 13.9013 6.15728 12.952 6.15728 11.7893C6.15728 10.6267 6.98928 9.67731 8.05596 9.67731C9.11194 9.67731 9.97591 10.6267 9.95457 11.7893C9.95457 12.952 9.11194 13.9013 8.05596 13.9013ZM15.065 13.9013C14.0197 13.9013 13.1653 12.952 13.1653 11.7893C13.1653 10.6267 13.9983 9.67731 15.065 9.67731C16.121 9.67731 16.985 10.6267 16.9637 11.7893C16.9637 12.952 16.1317 13.9013 15.065 13.9013Z" fill="COLOR"/></svg>`,
  telegram:  `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM12.3583 9.38244C11.3857 9.787 9.44177 10.6243 6.52657 11.8944C6.05318 12.0827 5.8052 12.2669 5.78263 12.4469C5.74448 12.7513 6.12559 12.8711 6.64455 13.0343C6.71515 13.0565 6.78829 13.0795 6.86327 13.1038C7.37385 13.2698 8.06068 13.464 8.41773 13.4717C8.74161 13.4787 9.1031 13.3452 9.50219 13.0711C12.226 11.2325 13.632 10.3032 13.7202 10.2831C13.7825 10.269 13.8688 10.2512 13.9273 10.3032C13.9858 10.3552 13.98 10.4536 13.9738 10.48C13.9361 10.641 12.4401 12.0318 11.6659 12.7515C11.4246 12.9759 11.2534 13.135 11.2184 13.1714C11.14 13.2528 11.0601 13.3298 10.9833 13.4038C10.509 13.8611 10.1532 14.204 11.003 14.764C11.4114 15.0331 11.7381 15.2556 12.0641 15.4776C12.4201 15.7201 12.7752 15.9619 13.2347 16.2631C13.3517 16.3398 13.4635 16.4195 13.5724 16.4971C13.9867 16.7925 14.3589 17.0579 14.8188 17.0155C15.086 16.991 15.362 16.7397 15.5022 15.9903C15.8335 14.2193 16.4847 10.382 16.6352 8.80081C16.6484 8.66228 16.6318 8.48498 16.6185 8.40715C16.6051 8.32932 16.5773 8.21842 16.4761 8.13633C16.3563 8.03911 16.1714 8.01861 16.0886 8.02C15.7125 8.0267 15.1354 8.22735 12.3583 9.38244Z" fill="COLOR"/></svg>`,
};
function _getSocialImg(id, hex) {
  const key = `${id}:${hex}`;
  if (_svgCache[key]) return _svgCache[key];
  const img  = new Image();
  const blob = new Blob([_svgDefs[id].replace('COLOR', hex)], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  img.onload = () => URL.revokeObjectURL(url);
  img.src = url;
  _svgCache[key] = img;
  return img;
}

import { drawPageLibrary }     from './pages/library.js';
import { drawPageLetterboxd }  from './pages/letterboxd.js';
import { drawPageMusic }       from './pages/music.js';
import { drawPageDiscord }     from './pages/discord.js';
import { drawPageArcade }      from './pages/arcade.js';
import { drawPageDoom }        from './pages/doom.js';
import { drawPageMario }       from './pages/mario.js';

// ── Gradient cache ────────────────────────────────────────────────────────────
function _rebuildGradients(ctx, W, H) {
  const BEZ = W * 0.016;
  const sw  = W - BEZ * 2;
  const sh  = H - BEZ * 2;
  const ambR = Math.max(W, H) * 0.72;
  const a = ctx.createRadialGradient(W / 2, H / 2, sw * 0.2, W / 2, H / 2, ambR);
  a.addColorStop(0.0,  'rgba(0,0,0,0)');
  a.addColorStop(0.62, 'rgba(0,0,0,0)');
  a.addColorStop(0.78, `rgba(${Math.floor(THEME.r * 0.8)},${Math.floor(THEME.g * 0.8)},${Math.floor(THEME.b * 0.8)},0.07)`);
  a.addColorStop(0.90, `rgba(${Math.floor(THEME.r * 0.6)},${Math.floor(THEME.g * 0.6)},${Math.floor(THEME.b * 0.6)},0.13)`);
  a.addColorStop(1.0,  `rgba(${Math.floor(THEME.r * 0.4)},${Math.floor(THEME.g * 0.4)},${Math.floor(THEME.b * 0.4)},0.18)`);
  const v = ctx.createRadialGradient(W / 2, H / 2, sh * 0.2, W / 2, H / 2, sh * 0.8);
  v.addColorStop(0,   'rgba(0,0,0,0)');
  v.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  v.addColorStop(1,   'rgba(0,0,0,0.85)');
  state.gradCache.ambient = a;
  state.gradCache.vig     = v;
  state.gradCache.W       = W;
  state.gradCache.H       = H;
}

// ── Main draw entry ───────────────────────────────────────────────────────────
export function drawTerminal(ctx, W, H) {
  state.globalHitAreas = [];
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const BEZ = W * 0.016;
  ctx.fillStyle = BEZEL;
  ctx.fillRect(0, 0, W, H);

  const sx = BEZ, sy = BEZ, sw = W - BEZ * 2, sh = H - BEZ * 2;
  if (state.gradCache.W !== W || state.gradCache.H !== H) _rebuildGradients(ctx, W, H);
  ctx.fillStyle = state.gradCache.ambient;
  ctx.fillRect(0, 0, W, H);
  const r = Math.min(sw, sh) * 0.035;

  roundRect(ctx, sx, sy, sw, sh, r);
  ctx.fillStyle = BG;
  ctx.fill();
  ctx.save();
  ctx.clip();

  ctx.fillStyle = state.gradCache.vig;
  ctx.fillRect(sx, sy, sw, sh);

  const PAD_X  = sw * 0.05;
  const PAD_Y  = sh * 0.045;
  const inner_x = sx + PAD_X;
  const inner_y = sy + PAD_Y;
  const inner_w = sw - PAD_X * 2;
  const inner_h = sh - PAD_Y * 2;

  const SIDE_W  = inner_w * 0.24;
  const MENU_FS = inner_h / 15;
  const FOOT_H  = sh * 0.10;

  const ascii_x = inner_x + SIDE_W + inner_w * 0.03;
  const ascii_w = inner_w - SIDE_W - inner_w * 0.03;
  const ascii_h = inner_h - FOOT_H - inner_h * 0.02;

  drawSidebar(ctx, inner_x, inner_y, SIDE_W, inner_h - FOOT_H, MENU_FS);
  drawAscii(ctx, ascii_x, inner_y, ascii_w, ascii_h);
  drawFooter(ctx, inner_x, inner_y + inner_h - FOOT_H, inner_w, FOOT_H, MENU_FS);

  ctx.restore();
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function drawSidebar(ctx, x, y, w, h, fs) {
  const boxH = fs * 1.6;
  ctx.fillStyle = AMBER;
  ctx.fillRect(x, y, w * 0.9, boxH);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#0d0800';
  ctx.font = `${fs}px VT323`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText('@kez', x + 8, y + boxH / 2);

  ctx.font = `${fs}px VT323`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';

  const lineH      = fs * 1.38;
  const topPad     = fs * 0.9;
  const PAD        = w * 0.1;
  const listStartY = y + boxH + topPad;
  const listH      = h - (listStartY - y) - (lineH * 2.0);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - PAD, listStartY, w + PAD * 2, listH);
  ctx.clip();

  const newHits = [];
  MENU.forEach(([key, label], i) => {
    const ly = listStartY + i * lineH - state.menuScrollY;
    if (ly + lineH < listStartY || ly > listStartY + listH) return;

    const hs    = state.hoverState[i]  || 0;
    const flash = state.clickFlash[i]  || 0;

    if (hs > 0) {
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      ctx.fillStyle  = `rgba(${THEME.r},${THEME.g},${THEME.b}, ${hs})`;
      ctx.fillRect(x, ly - lineH * 0.12, w, lineH * 0.95);
    }

    let textCol;
    if (flash > 0) {
      const f  = flash;
      const rr = Math.round(THEME.r + (255 - THEME.r) * f);
      const gg = Math.round(THEME.g + (255 - THEME.g) * f);
      const bb = Math.round(THEME.b + (255 - THEME.b) * f);
      textCol  = `rgb(${rr},${gg},${bb})`;
    } else {
      const rr = Math.round(THEME.r - (THEME.r - 13) * hs);
      const gg = Math.round(THEME.g - (THEME.g - 8)  * hs);
      const bb = Math.round(THEME.b - THEME.b         * hs);
      textCol  = `rgb(${rr},${gg},${bb})`;
    }
    ctx.fillStyle = textCol;

    const glowStr = flash > 0 ? 'rgba(255,255,200,1.0)' : AMBER_GLOW;
    const blur1   = flash > 0 ? 30 : Math.round(22 * (1 - hs));
    const blur2   = flash > 0 ? 12 : Math.round(8  * (1 - hs));
    ctx.shadowColor = glowStr; ctx.shadowBlur = blur1;
    ctx.fillText(key,   x + 6,        ly);
    ctx.fillText(label, x + w * 0.38, ly);
    ctx.shadowBlur = blur2;
    ctx.fillText(key,   x + 6,        ly);
    ctx.fillText(label, x + w * 0.38, ly);

    newHits.push({ x, y: ly - lineH * 0.2, w, h: lineH, i });
  });

  state.menuScrollMax = Math.max(0, MENU.length * lineH - listH);
  ctx.restore();

  if (state.menuScrollMax > 0) {
    const PAD_  = w * 0.1;
    const barX  = x + w + PAD_ * 0.5;
    const thumbH = Math.max(10, (listH / (MENU.length * lineH)) * listH);
    const thumbY = listStartY + (state.menuScrollY / state.menuScrollMax) * (listH - thumbH);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
    ctx.fillRect(barX, thumbY, 4, thumbH);
  }

  state.menuHitAreas = newHits;
}

// ── ASCII / video panel ───────────────────────────────────────────────────────
function drawAscii(ctx, x, y, w, h) {
  ctx.save();

  if (state.activePage) {
    const elapsed = (performance.now() - state.pageEnterTime) / 1000;
    drawPage(ctx, x, y, w, h, elapsed);
    ctx.restore();
    return;
  }

  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b}, 0.3)`;
  ctx.lineWidth   = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

  if (state.bgVideo && state.bgVideo.readyState >= 2) {
    const vW = state.bgVideo.videoWidth;
    const vH = state.bgVideo.videoHeight;
    const vAspect = vW / vH;
    const bAspect = w  / h;
    let sx, sy, svw, svh;
    if (vAspect > bAspect) { svh = vH; svw = vH * bAspect; sx = (vW - svw) * 0.5; sy = 0; }
    else                    { svw = vW; svh = vW / bAspect; sx = 0; sy = (vH - svh) * 0.5; }
    ctx.fillStyle   = BG;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(state.bgVideo, sx, sy, svw, svh, x, y, w, h);
    ctx.globalAlpha = 1.0;
    try {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(${THEME.r}, ${THEME.g}, ${THEME.b}, 1.0)`;
      ctx.fillRect(x, y, w, h);
    } finally { ctx.globalCompositeOperation = 'source-over'; }

  } else if (state.asciiImg) {
    if (state.asciiCache.w !== w || state.asciiCache.h !== h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cc = c.getContext('2d');
      cc.fillStyle = BG; cc.fillRect(0, 0, w, h);
      const iW = state.asciiImg.naturalWidth;
      const iH = state.asciiImg.naturalHeight;
      const imgAspect = iW / iH;
      const boxAspect = w  / h;
      let srcX, srcY, srcW, srcH;
      if (imgAspect > boxAspect) { srcH = iH; srcW = iH * boxAspect; srcX = (iW - srcW) * 0.5; srcY = 0; }
      else                        { srcW = iW; srcH = iW / boxAspect; srcX = 0; srcY = (iH - srcH) * 0.5; }
      cc.globalAlpha = 0.92;
      cc.drawImage(state.asciiImg, srcX, srcY, srcW, srcH, 0, 0, w, h);
      cc.globalAlpha = 1.0;
      cc.globalCompositeOperation = 'multiply';
      cc.fillStyle = AMBER; cc.fillRect(0, 0, w, h);
      cc.globalCompositeOperation = 'source-over';
      cc.shadowColor = AMBER_GLOW; cc.shadowBlur = 18; cc.globalAlpha = 0.22;
      cc.drawImage(state.asciiImg, srcX, srcY, srcW, srcH, 0, 0, w, h);
      cc.globalAlpha = 1.0; cc.shadowBlur = 0;
      state.asciiCache.canvas = c; state.asciiCache.w = w; state.asciiCache.h = h;
    }
    ctx.drawImage(state.asciiCache.canvas, x, y);

  } else {
    let start = 0, end = state.asciiLines.length - 1;
    while (start < end && state.asciiLines[start].trim() === '') start++;
    while (end > start && state.asciiLines[end].trim() === '') end--;
    const lines  = state.asciiLines.slice(start, end + 1);
    const rows   = lines.length;
    const cols   = Math.max(...lines.map(l => l.length));
    const fss    = Math.max(2, Math.min(w / (cols * 0.56), h / rows));
    const artW   = cols * fss * 0.56;
    const artH   = rows * fss;
    ctx.translate(x, y); ctx.scale(w / artW, h / artH);
    ctx.font = `${fss}px VT323`; ctx.fillStyle = AMBER;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.shadowColor  = AMBER_GLOW; ctx.shadowBlur = 10;
    lines.forEach((line, i) => ctx.fillText(line, 0, i * fss));
    ctx.shadowBlur = 4;
    lines.forEach((line, i) => ctx.fillText(line, 0, i * fss));
  }

  ctx.restore();
}

// ── Status footer ─────────────────────────────────────────────────────────────
function drawFooter(ctx, x, y, w, h, fs) {
  glowText(ctx, fs);
  ctx.font = `${fs}px VT323`; ctx.fillStyle = AMBER;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';

  const mid = y + h * 0.08;
  const tfs = fs * 0.85;
  ctx.font = `${tfs}px VT323`;

  const thLabel = `[◈] PHOS : ${state.windowTheme.name}`;
  const thW  = ctx.measureText(thLabel).width + 24;
  const thH  = tfs * 1.4;
  const thX  = x;
  const thY  = mid - thH / 2;
  const hsTheme = state.subHoverState['theme-toggle'] || 0;

  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.05 + hsTheme * 0.1})`;
  ctx.fillRect(thX, thY, thW, thH);

  if (hsTheme > 0 || state.themeMenuOpen) {
    ctx.fillStyle = AMBER;
    ctx.fillRect(thX, thY, thW, thH);
  }
  glowText(ctx, hsTheme > 0 || state.themeMenuOpen ? 0 : 10);
  ctx.fillStyle = (hsTheme > 0 || state.themeMenuOpen) ? '#000' : AMBER;
  ctx.fillText(thLabel, thX + 8, mid);
  ctx.shadowBlur = 0;

  state.globalHitAreas.push({ x: thX, y: thY, w: thW, h: thH, id: 'theme-toggle' });

  if (state.themeMenuOpen) {
    const listH = THEMES.length * (thH * 1.1);
    const listY = thY - listH - 8;
    ctx.fillStyle   = '#050400'; ctx.fillRect(thX, listY, thW, listH);
    ctx.strokeStyle = AMBER_DIM; ctx.lineWidth = 1; ctx.strokeRect(thX, listY, thW, listH);
    ctx.textBaseline = 'middle';
    THEMES.forEach((t, i) => {
      const itemH  = thH * 1.1;
      const itemY  = listY + i * itemH;
      const itemId = `theme-select-${i}`;
      const itemHs = state.subHoverState[itemId] || 0;
      const isCurr = (t.name === state.windowTheme.name);
      if (itemHs > 0) {
        ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.15 + itemHs * 0.85})`;
        ctx.fillRect(thX, itemY, thW, itemH);
      }
      ctx.fillStyle = (itemHs > 0 || isCurr) ? '#000' : AMBER;
      if (isCurr && itemHs === 0) {
        ctx.fillStyle = AMBER; ctx.fillRect(thX, itemY, thW, itemH);
        ctx.fillStyle = '#000';
      }
      ctx.fillText(t.name, thX + 12, itemY + itemH / 2);
      state.globalHitAreas.push({ x: thX, y: itemY, w: thW, h: itemH, id: itemId });
    });
  }

  const bfs  = Math.round(fs * 0.82);
  ctx.font = `${bfs}px VT323`; ctx.textBaseline = 'middle';

  const pct    = Math.floor(state.battery.level * 100);
  const stat   = state.battery.charging ? 'AC POWERED' : 'BATTERY PWR';
  const barLabel = `[ SYS POWER: ${pct}% ─ ${stat} ]`;
  const mBarW  = ctx.measureText(barLabel).width;
  const memX   = x + w - mBarW - w * 0.02;
  ctx.fillStyle = AMBER;
  ctx.fillText(barLabel, memX, y + h * 0.12);
  const mBarH = h * 0.22;
  const mY    = y + h * 0.46;
  ctx.strokeStyle = AMBER; ctx.lineWidth = 1;
  ctx.strokeRect(memX, mY, mBarW, mBarH);
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
  ctx.fillRect(memX + 1, mY + 1, Math.max(0, mBarW * state.battery.level - 2), mBarH - 2);

  ctx.font = `${Math.round(bfs * 0.85)}px VT323`;
  ctx.fillStyle = AMBER;
  ctx.fillText('0%', memX, mY + mBarH + h * 0.14);
  ctx.textAlign = 'right';
  ctx.fillText(`${pct}%`, memX + mBarW, mY + mBarH + h * 0.14);
  ctx.textAlign = 'left';
  ctx.font = `${bfs}px VT323`;

  // Social icons — starting at ASCII left edge
  const socials = ['instagram', 'discord', 'telegram'];
  const igS     = Math.round(h * 0.70);
  const igGap   = igS * 1.5;
  const igBaseX = x + w * 0.27;
  const igY     = y + (h - igS) / 2;
  socials.forEach((id, i) => {
    const ix  = igBaseX + i * igGap;
    const hs  = state.subHoverState[id] || 0;
    const img = _getSocialImg(id, THEME.hex);
    if (img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 + hs * 0.45;
      ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},1)`;
      ctx.shadowBlur  = 8 + hs * 16;
      ctx.drawImage(img, ix, igY, igS, igS);
      ctx.restore();
    }
    state.globalHitAreas.push({ x: ix - 4, y: igY - 4, w: igS + 8, h: igS + 8, id });
  });
}

// ── Page router ───────────────────────────────────────────────────────────────
function drawPage(ctx, x, y, w, h, elapsed) {
  state.pageHitAreas = [];
  ctx.fillStyle   = BG; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.35)`; ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, y + 1, w - 2, h - 2);
  ctx.clip();

  if      (state.activePage === 'letterboxd')    drawPageLetterboxd(ctx, x, y, w, h, elapsed);
  else if (state.activePage === 'library')       drawPageLibrary(ctx, x, y, w, h, elapsed);
  else if (state.activePage === 'music')         drawPageMusic(ctx, x, y, w, h, elapsed);
  else if (state.activePage === 'discord')       drawPageDiscord(ctx, x, y, w, h, elapsed);
  else if (state.activePage === 'arcade')        drawPageArcade(ctx, x, y, w, h, elapsed);
  else if (state.activePage === 'doom')          drawPageDoom(ctx, x, y, w, h, elapsed);
  else if (state.activePage === 'mario')         drawPageMario(ctx, x, y, w, h);

  ctx.restore();
}

// ── Boot overlay ──────────────────────────────────────────────────────────────
export function drawBootOverlay(ctx, W, H, t) {
  const CY = H / 2;
  if (t < 0.3) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
  if (t < 4.2) {
    const p      = (t - 0.3) / 3.9;
    const ease   = 1 - Math.pow(1 - p, 2.8);
    const halfH  = ease * (H * 0.52);
    const bandTop    = Math.max(0, CY - halfH);
    const bandBottom = Math.min(H, CY + halfH);
    if (bandTop > 0) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bandTop); }
    if (bandBottom < H) { ctx.fillStyle = '#000'; ctx.fillRect(0, bandBottom, W, H - bandBottom); }
    if (halfH > 3) {
      const glowH   = Math.min(20, halfH * 0.1);
      const dimTop  = ctx.createLinearGradient(0, bandTop, 0, bandTop + glowH);
      dimTop.addColorStop(0, `rgba(${THEME.r},${THEME.g},${THEME.b},0.5)`);
      dimTop.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dimTop; ctx.fillRect(0, bandTop, W, glowH);
      const dimBot  = ctx.createLinearGradient(0, bandBottom - glowH, 0, bandBottom);
      dimBot.addColorStop(0, 'rgba(0,0,0,0)');
      dimBot.addColorStop(1, `rgba(${THEME.r},${THEME.g},${THEME.b},0.5)`);
      ctx.fillStyle = dimBot; ctx.fillRect(0, bandBottom - glowH, W, glowH);
    }
    return;
  }
  const p       = (t - 4.2) / (BOOT_DUR - 4.2);
  const flicker = Math.sin(t * 11) * 0.5 + 0.5;
  const alpha   = Math.max(0, (1 - p) * 0.10 * flicker);
  if (alpha > 0.005) { ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(0, 0, W, H); }
}

// ── Orientation Gate ──────────────────────────────────────────────────────────
export function drawOrientationGate(ctx, W, H, t) {
  ctx.fillStyle = BEZEL;
  ctx.fillRect(0, 0, W, H);
  const BEZ = W * 0.016;
  const sw  = W - BEZ * 2;
  const sh  = H - BEZ * 2;
  const r   = Math.min(sw, sh) * 0.035;
  roundRect(ctx, BEZ, BEZ, sw, sh, r);
  ctx.fillStyle = BG; ctx.fill();
  ctx.save(); ctx.clip();

  const spinX = sw * 0.5 + BEZ;
  const spinY = sh * 0.36 + BEZ;
  const spinR = Math.min(sw, sh) * 0.15;
  ctx.save();
  ctx.translate(spinX, spinY); ctx.rotate(t * 1.5);
  ctx.font = `${spinR * 1.9}px VT323`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = AMBER_GLOW; ctx.shadowBlur = 36; ctx.fillStyle = AMBER;
  ctx.fillText('↻', 0, 0);
  ctx.shadowBlur = 12; ctx.fillText('↻', 0, 0);
  ctx.restore();

  const fss = Math.min(sh / 11, sw / 20);
  const lh  = fss * 1.58;
  const cx  = sw * 0.06 + BEZ;
  let   cy  = sh * 0.06 + BEZ;
  const G   = 155;
  const gReveal = (text, start) => { const el = t - start; if (el <= 0) return ''; return text.slice(0, Math.floor(el * G)); };

  ctx.font = `${fss}px VT323`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const entries = [
    { text: 'ERROR_431 : DISPLAY ORIENTATION', col: '#ff6b6b', blur: 20, start: 0.10 },
    { text: '',                                 col: AMBER,     blur: 0,  start: 0 },
    { text: 'EXPECTED  : LANDSCAPE MODE',       col: AMBER_DIM, blur: 8,  start: 0.55 },
    { text: 'DETECTED  : PORTRAIT MODE',        col: '#ff8888', blur: 14, start: 0.88 },
    { text: '',                                 col: AMBER,     blur: 0,  start: 0 },
    { text: '>> REORIENTING DISPLAY . . . FAILED',   col: '#ff8888', blur: 10, start: 1.25 },
    { text: '>> ADJUSTING RASTER SCAN . . . FAILED', col: '#ff8888', blur: 10, start: 1.80 },
    { text: '',                                       col: AMBER,     blur: 0,  start: 0 },
    { text: '[ ROTATE DEVICE TO CONTINUE ]',          col: AMBER,     blur: 24, start: 2.35 },
  ];
  entries.forEach(({ text, col, blur, start }) => {
    if (!text) { cy += lh * 0.52; return; }
    const shown = gReveal(text, start);
    if (!shown) { cy += lh; return; }
    ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.fillStyle = col;
    ctx.fillText(shown, cx, cy);
    ctx.shadowBlur = Math.round(blur * 0.42);
    ctx.fillText(shown, cx, cy);
    cy += lh;
  });
  ctx.restore();
}
