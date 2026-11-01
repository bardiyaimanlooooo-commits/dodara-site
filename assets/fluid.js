/*
 * Dodara — "arrange the smoke"
 * A real-time fluid (stable fluids) smoke simulation in raw WebGL2.
 * Fixed full-viewport canvas (#smokefx). Pointer / touch movement paints smoke,
 * other scripts can puff smoke with:
 *   dispatchEvent(new CustomEvent("dodara:smoke", { detail: { x, y, dx, dy, color:[r,g,b], r } }))
 *   (x, y in CSS px of the viewport; dx, dy = push in px; r = radius 0..1)
 * Pauses itself when idle, off-tab, or with reduced motion.
 */
(function () {
  "use strict";
  // Wait until the 3D hero is on screen (or has given up) so both do not fight
  // over the GPU at startup — the tin appears several times faster this way.
  const hero = document.querySelector(".hero");
  let started = false;
  const go = () => { if (started) return; started = true; (window.requestIdleCallback || setTimeout)(main, { timeout: 600 }); };
  const ready = () => !hero || /\b(gl-on|no-gl|gl-slow)\b/.test(hero.className);
  if (ready()) go();
  else { new MutationObserver((_, mo) => { if (ready()) { mo.disconnect(); setTimeout(go, 250); } }).observe(hero, { attributes: true, attributeFilter: ["class"] }); setTimeout(go, 4000); }

function main() {
  const canvas = document.getElementById("smokefx");
  if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const gl = canvas.getContext("webgl2", { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return;

  const coarse = matchMedia("(pointer: coarse)").matches;
  const CFG = {
    SIM: 128, DYE: coarse ? 384 : 640,
    DENSITY_DISSIPATION: 1.15, VELOCITY_DISSIPATION: 0.3, PRESSURE: 0.8, ITER: coarse ? 14 : 20,
    CURL: 30, RADIUS: 0.0026, FORCE: 5200, IDLE_MS: 6500
  };

  /* ---------- shaders ---------- */
  const VS = `#version 300 es
  precision highp float; in vec2 aPos; uniform vec2 texel;
  out vec2 vUv, vL, vR, vT, vB;
  void main(){ vUv = aPos * .5 + .5; vL = vUv - vec2(texel.x, 0.); vR = vUv + vec2(texel.x, 0.); vT = vUv + vec2(0., texel.y); vB = vUv - vec2(0., texel.y); gl_Position = vec4(aPos, 0., 1.); }`;
  const head = `#version 300 es
  precision highp float; precision highp sampler2D; in vec2 vUv, vL, vR, vT, vB; out vec4 o;`;
  const FS = {
    splat: `${head} uniform sampler2D uT; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
      void main(){ vec2 p = vUv - point; p.x *= aspect; vec3 s = exp(-dot(p, p) / radius) * color; o = vec4(texture(uT, vUv).xyz + s, 1.); }`,
    advect: `${head} uniform sampler2D uVel, uSrc; uniform vec2 velTexel; uniform float dt, diss;
      void main(){ vec2 c = vUv - dt * texture(uVel, vUv).xy * velTexel; o = texture(uSrc, c) / (1. + diss * dt); }`,
    divergence: `${head} uniform sampler2D uVel;
      void main(){ float L = texture(uVel, vL).x, R = texture(uVel, vR).x, T = texture(uVel, vT).y, B = texture(uVel, vB).y; vec2 C = texture(uVel, vUv).xy;
        if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;
        o = vec4(.5 * (R - L + T - B), 0., 0., 1.); }`,
    curl: `${head} uniform sampler2D uVel;
      void main(){ float L = texture(uVel, vL).y, R = texture(uVel, vR).y, T = texture(uVel, vT).x, B = texture(uVel, vB).x; o = vec4(.5 * (R - L - T + B), 0., 0., 1.); }`,
    vorticity: `${head} uniform sampler2D uVel, uCurl; uniform float curl, dt;
      void main(){ float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
        vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + .0001; f *= curl * C; f.y *= -1.;
        vec2 v = texture(uVel, vUv).xy + f * dt; o = vec4(clamp(v, -1000., 1000.), 0., 1.); }`,
    clear: `${head} uniform sampler2D uT; uniform float value; void main(){ o = value * texture(uT, vUv); }`,
    pressure: `${head} uniform sampler2D uP, uDiv;
      void main(){ float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x; o = vec4((L + R + B + T - texture(uDiv, vUv).x) * .25, 0., 0., 1.); }`,
    gradient: `${head} uniform sampler2D uP, uVel;
      void main(){ float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x; vec2 v = texture(uVel, vUv).xy - vec2(R - L, T - B); o = vec4(v, 0., 1.); }`,
    display: `${head} uniform sampler2D uT;
      void main(){ vec3 c = texture(uT, vUv).rgb; c = 1. - exp(-c * 1.6); float a = clamp(max(c.r, max(c.g, c.b)) * 1.05, 0., 1.); o = vec4(min(c, vec3(a)), a); }`
  };

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VS);
  const prog = {};
  for (const k in FS) {
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FS[k])); gl.bindAttribLocation(p, 0, "aPos"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    prog[k] = { p, u };
  }

  // full-screen triangle pair
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);

  function fbo(w, h, filter) {
    gl.activeTexture(gl.TEXTURE0);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f, w, h, tx: [1 / w, 1 / h], bind(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); return unit; } };
  }
  const dbl = (w, h, f) => { let a = fbo(w, h, f), b = fbo(w, h, f); return { get r() { return a; }, get w() { return b; }, swap() { [a, b] = [b, a]; } }; };
  const res = n => { let a = innerWidth / Math.max(1, innerHeight); if (a < 1) a = 1 / a; const hi = Math.round(n * a), lo = Math.round(n); return innerWidth > innerHeight ? [hi, lo] : [lo, hi]; };

  let dye, vel, div, curlT, pres, aspectNow = 0;
  function init() {
    const [sw, sh] = res(CFG.SIM), [dw, dh] = res(CFG.DYE);
    dye = dbl(dw, dh, gl.LINEAR); vel = dbl(sw, sh, gl.LINEAR);
    div = fbo(sw, sh, gl.NEAREST); curlT = fbo(sw, sh, gl.NEAREST); pres = dbl(sw, sh, gl.NEAREST);
    aspectNow = innerWidth / innerHeight;
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("fbo");
  }
  function sizeCanvas() {
    const k = Math.min(1, devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * k); canvas.height = Math.round(innerHeight * k);
  }
  try { sizeCanvas(); init(); } catch (e) { console.warn("[fluid]", e); return; }
  addEventListener("resize", () => {
    sizeCanvas();
    if (Math.abs(innerWidth / innerHeight - aspectNow) > 0.25) init();   // orientation change
    wake();
  });

  function blit(target) {
    if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); }
    else { gl.viewport(0, 0, canvas.width, canvas.height); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
  const use = (k, texel) => { const P = prog[k]; gl.useProgram(P.p); if (P.u.texel) gl.uniform2fv(P.u.texel, texel); return P.u; };

  /* ---------- splats ---------- */
  const queue = [];
  function splat(x, y, dx, dy, color, r) {
    const ar = canvas.width / canvas.height;
    let u = use("splat", vel.r.tx);
    gl.uniform1i(u.uT, vel.r.bind(0)); gl.uniform1f(u.aspect, ar);
    gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, dx, dy, 0);
    const rad = (r || CFG.RADIUS) * (ar > 1 ? ar : 1);
    gl.uniform1f(u.radius, rad); blit(vel.w); vel.swap();
    u = use("splat", dye.r.tx);
    gl.uniform1i(u.uT, dye.r.bind(0)); gl.uniform3fv(u.color, color); blit(dye.w); dye.swap();
  }
  const PAL = [[.62, .5, .28], [.56, .57, .55], [.66, .56, .38], [.6, .6, .58], [.5, .52, .5]];
  let palI = 0;
  const pick = k => { const c = PAL[(palI++) % PAL.length]; return [c[0] * k, c[1] * k, c[2] * k]; };
  function push(cx, cy, dxPx, dyPx, color, r) {
    queue.push({ x: cx / innerWidth, y: 1 - cy / innerHeight, dx: (dxPx / innerWidth) * CFG.FORCE, dy: (-dyPx / innerHeight) * CFG.FORCE, color, r });
    wake();
  }

  // pointer (mouse) + touch (works while the page scrolls)
  let last = null;
  addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    if (last) { const dx = e.clientX - last.x, dy = e.clientY - last.y; if (dx * dx + dy * dy > 4) push(e.clientX, e.clientY, dx, dy, pick(.13)); }
    last = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  addEventListener("pointerleave", () => { last = null; });
  let tl = null;
  addEventListener("touchstart", e => { const t = e.touches[0]; tl = { x: t.clientX, y: t.clientY, t: performance.now() }; push(t.clientX, t.clientY, 0, -6, pick(.09), CFG.RADIUS * 1.2); }, { passive: true });
  addEventListener("touchmove", e => {
    const t = e.touches[0]; if (!tl) { tl = { x: t.clientX, y: t.clientY }; return; }
    const dx = t.clientX - tl.x, dy = t.clientY - tl.y, now = performance.now();
    if (dx * dx + dy * dy > 16 && now - tl.t > 24) { push(t.clientX, t.clientY, dx * 1.3, dy * 1.3, pick(.11)); tl = { x: t.clientX, y: t.clientY, t: now }; }
  }, { passive: true });
  addEventListener("touchend", () => { tl = null; }, { passive: true });

  // external puffs
  addEventListener("dodara:smoke", e => { const d = e.detail || {}; push(d.x, d.y, d.dx || 0, d.dy || 0, d.color || pick(.18), d.r); });

  // ambient wisps near the top of the page so there is always a little smoke drifting
  let ambT = 0;
  function ambient(now) {
    if (now - ambT < 2600 || scrollY > innerHeight * 1.2) return;
    ambT = now;
    const x = innerWidth * (.15 + Math.random() * .7);
    push(x, innerHeight + 10, (Math.random() - .5) * 30, -70, pick(.07), CFG.RADIUS * 3);
  }

  /* ---------- simulation step ---------- */
  function step(dt) {
    gl.disable(gl.BLEND);
    let u = use("curl", vel.r.tx); gl.uniform1i(u.uVel, vel.r.bind(0)); blit(curlT);
    u = use("vorticity", vel.r.tx); gl.uniform1i(u.uVel, vel.r.bind(0)); gl.uniform1i(u.uCurl, curlT.bind(1)); gl.uniform1f(u.curl, CFG.CURL); gl.uniform1f(u.dt, dt); blit(vel.w); vel.swap();
    u = use("divergence", vel.r.tx); gl.uniform1i(u.uVel, vel.r.bind(0)); blit(div);
    u = use("clear", pres.r.tx); gl.uniform1i(u.uT, pres.r.bind(0)); gl.uniform1f(u.value, CFG.PRESSURE); blit(pres.w); pres.swap();
    u = use("pressure", vel.r.tx); gl.uniform1i(u.uDiv, div.bind(0));
    for (let i = 0; i < CFG.ITER; i++) { gl.uniform1i(u.uP, pres.r.bind(1)); blit(pres.w); pres.swap(); }
    u = use("gradient", vel.r.tx); gl.uniform1i(u.uP, pres.r.bind(0)); gl.uniform1i(u.uVel, vel.r.bind(1)); blit(vel.w); vel.swap();
    u = use("advect", vel.r.tx); gl.uniform2fv(u.velTexel, vel.r.tx); gl.uniform1i(u.uVel, vel.r.bind(0)); gl.uniform1i(u.uSrc, vel.r.bind(0)); gl.uniform1f(u.dt, dt); gl.uniform1f(u.diss, CFG.VELOCITY_DISSIPATION); blit(vel.w); vel.swap();
    u = use("advect", dye.r.tx); gl.uniform2fv(u.velTexel, vel.r.tx); gl.uniform1i(u.uVel, vel.r.bind(0)); gl.uniform1i(u.uSrc, dye.r.bind(1)); gl.uniform1f(u.diss, CFG.DENSITY_DISSIPATION); blit(dye.w); dye.swap();
  }
  function render() {
    const u = use("display", dye.r.tx); gl.uniform1i(u.uT, dye.r.bind(0)); blit(null);
  }

  /* ---------- loop: runs only while there is smoke to move ---------- */
  let running = false, lastT = 0, activeUntil = 0;
  function wake() { activeUntil = performance.now() + CFG.IDLE_MS; if (!running && !document.hidden) { running = true; lastT = performance.now(); requestAnimationFrame(loop); } }
  function loop(now) {
    if (document.hidden) { running = false; return; }
    const dt = Math.min(0.0167 * 1.5, (now - lastT) / 1000); lastT = now;
    ambient(now);
    while (queue.length) { const q = queue.shift(); splat(q.x, q.y, q.dx, q.dy, q.color, q.r); }
    step(dt); render();
    if (now < activeUntil || scrollY < innerHeight * 1.2) requestAnimationFrame(loop);
    else { running = false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  addEventListener("scroll", () => { if (scrollY < innerHeight * 1.2) wake(); }, { passive: true });
  canvas.classList.add("on");
  wake();
}
})();
