// ─── PAGE: DOOM ──────────────────────────────────────────────────────────────

import { state }                              from '../state.js';
import { THEME, AMBER, AMBER_DIM, AMBER_GLOW } from '../theme.js';
import { typeReveal, pgGlow, pgGlowOff, regHit, drawSubLink } from '../utils.js';
import { SPEED, DOOM_W, DOOM_H }              from '../constants.js';

export async function initDoom() {
  if (state.doomLoading || state.doomReady) return;
  state.doomLoading = true;

  state.doomCanvas        = document.createElement('canvas');
  state.doomCanvas.width  = DOOM_W;
  state.doomCanvas.height = DOOM_H;
  state.doomCtx           = state.doomCanvas.getContext('2d');

  try {
    const { DOOM } = await import('wasm-doom');
    const kbTarget = document.getElementById('doom-kb');
    const game = new DOOM({
      screenWidth: DOOM_W, screenHeight: DOOM_H,
      wasmURL: '/doom.wasm',
      keyboardTarget: kbTarget,
      enableLogs: true,
      onFrameRender: ({ screen }) => {
        const frame = new ImageData(screen, DOOM_W, DOOM_H);
        state.doomCtx.putImageData(frame, 0, 0);
      },
    });
    await game.start();
    state.doomReady    = true;
    state.doomReadyTime = performance.now();
    state.doomLoading  = false;
    const kb = document.getElementById('doom-kb');
    if (kb && state.activePage === 'doom') kb.focus({ preventScroll: true });
  } catch (err) {
    console.error('[DOOM] init failed:', err);
    state.doomLoading = false;
    state.doomError   = String(err);
  }
}

export function drawPageDoom(ctx, x, y, w, h, elapsed) {
  if (state.doomReady && state.doomCanvas) {
    ctx.save();
    ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b}, 0.35)`;
    ctx.lineWidth   = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.drawImage(state.doomCanvas, x, y, w, h);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b}, 0.035)`;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';

    const fs      = Math.min(h / 22, w / 28);
    ctx.font      = `${fs}px VT323`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'right';
    const badgeW  = fs * 9, badgeH = fs * 1.3;
    const badgeX  = x + w - badgeW - fs * 0.4;
    const badgeY  = y + fs * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(badgeX - fs * 0.3, badgeY - fs * 0.1, badgeW + fs * 0.6, badgeH + fs * 0.2);
    pgGlow(ctx, 8); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
    ctx.fillText('[ESC] EXIT', x + w - fs * 0.5, badgeY);
    pgGlowOff(ctx);

    const hudAge   = (performance.now() - state.doomReadyTime) / 1000;
    const FADE_START = 5.5, FADE_END = 8.5;
    if (hudAge < FADE_END) {
      const alpha    = hudAge < FADE_START ? 1 : 1 - (hudAge - FADE_START) / (FADE_END - FADE_START);
      const hfs      = fs * 0.82;
      const hlh      = hfs * 1.55;
      const hpad     = hfs * 0.8;
      const controls = [
        ['↑ / ↓', 'MOVE FWD / BACK'],
        ['← / →', 'TURN LEFT / RIGHT'],
        ['CTRL',  'SHOOT'],
        ['SPACE', 'USE / OPEN DOOR'],
        ['ALT + ←→', 'STRAFE'],
        ['[ / ]', 'PREV / NEXT WEAPON'],
        ['TAB',   'AUTOMAP'],
        ['ENTER', 'MENU SELECT'],
      ];
      const hudW = hfs * 18;
      const hudH = hpad * 2 + controls.length * hlh;
      const hudX = x + fs * 0.8;
      const hudY = y + fs * 2.5;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = 'rgba(0,0,0,0.72)';
      ctx.fillRect(hudX, hudY, hudW, hudH);
      ctx.fillStyle   = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.7 * alpha})`;
      ctx.fillRect(hudX, hudY, 2, hudH);
      ctx.font         = `${hfs}px VT323`;
      ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      pgGlow(ctx, 14); ctx.fillStyle = AMBER;
      ctx.fillText('CONTROLS', hudX + hpad, hudY + hpad * 0.5);
      pgGlowOff(ctx);
      controls.forEach(([key, action], i) => {
        const ry = hudY + hpad + hfs * 1.4 + i * hlh;
        ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.9)`;
        ctx.fillText(key.padEnd(10), hudX + hpad, ry);
        ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.5)`;
        ctx.fillText(action, hudX + hpad + hfs * 6.5, ry);
      });
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // Loading / boot-log mode
  const PAD = w * 0.055;
  const fs  = Math.min(h / 20, w / 24);
  const lh  = fs * 1.45;
  const cx  = x + PAD;
  let   cy  = y + PAD * 0.8;
  let   t   = 0;
  const Q   = 10 / SPEED;

  ctx.font = `${fs}px VT323`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  const titleFS = fs * 2.1;
  ctx.font = `${titleFS}px VT323`;
  cy += lh * 1.55;
  pgGlow(ctx, 40); ctx.fillStyle = '#ff4400';
  ctx.fillText(typeReveal('DOOM', elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);
  t = 0.06 + 4 / SPEED;

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.1;
  const subStr = state.doomLoading ? 'LOADING WASM ENGINE . . . PLEASE WAIT' : 'WASM DOOM  —  FREEDOOM ENGINE  —  CLICK @doom TO START';
  pgGlow(ctx, 8); ctx.fillStyle = AMBER_DIM;
  ctx.fillText(typeReveal(subStr, elapsed, t), cx, cy);
  pgGlowOff(ctx);
  t += subStr.length / SPEED + Q;

  cy += lh * 1.35;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.4)`;
  ctx.fillText(typeReveal('─'.repeat(42), elapsed, t), cx, cy);
  t += 42 / SPEED; cy += lh * 1.1;

  const lines = [
    '> INITIALIZING DOOM ENGINE . . .',
    '> LOADING doom.wasm  (LOCAL)  . . .',
    '> ALLOCATING ZONE MEMORY . . .',
    '> V_INIT: ALLOCATE SCREENS . . .',
    '> M_INIT: MENUS . . .',
    '> R_INIT: RENDERER . . . . . . OK',
    state.doomLoading ? '> STARTING GAME LOOP . . . LOADING' : '> GAME LOOP . . . . . . . . . . OK',
    '',
    state.doomLoading ? '[ WASM LOADING — PLEASE WAIT ]' : '[ DOOM READY — CLICK @doom TO PLAY ]',
  ];
  const ctrlLines = [
    '',
    '───  CONTROLS  ───────────────────────────────',
    '  MOVE FWD / BACK     ← ↑ ↓ →  (arrow keys)',
    '  SHOOT               CTRL',
    '  USE / OPEN DOOR     SPACE',
    '  STRAFE              ALT + ← / →',
    '  PREV / NEXT WEAPON  [ / ]',
    '  AUTOMAP             TAB',
    '  MENU SELECT         ENTER',
    '  EXIT TO TERMINAL    ESC',
    '',
    '  TIP: Click the game area first to capture keyboard focus.',
  ];
  const allLines  = [...lines, ...ctrlLines];
  const ctrlStart = lines.length;

  const listStartY = cy;
  const listH      = (y + h) - listStartY - PAD;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listStartY, w, listH);
  ctx.clip();
  cy -= state.lbScrollY;

  allLines.forEach((line, li) => {
    if (!line) { t += Q * 3; return; }
    const shown   = typeReveal(line, elapsed, t);
    const isCmd   = line.startsWith('>');
    const isReady = line.startsWith('[');
    const isSep   = line.startsWith('─');
    const isCtrl  = li >= ctrlStart && !isCmd && !isReady && !isSep;
    const isTip   = line.trimStart().startsWith('TIP');
    if (isCmd)        { ctx.shadowColor = 'rgba(255,80,0,0.8)';  ctx.shadowBlur = 14; ctx.fillStyle = '#ff6633'; }
    else if (isReady) { pgGlow(ctx, 22); ctx.fillStyle = AMBER; }
    else if (isSep)   { pgGlow(ctx, 6);  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.35)`; }
    else if (isTip)   { pgGlow(ctx, 6);  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.38)`; }
    else if (isCtrl)  { pgGlow(ctx, 10); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.75)`; }
    else              { pgGlow(ctx, 10); ctx.fillStyle = AMBER; }
    ctx.fillText(shown, cx, cy + li * lh); pgGlowOff(ctx);
    t += line.length / SPEED + Q;
  });

  const totalContentH = (cy + allLines.length * lh) - (listStartY - state.lbScrollY);
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
