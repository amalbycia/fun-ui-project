const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

// 1. Add globalHitAreas to globals
if (!code.includes('let globalHitAreas = [];')) {
  code = code.replace(/let pageHitAreas  = \[\];/g, "let pageHitAreas  = [];\nlet globalHitAreas = []; // always active\nlet globalHoverId = null;");
}

// 2. Add subHoverState entry mapping just to be safe
// (already exists at top, but we'll use subHoverState for the animation)

// 3. Inject the theme button drawing at the end of drawSidebar
if (!code.includes('globalHitAreas = newGlobalHits;')) {
  code = code.replace(/menuHitAreas = newHits;\n}/g, `
  // Setup theme button at the bottom of the sidebar area
  const newGlobalHits = [];
  const btnFS    = fs * 0.9;
  const btnH     = btnFS * 1.8;
  const btnY     = y + h - btnH; // pinned to bottom of sidebar rect
  const btnLabel = '[◈] THEME: ' + windowTheme.name;
  const btnHs    = subHoverState['theme_toggle'] || 0;

  if (btnHs > 0) {
    ctx.fillStyle = \`rgba(\${THEME.r},\${THEME.g},\${THEME.b},\${btnHs * 0.2})\`;
    ctx.fillRect(x - 2, btnY - 2, w * 0.92 + 4, btnH + 4);
  }

  ctx.strokeStyle = \`rgba(\${THEME.r},\${THEME.g},\${THEME.b},0.3)\`;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x, btnY - btnFS * 0.4);
  ctx.lineTo(x + w * 0.92, btnY - btnFS * 0.4);
  ctx.stroke();

  ctx.font         = \`\${btnFS}px VT323\`;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'left';
  ctx.shadowColor  = \`rgba(\${THEME.r},\${THEME.g},\${THEME.b},0.9)\`;
  ctx.shadowBlur   = btnHs > 0 ? 12 : 0;
  ctx.fillStyle    = btnHs > 0 ? '#ffffff' : windowTheme.hex;
  ctx.fillText(btnLabel, x + 4, btnY + btnH / 2);
  ctx.shadowBlur   = 0;

  newGlobalHits.push({ x: x - 2, y: btnY - 2, w: w * 0.92 + 4, h: btnH + 4, id: 'theme_toggle' });

  menuHitAreas = newHits;
  globalHitAreas = newGlobalHits;
}
`);
}

// 4. Inject into mousemove (before pageHitAreas)
if (!code.includes('for (const hit of globalHitAreas)')) {
code = code.replace(/let lastHovered    = -1;\n  let lastSubHovered = null;\n  canvas\.addEventListener\('mousemove', e => {\n    const { x, y } = cssToCanvas\(e\.clientX, e\.clientY\);/g, `let lastHovered    = -1;
  let lastSubHovered = null;
  canvas.addEventListener('mousemove', e => {
    const { x, y } = cssToCanvas(e.clientX, e.clientY);

    // -- Global hits (Theme button) -- 
    if (typeof globalHitAreas !== 'undefined') {
      let foundGlobal = null;
      for (const hit of globalHitAreas) {
        if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
          foundGlobal = hit.id; break;
        }
      }
      if (foundGlobal !== globalHoverId) {
        if (globalHoverId !== null) gsap.to(subHoverState, { [globalHoverId]: 0, duration: 0.18, overwrite: 'auto' });
        if (foundGlobal !== null) {
          if (!subHoverState[foundGlobal]) subHoverState[foundGlobal] = 0;
          gsap.to(subHoverState, { [foundGlobal]: 1, duration: 0.10, overwrite: 'auto' });
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'default';
        }
        globalHoverId = foundGlobal;
      }
      if (foundGlobal) return; // intercept hover
    }
`);
}

// 5. Inject into click
if (!code.includes("if (hit.id === 'theme_toggle')")) {
code = code.replace(/canvas\.addEventListener\('click', e => {\n    const { x, y } = cssToCanvas\(e\.clientX, e\.clientY\);/g, `canvas.addEventListener('click', e => {
    const { x, y } = cssToCanvas(e.clientX, e.clientY);
    
    if (typeof globalHitAreas !== 'undefined') {
      for (const hit of globalHitAreas) {
        if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
          if (hit.id === 'theme_toggle') {
            themeIdx = (themeIdx + 1) % THEMES.length;
            windowTheme = THEMES[themeIdx];
            localStorage.setItem('crt-theme', themeIdx);
            if (typeof pctx !== 'undefined' && pctx) pctx.clearRect(0, 0, window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio);
            if (typeof asciiCache !== 'undefined' && asciiCache) asciiCache.canvas = null;
            if (typeof _gradCache !== 'undefined' && _gradCache) _gradCache.W = -1;
            return;
          }
        }
      }
    }
`);
}

fs.writeFileSync('main.js', code);
console.log('UI injected.');
