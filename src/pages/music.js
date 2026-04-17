// ─── PAGE: MUSIC ─────────────────────────────────────────────────────────────

import { state }                              from '../state.js';
import { THEME, AMBER, AMBER_DIM, AMBER_GLOW } from '../theme.js';
import { typeReveal, pgGlow, pgGlowOff, regHit, drawSubLink } from '../utils.js';
import { LASTFM_KEY, LASTFM_USER, LASTFM_POLL } from '../constants.js';

// Module-level music state (only accessed from this file)
let musicNow      = null;
let musicRecent   = [];
let musicFetching = false;
let musicError    = null;
let musicImgURL   = null;
let musicPixelCanvas = null;
let musicTrackStart  = 0;
let musicLastTrack   = null;

export async function fetchMusicData() {
  if (musicFetching) return;
  musicFetching = true;
  try {
    const url  = `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${LASTFM_USER}&api_key=${LASTFM_KEY}&format=json&limit=20`;
    const res  = await fetch(url);
    const json = await res.json();
    const tracks = json.recenttracks?.track;
    if (!Array.isArray(tracks) || !tracks.length) {
      musicError = 'NO TRACKS FOUND'; musicFetching = false; return;
    }

    const first     = tracks[0];
    const isPlaying = first?.['@attr']?.nowplaying === 'true';

    if (isPlaying) {
      const tid = `${first.name}||${first.artist['#text']}`;
      if (tid !== musicLastTrack) { musicTrackStart = performance.now(); musicLastTrack = tid; }

      const imgUrl = (first.image || []).find(i => i.size === 'large')?.['#text'] || '';
      const hasArt = imgUrl && !imgUrl.includes('2a96cbd8b46e442fc41c2b86b821562f');
      musicNow = {
        name: first.name, artist: first.artist['#text'],
        album: first.album['#text'], imageUrl: imgUrl,
        duration: parseInt(first.duration) || 0,
        url: first.url || '',
      };

      if (hasArt && imgUrl !== musicImgURL) {
        musicImgURL = imgUrl; musicPixelCanvas = null;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const pc  = document.createElement('canvas');
          pc.width  = 64; pc.height = 64;
          const pc2 = pc.getContext('2d');
          pc2.imageSmoothingEnabled = false;
          pc2.drawImage(img, 0, 0, 64, 64);
          pc2.globalCompositeOperation = 'multiply';
          pc2.fillStyle = 'rgba(244,180,40,0.18)';
          pc2.fillRect(0, 0, 64, 64);
          pc2.globalCompositeOperation = 'source-over';
          musicPixelCanvas = pc;
        };
        img.onerror = () => { musicPixelCanvas = null; };
        img.src = imgUrl;
      } else if (!hasArt) {
        musicPixelCanvas = null;
      }
    } else {
      musicNow = null;
    }

    const skip  = isPlaying ? 1 : 0;
    musicRecent = tracks.slice(skip, skip + 12).map(t => ({
      name: t.name, artist: t.artist['#text'],
      ts: t.date?.['#text'] || '--', url: t.url || '',
    }));
    musicError = null;
  } catch (e) {
    musicError = 'LAST.FM UNREACHABLE';
    console.warn('[music]', e);
  }
  musicFetching = false;
}

function drawEqualizer(ctx, x, y, w, h, t) {
  const N    = 14;
  const freq = [2.1,3.4,1.8,2.7,4.1,1.5,3.2,2.9,1.4,3.7,2.3,4.5,1.9,3.1];
  const phs  = [0.0,0.5,1.1,0.2,0.8,1.4,0.3,0.9,0.6,1.2,0.1,0.7,1.3,0.4];
  const gap  = w * 0.04;
  const bw   = (w - gap * (N - 1)) / N;
  ctx.save();
  for (let i = 0; i < N; i++) {
    const raw  = Math.pow(Math.sin(t * freq[i] + phs[i]) * 0.5 + 0.5, 1.3);
    const barH = h * (0.12 + 0.88 * raw);
    const bx   = x + i * (bw + gap);
    const al   = 0.35 + 0.65 * raw;
    ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},${al})`;
    ctx.shadowBlur  = 5 + 9 * raw;
    ctx.fillStyle   = `rgba(${THEME.r},${THEME.g},${THEME.b},${al})`;
    ctx.fillRect(Math.round(bx), Math.round(y + h - barH), Math.max(1, Math.ceil(bw)), Math.ceil(barH));
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawPageMusic(ctx, x, y, w, h, elapsed) {
  const PAD      = w * 0.055;
  const fs       = Math.min(h / 20, w / 24);
  const lh       = fs * 1.45;
  const cx       = x + PAD;
  const contentW = w - PAD * 2;
  let   cy       = y + PAD * 0.8;

  ctx.font         = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';

  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  cy += lh * 1.55;
  const titleFS = fs * 1.8;
  ctx.font = `${titleFS}px VT323`;
  pgGlow(ctx, 28); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('MUSIC', elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.15;
  pgGlow(ctx, 7); ctx.fillStyle = AMBER_DIM;
  ctx.fillText(typeReveal('SCROBBLED VIA LAST.FM — ' + LASTFM_USER.toUpperCase(), elapsed, 0.10), cx, cy);
  pgGlowOff(ctx);

  cy += lh * 1.2;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
  ctx.fillText(typeReveal('─'.repeat(42), elapsed, 0.12), cx, cy);
  cy += lh * 1.6;

  if (elapsed < 0.25) return;

  if (musicError) {
    pgGlow(ctx, 14); ctx.fillStyle = '#ff4433';
    ctx.fillText('ERR: ' + musicError, cx, cy);
    pgGlowOff(ctx); cy += lh * 2;
  } else if (musicFetching && !musicNow && !musicRecent.length) {
    pgGlow(ctx, 12); ctx.fillStyle = AMBER_DIM;
    ctx.fillText('SCANNING LAST.FM . . .', cx, cy);
    pgGlowOff(ctx); return;
  }

  if (musicNow) {
    ctx.font = `${fs * 0.78}px VT323`;
    ctx.shadowColor = `rgba(${THEME.r},${Math.floor(THEME.g * 0.4)},${Math.floor(THEME.b * 0.7)},0.9)`;
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = '#ff5533';
    ctx.fillText('▶  NOW PLAYING', cx, cy);
    ctx.shadowBlur  = 0;
    cy += fs * 1.25;

    const artW    = Math.min(contentW * 0.38, h * 0.30, 170);
    const artH    = artW;
    const artX    = cx;
    const artY    = cy;
    const hsArt   = state.subHoverState['music-art'] || 0;
    const trackUrl = musicNow.url || ('https://www.last.fm/music/' + encodeURIComponent(musicNow.artist) + '/_/' + encodeURIComponent(musicNow.name));

    ctx.save();
    ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.5 + hsArt * 0.4})`;
    ctx.shadowBlur  = 8 + hsArt * 18;
    ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.4 + hsArt * 0.45})`;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(artX, artY, artW, artH);
    ctx.shadowBlur  = 0;

    if (musicPixelCanvas) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(musicPixelCanvas, artX + 1, artY + 1, artW - 2, artH - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let sl = 0; sl < artH; sl += 3) ctx.fillRect(artX + 1, artY + 1 + sl, artW - 2, 1.3);
    } else {
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.05)`;
      ctx.fillRect(artX + 1, artY + 1, artW - 2, artH - 2);
      ctx.font = `${artW * 0.4}px VT323`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      pgGlow(ctx, 12); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.32)`;
      ctx.fillText('♫', artX + artW / 2, artY + artH / 2);
      pgGlowOff(ctx);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    }

    if (hsArt > 0.05) {
      ctx.fillStyle = `rgba(0,0,0,${0.55 * hsArt})`;
      ctx.fillRect(artX + 1, artY + 1, artW - 2, artH - 2);
      ctx.font = `${fs * 0.9}px VT323`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      pgGlow(ctx, 16);
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hsArt})`;
      ctx.fillText('↗ OPEN ON LAST.FM', artX + artW / 2, artY + artH / 2);
      pgGlowOff(ctx);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    }
    ctx.restore();
    regHit(artX, artY, artW, artH, 'music-art', trackUrl);

    const infoX = artX + artW + PAD * 0.85;
    const infoW = contentW - artW - PAD * 0.85;
    let   iy    = artY;
    const clamp = (s, maxW, fsize) => {
      const max = Math.floor(maxW / (fsize * 0.62));
      return s.length > max ? s.slice(0, max - 1) + '…' : s;
    };

    ctx.font = `${fs * 1.5}px VT323`;
    pgGlow(ctx, 24); ctx.fillStyle = AMBER;
    ctx.fillText(clamp(musicNow.name, infoW, fs * 1.5), infoX, iy);
    pgGlowOff(ctx); iy += fs * 1.75;

    ctx.font = `${fs * 1.1}px VT323`;
    pgGlow(ctx, 12); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.82)`;
    ctx.fillText(clamp(musicNow.artist, infoW, fs * 1.1), infoX, iy);
    pgGlowOff(ctx); iy += lh * 1.1;

    ctx.font = `${fs}px VT323`;
    pgGlow(ctx, 6); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.42)`;
    ctx.fillText(clamp(musicNow.album || '—', infoW, fs), infoX, iy);
    pgGlowOff(ctx); iy += lh * 2.0;

    if (musicNow.duration > 0) {
      const pct    = Math.min(1, (performance.now() - musicTrackStart) / (musicNow.duration * 1000));
      const elSec  = (performance.now() - musicTrackStart) / 1000;
      const fmt    = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const barH   = fs * 0.46;
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.12)`;
      ctx.fillRect(infoX, iy, infoW, barH);
      pgGlow(ctx, 8); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.88)`;
      ctx.fillRect(infoX, iy, infoW * pct, barH);
      pgGlowOff(ctx);
      iy += barH + fs * 0.3;
      ctx.font = `${fs * 0.72}px VT323`; ctx.fillStyle = AMBER_DIM;
      ctx.fillText(fmt(elSec), infoX, iy);
      ctx.textAlign = 'right';
      ctx.fillText(fmt(musicNow.duration), infoX + infoW, iy);
      ctx.textAlign = 'left';
      iy += lh * 1.1;
    }

    const eqH = fs * 2.2;
    if (iy + eqH <= artY + artH) drawEqualizer(ctx, infoX, iy, Math.min(infoW, artW * 1.4), eqH, elapsed);
    cy = artY + artH + lh * 1.8;
  } else if (!musicFetching && !musicError) {
    ctx.font = `${fs}px VT323`;
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.38)`;
    ctx.fillText('—  nothing playing right now', cx, cy);
    cy += lh * 2.2;
  }

  if (musicRecent.length && cy + lh * 2.2 < y + h) {
    ctx.font = `${fs * 0.82}px VT323`;
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
    ctx.fillText('───  RECENTLY PLAYED  ──────────────────────────────────', cx, cy);
    cy += lh * 1.25;

    const listStartY = cy;
    const listH      = (y + h) - listStartY - lh * 0.4;
    const rowH       = lh * 1.6;
    const totalListH = musicRecent.length * rowH;
    state.lbScrollMax = Math.max(0, totalListH - listH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, listStartY, w, listH);
    ctx.clip();

    let ry = listStartY - state.lbScrollY;
    musicRecent.forEach((tr, i) => {
      const rid = 'music-rec-' + i;
      const hs  = state.subHoverState[rid] || 0;
      if (hs > 0) {
        pgGlowOff(ctx);
        ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs * 0.09})`;
        ctx.fillRect(cx - 4, ry - 2, contentW + 8, rowH);
      }
      ctx.font = `${fs}px VT323`;
      const rr   = Math.round(THEME.r - (THEME.r - 13) * hs);
      const gg   = Math.round(THEME.g - (THEME.g - 8)  * hs);
      const bb   = Math.round(THEME.b - THEME.b         * hs);
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      pgGlow(ctx, Math.round(12 * (1 - hs)));
      const maxC  = Math.floor(contentW * 0.72 / (fs * 0.63));
      const label = tr.name + '  —  ' + tr.artist;
      ctx.fillText(label.length > maxC ? label.slice(0, maxC - 1) + '…' : label, cx, ry + fs * 0.15);
      pgGlowOff(ctx);
      ctx.font      = `${fs * 0.72}px VT323`;
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.35 + hs * 0.3})`;
      ctx.textAlign = 'right';
      ctx.fillText(tr.ts, x + w - PAD * 0.6, ry + fs * 0.2);
      ctx.textAlign = 'left';
      const screenY = listStartY + i * rowH - state.lbScrollY;
      if (tr.url && screenY + rowH > listStartY && screenY < listStartY + listH)
        regHit(cx - 4, screenY - 2, contentW + 8, rowH, rid, tr.url);
      ry += rowH;
    });
    ctx.restore();

    if (state.lbScrollMax > 0) {
      const sbX    = x + w - PAD * 0.38;
      const thumbH = Math.max(18, (listH / totalListH) * listH);
      const thumbY = listStartY + (state.lbScrollY / state.lbScrollMax) * (listH - thumbH);
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.15)`;
      ctx.fillRect(sbX, listStartY, 3, listH);
      pgGlow(ctx, 6);
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.55)`;
      ctx.fillRect(sbX, thumbY, 3, thumbH);
      pgGlowOff(ctx);
    }
  }
}
