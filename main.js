/**
 * CRT Terminal Renderer
 *
 * Pipeline:
 *   1. Load ASCII art text
 *   2. Each frame: paint the entire terminal UI onto an offscreen 2D canvas
 *   3. Upload that canvas as a WebGL texture
 *   4. Fragment shader applies: barrel distortion + chromatic aberration
 *      + scanlines + film grain + vignette + phosphor flicker
 */

// ─── WebGL shaders ───────────────────────────────────────────────────────────

const VERT = `
attribute vec2 a_pos;
varying   vec2 v_uv;
void main(){
  v_uv        = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2  v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform vec2  u_res;

// --- CRT tunables ---
const float CURVE    = 0.06;   // subtle CRT curve — contents stay readable
const float CHROMA   = 0.006;  // chromatic aberration
const float VIGNETTE = 0.45;   // gentle corner falloff — no blackout
const float GRAIN    = 0.05;   // film grain
const float SCAN_STR = 0.20;   // scanline darkness

vec2 barrel(vec2 uv){
  uv = uv * 2.0 - 1.0;
  uv *= 1.0 + CURVE * dot(uv, uv); // simple r² — full-screen gentle warp
  return uv * 0.5 + 0.5;
}

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
}

void main(){
  vec2 uv = barrel(v_uv);

  // Discard outside warped screen → shows black bezel
  if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0){
    gl_FragColor = vec4(0.0,0.0,0.0,1.0);
    return;
  }

  // Chromatic aberration — R/G/B at slightly different warp positions
  vec2 dir = (uv - 0.5);
  float ca = CHROMA * dot(dir, dir);
  float r  = texture2D(u_tex, barrel(v_uv + dir * ca * 2.0)).r;
  float g  = texture2D(u_tex, uv).g;
  float b  = texture2D(u_tex, barrel(v_uv - dir * ca * 2.0)).b;
  vec3 col = vec3(r, g, b);

  // Scanlines
  float scan = sin(uv.y * u_res.y * 3.14159);
  col *= 1.0 - SCAN_STR * (0.5 - 0.5 * scan * scan);

  // Film grain
  col += (hash(uv + fract(u_time * 0.031)) - 0.5) * GRAIN;

  // Vignette
  vec2 vig = uv * (1.0 - uv);
  col *= pow(vig.x * vig.y * 16.0, VIGNETTE);

  // Phosphor flicker (very subtle)
  col *= 0.97 + 0.03 * sin(u_time * 53.1);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// ─── Globals ─────────────────────────────────────────────────────────────────

// ─── Globals & Themes ────────────────────────────────────────────────────────
const THEMES = [
  { name: 'AMBER', hex: '#F4C436', r: 244, g: 196, b: 54 },
  { name: 'GREEN', hex: '#4af626', r: 74, g: 246, b: 38 },
  { name: 'CYAN', hex: '#00e5ff', r: 0, g: 229, b: 255 },
  { name: 'WHITE', hex: '#dcdcdc', r: 220, g: 220, b: 220 },
  { name: 'PINK', hex: '#ff00aa', r: 255, g: 0, b: 170 },
  { name: 'BLOOD', hex: '#ff1100', r: 255, g: 17, b: 0 }
];

let themeIdx = parseInt(localStorage.getItem('crt-theme') || '0', 10);
if (isNaN(themeIdx) || themeIdx >= THEMES.length) themeIdx = 0;
let windowTheme = THEMES[themeIdx];

// Using globalThis so variables resolve implicitly in non-strict, but in a module, we just create proxies.
const THEME = new Proxy({}, {
  get: (t, p) => windowTheme[p],
  set: (t, p, v) => { windowTheme = v; return true; }
});

Object.defineProperty(globalThis, 'AMBER', { get: () => windowTheme.hex });
Object.defineProperty(globalThis, 'AMBER_DIM', { get: () => `rgba(${windowTheme.r},${windowTheme.g},${windowTheme.b},0.4)` });
Object.defineProperty(globalThis, 'AMBER_GLOW', { get: () => `rgba(${windowTheme.r},${windowTheme.g},${windowTheme.b},0.9)` });
Object.defineProperty(globalThis, 'AMBER_STRONG', { get: () => `rgba(${windowTheme.r},${windowTheme.g},${windowTheme.b},1.0)` });

const AMBER = { toString: () => windowTheme.hex };
const AMBER_DIM = { toString: () => `rgba(${windowTheme.r},${windowTheme.g},${windowTheme.b},0.4)` };
const AMBER_GLOW = { toString: () => `rgba(${windowTheme.r},${windowTheme.g},${windowTheme.b},0.9)` };
const AMBER_STRONG = { toString: () => `rgba(${windowTheme.r},${windowTheme.g},${windowTheme.b},1.0)` };

const BG = '#120d00';
const BEZEL = '#050400';

// ─── Mobile / Touch ──────────────────────────────────────────────────────────
function isPortrait() { return window.innerHeight > window.innerWidth; }
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let _touchStartX = 0, _touchStartY = 0;
let _touchLastY = 0, _touchLastTime = 0;
let _scrollVel = 0;        // inertia: px/frame, decayed in rAF
let _scrollTarget = 'page';   // 'sidebar' | 'page'
let _lastPortrait = isPortrait();

let asciiLines = ['LOADING...'];
let asciiImg = null;   // PNG mode — loaded if ascii-art.png exists
let fontReady = false;

// Pre-composited PNG cache — rebuilt once on first draw and on every resize.
// Stores the amber-tinted image at the exact box dimensions so each frame
// is a single fast blit (zero PNG decode, zero compositing per frame).
const asciiCache = { canvas: null, w: -1, h: -1 };

// Hidden <video> element — drawn each frame as the main panel background
const bgVideo = document.getElementById('bg-video');


// Gradient cache — rebuilt on resize, reused every frame (createRadialGradient is expensive)
const _gradCache = { W: -1, H: -1, ambient: null, vig: null };
function _rebuildGradients(ctx, W, H) {
  const BEZ = W * 0.016;
  const sw = W - BEZ * 2, sh = H - BEZ * 2;
  const ambientR = Math.max(W, H) * 0.72;
  const a = ctx.createRadialGradient(W / 2, H / 2, sw * 0.2, W / 2, H / 2, ambientR);
  a.addColorStop(0.0, 'rgba(0,0,0,0)');
  a.addColorStop(0.62, 'rgba(0,0,0,0)');
  a.addColorStop(0.78, `rgba(${Math.floor(THEME.r * 0.8)},${Math.floor(THEME.g * 0.8)},${Math.floor(THEME.b * 0.8)},0.07)`);
  a.addColorStop(0.90, `rgba(${Math.floor(THEME.r * 0.6)},${Math.floor(THEME.g * 0.6)},${Math.floor(THEME.b * 0.6)},0.13)`);
  a.addColorStop(1.0, `rgba(${Math.floor(THEME.r * 0.4)},${Math.floor(THEME.g * 0.4)},${Math.floor(THEME.b * 0.4)},0.18)`);
  const v = ctx.createRadialGradient(W / 2, H / 2, sh * 0.2, W / 2, H / 2, sh * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  v.addColorStop(1, 'rgba(0,0,0,0.85)');
  _gradCache.ambient = a; _gradCache.vig = v;
  _gradCache.W = W; _gradCache.H = H;
}

let menuHitAreas = [];          // [{x,y,w,h,i}] — updated each draw
let hoveredItem = -1;          // index of currently hovered item
const clickFlash = {};          // index → flash intensity 0–1 (GSAP drives this)
const hoverState = {};          // index → highlight intensity 0–1 (GSAP-animated)

// ── Page system ───────────────────────────────────────────────────
// Active in-screen page: replaces the ASCII art panel while sidebar/footer stay
let activePage = null;  // null | 'letterboxd' | 'socials' | 'twitter-error' | 'library' | 'doom'
let pageEnterTime = 0;     // performance.now() when page opened
let pageHitAreas = []; // [{x,y,w,h,id,url}] — cleared on page open
let globalHitAreas = []; // [{x,y,w,h,id}] — always active hit objects
let globalHoverId = null; // currently hovered global area id
let subHoverId = null;  // currently hovered sub-link id
const subHoverState = {};  // id → 0–1 (GSAP animated)

// Letterboxd scroll state
let lbScrollY = 0;  // current scroll offset in canvas pixels
let lbScrollMax = 0;  // max scroll, computed during draw

// Menu scroll state
let menuScrollY = 0;
let menuScrollMax = 0;

// ── Doom state ─────────────────────────────────────────────────────────────
const DOOM_W = 640;
const DOOM_H = 400;
let doomCanvas = null;   // offscreen canvas doom renders into each frame
let doomCtx = null;   // 2D context for doomCanvas
let doomReady = false;  // true once WASM game loop is running
let doomLoading = false;  // true while WASM is initialising
let doomError = null;   // string if init failed, null otherwise
let doomReadyTime = 0;      // performance.now() timestamp when WASM finished starting

// ── Music / Last.fm state ──────────────────────────────────────────────────
const LASTFM_KEY = '0516e4e3bbe03d3dd814d45fc654d0f2';
const LASTFM_USER = 'keznotkez';
const LASTFM_POLL = 30_000; // ms between polls

let musicNow = null;      // { name, artist, album, imageUrl, duration }
let musicRecent = [];        // last 4 scrobbles excluding now-playing
let musicLastFetch = -999_999; // forces immediate fetch on first open
let musicFetching = false;
let musicError = null;
let musicImgURL = null;      // URL of the currently-loaded art
let musicPixelCanvas = null;      // offscreen 32×32 pixelated art canvas
let musicTrackStart = 0;         // performance.now() when current track was first detected
let musicLastTrack = null;      // 'name||artist' — change detection

async function fetchMusicData() {
  if (musicFetching) return;
  musicFetching = true;
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${LASTFM_USER}&api_key=${LASTFM_KEY}&format=json&limit=20`;
    const res = await fetch(url);
    const json = await res.json();
    const tracks = json.recenttracks?.track;
    if (!Array.isArray(tracks) || !tracks.length) {
      musicError = 'NO TRACKS FOUND'; musicFetching = false; musicLastFetch = performance.now(); return;
    }

    const first = tracks[0];
    const isPlaying = first?.['@attr']?.nowplaying === 'true';

    if (isPlaying) {
      const tid = `${first.name}||${first.artist['#text']}`;
      if (tid !== musicLastTrack) { musicTrackStart = performance.now(); musicLastTrack = tid; }

      const imgUrl = (first.image || []).find(i => i.size === 'large')?.['#text'] || '';
      // Last.fm returns a grey placeholder when no art exists — skip it
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
          const pc = document.createElement('canvas');
          pc.width = 64; pc.height = 64;   // 64×64 — crisp at large display sizes
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

    const skip = isPlaying ? 1 : 0;
    musicRecent = tracks.slice(skip, skip + 12).map(t => ({
      name: t.name, artist: t.artist['#text'],
      ts: t.date?.['#text'] || '--',
      url: t.url || '',
    }));
    musicError = null;
  } catch (e) {
    musicError = 'LAST.FM UNREACHABLE';
    console.warn('[music]', e);
  }
  musicFetching = false; musicLastFetch = performance.now();
}

// Animated equalizer bars — purely decorative, driven by offset sine waves
function drawEqualizer(ctx, x, y, w, h, t) {
  const N = 14;
  const freq = [2.1, 3.4, 1.8, 2.7, 4.1, 1.5, 3.2, 2.9, 1.4, 3.7, 2.3, 4.5, 1.9, 3.1];
  const phs = [0.0, 0.5, 1.1, 0.2, 0.8, 1.4, 0.3, 0.9, 0.6, 1.2, 0.1, 0.7, 1.3, 0.4];
  const gap = w * 0.04;
  const bw = (w - gap * (N - 1)) / N;
  ctx.save();
  for (let i = 0; i < N; i++) {
    const raw = Math.pow(Math.sin(t * freq[i] + phs[i]) * 0.5 + 0.5, 1.3);
    const barH = h * (0.12 + 0.88 * raw);
    const bx = x + i * (bw + gap);
    const al = 0.35 + 0.65 * raw;
    ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},${al})`;
    ctx.shadowBlur = 5 + 9 * raw;
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${al})`;
    ctx.fillRect(Math.round(bx), Math.round(y + h - barH), Math.max(1, Math.ceil(bw)), Math.ceil(barH));
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

async function initDoom() {
  if (doomLoading || doomReady) return;
  doomLoading = true;

  // Offscreen canvas — doom renders here; we blit it each frame
  doomCanvas = document.createElement('canvas');
  doomCanvas.width = DOOM_W;
  doomCanvas.height = DOOM_H;
  doomCtx = doomCanvas.getContext('2d');

  try {
    const { DOOM } = await import('wasm-doom');
    const kbTarget = document.getElementById('doom-kb');
    const game = new DOOM({
      screenWidth: DOOM_W,
      screenHeight: DOOM_H,
      // Use local file served by Vite — avoids CDN latency, CORS, and COEP issues
      wasmURL: '/doom.wasm',
      keyboardTarget: kbTarget,
      enableLogs: true,   // prints DOOM stdout to browser console
      onFrameRender: ({ screen }) => {
        const frame = new ImageData(screen, DOOM_W, DOOM_H);
        doomCtx.putImageData(frame, 0, 0);
      },
    });
    await game.start();
    doomReady = true;
    doomReadyTime = performance.now();
    doomLoading = false;
    // Doom takes several seconds to load — the initial focus call in openPage
    // fires long before we get here. Refocus now so keys work immediately.
    const kb = document.getElementById('doom-kb');
    if (kb && activePage === 'doom') kb.focus({ preventScroll: true });
  } catch (err) {
    console.error('[DOOM] init failed:', err);
    doomLoading = false;
    doomError = String(err);
  }
}


// Battery System State
let sysBattery = { level: 1.0, charging: false };
if (navigator.getBattery) {
  navigator.getBattery().then(bat => {
    sysBattery.level = bat.level;
    sysBattery.charging = bat.charging;
    bat.addEventListener('levelchange', () => sysBattery.level = bat.level);
    bat.addEventListener('chargingchange', () => sysBattery.charging = bat.charging);
  });
}

function openPage(name) {
  activePage = name;
  pageEnterTime = performance.now();
  pageHitAreas = [];
  subHoverId = null;
  lbScrollY = 0;
  Object.keys(subHoverState).forEach(k => { subHoverState[k] = 0; });

  if (name === 'music') {
    musicLastFetch = -999_999;
    fetchMusicData(); // immediate fetch on open
    _musicPollTimer = setInterval(fetchMusicData, LASTFM_POLL);
  }
  if (name === 'letterboxd') {
    loadLbPosters(); // kick off poster image loads if not already cached
  }
  if (name === 'doom') {
    initDoom(); // lazy — no-op if already loaded
    // Give the browser one tick to settle before focusing
    requestAnimationFrame(() => {
      const kb = document.getElementById('doom-kb');
      if (kb) kb.focus({ preventScroll: true });
    });
  }
}
function closePage() {
  activePage = null;
  pageHitAreas = [];
  subHoverId = null;
  // Stop music polling when leaving the music page
  if (_musicPollTimer) { clearInterval(_musicPollTimer); _musicPollTimer = null; }
  // Release keyboard from doom-kb so doom stops receiving input
  const kb = document.getElementById('doom-kb');
  if (kb) kb.blur();
}

// Links
const MENU_LINKS = {
  0: { type: 'external', url: 'https://alkeshjames.vercel.app' },
  1: { type: 'page', page: 'library' },
  2: { type: 'page', page: 'letterboxd' },
  3: { type: 'page', page: 'discord' },
  4: { type: 'page', page: 'music' },
  5: null,
  6: { type: 'page', page: 'socials' },
  7: null,
  8: { type: 'page', page: 'doom' },
};

// Letterboxd data — real posters via TMDB image CDN
const LB_USER = 'alkeshjames';
const LB_FILMS = [
  { title: 'Project Hail Mary', dir: 'Lord & Miller', year: '2026', rating: '★★★★★', color: '#1a3a5c', poster: 'https://image.tmdb.org/t/p/w342/yihdXomYb5kTeSivtFndMy5iDmf.jpg' },
  { title: 'One Battle After Another', dir: 'Paul Thomas Anderson', year: '2025', rating: '★★★★½', color: '#2a1a0a', poster: 'https://image.tmdb.org/t/p/w342/lbBWwxBht4JFP5PsuJ5onpMqugW.jpg' },
  { title: 'Sinners', dir: 'Ryan Coogler', year: '2025', rating: '★★★★½', color: '#3a0808', poster: 'https://image.tmdb.org/t/p/w342/705nQHqe4JGdEisrQmVYmXyjs1U.jpg' },
  { title: 'Anora', dir: 'Sean Baker', year: '2024', rating: '★★★★', color: '#1a2a3a', poster: 'https://image.tmdb.org/t/p/w342/oN0o3owobFjePDc5vMdLRAd0jkd.jpg' },
  { title: 'The Brutalist', dir: 'Brady Corbet', year: '2024', rating: '★★★★', color: '#2a2a1a', poster: 'https://image.tmdb.org/t/p/w342/vP7Yd6couiAaw9jgMd5cjMRj3hQ.jpg' },
];

// Poster image cache — loaded once, drawn every frame
const lbPosterCache = {}; // index → HTMLImageElement (loaded) | 'loading' | 'error'

function loadLbPosters() {
  LB_FILMS.forEach((film, i) => {
    if (lbPosterCache[i]) return; // already loading or loaded
    lbPosterCache[i] = 'loading';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { lbPosterCache[i] = img; };
    img.onerror = () => { lbPosterCache[i] = 'error'; };
    img.src = film.poster;
  });
}

// Socials data
const SOCIALS = [
  { id: 'instagram', label: '@INSTAGRAM', handle: 'alkexh', url: 'https://instagram.com/alkexh' },
  { id: 'linkedin', label: '@LINKEDIN', handle: 'alkeshjames', url: 'https://linkedin.com/in/alkeshjames' },
  { id: 'twitter', label: '@TWITTER', handle: '___', url: null },
];

// ─── Entry point ─────────────────────────────────────────────────────────────

async function boot() {
  // 1. Boot — video is the primary panel renderer; no PNG/TXT asset needed
  //    (asciiImg / asciiLines kept as fallback in case bgVideo is unavailable)
  if (!bgVideo || bgVideo.error) {
    // Only load text fallback if video element is broken
    try {
      const r = await fetch('/ascii-art.txt');
      const t = await r.text();
      asciiLines = t.split('\n');
    } catch {
      asciiLines = ['NO SIGNAL', 'DATA STREAM ERROR'];
    }
  }


  // 2. Wait for VT323 to be available (FontFace API)
  try {
    await document.fonts.load('20px VT323');
    fontReady = true;
  } catch {
    fontReady = true; // fall back – draw anyway
  }

  // 3a. Start the background video (muted → no autoplay restriction in any browser)
  if (bgVideo) {
    bgVideo.play().catch(() => {
      // Some browsers still block until first interaction — retry on click
      document.addEventListener('click', () => bgVideo.play(), { once: true });
    });
  }

  // 3. Set up canvas & WebGL
  const canvas = document.getElementById('c');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    // --vh: mobile browsers lie about 100vh (address bar eats height)
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  };
  resize();
  window.addEventListener('resize', () => {
    resize();
    asciiCache.w = -1; // invalidate PNG cache on resize
  });

  // Offscreen 2D canvas for painting the terminal UI
  const off = document.createElement('canvas');
  const ctx = off.getContext('2d');

  // ── Phosphor persistence buffer (effect 5) ──────────────────────────────
  // Old frame lingers for a few frames before decaying, like real phosphor.
  const persist = document.createElement('canvas');
  const pctx = persist.getContext('2d');

  // ─── WebGL ──────────────────────────────────────────────────────────────

  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
    || canvas.getContext('experimental-webgl', { alpha: false, antialias: false });

  if (!gl) {
    // Graceful degradation: just draw the 2D canvas directly
    const visCtx = canvas.getContext('2d');
    const loop = () => {
      off.width = canvas.width; off.height = canvas.height;
      drawTerminal(ctx, off.width, off.height);
      visCtx.drawImage(off, 0, 0);
      requestAnimationFrame(loop);
    };
    loop();
    return;
  }

  const prog = buildProgram(gl, VERT, FRAG);
  gl.useProgram(prog);

  // Full-screen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Texture
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_res');
  gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);

  const t0 = performance.now();

  // ─── Render loop ──────────────────────────────────────────────────────────
  function loop() {
    const W = canvas.width, H = canvas.height;

    // Sync both offscreen canvases
    if (off.width !== W || off.height !== H) {
      off.width = W; off.height = H;
      persist.width = W; persist.height = H;
    }

    // ── Scroll momentum / inertia decay (touch) ────────────────────────────
    if (_scrollVel !== 0) {
      if (_scrollTarget === 'sidebar') {
        menuScrollY = Math.max(0, Math.min(menuScrollMax, menuScrollY + _scrollVel));
      } else {
        lbScrollY = Math.max(0, Math.min(lbScrollMax, lbScrollY + _scrollVel));
      }
      _scrollVel *= 0.88;
      if (Math.abs(_scrollVel) < 0.5) _scrollVel = 0;
    }

    // ── Orientation transition: clear persistence buffer when rotating ────────
    const _portrait = isPortrait();
    if (_portrait !== _lastPortrait) {
      _lastPortrait = _portrait;
      pctx.clearRect(0, 0, W, H); // wipe ghost of previous orientation
    }

    // 1. Draw fresh terminal UI to `off` (or gate screen if portrait)
    if (_portrait) {
      drawOrientationGate(ctx, W, H, (performance.now() - t0) / 1000);
    } else {
      drawTerminal(ctx, W, H);
    }

    // 2. Phosphor persistence: decay persist canvas, then stamp new frame
    //    Overlay black at 18% opacity → previous frame fades over ~6 frames
    pctx.globalCompositeOperation = 'source-over';
    pctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    pctx.fillRect(0, 0, W, H);
    //    Stamp the freshly drawn frame on top at full opacity
    pctx.drawImage(off, 0, 0);

    // 3. Upload the accumulated persistence buffer as the WebGL texture
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, persist);

    // 4. Draw warped quad
    const t = (performance.now() - t0) / 1000;
    gl.viewport(0, 0, W, H);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uRes, W, H);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ── Interaction ───────────────────────────────────────────────────────────

  // Convert CSS pixel position → physical 2D canvas pixel.
  //
  // The GLSL barrel maps: screen UV → source UV (where it samples in the texture).
  // So we apply the barrel FORWARD to find what canvas pixel maps to a CSS click:
  //   CSS → screen UV (flip Y) → barrel forward → source UV → canvas pixel (flip Y back)
  function cssToCanvas(cssX, cssY) {
    const CURVE = 0.06;

    // CSS → screen UV [0,1] (Y flipped: CSS top=0, WebGL v top=1)
    const u_s = cssX / window.innerWidth;
    const v_s = 1.0 - cssY / window.innerHeight;

    // Screen UV centered [-1,1]
    const u_sc = u_s * 2.0 - 1.0;
    const v_sc = v_s * 2.0 - 1.0;

    // Forward barrel (matches GLSL exactly: src = screen * (1 + CURVE * r²))
    const r2 = u_sc * u_sc + v_sc * v_sc;
    const factor = 1.0 + CURVE * r2;
    const u_src_c = u_sc * factor;
    const v_src_c = v_sc * factor;

    // Source UV [0,1]
    const u_src = u_src_c * 0.5 + 0.5;
    const v_src = v_src_c * 0.5 + 0.5;

    // Source UV → canvas pixels (v=1 → canvas top y=0, v=0 → canvas bottom y=H)
    return {
      x: u_src * canvas.width,
      y: (1.0 - v_src) * canvas.height,
    };
  }

  // Fire GSAP flash + open page or external link
  function onItemClick(i) {
    if (!CLICKABLE.has(i)) return;
    clickFlash[i] = 1;
    gsap.to(clickFlash, { [i]: 0, duration: 0.55, ease: 'power2.out' });
    const action = MENU_LINKS[i];
    if (!action) return;
    if (action.type === 'external') window.open(action.url, '_blank');
    else if (action.type === 'page') openPage(action.page);
  }

  // ESC key — close active page.
  // Use CAPTURE phase so we intercept before wasm-doom's own keydown handler.
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activePage) {
      e.stopPropagation(); // doom-kb never sees this ESC
      closePage();
    }
  }, true);

  // Wheel — scroll lists dependent on cursor/page
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const { x } = cssToCanvas(e.clientX, e.clientY);

    // If hovering sidebar, scroll sidebar
    if (x < canvas.width * 0.30) {
      menuScrollY = Math.max(0, Math.min(menuScrollMax, menuScrollY + e.deltaY * 0.6));
    } else {
      // Scroll active page
      if (activePage === 'letterboxd' || activePage === 'socials' || activePage === 'twitter-error' || activePage === 'music' || activePage === 'discord') {
        lbScrollY = Math.max(0, Math.min(lbScrollMax, lbScrollY + e.deltaY * 0.6));
      }
    }
  }, { passive: false });

  // Hover SFX setup
  const hoverSfx = new Audio('hover.mp3');
  hoverSfx.volume = 0.6; // Not too loud

  // Mousemove — sub-link hover (in active page) + sidebar hover
  let lastHovered = -1;
  let lastSubHovered = null;
  canvas.addEventListener('mousemove', e => {
    const { x, y } = cssToCanvas(e.clientX, e.clientY);

    // ── Global hover (e.g. theme toggle) ──
    let foundGlobal = null;
    for (const hit of globalHitAreas) {
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
        foundGlobal = hit.id; break;
      }
    }
    if (foundGlobal !== globalHoverId) {
      if (globalHoverId !== null)
        gsap.to(subHoverState, { [globalHoverId]: 0, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
      if (foundGlobal !== null) {
        if (!subHoverState[foundGlobal]) subHoverState[foundGlobal] = 0;
        gsap.to(subHoverState, { [foundGlobal]: 1, duration: 0.10, ease: 'power2.out', overwrite: 'auto' });
        const clip = hoverSfx.cloneNode();
        clip.volume = 0.5;
        clip.play().catch(() => { });
      }
      globalHoverId = foundGlobal;
    }
    if (foundGlobal) {
      canvas.style.cursor = 'pointer';
      return; // intercept
    }

    // ── Sub-link hover when a page is open ──
    if (activePage) {
      let foundSub = null;
      for (const hit of pageHitAreas) {
        if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
          foundSub = hit.id; break;
        }
      }
      if (foundSub !== lastSubHovered) {
        if (lastSubHovered !== null)
          gsap.to(subHoverState, { [lastSubHovered]: 0, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
        if (foundSub !== null) {
          if (!subHoverState[foundSub]) subHoverState[foundSub] = 0;
          gsap.to(subHoverState, { [foundSub]: 1, duration: 0.10, ease: 'power2.out', overwrite: 'auto' });
          const clip = hoverSfx.cloneNode();
          clip.volume = 0.5;
          clip.play().catch(() => { });
        }
        lastSubHovered = foundSub;
        subHoverId = foundSub;
        canvas.style.cursor = foundSub ? 'pointer' : 'default';
      }
      return;
    }

    // ── Sidebar hover ──
    let found = -1;
    for (const hit of menuHitAreas) {
      if (x >= hit.x && x <= hit.x + hit.w &&
        y >= hit.y && y <= hit.y + hit.h &&
        CLICKABLE.has(hit.i)) {
        found = hit.i; break;
      }
    }
    if (found !== lastHovered) {
      if (lastHovered !== -1)
        gsap.to(hoverState, { [lastHovered]: 0, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
      if (found !== -1) {
        if (!hoverState[found]) hoverState[found] = 0;
        gsap.to(hoverState, { [found]: 1, duration: 0.10, ease: 'power2.out', overwrite: 'auto' });
        const clip = hoverSfx.cloneNode();
        clip.volume = 0.5;
        clip.play().catch(() => { });
      }
      lastHovered = found;
      hoveredItem = found;
      canvas.style.cursor = found !== -1 ? 'pointer' : 'default';
    }
  });

  // Click — page sub-links first, then sidebar
  canvas.addEventListener('click', e => {
    const { x, y } = cssToCanvas(e.clientX, e.clientY);
    
    // ── Global click (e.g. theme toggle) ──
    for (const hit of globalHitAreas) {
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
        handleGlobalClick(hit.id);
        return; // intercept
      }
    }

    if (activePage) {
      // ── Doom: every click re-focuses the keyboard target ──
      // Without this, clicking the canvas steals focus from doom-kb
      // and keys stop reaching the WASM engine.
      if (activePage === 'doom') {
        const kb = document.getElementById('doom-kb');
        if (kb) kb.focus({ preventScroll: true });
        return;
      }
      for (const hit of pageHitAreas) {
        if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
          // Music art / recent track links open Last.fm directly
          if (hit.url) { window.open(hit.url, '_blank', 'noopener'); return; }
          handleSubClick(hit.id); return;
        }
      }
      return;
    }
    for (const hit of menuHitAreas) {
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
        onItemClick(hit.i); return;
      }
    }
  });

  // ── Touch Controls (mobile) ───────────────────────────────────────────────
  // All desktop mouse/keyboard handlers above are untouched — touch is additive.
  if (isTouchDevice) {
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      _scrollVel = 0;
      _touchStartX = e.touches[0].clientX;
      _touchStartY = e.touches[0].clientY;
      _touchLastY = _touchStartY;
      _touchLastTime = performance.now();

      const { x: tx, y: ty } = cssToCanvas(_touchStartX, _touchStartY);
      _scrollTarget = tx < canvas.width * 0.30 ? 'sidebar' : 'page';

      // Portrait gate: no interactive elements; just absorb the touch
      if (isPortrait()) return;

      // ── Active page sub-links ──
      if (activePage) {
        if (activePage === 'doom') {
          const kb = document.getElementById('doom-kb');
          if (kb) kb.focus({ preventScroll: true });
          return;
        }
        for (const hit of pageHitAreas) {
          if (tx >= hit.x && tx <= hit.x + hit.w && ty >= hit.y && ty <= hit.y + hit.h) {
            if (hit.url) { window.open(hit.url, '_blank', 'noopener'); return; }
            // Flash highlight → fire action after a brief visible delay
            if (subHoverState[hit.id] === undefined) subHoverState[hit.id] = 0;
            gsap.to(subHoverState, { [hit.id]: 1, duration: 0.07, overwrite: 'auto' });
            setTimeout(() => {
              gsap.to(subHoverState, { [hit.id]: 0, duration: 0.35, overwrite: 'auto' });
              handleSubClick(hit.id);
            }, 85);
            return;
          }
        }
        return;
      }

      // ── Sidebar menu items ──
      for (const hit of menuHitAreas) {
        if (tx >= hit.x && tx <= hit.x + hit.w && ty >= hit.y && ty <= hit.y + hit.h && CLICKABLE.has(hit.i)) {
          clickFlash[hit.i] = 1;
          gsap.to(clickFlash, { [hit.i]: 0, duration: 0.55, ease: 'power2.out' });
          setTimeout(() => onItemClick(hit.i), 50);
          return;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const now = performance.now();
      const dy = _touchLastY - e.touches[0].clientY; // positive = scroll down
      const dt = Math.max(1, now - _touchLastTime);
      _scrollVel = dy / dt * 16; // scale to px/frame at 60fps
      _touchLastY = e.touches[0].clientY;
      _touchLastTime = now;

      if (_scrollTarget === 'sidebar') {
        menuScrollY = Math.max(0, Math.min(menuScrollMax, menuScrollY + dy * 1.2));
      } else if (activePage) {
        lbScrollY = Math.max(0, Math.min(lbScrollMax, lbScrollY + dy * 1.2));
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - _touchStartX;
      const dy = Math.abs(e.changedTouches[0].clientY - _touchStartY);
      // Swipe right → go back (close active page) — natural iOS gesture
      if (dx > 60 && dy < 40 && activePage && activePage !== 'doom') {
        closePage();
        _scrollVel = 0;
      }
      // Clamp scroll to valid range on release
      menuScrollY = Math.max(0, Math.min(menuScrollMax, menuScrollY));
      lbScrollY = Math.max(0, Math.min(lbScrollMax, lbScrollY));
    }, { passive: true });
  }

  // Sub-link dispatcher
  function handleSubClick(id) {
    if (id === 'back') { closePage(); return; }
    if (id === 'instagram') { window.open('https://instagram.com/alkexh', '_blank'); return; }
    if (id === 'linkedin') { window.open('https://linkedin.com/in/alkeshjames', '_blank'); return; }
    if (id === 'twitter') { openPage('twitter-error'); return; }
    if (id === 'lb_link') { window.open('https://letterboxd.com/psfo', '_blank'); return; }
    if (id === 'discord-link') { window.open('https://discord.com/users/1426930274213822595', '_blank', 'noopener'); return; }
  }
}

// ─── Orientation Gate ────────────────────────────────────────────────────────
// Shown on mobile when device is in portrait — the terminal requires landscape.
// Runs through the same WebGL pipeline so it gets full CRT effects.
function drawOrientationGate(ctx, W, H, t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const BEZ = W * 0.016;
  const sw = W - BEZ * 2, sh = H - BEZ * 2;
  const r = Math.min(sw, sh) * 0.035;
  ctx.fillStyle = BEZEL;
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, BEZ, BEZ, sw, sh, r);
  ctx.fillStyle = BG;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // ── Spinning ↻ glyph ────────────────────────────────────────────────────
  const spinX = sw * 0.5 + BEZ;
  const spinY = sh * 0.36 + BEZ;
  const spinR = Math.min(sw, sh) * 0.15;
  ctx.save();
  ctx.translate(spinX, spinY);
  ctx.rotate(t * 1.5);
  ctx.font = `${spinR * 1.9}px VT323`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = AMBER_GLOW;
  ctx.shadowBlur = 36;
  ctx.fillStyle = AMBER;
  ctx.fillText('\u21BB', 0, 0);
  ctx.shadowBlur = 12;
  ctx.fillText('\u21BB', 0, 0);
  ctx.restore();

  // ── Error lines ──────────────────────────────────────────────────────────
  const fs = Math.min(sh / 11, sw / 20);
  const lh = fs * 1.58;
  const cx = sw * 0.06 + BEZ;
  let cy = sh * 0.06 + BEZ;
  const G = 155; // chars/sec typewriter speed for gate

  function gReveal(text, start) {
    const el = t - start;
    if (el <= 0) return '';
    return text.slice(0, Math.floor(el * G));
  }

  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const entries = [
    { text: 'ERROR_431 : DISPLAY ORIENTATION', col: '#ff6b6b', blur: 20, start: 0.10 },
    { text: '', col: AMBER, blur: 0, start: 0 },
    { text: 'EXPECTED  : LANDSCAPE MODE', col: AMBER_DIM, blur: 8, start: 0.55 },
    { text: 'DETECTED  : PORTRAIT MODE', col: '#ff8888', blur: 14, start: 0.88 },
    { text: '', col: AMBER, blur: 0, start: 0 },
    { text: '>> REORIENTING DISPLAY . . . FAILED', col: '#ff8888', blur: 10, start: 1.25 },
    { text: '>> ADJUSTING RASTER SCAN . . . FAILED', col: '#ff8888', blur: 10, start: 1.80 },
    { text: '', col: AMBER, blur: 0, start: 0 },
    { text: '[ ROTATE DEVICE TO CONTINUE ]', col: AMBER, blur: 24, start: 2.35 },
  ];

  entries.forEach(({ text, col, blur, start }) => {
    if (!text) { cy += lh * 0.52; return; }
    const shown = gReveal(text, start);
    if (!shown) { cy += lh; return; }
    ctx.shadowColor = col;
    ctx.shadowBlur = blur;
    ctx.fillStyle = col;
    ctx.fillText(shown, cx, cy);
    ctx.shadowBlur = Math.round(blur * 0.42);
    ctx.fillText(shown, cx, cy);
    cy += lh;
  });

  ctx.restore();
}

// ─── 2D Terminal Painter ─────────────────────────────────────────────────────

function drawTerminal(ctx, W, H) {
  // Clear
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // ── Outer bezel (thin dark ring) ─────────────────────────────────────────
  const BEZ = W * 0.016;
  ctx.fillStyle = BEZEL;
  ctx.fillRect(0, 0, W, H);

  // ── Ambient room glow ──────────────────────────────────────────────────────
  const sx = BEZ, sy = BEZ, sw = W - BEZ * 2, sh = H - BEZ * 2;
  if (_gradCache.W !== W || _gradCache.H !== H) _rebuildGradients(ctx, W, H);
  ctx.fillStyle = _gradCache.ambient;
  ctx.fillRect(0, 0, W, H);
  const r = Math.min(sw, sh) * 0.035;

  roundRect(ctx, sx, sy, sw, sh, r);
  ctx.fillStyle = BG;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Ambient vignette
  ctx.fillStyle = _gradCache.vig;
  ctx.fillRect(sx, sy, sw, sh);


  // ── Layout constants ─────────────────────────────────────────────────────
  const PAD_X = sw * 0.05;
  const PAD_Y = sh * 0.045;
  const inner_x = sx + PAD_X;
  const inner_y = sy + PAD_Y;
  const inner_w = sw - PAD_X * 2;
  const inner_h = sh - PAD_Y * 2;

  const SIDE_W = inner_w * 0.24;          // always proportional, no px cap
  const MENU_FS = inner_h / 15;            // scale with screen, no px cap
  const FOOT_H = sh * 0.10;

  const ascii_x = inner_x + SIDE_W + inner_w * 0.03;
  const ascii_w = inner_w - SIDE_W - inner_w * 0.03;
  const ascii_h = inner_h - FOOT_H - inner_h * 0.02;

  // ── Sidebar ──────────────────────────────────────────────────────────────
  drawSidebar(ctx, inner_x, inner_y, SIDE_W, inner_h - FOOT_H, MENU_FS);

  // ── ASCII art ─────────────────────────────────────────────────────────────
  drawAscii(ctx, ascii_x, inner_y, ascii_w, ascii_h);

  // ── Status footer ─────────────────────────────────────────────────────────
  drawFooter(ctx, inner_x, inner_y + inner_h - FOOT_H, inner_w, FOOT_H, MENU_FS);

  ctx.restore(); // end screen clip
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

const MENU = [
  ['[♦]', '@portfolio'],   // diamond        — home / portfolio
  ['[≡]', '@library'],    // triple bar     — bookshelf
  ['[◉]', '@letterboxd'], // bullseye       — film lens / reticle
  ['[#]', '@discord'],    // hash           — Discord identity
  ['[♫]', '@music'],      // music note     — now playing
  ['[▩]', '@images'],     // mosaic square  — image gallery
  ['[⊕]', '@socials'],    // circled plus   — social graph
  ['[§]', '@diary'],      // section mark   — journal / prose
  ['[►]', '@doom'],       // play arrow     — run the game
];


// All items are clickable
const CLICKABLE = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);

function drawSidebar(ctx, x, y, w, h, fs) {
  // ── Highlight bar ──
  const boxH = fs * 1.6;
  ctx.fillStyle = AMBER;
  ctx.fillRect(x, y, w * 0.9, boxH);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0d0800';
  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('@kez', x + 8, y + boxH / 2);

  // ── Menu list ──
  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // Reference screenshot: items packed tight at a consistent line-height,
  // NOT stretched to fill the full sidebar height.
  const lineH = fs * 1.38;           // ~1.38× font size matches reference density
  const topPad = fs * 0.9;            // small gap between header bar and first item
  const PAD = w * 0.1;

  const listStartY = y + boxH + topPad;
  const listH = h - (listStartY - y);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - PAD, listStartY, w + PAD * 2, listH);
  ctx.clip();

  const newHits = [];

  MENU.forEach(([key, label], i) => {
    const ly = listStartY + i * lineH - menuScrollY;

    // Skip render completely if way off-screen
    if (ly + lineH < listStartY || ly > listStartY + listH) {
      // We still map hits if we want, or we just rely on clip. 
      // Actually, hit areas need to map correctly. If it's outside the clip, it shouldn't be hittable.
      return;
    }

    const hs = hoverState[i] || 0;   // 0→1 animated by GSAP
    const flash = clickFlash[i] || 0;  // 0→1 click pulse

    // ── Full amber highlight bar ──
    if (hs > 0) {
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b}, ${hs})`;
      // Full sidebar width so the bar always covers the longest label
      ctx.fillRect(x, ly - lineH * 0.12, w, lineH * 0.95);
    }

    // ── Text color: dark on hover, amber at rest, white flash on click ──
    let textCol;
    if (flash > 0) {
      // click flash: white burst decaying back to rest
      const f = flash;
      const rr = Math.round(THEME.r + (255 - THEME.r) * f);
      const gg = Math.round(THEME.g + (255 - THEME.g) * f);
      const bb = Math.round(THEME.b + (255 - THEME.b) * f);
      textCol = `rgb(${rr},${gg},${bb})`;
    } else {
      // lerp amber → dark as hs goes 0→1
      const rr = Math.round(THEME.r - (THEME.r - 13) * hs);
      const gg = Math.round(THEME.g - (THEME.g - 8) * hs);
      const bb = Math.round(THEME.b - THEME.b * hs);
      textCol = `rgb(${rr},${gg},${bb})`;
    }

    ctx.fillStyle = textCol;

    // ── Glow: strong amber glow at rest, none on full hover ──
    const glowStr = flash > 0 ? 'rgba(255,255,200,1.0)' : AMBER_GLOW;
    const blur1 = flash > 0 ? 30 : Math.round(22 * (1 - hs));
    const blur2 = flash > 0 ? 12 : Math.round(8 * (1 - hs));

    ctx.shadowColor = glowStr;
    ctx.shadowBlur = blur1;
    ctx.fillText(key, x + 6, ly);
    ctx.fillText(label, x + w * 0.38, ly);
    ctx.shadowBlur = blur2;
    ctx.fillText(key, x + 6, ly);
    ctx.fillText(label, x + w * 0.38, ly);

    // Record hit area
    newHits.push({ x, y: ly - lineH * 0.2, w, h: lineH, i });
  });

  menuScrollMax = Math.max(0, MENU.length * lineH - listH);

  ctx.restore();

  // Scrollbar indicator for sidebar
  if (menuScrollMax > 0) {
    const barX = x + w + PAD * 0.5; // Placed clearly to the right edge of the text bounds
    const barY = listStartY;
    const thumbH = Math.max(10, (listH / (MENU.length * lineH)) * listH);
    const thumbY = barY + (menuScrollY / menuScrollMax) * (listH - thumbH);

    // Only drawing the tracking pill so it matches the aesthetic
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
    ctx.fillRect(barX, thumbY, 4, thumbH);
  }

  // Atomic update of hit areas
  menuHitAreas = newHits;
}

// \u2500\u2500 Main panel renderer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function drawAscii(ctx, x, y, w, h) {
  ctx.save();

  // Active page replaces the main panel
  if (activePage) {
    const elapsed = (performance.now() - pageEnterTime) / 1000;
    drawPage(ctx, x, y, w, h, elapsed);
    ctx.restore();
    return;
  }

  // Box border
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b}, 0.3)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Clip so nothing bleeds outside the panel
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // \u2500\u2500 Video mode (primary) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (bgVideo && bgVideo.readyState >= 2) {
    const vW = bgVideo.videoWidth;
    const vH = bgVideo.videoHeight;

    // Cover-fit: fill the panel, crop symmetrically
    const vAspect = vW / vH;
    const bAspect = w / h;
    let sx, sy, sw, sh;
    if (vAspect > bAspect) {
      sh = vH; sw = vH * bAspect;
      sx = (vW - sw) * 0.5; sy = 0;
    } else {
      sw = vW; sh = vW / bAspect;
      sx = 0; sy = (vH - sh) * 0.5;
    }

    // Black base so multiply composite has something to work against
    ctx.fillStyle = BG;
    ctx.fillRect(x, y, w, h);

    // Draw video frame + amber phosphor tint (composite always reset via finally)
    ctx.globalAlpha = 0.95;
    ctx.drawImage(bgVideo, sx, sy, sw, sh, x, y, w, h);
    ctx.globalAlpha = 1.0;
    try {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(244, 176, 40, 1.0)';
      ctx.fillRect(x, y, w, h);
    } finally {
      ctx.globalCompositeOperation = 'source-over';
    }
    // (glow pass removed — WebGL shader provides global phosphor glow already)


    // \u2500\u2500 PNG fallback \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  } else if (asciiImg) {
    if (asciiCache.w !== w || asciiCache.h !== h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cc = c.getContext('2d');
      cc.fillStyle = BG; cc.fillRect(0, 0, w, h);
      const iW = asciiImg.naturalWidth; const iH = asciiImg.naturalHeight;
      const imgAspect = iW / iH; const boxAspect = w / h;
      let srcX, srcY, srcW, srcH;
      if (imgAspect > boxAspect) { srcH = iH; srcW = iH * boxAspect; srcX = (iW - srcW) * 0.5; srcY = 0; }
      else { srcW = iW; srcH = iW / boxAspect; srcX = 0; srcY = (iH - srcH) * 0.5; }
      cc.globalAlpha = 0.92;
      cc.drawImage(asciiImg, srcX, srcY, srcW, srcH, 0, 0, w, h);
      cc.globalAlpha = 1.0;
      cc.globalCompositeOperation = 'multiply';
      cc.fillStyle = AMBER; cc.fillRect(0, 0, w, h);
      cc.globalCompositeOperation = 'source-over';
      cc.shadowColor = AMBER_GLOW; cc.shadowBlur = 18; cc.globalAlpha = 0.22;
      cc.drawImage(asciiImg, srcX, srcY, srcW, srcH, 0, 0, w, h);
      cc.globalAlpha = 1.0; cc.shadowBlur = 0;
      asciiCache.canvas = c; asciiCache.w = w; asciiCache.h = h;
    }
    ctx.drawImage(asciiCache.canvas, x, y);

    // \u2500\u2500 Text fallback \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  } else {
    let start = 0, end = asciiLines.length - 1;
    while (start < end && asciiLines[start].trim() === '') start++;
    while (end > start && asciiLines[end].trim() === '') end--;
    const lines = asciiLines.slice(start, end + 1);
    const rows = lines.length;
    const cols = Math.max(...lines.map(l => l.length));
    const fs = Math.max(2, Math.min(w / (cols * 0.56), h / rows));
    const artW = cols * fs * 0.56; const artH = rows * fs;
    ctx.translate(x, y); ctx.scale(w / artW, h / artH);
    ctx.font = `${fs}px VT323`; ctx.fillStyle = AMBER;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.shadowColor = AMBER_GLOW; ctx.shadowBlur = 10;
    lines.forEach((line, i) => ctx.fillText(line, 0, i * fs));
    ctx.shadowBlur = 4;
    lines.forEach((line, i) => ctx.fillText(line, 0, i * fs));
  }

  ctx.restore();
}

// ── Status footer ─────────────────────────────────────────────────────────────

function drawFooter(ctx, x, y, w, h, fs) {
  glowText(ctx, fs);
  ctx.font = `${fs}px VT323`;
  ctx.fillStyle = AMBER;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const mid = y + h * 0.3;

  // Progress bar
  const barW = w * 0.22;
  const barH = h * 0.35;
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, mid - barH / 2, barW, barH);
  ctx.fillStyle = AMBER;
  ctx.fillRect(x + 2, mid - barH / 2 + 2, (barW - 4) * 1.0, barH - 4);

  // "100%"
  ctx.fillStyle = AMBER;
  ctx.fillText('100%', x + barW + 14, mid);

  // Battery block (right side)
  const memX = x + w * 0.45;
  const memW = w * 0.52;
  const pct = Math.floor(sysBattery.level * 100);
  const stat = sysBattery.charging ? 'AC POWERED' : 'BATTERY PWR';
  const label = `[ SYS POWER: ${pct}% ─ ${stat} ]`;
  ctx.fillText(label, memX, y + h * 0.1);

  const mBarW = memW;
  const mBarH = h * 0.3;
  const mY = y + h * 0.42;
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1;
  ctx.strokeRect(memX, mY, mBarW, mBarH);
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
  ctx.fillRect(memX + 1, mY + 1, Math.max(0, mBarW * sysBattery.level - 2), mBarH - 2);

  ctx.fillStyle = AMBER;
  ctx.fillText('0%', memX, mY + mBarH + h * 0.12);
  ctx.textAlign = 'right';
  ctx.fillStyle = AMBER;
  ctx.fillText(`${pct}%`, memX + mBarW, mY + mBarH + h * 0.05);
  if (pct < 100) {
    ctx.fillStyle = AMBER_DIM;
    ctx.fillText('100%', memX + mBarW, mY + mBarH + h * 0.22);
  }
  ctx.textAlign = 'left';
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

function glowText(ctx, radius = 22) {
  ctx.shadowColor = AMBER_GLOW;
  ctx.shadowBlur = Math.max(radius, 10);
}

function roundRect(ctx, x, y, w, h, r) {
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

// ─── WebGL helpers ───────────────────────────────────────────────────────────

function buildProgram(gl, vSrc, fSrc) {
  const vs = compile(gl, gl.VERTEX_SHADER, vSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}

// ─── Go ──────────────────────────────────────────────────────────────────────

// ─── Page System ─────────────────────────────────────────────────────────────

const SPEED = 200; // chars/sec for typewriter

function typeReveal(text, elapsed, startAt) {
  const t = elapsed - startAt;
  if (t <= 0) return '';
  return text.slice(0, Math.floor(t * SPEED));
}
function pgGlow(ctx, blur = 18) { ctx.shadowColor = AMBER_GLOW; ctx.shadowBlur = blur; }
function pgGlowOff(ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
function regHit(x, y, w, h, id, url = null) { pageHitAreas.push({ x, y, w, h, id, url }); }

// Animated sub-link with hover highlight
function drawSubLink(ctx, label, x, y, rowW, lineH, id, elapsed, startAt) {
  const shown = typeReveal(label, elapsed, startAt);
  if (!shown) return;
  const hs = subHoverState[id] || 0;
  if (hs > 0) {
    pgGlowOff(ctx);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs})`;
    ctx.fillRect(x - 4, y - lineH * 0.1, rowW + 8, lineH * 0.88);
  }
  const rr = Math.round(THEME.r - (THEME.r - 13) * hs);
  const gg = Math.round(THEME.g - (THEME.g - 8) * hs);
  const bb = Math.round(THEME.b - THEME.b * hs);
  ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
  pgGlow(ctx, Math.round(16 * (1 - hs)));
  ctx.fillText(shown, x, y);
  pgGlowOff(ctx);
  if (shown.length >= label.length) regHit(x - 4, y - lineH * 0.1, rowW + 8, lineH * 0.88, id);
}

// Page router
function drawPage(ctx, x, y, w, h, elapsed) {
  pageHitAreas = [];
  ctx.fillStyle = BG; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.35)`; ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Hard clip — NO page function can ever overflow the panel boundary
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, y + 1, w - 2, h - 2);
  ctx.clip();

  if (activePage === 'letterboxd') drawPageLetterboxd(ctx, x, y, w, h, elapsed);
  else if (activePage === 'socials') drawPageSocials(ctx, x, y, w, h, elapsed);
  else if (activePage === 'twitter-error') drawPageTwitterError(ctx, x, y, w, h, elapsed);
  else if (activePage === 'library') drawPageLibrary(ctx, x, y, w, h, elapsed);
  else if (activePage === 'music') drawPageMusic(ctx, x, y, w, h, elapsed);
  else if (activePage === 'discord') drawPageDiscord(ctx, x, y, w, h, elapsed);
  else if (activePage === 'doom') drawPageDoom(ctx, x, y, w, h, elapsed);

  ctx.restore();
}

// ───── PAGE: DISCORD ─────────────────────────────────────────────────────────
function drawPageDiscord(ctx, x, y, w, h, elapsed) {
  const PAD = w * 0.055;
  const fs = Math.min(h / 24, w / 28);
  const lh = fs * 1.45;
  const cx = x + PAD;
  const contentW = w - PAD * 2;
  let cy = y + PAD * 0.7;

  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';

  // Back
  drawSubLink(ctx, '[ESC] \u2190 BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  // Title
  cy += lh * 1.4;
  const titleFS = fs * 1.7;
  ctx.font = `${titleFS}px VT323`;
  pgGlow(ctx, 26); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('DISCORD', elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 0.95;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
  ctx.fillText(typeReveal('\u2500'.repeat(42), elapsed, 0.10), cx, cy);
  cy += lh * 1.5;

  if (elapsed < 0.22) return;

  // \u2500\u2500 Profile card \u2014 narrow, two-column body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const available = (y + h) - cy - lh * 2.8;    // reserve space for flavour
  const cardW = Math.min(contentW * 0.68, 460);
  const cardX = cx;
  const cardY = cy;

  // Size everything as a fraction of available space
  const bannerH = Math.min(fs * 2.0, available * 0.20);
  const bodyH = Math.min(available * 0.70, available - bannerH);
  const avSize = Math.min(bodyH * 0.80, cardW * 0.28);

  // \u2500\u2500 Banner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Horizontal scan-line pattern fill
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.04)`;
  ctx.fillRect(cardX, cardY, cardW, bannerH);
  for (let sy = cardY + 2; sy < cardY + bannerH; sy += 4) {
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.07)`;
    ctx.fillRect(cardX, sy, cardW, 1.5);
  }
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.4)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(cardX, cardY, cardW, bannerH);

  // Username small in banner top-right (replaces the ugly raw ID)
  ctx.font = `${fs * 0.7}px VT323`;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
  ctx.textAlign = 'right';
  ctx.fillText('@zetiva', cardX + cardW - fs * 0.8, cardY + bannerH * 0.25);
  ctx.textAlign = 'left';

  // \u2500\u2500 Card body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const bodyY = cardY + bannerH;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.035)`;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
  ctx.lineWidth = 1;
  ctx.fillRect(cardX, bodyY, cardW, bodyH);
  ctx.beginPath();
  ctx.moveTo(cardX, bodyY); ctx.lineTo(cardX, bodyY + bodyH);
  ctx.lineTo(cardX + cardW, bodyY + bodyH); ctx.lineTo(cardX + cardW, bodyY);
  ctx.stroke();

  // \u2500\u2500 Avatar column (left) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const avPad = fs * 0.9;
  const avX = cardX + avPad;
  const avY = bodyY + (bodyH - avSize) * 0.5;   // vertically centred

  // Outer glow ring
  ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},0.45)`;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.65)`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(avX, avY, avSize, avSize);
  ctx.shadowBlur = 0;

  // Avatar fill
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.08)`;
  ctx.fillRect(avX + 1, avY + 1, avSize - 2, avSize - 2);

  // Avatar glyph #
  ctx.font = `${avSize * 0.52}px VT323`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  pgGlow(ctx, 22);
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.65)`;
  ctx.fillText('#', avX + avSize / 2, avY + avSize / 2);
  pgGlowOff(ctx);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';

  // Thin vertical divider between columns
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.15)`;
  ctx.fillRect(avX + avSize + avPad * 0.6, bodyY + bodyH * 0.12, 1, bodyH * 0.76);

  // \u2500\u2500 Info column (right of avatar) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const infoX = avX + avSize + avPad * 1.4;
  const infoW = cardX + cardW - infoX - avPad * 0.5;
  // Vertically centre the info block
  const infoBlockH = fs * 1.5 + lh * 1.0 + lh * 0.8 + lh * 1.4;  // name+status+divider+CTA
  let iy = bodyY + (bodyH - infoBlockH) / 2;

  // Username — large
  ctx.font = `${fs * 1.45}px VT323`;
  pgGlow(ctx, 22); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('@zetiva', elapsed, 0.28), infoX, iy);
  pgGlowOff(ctx);
  iy += fs * 1.65;

  // Status line
  ctx.font = `${fs * 0.9}px VT323`;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.45)`;
  ctx.fillText(typeReveal('DISCORD USER', elapsed, 0.34), infoX, iy);
  iy += lh * 1.1;

  // Horizontal rule
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.20)`;
  ctx.fillRect(infoX, iy, Math.min(infoW, fs * 14), 1);
  iy += lh * 0.8;

  // CTA link — inside the card
  const ctaW = infoW;
  drawSubLink(ctx, '\u2197  come say hi', infoX, iy, ctaW, lh * 1.4, 'discord-link', elapsed, 0.40);
  regHit(infoX - 4, iy - 4, ctaW + 8, lh * 1.4 + 8, 'discord-link');

  // \u2500\u2500 Flavour text below card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  cy = bodyY + bodyH + lh * 1.2;
  ctx.font = `${fs}px VT323`;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.30)`;
  ctx.fillText(typeReveal("i'm usually around \u2014 send a message.", elapsed, 0.50), cx, cy);
}

// ───── PAGE: LETTERBOXD ──────────────────────────────────────────────────────
function drawPageLetterboxd(ctx, x, y, w, h, elapsed) {
  const PAD = w * 0.055;
  const fs = Math.min(h / 20, w / 24);
  const lh = fs * 1.45;
  const cx = x + PAD;
  let cy = y + PAD * 0.8;
  let t = 0;
  const Q = 10 / SPEED;

  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';

  // Back
  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  // Title
  const titleFS = fs * 2.1;
  ctx.font = `${titleFS}px VT323`;
  cy += lh * 1.55;
  const hdr = typeReveal('LETTERBOXD', elapsed, 0.06);
  pgGlow(ctx, 32); ctx.fillStyle = AMBER;
  ctx.fillText(hdr, cx, cy); pgGlowOff(ctx);
  t = 0.06 + 10 / SPEED;

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.1;
  const subStr = `USER: @${LB_USER}  —  FILM DIARY`;
  const sub = typeReveal(subStr, elapsed, t);
  ctx.fillStyle = AMBER_DIM; pgGlow(ctx, 8);
  ctx.fillText(sub, cx, cy); pgGlowOff(ctx);
  t += subStr.length / SPEED + Q;

  cy += lh * 1.35;
  const sep = typeReveal('─'.repeat(42), elapsed, t);
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.4)`; ctx.fillText(sep, cx, cy);
  t += 42 / SPEED; cy += lh * 1.1;

  // ── Scrollable Area (Films + Footer) ──
  const listStartY = cy;
  const listH = (y + h) - listStartY - PAD;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listStartY, w, listH);
  ctx.clip();

  // Offset by scroll
  cy -= lbScrollY;

  const pW = fs * 3.4; const pH = fs * 4.8;
  const textCol = cx + pW + fs * 1.0;
  LB_FILMS.forEach((film, fi) => {
    const filmStart = t;
    const filmY = cy + fi * (pH + lh * 0.55);
    const rowId = 'lb_film_' + fi;

    // Hover Highlight
    const hs = subHoverState[rowId] || 0;
    if (hs > 0) {
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs * 0.15})`;
      ctx.fillRect(cx - 8, filmY - 8, w - PAD * 2 + 16, pH + 16);
    }

    // Register hit area (adjusted for scroll!)
    if (elapsed > filmStart) {
      regHit(cx - 8, filmY - 8, w - PAD * 2 + 16, pH + 16, rowId);
    }

    if (elapsed > filmStart + 0.04) {
      const a = Math.min((elapsed - filmStart - 0.04) * 5, 1);
      ctx.globalAlpha = a;

      const poster = lbPosterCache[fi];
      if (poster && poster !== 'loading' && poster !== 'error') {
        // Real poster image — draw smoothly (no pixelation)
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(poster, cx, filmY, pW, pH);
        ctx.imageSmoothingEnabled = false; // reset to default for rest of UI
        // Subtle amber CRT tint over the poster (very light — keeps image recognisable)
        try {
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = `rgba(${THEME.r},${Math.floor(THEME.g * 0.81)},${Math.floor(THEME.b * 0.55)},0.22)`;
          ctx.fillRect(cx, filmY, pW, pH);
        } finally {
          ctx.globalCompositeOperation = 'source-over';
        }
      } else {
        // Fallback: colour block while loading or on error
        ctx.fillStyle = film.color;
        ctx.fillRect(cx, filmY, pW, pH);
      }

      // Gradient vignette over bottom of poster
      const pvg = ctx.createLinearGradient(cx, filmY + pH * 0.55, cx, filmY + pH);
      pvg.addColorStop(0, 'rgba(0,0,0,0)'); pvg.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = pvg; ctx.fillRect(cx, filmY, pW, pH);

      // Rating badge at bottom of poster
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
    const dirStr = `${film.dir}  ·  ${film.year}`;
    const dirShown = typeReveal(dirStr, elapsed, t);
    ctx.fillStyle = AMBER_DIM; ctx.font = `${fs}px VT323`; pgGlow(ctx, 6);
    ctx.fillText(dirShown, textCol, filmY + lh * 1.1);
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
      t += line.length / SPEED + Q;
      return;
    }
    const shown = typeReveal(line, elapsed, t);
    ctx.fillStyle = AMBER_DIM; pgGlow(ctx, 8);
    ctx.fillText(shown, cx, cy + li * lh); t += line.length / SPEED + Q;
  });
  pgGlowOff(ctx);

  // Compute max scroll
  const totalContentH = (cy + desc.length * lh) - (listStartY - lbScrollY);
  lbScrollMax = Math.max(0, totalContentH - listH);

  ctx.restore();

  // Scrollbar indicator
  if (lbScrollMax > 0 && elapsed > t * 0.5) {
    const barX = x + w - PAD * 0.5;
    const barY = listStartY;
    const thumbH = Math.max(20, (listH / totalContentH) * listH);
    const thumbY = barY + (lbScrollY / lbScrollMax) * (listH - thumbH);

    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.15)`;
    ctx.fillRect(barX, barY, 4, listH);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
    ctx.fillRect(barX, thumbY, 4, thumbH);
  }
}

// ───── PAGE: SOCIALS ─────────────────────────────────────────────────────────
function drawPageSocials(ctx, x, y, w, h, elapsed) {
  const PAD = w * 0.055;
  const fs = Math.min(h / 18, w / 22);
  const lh = fs * 1.5;
  const cx = x + PAD;
  const cw = w - PAD * 2;
  let cy = y + PAD * 0.8;
  let t = 0;
  const Q = 8 / SPEED;

  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';

  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, cw * 0.28, lh, 'back', elapsed, 0);

  const titleFS = fs * 2.1;
  ctx.font = `${titleFS}px VT323`;
  cy += lh * 1.55;
  const hdr = typeReveal('LINKS & HANDLES', elapsed, 0.06);
  pgGlow(ctx, 30); ctx.fillStyle = AMBER;
  ctx.fillText(hdr, cx, cy); pgGlowOff(ctx);
  t = 0.06 + 15 / SPEED;

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.15;
  const sub = typeReveal('where to find me on the internet', elapsed, t);
  ctx.fillStyle = AMBER_DIM; pgGlow(ctx, 8);
  ctx.fillText(sub, cx, cy); pgGlowOff(ctx);
  t += 32 / SPEED + Q * 3;

  cy += lh * 1.6;
  const sep = typeReveal('─'.repeat(40), elapsed, t);
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.4)`; ctx.fillText(sep, cx, cy);
  t += 40 / SPEED; cy += lh * 1.4;

  // ── Scrollable Area (Socials) ──
  const listStartY = cy;
  const listH = (y + h) - listStartY - PAD;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listStartY, w, listH);
  ctx.clip();

  // Offset by scroll
  cy -= lbScrollY;

  const keyW = cw * 0.36;
  const btnW = cw * 0.30;
  const btnX = cx + cw - btnW;

  SOCIALS.forEach((s) => {
    const rowY = cy;
    const keyShown = typeReveal(s.label, elapsed, t);
    ctx.fillStyle = AMBER; pgGlow(ctx, 18);
    ctx.font = `${fs * 1.1}px VT323`;
    ctx.fillText(keyShown, cx, rowY);
    t += s.label.length / SPEED + Q;

    const handleShown = typeReveal(s.handle, elapsed, t);
    ctx.fillStyle = AMBER_DIM; ctx.font = `${fs}px VT323`; pgGlow(ctx, 8);
    ctx.fillText(handleShown, cx + keyW, rowY);
    t += s.handle.length / SPEED + Q;

    const btnLabel = s.url ? '[ CONNECT ]' : '[ DEAD LINK ]';
    if (elapsed > t) {
      const alpha = Math.min((elapsed - t) * SPEED / btnLabel.length, 1);
      const hs = subHoverState[s.id] || 0;
      ctx.globalAlpha = alpha;
      if (hs > 0) {
        pgGlowOff(ctx);
        ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs})`;
        ctx.fillRect(btnX - 4, rowY - lh * 0.1, btnW + 8, lh * 0.88);
      }
      const rr = Math.round(THEME.r - (THEME.r - 13) * hs);
      const gg = Math.round(THEME.g - (THEME.g - 8) * hs);
      const bb = Math.round(THEME.b - THEME.b * hs);
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

  // Compute max scroll
  const totalContentH = cy - (listStartY - lbScrollY);
  lbScrollMax = Math.max(0, totalContentH - listH);

  ctx.restore();

  // Scrollbar indicator
  if (lbScrollMax > 0 && elapsed > t * 0.5) {
    const barX = x + w - PAD * 0.5;
    const barY = listStartY;
    const thumbH = Math.max(20, (listH / totalContentH) * listH);
    const thumbY = barY + (lbScrollY / lbScrollMax) * (listH - thumbH);

    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.15)`;
    ctx.fillRect(barX, barY, 4, listH);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
    ctx.fillRect(barX, thumbY, 4, thumbH);
  }
}

// ───── PAGE: TWITTER ERROR ───────────────────────────────────────────────────
function drawPageTwitterError(ctx, x, y, w, h, elapsed) {
  const PAD = w * 0.055;
  const fs = Math.min(h / 18, w / 22);
  const lh = fs * 1.52;
  const cx = x + PAD;
  let cy = y + PAD * 0.8;
  let t = 0;
  const Q = 5 / SPEED;

  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';

  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  const titleFS = fs * 1.9;
  ctx.font = `${titleFS}px VT323`;
  cy += lh * 1.7;
  const hdr = typeReveal('ERROR ─ SIGNAL_NOT_FOUND', elapsed, 0.04);
  ctx.shadowColor = 'rgba(255,80,80,0.85)'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff6b6b'; ctx.fillText(hdr, cx, cy); pgGlowOff(ctx);
  t = 0.04 + 22 / SPEED;
  ctx.font = `${fs}px VT323`; cy += titleFS * 1.3;

  // ── Scrollable Area (Twitter) ──
  const listStartY = cy;
  const listH = (y + h) - listStartY - PAD;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listStartY, w, listH);
  ctx.clip();

  // Offset by scroll
  cy -= lbScrollY;

  const lines = [
    `ERR_404: @${LB_USER} — HANDLE NOT LOCATED`,
    '',
    'This user has not established a presence',
    'on the bird site. Or its successor.',
    "Or whatever it's called this week.",
    '',
    '"Sometimes the best option is to not tweet."',
    '  — probably someone very wise',
    '',
    '>> ATTEMPTING RECONNECT . . .',
    '>> ROUTE 1: twitter.com . . . . . . FAILED',
    '>> ROUTE 2: x.com . . . . . . . . . FAILED',
    '>> ROUTE 3: . . . . . . . . . TIMED OUT',
    '',
    '[ SIGNAL LOST  —  NO CARRIER ]',
  ];

  lines.forEach((line, li) => {
    if (!line) { t += Q * 3; return; }
    const shown = typeReveal(line, elapsed, t);
    const isErr = line.startsWith('ERR') || line.startsWith('>>') || line.startsWith('[');
    const isQuote = line.startsWith('"') || line.startsWith('  —');
    if (isErr) { ctx.shadowColor = 'rgba(255,80,80,0.75)'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff8888'; }
    else if (isQuote) { pgGlow(ctx, 8); ctx.fillStyle = AMBER_DIM; }
    else { pgGlow(ctx, 10); ctx.fillStyle = AMBER; }
    ctx.fillText(shown, cx, cy + li * lh); pgGlowOff(ctx);
    t += line.length / SPEED + Q;
  });

  // Compute max scroll
  const totalContentH = (cy + lines.length * lh) - (listStartY - lbScrollY);
  lbScrollMax = Math.max(0, totalContentH - listH);

  ctx.restore();

  // Scrollbar indicator
  if (lbScrollMax > 0 && elapsed > t * 0.5) {
    const barX = x + w - PAD * 0.5;
    const barY = listStartY;
    const thumbH = Math.max(20, (listH / totalContentH) * listH);
    const thumbY = barY + (lbScrollY / lbScrollMax) * (listH - thumbH);

    ctx.fillStyle = 'rgba(255,100,100,0.15)'; // Red tint for error page
    ctx.fillRect(barX, barY, 4, listH);
    ctx.fillStyle = 'rgba(255,100,100,0.6)';
    ctx.fillRect(barX, thumbY, 4, thumbH);
  }
}

// Music polling timer — started/stopped by openPage/closePage (NOT driven by rAF)
let _musicPollTimer = null;

// ───── PAGE: MUSIC ─────────────────────────────────────────────────────────
function drawPageMusic(ctx, x, y, w, h, elapsed) {

  const PAD = w * 0.055;
  const fs = Math.min(h / 20, w / 24);
  const lh = fs * 1.45;
  const cx = x + PAD;
  const contentW = w - PAD * 2;
  let cy = y + PAD * 0.8;

  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';

  // ── Header ───────────────────────────────────────────────────────────────
  drawSubLink(ctx, '[ESC] \u2190 BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  cy += lh * 1.55;
  const titleFS = fs * 1.8;
  ctx.font = `${titleFS}px VT323`;
  pgGlow(ctx, 28); ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('MUSIC', elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.15;
  pgGlow(ctx, 7); ctx.fillStyle = AMBER_DIM;
  ctx.fillText(typeReveal('SCROBBLED VIA LAST.FM \u2014 ' + LASTFM_USER.toUpperCase(), elapsed, 0.10), cx, cy);
  pgGlowOff(ctx);

  cy += lh * 1.2;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
  ctx.fillText(typeReveal('\u2500'.repeat(42), elapsed, 0.12), cx, cy);
  cy += lh * 1.6;

  if (elapsed < 0.25) return;

  // ── Loading / error states ────────────────────────────────────────────────
  if (musicError) {
    pgGlow(ctx, 14); ctx.fillStyle = '#ff4433';
    ctx.fillText('ERR: ' + musicError, cx, cy);
    pgGlowOff(ctx); cy += lh * 2;
  } else if (musicFetching && !musicNow && !musicRecent.length) {
    pgGlow(ctx, 12); ctx.fillStyle = AMBER_DIM;
    ctx.fillText('SCANNING LAST.FM . . .', cx, cy);
    pgGlowOff(ctx); return;
  }

  // ── NOW PLAYING card ─────────────────────────────────────────────────────
  if (musicNow) {
    // ▶ NOW PLAYING badge
    ctx.font = `${fs * 0.78}px VT323`;
    ctx.shadowColor = `rgba(${THEME.r},${Math.floor(THEME.g * 0.4)},${Math.floor(THEME.b * 0.7)},0.9)`; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff5533';
    ctx.fillText('\u25b6  NOW PLAYING', cx, cy);
    ctx.shadowBlur = 0;
    cy += fs * 1.25;

    // Cover art — 38% content width, hoverable with ↗ OPEN overlay
    const artW = Math.min(contentW * 0.38, h * 0.30, 170);
    const artH = artW;
    const artX = cx;
    const artY = cy;
    const hsArt = subHoverState['music-art'] || 0;
    const trackUrl = musicNow.url || ('https://www.last.fm/music/' + encodeURIComponent(musicNow.artist) + '/_/' + encodeURIComponent(musicNow.name));

    ctx.save();
    // Glow border — brighter on hover
    ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.5 + hsArt * 0.4})`;
    ctx.shadowBlur = 8 + hsArt * 18;
    ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.4 + hsArt * 0.45})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(artX, artY, artW, artH);
    ctx.shadowBlur = 0;

    if (musicPixelCanvas) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(musicPixelCanvas, artX + 1, artY + 1, artW - 2, artH - 2);
      // CRT scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let sl = 0; sl < artH; sl += 3) ctx.fillRect(artX + 1, artY + 1 + sl, artW - 2, 1.3);
    } else {
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.05)`;
      ctx.fillRect(artX + 1, artY + 1, artW - 2, artH - 2);
      ctx.font = `${artW * 0.4}px VT323`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      pgGlow(ctx, 12); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.32)`;
      ctx.fillText('\u266b', artX + artW / 2, artY + artH / 2);
      pgGlowOff(ctx);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    }

    // Hover overlay — dark veil + "↗ OPEN" centred text
    if (hsArt > 0.05) {
      ctx.fillStyle = `rgba(0,0,0,${0.55 * hsArt})`;
      ctx.fillRect(artX + 1, artY + 1, artW - 2, artH - 2);
      ctx.font = `${fs * 0.9}px VT323`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      pgGlow(ctx, 16);
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hsArt})`;
      ctx.fillText('\u2197 OPEN ON LAST.FM', artX + artW / 2, artY + artH / 2);
      pgGlowOff(ctx);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    }
    ctx.restore();

    // Register art as clickable (opens Last.fm)
    regHit(artX, artY, artW, artH, 'music-art', trackUrl);

    // ── Track info — right of art ─────────────────────────────────────────
    const infoX = artX + artW + PAD * 0.85;
    const infoW = contentW - artW - PAD * 0.85;
    let iy = artY;

    const clamp = (s, maxW, fsize) => {
      const max = Math.floor(maxW / (fsize * 0.62));
      return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
    };

    // Track name — big
    ctx.font = `${fs * 1.5}px VT323`;
    pgGlow(ctx, 24); ctx.fillStyle = AMBER;
    ctx.fillText(clamp(musicNow.name, infoW, fs * 1.5), infoX, iy);
    pgGlowOff(ctx); iy += fs * 1.75;

    // Artist
    ctx.font = `${fs * 1.1}px VT323`;
    pgGlow(ctx, 12); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.82)`;
    ctx.fillText(clamp(musicNow.artist, infoW, fs * 1.1), infoX, iy);
    pgGlowOff(ctx); iy += lh * 1.1;

    // Album
    ctx.font = `${fs}px VT323`;
    pgGlow(ctx, 6); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.42)`;
    ctx.fillText(clamp(musicNow.album || '\u2014', infoW, fs), infoX, iy);
    pgGlowOff(ctx); iy += lh * 2.0;

    // Progress bar
    if (musicNow.duration > 0) {
      const pct = Math.min(1, (performance.now() - musicTrackStart) / (musicNow.duration * 1000));
      const elSec = (performance.now() - musicTrackStart) / 1000;
      const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      const barH = fs * 0.46;

      // Track fill
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.12)`;
      ctx.fillRect(infoX, iy, infoW, barH);
      pgGlow(ctx, 8); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.88)`;
      ctx.fillRect(infoX, iy, infoW * pct, barH);
      pgGlowOff(ctx);
      iy += barH + fs * 0.3;

      // Timestamps
      ctx.font = `${fs * 0.72}px VT323`; ctx.fillStyle = AMBER_DIM;
      ctx.fillText(fmt(elSec), infoX, iy);
      ctx.textAlign = 'right';
      ctx.fillText(fmt(musicNow.duration), infoX + infoW, iy);
      ctx.textAlign = 'left';
      iy += lh * 1.1;
    }

    // Equalizer — below progress bar, within info column
    const eqH = fs * 2.2;
    if (iy + eqH <= artY + artH) {
      drawEqualizer(ctx, infoX, iy, Math.min(infoW, artW * 1.4), eqH, elapsed);
    }

    cy = artY + artH + lh * 1.8; // advance past art block
  } else if (!musicFetching && !musicError) {
    ctx.font = `${fs}px VT323`;
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.38)`;
    ctx.fillText('—  nothing playing right now', cx, cy);
    cy += lh * 2.2;
  }

  // ── Recently played (scrollable) ────────────────────────────────────────
  if (musicRecent.length && cy + lh * 2.2 < y + h) {
    ctx.font = `${fs * 0.82}px VT323`;
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.28)`;
    ctx.fillText('───  RECENTLY PLAYED  ──────────────────────────────────', cx, cy);
    cy += lh * 1.25;

    // Clip to the remaining panel height so rows don’t bleed out
    const listStartY = cy;
    const listH = (y + h) - listStartY - lh * 0.4;
    const rowH = lh * 1.6;
    const totalListH = musicRecent.length * rowH;
    lbScrollMax = Math.max(0, totalListH - listH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, listStartY, w, listH);
    ctx.clip();

    let ry = listStartY - lbScrollY; // scrolled Y origin

    musicRecent.forEach((t, i) => {
      const rid = 'music-rec-' + i;
      const hs = subHoverState[rid] || 0;

      // Row hover highlight
      if (hs > 0) {
        pgGlowOff(ctx);
        ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${hs * 0.09})`;
        ctx.fillRect(cx - 4, ry - 2, contentW + 8, rowH);
      }

      // Track + artist
      ctx.font = `${fs}px VT323`;
      const rr = Math.round(THEME.r - (THEME.r - 13) * hs);
      const gg = Math.round(THEME.g - (THEME.g - 8) * hs);
      const bb = Math.round(THEME.b - THEME.b * hs);
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      pgGlow(ctx, Math.round(12 * (1 - hs)));
      const maxC = Math.floor(contentW * 0.72 / (fs * 0.63));
      const label = t.name + '  —  ' + t.artist;
      ctx.fillText(label.length > maxC ? label.slice(0, maxC - 1) + '…' : label, cx, ry + fs * 0.15);
      pgGlowOff(ctx);

      // Timestamp — right edge
      ctx.font = `${fs * 0.72}px VT323`;
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.35 + hs * 0.3})`;
      ctx.textAlign = 'right';
      ctx.fillText(t.ts, x + w - PAD * 0.6, ry + fs * 0.2);
      ctx.textAlign = 'left';

      // Hit area registered in screen coords (not scrolled)
      const screenY = listStartY + i * rowH - lbScrollY;
      if (t.url && screenY + rowH > listStartY && screenY < listStartY + listH) {
        regHit(cx - 4, screenY - 2, contentW + 8, rowH, rid, t.url);
      }

      ry += rowH;
    });

    ctx.restore();

    // Scrollbar indicator
    if (lbScrollMax > 0) {
      const sbX = x + w - PAD * 0.38;
      const thumbH = Math.max(18, (listH / totalListH) * listH);
      const thumbY = listStartY + (lbScrollY / lbScrollMax) * (listH - thumbH);
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.15)`;
      ctx.fillRect(sbX, listStartY, 3, listH);
      pgGlow(ctx, 6);
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.55)`;
      ctx.fillRect(sbX, thumbY, 3, thumbH);
      pgGlowOff(ctx);
    }
  }
}

// ───── PAGE: LIBRARY ──────────────────────────────────────────────────────
// Retro folder icon drawn entirely on canvas — no images, no external assets.
// Each folder = tab (top-left notch) + body rectangle, amber phosphor glow.
function drawFolder(ctx, fx, fy, fw, fh, label, id, elapsed, startAt) {
  const shown = elapsed - startAt > 0;
  if (!shown) return;

  const hs = subHoverState[id] || 0;
  const tabW = fw * 0.38;
  const tabH = fh * 0.14;
  const bodyY = fy + tabH;
  const bodyH = fh - tabH;
  const radius = fw * 0.045;

  // Brightness base + hover lift
  const baseAlpha = 0.13 + hs * 0.10;
  const rimAlpha = 0.55 + hs * 0.35;
  const glowBlur = 10 + hs * 22;

  ctx.save();

  // ── Folder tab (top-left raised notch) ─────────────────────────────
  ctx.beginPath();
  ctx.moveTo(fx + radius, fy);
  ctx.lineTo(fx + tabW - radius, fy);
  ctx.quadraticCurveTo(fx + tabW, fy, fx + tabW, fy + radius);
  ctx.lineTo(fx + tabW, bodyY);
  ctx.lineTo(fx, bodyY);
  ctx.lineTo(fx, fy + radius);
  ctx.quadraticCurveTo(fx, fy, fx + radius, fy);
  ctx.closePath();
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${baseAlpha + 0.04})`;
  ctx.fill();
  ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},${rimAlpha})`;
  ctx.shadowBlur = glowBlur;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${rimAlpha})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ── Folder body ───────────────────────────────────────────────
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
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${baseAlpha})`;
  ctx.fill();
  ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},${rimAlpha})`;
  ctx.shadowBlur = glowBlur;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${rimAlpha})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ── Inner depth lines (gives it a 3-D folder feel) ────────────────
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.10 + hs * 0.08})`;
  ctx.lineWidth = 1;
  const inset = fw * 0.055;
  // horizontal crease
  ctx.beginPath();
  ctx.moveTo(fx + inset, bodyY + bodyH * 0.38);
  ctx.lineTo(fx + fw - inset, bodyY + bodyH * 0.38);
  ctx.stroke();

  // ── Label below folder ───────────────────────────────────────
  const lfs = fw * 0.195;
  ctx.font = `${lfs}px VT323`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.shadowColor = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.8 + hs * 0.2})`;
  ctx.shadowBlur = 8 + hs * 10;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.8 + hs * 0.2})`;
  ctx.fillText(label, fx + fw * 0.5, fy + fh + lfs * 0.35);

  ctx.restore();

  // Register hit area (folder + label zone)
  regHit(fx - 4, fy - 4, fw + 8, fh + lfs * 2.2, id);
}

function drawPageLibrary(ctx, x, y, w, h, elapsed) {
  const PAD = w * 0.055;
  const fs = Math.min(h / 20, w / 24);
  const lh = fs * 1.45;
  const cx = x + PAD;
  let cy = y + PAD * 0.8;

  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';

  // Back link
  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  // Title
  cy += lh * 1.55;
  const titleFS = fs * 1.8;
  ctx.font = `${titleFS}px VT323`;
  pgGlow(ctx, 28);
  ctx.fillStyle = AMBER;
  ctx.fillText(typeReveal('LIBRARY', elapsed, 0.06), cx, cy);
  pgGlowOff(ctx);

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.1;
  pgGlow(ctx, 7);
  ctx.fillStyle = AMBER_DIM;
  ctx.fillText(typeReveal('SELECT A FOLDER TO EXPLORE', elapsed, 0.15), cx, cy);
  pgGlowOff(ctx);

  cy += lh * 1.3;
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.3)`;
  ctx.fillText(typeReveal('─'.repeat(38), elapsed, 0.18), cx, cy);
  cy += lh * 1.6;

  // ── Folder grid ──────────────────────────────────────────
  const folders = [
    { id: 'lib-fun', label: '~fun' },
    { id: 'lib-tools', label: '~tools' },
    { id: 'lib-websites', label: '~websites' },
  ];

  const availW = w - PAD * 2;
  const fCols = Math.min(folders.length, 4);          // up to 4 per row
  const fGap = availW * 0.055;
  const fW = (availW - fGap * (fCols - 1)) / fCols;
  const fH = fW * 0.72;                            // classic folder proportion
  const revDelay = 0.22;                                 // stagger per folder

  folders.forEach((f, i) => {
    const col = i % fCols;
    const row = Math.floor(i / fCols);
    const fx = cx + col * (fW + fGap);
    const fy = cy + row * (fH * 1.55);
    drawFolder(ctx, fx, fy, fW, fH, f.label, f.id, elapsed, 0.25 + i * revDelay);
  });
}

// ───── PAGE: DOOM ──────────────────────────────────────────────────────
function drawPageDoom(ctx, x, y, w, h, elapsed) {

  // ── LIVE MODE: doom is running — blit frames into the CRT pipeline ──────
  if (doomReady && doomCanvas) {
    ctx.save();

    // Amber border (same style as all other page boxes)
    ctx.strokeStyle = `rgba(${THEME.r},${THEME.g},${THEME.b}, 0.35)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Clip to the content box
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // Blit doom frame — scaled to fill the panel exactly.
    // The WebGL shader above applies CRT barrel + scanlines + film grain on top.
    ctx.drawImage(doomCanvas, x, y, w, h);

    // Faint amber phosphor tint (very subtle — preserves game colours)
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b}, 0.035)`;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Top-right badge — [ESC] EXIT DOOM — sits on the panel border, never overlaps game
    const fs = Math.min(h / 22, w / 28);
    ctx.font = `${fs}px VT323`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    // faint pill background
    const badgeW = fs * 9;
    const badgeH = fs * 1.3;
    const badgeX = x + w - badgeW - fs * 0.4;
    const badgeY = y + fs * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(badgeX - fs * 0.3, badgeY - fs * 0.1, badgeW + fs * 0.6, badgeH + fs * 0.2);
    pgGlow(ctx, 8);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
    ctx.fillText('[ESC] EXIT', x + w - fs * 0.5, badgeY);
    pgGlowOff(ctx);

    // ── Controls HUD: fades in instantly, fades out after 8 s ────────────────
    const hudAge = (performance.now() - doomReadyTime) / 1000; // seconds since ready
    const FADE_START = 5.5, FADE_END = 8.5;
    if (hudAge < FADE_END) {
      const alpha = hudAge < FADE_START ? 1
        : 1 - (hudAge - FADE_START) / (FADE_END - FADE_START);

      const hfs = fs * 0.82;
      const hlh = hfs * 1.55;
      const hpad = hfs * 0.8;
      const controls = [
        ['\u2191 / \u2193', 'MOVE FWD / BACK'],
        ['\u2190 / \u2192', 'TURN LEFT / RIGHT'],
        ['CTRL', 'SHOOT'],
        ['SPACE', 'USE / OPEN DOOR'],
        ['ALT + \u2190\u2192', 'STRAFE'],
        ['[ / ]', 'PREV / NEXT WEAPON'],
        ['TAB', 'AUTOMAP'],
        ['ENTER', 'MENU SELECT'],
      ];
      const hudW = hfs * 18;
      const hudH = hpad * 2 + controls.length * hlh;
      const hudX = x + fs * 0.8;
      const hudY = y + fs * 2.5; // below ESC badge height

      ctx.save();
      ctx.globalAlpha = alpha;

      // Dark pill background
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(hudX, hudY, hudW, hudH);
      // Amber left border accent
      ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},${0.7 * alpha})`;
      ctx.fillRect(hudX, hudY, 2, hudH);

      ctx.font = `${hfs}px VT323`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      // Header
      pgGlow(ctx, 14);
      ctx.fillStyle = AMBER;
      ctx.fillText('CONTROLS', hudX + hpad, hudY + hpad * 0.5);
      pgGlowOff(ctx);

      controls.forEach(([key, action], i) => {
        const ry = hudY + hpad + hfs * 1.4 + i * hlh;
        // key column (amber, monospace)
        ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.9)`;
        ctx.fillText(key.padEnd(10), hudX + hpad, ry);
        // action column (dimmer)
        ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.5)`;
        ctx.fillText(action, hudX + hpad + hfs * 6.5, ry);
      });

      ctx.restore();
    }

    ctx.restore();
    return;
  }

  // ── LOADING / BOOT LOG mode ──────────────────────────────────────────────
  const PAD = w * 0.055;
  const fs = Math.min(h / 20, w / 24);
  const lh = fs * 1.45;
  const cx = x + PAD;
  let cy = y + PAD * 0.8;
  let t = 0;
  const Q = 10 / SPEED;

  ctx.font = `${fs}px VT323`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';

  // Back link
  drawSubLink(ctx, '[ESC] ← BACK', cx, cy, w * 0.28, lh, 'back', elapsed, 0);

  // Title
  const titleFS = fs * 2.1;
  ctx.font = `${titleFS}px VT323`;
  cy += lh * 1.55;
  const hdr = typeReveal('DOOM', elapsed, 0.06);
  pgGlow(ctx, 40);
  ctx.fillStyle = '#ff4400';
  ctx.fillText(hdr, cx, cy);
  pgGlowOff(ctx);
  t = 0.06 + 4 / SPEED;

  ctx.font = `${fs}px VT323`;
  cy += titleFS * 1.1;
  const subStr = doomLoading
    ? 'LOADING WASM ENGINE . . . PLEASE WAIT'
    : 'WASM DOOM  —  FREEDOOM ENGINE  —  CLICK @doom TO START';
  const sub = typeReveal(subStr, elapsed, t);
  ctx.fillStyle = AMBER_DIM; pgGlow(ctx, 8);
  ctx.fillText(sub, cx, cy); pgGlowOff(ctx);
  t += subStr.length / SPEED + Q;

  cy += lh * 1.35;
  const sep = typeReveal('─'.repeat(42), elapsed, t);
  ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.4)`;
  ctx.fillText(sep, cx, cy);
  t += 42 / SPEED; cy += lh * 1.1;

  // Boot log lines — animate sequentially
  const lines = [
    '> INITIALIZING DOOM ENGINE . . .',
    '> LOADING doom.wasm  (LOCAL)  . . .',
    '> ALLOCATING ZONE MEMORY . . .',
    '> V_INIT: ALLOCATE SCREENS . . .',
    '> M_INIT: MENUS . . .',
    '> R_INIT: RENDERER . . . . . . OK',
    doomLoading ? '> STARTING GAME LOOP . . . LOADING' : '> GAME LOOP . . . . . . . . . . OK',
    '',
    doomLoading ? '[ WASM LOADING \u2014 PLEASE WAIT ]' : '[ DOOM READY \u2014 CLICK @doom TO PLAY ]',
  ];

  // Controls reference — shown statically below boot log so user reads it while loading
  const ctrlLines = [
    '',
    '\u2500\u2500\u2500  CONTROLS  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
    '  MOVE FWD / BACK     \u2190 \u2191 \u2193 \u2192  (arrow keys)',
    '  SHOOT               CTRL',
    '  USE / OPEN DOOR     SPACE',
    '  STRAFE              ALT + \u2190 / \u2192',
    '  PREV / NEXT WEAPON  [ / ]',
    '  AUTOMAP             TAB',
    '  MENU SELECT         ENTER',
    '  EXIT TO TERMINAL    ESC',
    '',
    '  TIP: Click the game area first to capture keyboard focus.',
  ];

  const allLines = [...lines, ...ctrlLines];
  const ctrlStart = lines.length; // index where controls begin (for colour switch)

  const listStartY = cy;
  const listH = (y + h) - listStartY - PAD;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, listStartY, w, listH);
  ctx.clip();
  cy -= lbScrollY;

  allLines.forEach((line, li) => {
    if (!line) { t += Q * 3; return; }
    const shown = typeReveal(line, elapsed, t);
    const isCmd = line.startsWith('>');
    const isReady = line.startsWith('[');
    const isSep = line.startsWith('\u2500');
    const isCtrl = li >= ctrlStart && !isCmd && !isReady && !isSep;
    const isTip = line.trimStart().startsWith('TIP');

    if (isCmd) { ctx.shadowColor = 'rgba(255,80,0,0.8)'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff6633'; }
    else if (isReady) { pgGlow(ctx, 22); ctx.fillStyle = AMBER; }
    else if (isSep) { pgGlow(ctx, 6); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.35)`; }
    else if (isTip) { pgGlow(ctx, 6); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.38)`; }
    else if (isCtrl) { pgGlow(ctx, 10); ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.75)`; }
    else { pgGlow(ctx, 10); ctx.fillStyle = AMBER; }

    ctx.fillText(shown, cx, cy + li * lh);
    pgGlowOff(ctx);
    t += line.length / SPEED + Q;
  });

  const totalContentH = (cy + allLines.length * lh) - (listStartY - lbScrollY);
  lbScrollMax = Math.max(0, totalContentH - listH);
  ctx.restore();

  // Amber scrollbar
  if (lbScrollMax > 0 && elapsed > t * 0.5) {
    const barX = x + w - PAD * 0.5;
    const thumbH = Math.max(20, (listH / totalContentH) * listH);
    const thumbY = listStartY + (lbScrollY / lbScrollMax) * (listH - thumbH);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.15)`;
    ctx.fillRect(barX, listStartY, 4, listH);
    ctx.fillStyle = `rgba(${THEME.r},${THEME.g},${THEME.b},0.6)`;
    ctx.fillRect(barX, thumbY, 4, thumbH);
  }
}

boot();
