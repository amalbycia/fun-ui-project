const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

// locals replacement
const globalsRegex = /const AMBER[\s\S]*?const BEZEL        = '#050400';/;
const themesReplacement = `
// ─── Globals & Themes ────────────────────────────────────────────────────────
const THEMES = [
  { name: 'AMBER', hex: '#F4C436', r: 244, g: 196, b: 54 },
  { name: 'GREEN', hex: '#4af626', r: 74,  g: 246, b: 38 },
  { name: 'CYAN',  hex: '#00e5ff', r: 0,   g: 229, b: 255 },
  { name: 'WHITE', hex: '#dcdcdc', r: 220, g: 220, b: 220 },
  { name: 'PINK',  hex: '#ff00aa', r: 255, g: 0,   b: 170 },
  { name: 'BLOOD', hex: '#ff1100', r: 255, g: 17, b: 0 }
];

let themeIdx = parseInt(localStorage.getItem('crt-theme') || '0', 10);
if (isNaN(themeIdx) || themeIdx >= THEMES.length) themeIdx = 0;
let windowTheme = THEMES[themeIdx];

Object.defineProperties(window, {
  AMBER:        { get: () => windowTheme.hex },
  AMBER_DIM:    { get: () => 'rgba(' + windowTheme.r + ',' + windowTheme.g + ',' + windowTheme.b + ',0.4)' },
  AMBER_GLOW:   { get: () => 'rgba(' + windowTheme.r + ',' + windowTheme.g + ',' + windowTheme.b + ',0.9)' },
  AMBER_STRONG: { get: () => 'rgba(' + windowTheme.r + ',' + windowTheme.g + ',' + windowTheme.b + ',1.0)' },
  THEME:        { get: () => windowTheme }
});

const BG           = '#120d00';
const BEZEL        = '#050400';
`.trim();
code = code.replace(globalsRegex, themesReplacement);

// Keydown events
const hotkeyInject = "if (e.key === 'Escape')";
const hotkeyReplacement = `
    // Cycle theme on 'T'
    const char = (e.key || '').toLowerCase();
    if (char === 't' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      themeIdx = (themeIdx + 1) % THEMES.length;
      windowTheme = THEMES[themeIdx];
      localStorage.setItem('crt-theme', themeIdx);
      if (typeof pctx !== 'undefined' && pctx) pctx.clearRect(0, 0, window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio);
      if (typeof asciiCache !== 'undefined' && asciiCache) asciiCache.canvas = null;
      if (typeof _gradCache !== 'undefined' && _gradCache) _gradCache.W = -1;
      return;
    }
    
    if (e.key === 'Escape')`;
code = code.replace(hotkeyInject, hotkeyReplacement);

// Text string Replacements
code = code.replace(/rgba?\(\s*244\s*,\s*196\s*,\s*54([^)]*)\)/g, 'rgba(${THEME.r},${THEME.g},${THEME.b}$1)');
code = code.replace(/rgba\(\s*244\s*,\s*160\s*,\s*30([^)]*)\)/g, 'rgba(${THEME.r},${Math.floor(THEME.g*0.81)},${Math.floor(THEME.b*0.55)}$1)');
code = code.replace(/rgb\(255,\s*187,\s*0\)/g, 'rgb(${THEME.r},${Math.floor(THEME.g*0.95)},${Math.floor(THEME.b*0.7)})');
code = code.replace(/rgba\(255,\s*187,\s*0/g, 'rgba(${THEME.r},${THEME.g},${THEME.b}');
code = code.replace(/rgba\(200,130,0/g, 'rgba(${Math.floor(THEME.r*0.8)},${Math.floor(THEME.g*0.8)},${Math.floor(THEME.b*0.8)}');
code = code.replace(/rgba\(160,90,0/g,  'rgba(${Math.floor(THEME.r*0.6)},${Math.floor(THEME.g*0.6)},${Math.floor(THEME.b*0.6)}');
code = code.replace(/rgba\(100,55,0/g,  'rgba(${Math.floor(THEME.r*0.4)},${Math.floor(THEME.g*0.4)},${Math.floor(THEME.b*0.4)}');
code = code.replace(/rgba\(255,78,50/g,  'rgba(${THEME.r},${Math.floor(THEME.g*0.4)},${Math.floor(THEME.b*0.7)}'); // special highlights

// Math replacements
code = code.replace(/244 \+ \(255 - 244\) \* f/g, 'THEME.r + (255 - THEME.r) * f');
code = code.replace(/196 \+ \(255 - 196\) \* f/g, 'THEME.g + (255 - THEME.g) * f');
code = code.replace(/54  \+ \(255 - 54\)  \* f/g, 'THEME.b + (255 - THEME.b) * f');

code = code.replace(/244 - \(244 - 13\)\s*\* hs/g, 'THEME.r - (THEME.r - 13) * hs');
code = code.replace(/196 - \(196 - 8\)\s*\* hs/g,  'THEME.g - (THEME.g - 8) * hs');
code = code.replace(/54  - \(54  - 0\)\s*\* hs/g,  'THEME.b - THEME.b * hs');

code = code.replace(/244 - 231 \* hs/g, 'THEME.r - (THEME.r - 13) * hs');
code = code.replace(/196 - 188 \* hs/g, 'THEME.g - (THEME.g - 8) * hs');
code = code.replace(/54  - 54  \* hs/g, 'THEME.b - THEME.b * hs');

fs.writeFileSync('main.js', code);
console.log('Transformation complete!');
