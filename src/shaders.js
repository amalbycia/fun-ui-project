// ─── WebGL Shaders ───────────────────────────────────────────────────────────

export const VERT = `
attribute vec2 a_pos;
varying   vec2 v_uv;
void main(){
  v_uv        = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const FRAG = `
precision highp float;
varying vec2  v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform vec2  u_res;

// --- CRT tunables ---
const float CURVE    = 0.06;
const float CHROMA   = 0.006;
const float VIGNETTE = 0.45;
const float GRAIN    = 0.05;
const float SCAN_STR = 0.20;

vec2 barrel(vec2 uv){
  uv = uv * 2.0 - 1.0;
  uv *= 1.0 + CURVE * dot(uv, uv);
  return uv * 0.5 + 0.5;
}

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
}

void main(){
  vec2 uv = barrel(v_uv);

  if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0){
    gl_FragColor = vec4(0.0,0.0,0.0,1.0);
    return;
  }

  vec2 dir = (uv - 0.5);
  float ca = CHROMA * dot(dir, dir);
  float r  = texture2D(u_tex, barrel(v_uv + dir * ca * 2.0)).r;
  float g  = texture2D(u_tex, uv).g;
  float b  = texture2D(u_tex, barrel(v_uv - dir * ca * 2.0)).b;
  vec3 col = vec3(r, g, b);

  float scan = sin(uv.y * u_res.y * 3.14159);
  col *= 1.0 - SCAN_STR * (0.5 - 0.5 * scan * scan);

  col += (hash(uv + fract(u_time * 0.031)) - 0.5) * GRAIN;

  vec2 vig = uv * (1.0 - uv);
  col *= pow(vig.x * vig.y * 16.0, VIGNETTE);

  col *= 0.97 + 0.03 * sin(u_time * 53.1);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
