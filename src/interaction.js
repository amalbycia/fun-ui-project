// ─── Interaction & Boot ───────────────────────────────────────────────────────
// openPage / closePage, all event handlers, and the main boot() entry.

import { state }                              from './state.js';
import { THEMES, MENU_LINKS, CLICKABLE, LASTFM_POLL } from './constants.js';
import { THEME, AMBER_GLOW }                  from './theme.js';
import { isPortrait, isTouchDevice, buildProgram } from './utils.js';
import { VERT, FRAG }                         from './shaders.js';
import { drawTerminal, drawBootOverlay, drawOrientationGate } from './renderer.js';

import { initDoom }                    from './pages/doom.js';
import { loadLbPosters }               from './pages/letterboxd.js';
import { fetchMusicData }              from './pages/music.js';
import { positionMarioFrame, showMarioControls } from './pages/mario.js';

// ── Page lifecycle ────────────────────────────────────────────────────────────
export function openPage(name) {
  state.activePage    = name;
  state.pageEnterTime = performance.now();
  state.pageHitAreas  = [];
  state.subHoverId    = null;
  state.lbScrollY     = 0;
  Object.keys(state.subHoverState).forEach(k => { state.subHoverState[k] = 0; });

  if (name === 'library') state.libOpenFolder = null;

  if (name === 'music') {
    fetchMusicData();
    state.musicPollTimer = setInterval(fetchMusicData, LASTFM_POLL);
  }
  if (name === 'letterboxd') loadLbPosters();
  if (name === 'doom') {
    initDoom();
    requestAnimationFrame(() => {
      const kb = document.getElementById('doom-kb');
      if (kb) kb.focus({ preventScroll: true });
    });
  }
  if (name === 'mario') {
    if (!state.marioFrame) {
      state.marioFrame = document.createElement('iframe');
      state.marioFrame.src = '/mario/index.html';
      state.marioFrame.style.cssText = 'position:fixed;border:none;z-index:10;background:#000;display:block;';
      document.body.appendChild(state.marioFrame);
    } else {
      state.marioFrame.style.display = 'block';
    }
    positionMarioFrame();
    requestAnimationFrame(() => {
      if (state.marioFrame) state.marioFrame.contentWindow.focus();
    });
    showMarioControls();
  }
}

export function closePage() {
  const prev  = state.pagePrev;
  state.pagePrev = null;

  if (state.marioFrame)       state.marioFrame.style.display = 'none';
  if (state.marioControlsDiv) { state.marioControlsDiv.remove(); state.marioControlsDiv = null; }
  if (state.musicPollTimer)   { clearInterval(state.musicPollTimer); state.musicPollTimer = null; }

  const kb = document.getElementById('doom-kb');
  if (kb) kb.blur();

  if (prev) {
    openPage(prev);
  } else {
    state.activePage   = null;
    state.pageHitAreas = [];
    state.subHoverId   = null;
  }
}

// ── Click dispatcher ─────────────────────────────────────────────────────────
function handleGlobalClick(id) {
  if (id === 'instagram') { window.open('https://instagram.com/alkexh', '_blank', 'noopener'); return; }
  if (id === 'discord')   { window.open('https://discordapp.com/users/1426930274213822595', '_blank', 'noopener'); return; }
  if (id === 'telegram')  { window.open('https://t.me/zetiva', '_blank', 'noopener'); return; }
  if (id === 'theme-toggle') {
    state.themeMenuOpen = !state.themeMenuOpen;
  } else if (id.startsWith('theme-select-')) {
    const idx = parseInt(id.split('-')[2], 10);
    if (!isNaN(idx) && idx >= 0 && idx < THEMES.length) {
      state.themeIdx    = idx;
      state.windowTheme = THEMES[idx];
      localStorage.setItem('crt-theme', idx.toString());
      state.gradCache.W = -1;
      state.asciiCache.w = -1;
    }
    state.themeMenuOpen = false;
  }
}

function handleSubClick(id) {
  if (id === 'back')          { closePage(); return; }
  if (id === 'lib-folder-back') { state.libOpenFolder = null; state.lbScrollY = 0; return; }

  // Library folder open
  if (id.startsWith('lib-') && !id.startsWith('lib-site-')) {
    state.libOpenFolder = id;
    state.lbScrollY     = 0;
    return;
  }

  if (id === 'instagram')    { window.open('https://instagram.com/alkexh', '_blank'); return; }
  if (id === 'discord')      { window.open('https://discordapp.com/users/1426930274213822595', '_blank', 'noopener'); return; }
  if (id === 'telegram')     { window.open('https://t.me/zetiva', '_blank', 'noopener'); return; }
  if (id === 'lb_link')     { window.open('https://letterboxd.com/psfo', '_blank'); return; }
  if (id === 'discord-link') { window.open('https://discord.com/users/1426930274213822595', '_blank', 'noopener'); return; }
  if (id === 'game-doom')   { state.pagePrev = 'arcade'; openPage('doom');  return; }
  if (id === 'game-mario')  { state.pagePrev = 'arcade'; openPage('mario'); return; }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
export async function boot() {
  state.bgVideo     = document.getElementById('bg-video');
  state.lastPortrait = isPortrait();

  // Battery
  if (navigator.getBattery) {
    navigator.getBattery().then(bat => {
      state.battery.level    = bat.level;
      state.battery.charging = bat.charging;
      bat.addEventListener('levelchange',  () => state.battery.level    = bat.level);
      bat.addEventListener('chargingchange', () => state.battery.charging = bat.charging);
    });
  }

  // Fallback ASCII text
  if (!state.bgVideo || state.bgVideo.error) {
    try {
      const r = await fetch('/ascii-art.txt');
      state.asciiLines = (await r.text()).split('\n');
    } catch {
      state.asciiLines = ['NO SIGNAL', 'DATA STREAM ERROR'];
    }
  }

  // Font
  try { await document.fonts.load('20px VT323'); } catch {}
  state.fontReady = true;

  // Video
  if (state.bgVideo) {
    state.bgVideo.play().catch(() => {
      document.addEventListener('click', () => state.bgVideo.play(), { once: true });
    });
  }

  // Canvas + WebGL
  const canvas = document.getElementById('c');
  const dpr    = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  };
  resize();
  window.addEventListener('resize', () => {
    resize();
    state.asciiCache.w = -1;
    if (state.activePage === 'mario') positionMarioFrame();
  });

  const off   = document.createElement('canvas');
  const ctx   = off.getContext('2d');
  const persist = document.createElement('canvas');
  const pctx  = persist.getContext('2d');

  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
          || canvas.getContext('experimental-webgl', { alpha: false, antialias: false });

  if (!gl) {
    const visCtx = canvas.getContext('2d');
    const loop = () => {
      off.width = canvas.width; off.height = canvas.height;
      drawTerminal(ctx, off.width, off.height);
      visCtx.drawImage(off, 0, 0);
      requestAnimationFrame(loop);
    };
    loop(); return;
  }

  const prog  = buildProgram(gl, VERT, FRAG);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes  = gl.getUniformLocation(prog, 'u_res');
  gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);

  const t0      = performance.now();
  const bootSfx = new Audio('/boot.mp3');
  bootSfx.volume = 1.0;

  // ── Render loop ──────────────────────────────────────────────────────────
  function loop() {
    const W = canvas.width, H = canvas.height;
    if (off.width !== W || off.height !== H) {
      off.width = W; off.height = H;
      persist.width = W; persist.height = H;
    }

    // Scroll inertia
    if (state.scrollVel !== 0) {
      if (state.scrollTarget === 'sidebar') {
        state.menuScrollY = Math.max(0, Math.min(state.menuScrollMax, state.menuScrollY + state.scrollVel));
      } else {
        state.lbScrollY = Math.max(0, Math.min(state.lbScrollMax, state.lbScrollY + state.scrollVel));
      }
      state.scrollVel *= 0.88;
      if (Math.abs(state.scrollVel) < 0.5) state.scrollVel = 0;
    }

    const portrait = isPortrait();
    if (portrait !== state.lastPortrait) {
      state.lastPortrait = portrait;
      pctx.clearRect(0, 0, W, H);
    }

    if (portrait) {
      drawOrientationGate(ctx, W, H, (performance.now() - t0) / 1000);
    } else {
      drawTerminal(ctx, W, H);
    }

    if (!state.BOOT_DONE && !portrait) {
      if (state.bootStartTime === null) {
        state.bootStartTime = performance.now();
        bootSfx.play().catch(() => {
          const play = () => { bootSfx.play().catch(() => {}); document.removeEventListener('click', play); document.removeEventListener('keydown', play); };
          document.addEventListener('click', play, { once: true });
          document.addEventListener('keydown', play, { once: true });
        });
      }
      const be = (performance.now() - state.bootStartTime) / 1000;
      if (be >= 3.8) { state.BOOT_DONE = true; }
      else            { drawBootOverlay(ctx, W, H, be); }
    }

    pctx.globalCompositeOperation = 'source-over';
    pctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    pctx.fillRect(0, 0, W, H);
    pctx.drawImage(off, 0, 0);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, persist);

    const t = (performance.now() - t0) / 1000;
    gl.viewport(0, 0, W, H);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uRes, W, H);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ── CSS → canvas coordinate mapping ──────────────────────────────────────
  function cssToCanvas(cssX, cssY) {
    const CURVE = 0.06;
    const u_s   = cssX / window.innerWidth;
    const v_s   = 1.0 - cssY / window.innerHeight;
    const u_sc  = u_s * 2.0 - 1.0;
    const v_sc  = v_s * 2.0 - 1.0;
    const r2     = u_sc * u_sc + v_sc * v_sc;
    const factor = 1.0 + CURVE * r2;
    const u_src  = (u_sc * factor * 0.5 + 0.5);
    const v_src  = (v_sc * factor * 0.5 + 0.5);
    return { x: u_src * canvas.width, y: (1.0 - v_src) * canvas.height };
  }

  function onItemClick(i) {
    if (!CLICKABLE.has(i)) return;
    state.clickFlash[i] = 1;
    gsap.to(state.clickFlash, { [i]: 0, duration: 0.55, ease: 'power2.out' });
    const action = MENU_LINKS[i];
    if (!action) return;
    if (action.type === 'external') window.open(action.url, '_blank');
    else if (action.type === 'page') openPage(action.page);
  }

  // ESC
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.activePage) {
      e.stopPropagation();
      closePage();
    }
  }, true);

  // Mario ESC bridge
  window.addEventListener('message', e => {
    if (e.data?.type === 'mario-esc' && state.activePage === 'mario') closePage();
  });

  canvas.addEventListener('click', () => {
    if (state.activePage === 'mario' && state.marioFrame) state.marioFrame.contentWindow.focus();
  });

  // Wheel scroll
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const { x } = cssToCanvas(e.clientX, e.clientY);
    if (x < canvas.width * 0.30) {
      state.menuScrollY = Math.max(0, Math.min(state.menuScrollMax, state.menuScrollY + e.deltaY * 0.6));
    } else if (state.activePage === 'letterboxd' || state.activePage === 'music' ||
               state.activePage === 'discord' || state.activePage === 'arcade' ||
               state.activePage === 'library') {
      state.lbScrollY = Math.max(0, Math.min(state.lbScrollMax, state.lbScrollY + e.deltaY * 0.6));
    }
  }, { passive: false });

  // Hover SFX
  const hoverSfx = new Audio('/hover.mp3');
  hoverSfx.volume = 0.6;

  let lastHovered    = -1;
  let lastSubHovered = null;

  canvas.addEventListener('mousemove', e => {
    const { x, y } = cssToCanvas(e.clientX, e.clientY);

    // Global hover
    let foundGlobal = null;
    for (const hit of state.globalHitAreas) {
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) { foundGlobal = hit.id; break; }
    }
    if (foundGlobal !== state.globalHoverId) {
      if (state.globalHoverId !== null)
        gsap.to(state.subHoverState, { [state.globalHoverId]: 0, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
      if (foundGlobal !== null) {
        if (!state.subHoverState[foundGlobal]) state.subHoverState[foundGlobal] = 0;
        gsap.to(state.subHoverState, { [foundGlobal]: 1, duration: 0.10, ease: 'power2.out', overwrite: 'auto' });
        if (!['instagram','discord','telegram'].includes(foundGlobal)) hoverSfx.cloneNode().play().catch(() => {});
      }
      state.globalHoverId = foundGlobal;
    }
    if (foundGlobal) { canvas.style.cursor = 'pointer'; return; }

    if (state.activePage) {
      // Sub-link hover
      let foundSub = null;
      for (const hit of state.pageHitAreas) {
        if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) { foundSub = hit.id; break; }
      }
      if (foundSub !== lastSubHovered) {
        if (lastSubHovered !== null)
          gsap.to(state.subHoverState, { [lastSubHovered]: 0, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
        if (foundSub !== null) {
          if (!state.subHoverState[foundSub]) state.subHoverState[foundSub] = 0;
          gsap.to(state.subHoverState, { [foundSub]: 1, duration: 0.10, ease: 'power2.out', overwrite: 'auto' });
          hoverSfx.cloneNode().play().catch(() => {});
        }
        lastSubHovered = foundSub;
        state.subHoverId = foundSub;
      }

      // Sidebar hover while page open
      let foundSidebar = -1;
      for (const hit of state.menuHitAreas) {
        if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h && CLICKABLE.has(hit.i)) { foundSidebar = hit.i; break; }
      }
      if (foundSidebar !== lastHovered) {
        if (lastHovered !== -1)
          gsap.to(state.hoverState, { [lastHovered]: 0, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
        if (foundSidebar !== -1) {
          if (!state.hoverState[foundSidebar]) state.hoverState[foundSidebar] = 0;
          gsap.to(state.hoverState, { [foundSidebar]: 1, duration: 0.10, ease: 'power2.out', overwrite: 'auto' });
          hoverSfx.cloneNode().play().catch(() => {});
        }
        lastHovered = foundSidebar;
        state.hoveredItem = foundSidebar;
      }
      canvas.style.cursor = (foundSub || foundSidebar !== -1) ? 'pointer' : 'default';
      return;
    }

    // Sidebar hover (no page open)
    let found = -1;
    for (const hit of state.menuHitAreas) {
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h && CLICKABLE.has(hit.i)) { found = hit.i; break; }
    }
    if (found !== lastHovered) {
      if (lastHovered !== -1)
        gsap.to(state.hoverState, { [lastHovered]: 0, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
      if (found !== -1) {
        if (!state.hoverState[found]) state.hoverState[found] = 0;
        gsap.to(state.hoverState, { [found]: 1, duration: 0.10, ease: 'power2.out', overwrite: 'auto' });
        hoverSfx.cloneNode().play().catch(() => {});
      }
      lastHovered = found;
      state.hoveredItem = found;
      canvas.style.cursor = found !== -1 ? 'pointer' : 'default';
    }
  });

  // Click
  canvas.addEventListener('click', e => {
    const { x, y } = cssToCanvas(e.clientX, e.clientY);
    for (const hit of state.globalHitAreas) {
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) { handleGlobalClick(hit.id); return; }
    }
    if (state.activePage) {
      if (state.activePage === 'doom') {
        const kb = document.getElementById('doom-kb');
        if (kb) kb.focus({ preventScroll: true });
        return;
      }
      for (const hit of state.pageHitAreas) {
        if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
          if (hit.url) { window.open(hit.url, '_blank', 'noopener'); return; }
          handleSubClick(hit.id); return;
        }
      }
      for (const hit of state.menuHitAreas) {
        if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) { onItemClick(hit.i); return; }
      }
      return;
    }
    for (const hit of state.menuHitAreas) {
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) { onItemClick(hit.i); return; }
    }
  });

  // Touch
  if (isTouchDevice) {
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      state.scrollVel     = 0;
      state.touchStartX   = e.touches[0].clientX;
      state.touchStartY   = e.touches[0].clientY;
      state.touchLastY    = state.touchStartY;
      state.touchLastTime = performance.now();
      const { x: tx, y: ty } = cssToCanvas(state.touchStartX, state.touchStartY);
      state.scrollTarget = tx < canvas.width * 0.30 ? 'sidebar' : 'page';
      if (isPortrait()) return;

      for (const hit of state.globalHitAreas) {
        if (tx >= hit.x && tx <= hit.x + hit.w && ty >= hit.y && ty <= hit.y + hit.h) {
          if (state.subHoverState[hit.id] === undefined) state.subHoverState[hit.id] = 0;
          gsap.to(state.subHoverState, { [hit.id]: 1, duration: 0.07, overwrite: 'auto' });
          setTimeout(() => { gsap.to(state.subHoverState, { [hit.id]: 0, duration: 0.35, overwrite: 'auto' }); handleGlobalClick(hit.id); }, 85);
          return;
        }
      }

      if (state.activePage) {
        if (state.activePage === 'doom') { const kb = document.getElementById('doom-kb'); if (kb) kb.focus({ preventScroll: true }); return; }
        for (const hit of state.pageHitAreas) {
          if (tx >= hit.x && tx <= hit.x + hit.w && ty >= hit.y && ty <= hit.y + hit.h) {
            if (hit.url) { window.open(hit.url, '_blank', 'noopener'); return; }
            if (state.subHoverState[hit.id] === undefined) state.subHoverState[hit.id] = 0;
            gsap.to(state.subHoverState, { [hit.id]: 1, duration: 0.07, overwrite: 'auto' });
            setTimeout(() => { gsap.to(state.subHoverState, { [hit.id]: 0, duration: 0.35, overwrite: 'auto' }); handleSubClick(hit.id); }, 85);
            return;
          }
        }
        for (const hit of state.menuHitAreas) {
          if (tx >= hit.x && tx <= hit.x + hit.w && ty >= hit.y && ty <= hit.y + hit.h && CLICKABLE.has(hit.i)) {
            state.clickFlash[hit.i] = 1;
            gsap.to(state.clickFlash, { [hit.i]: 0, duration: 0.55, ease: 'power2.out' });
            setTimeout(() => onItemClick(hit.i), 50);
            return;
          }
        }
        return;
      }

      for (const hit of state.menuHitAreas) {
        if (tx >= hit.x && tx <= hit.x + hit.w && ty >= hit.y && ty <= hit.y + hit.h && CLICKABLE.has(hit.i)) {
          state.clickFlash[hit.i] = 1;
          gsap.to(state.clickFlash, { [hit.i]: 0, duration: 0.55, ease: 'power2.out' });
          setTimeout(() => onItemClick(hit.i), 50);
          return;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const now = performance.now();
      const dy  = state.touchLastY - e.touches[0].clientY;
      const dt  = Math.max(1, now - state.touchLastTime);
      state.scrollVel     = dy / dt * 16;
      state.touchLastY    = e.touches[0].clientY;
      state.touchLastTime = now;
      if (state.scrollTarget === 'sidebar') {
        state.menuScrollY = Math.max(0, Math.min(state.menuScrollMax, state.menuScrollY + dy * 1.2));
      } else if (state.activePage) {
        state.lbScrollY = Math.max(0, Math.min(state.lbScrollMax, state.lbScrollY + dy * 1.2));
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - state.touchStartX;
      const dy = Math.abs(e.changedTouches[0].clientY - state.touchStartY);
      if (dx > 60 && dy < 40 && state.activePage && state.activePage !== 'doom') {
        closePage(); state.scrollVel = 0;
      }
      state.menuScrollY = Math.max(0, Math.min(state.menuScrollMax, state.menuScrollY));
      state.lbScrollY   = Math.max(0, Math.min(state.lbScrollMax, state.lbScrollY));
    }, { passive: true });
  }
}
