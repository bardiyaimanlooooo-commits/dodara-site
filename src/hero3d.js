/*
 * Dodara — WebGL hero scene
 * A real 3D Al Fakher tin floating over a gold ring, wrapped in shader smoke
 * and drifting gold dust. Drag / swipe to rotate, tap to spin.
 *
 * Source file. The site loads the bundled build in /assets/hero3d.js
 * Rebuild after edits:  cd src && npm install && npm run build
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshPhysicalMaterial, MeshBasicMaterial,
  ShaderMaterial, PlaneGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute, Points,
  TextureLoader, SRGBColorSpace, ACESFilmicToneMapping, PMREMGenerator, AdditiveBlending,
  DirectionalLight, PointLight, Color, Vector2, Vector3, Plane, Raycaster
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const hero = document.querySelector(".hero");
const canvas = document.getElementById("gl");
const stage = document.getElementById("stage");

const TEX = "/assets/3d/";
const TIN_H = 1.03;          // tin height (width = depth = 1)
const RING_Y = -0.84;        // ring / floor height under the tin
const COMP_H = 1.5;          // world height of the whole composition (ring → lid)
const COMP_W = 2.1;          // world width (ring glow)

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const smooth = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function hasWebGL2() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

/* ---------------- shaders ---------------- */
const NOISE = /* glsl */`
float hash(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++){ s += a * noise(p); p = ROT * p; a *= 0.5; } return s; }
`;
const PLANE_VS = /* glsl */`
varying vec2 vUv; varying vec2 vP;
void main(){ vUv = uv; vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// rising plume behind the tin
const PLUME_FS = /* glsl */`
uniform float uTime, uAlpha, uFade, uSeed, uMA; uniform vec2 uMouse, uSize; uniform vec3 uC1, uC2;
varying vec2 vUv; varying vec2 vP;
${NOISE}
void main(){
  float t = uTime;
  vec2 p = vec2((vUv.x - 0.5) * uSize.x, vUv.y * uSize.y);
  vec2 dm = vP - uMouse; float m = exp(-dot(dm, dm) * 2.5) * uMA; p += dm * m * 0.9;
  float s = sin(p.y * 1.25 - t * 0.45 + uSeed) * 0.24 + sin(p.y * 2.6 + t * 0.31 + uSeed * 2.0) * 0.08;
  vec2 q = vec2(p.x - s * smoothstep(0.0, 1.5, p.y), p.y - t * 0.36);
  vec2 w = vec2(fbm(q * 1.15 + vec2(uSeed, 0.0)), fbm(q * 1.15 + vec2(5.2, 1.3 + uSeed)));
  float f = fbm(q * 1.9 + (w - 0.5) * 2.7 + vec2(0.0, -t * 0.15));
  float width = 0.22 + p.y * 0.34;
  float col = 1.0 - smoothstep(width * 0.3, width, abs(p.x - s * 1.1 - (w.x - 0.5) * 0.75));
  float vm = smoothstep(0.0, 0.75, p.y) * (1.0 - smoothstep(uSize.y * 0.5, uSize.y * 0.97, p.y));
  float d = smoothstep(0.36, 0.84, f) * col * vm;
  vec3 c = mix(uC1, uC2, smoothstep(0.3, 0.75, w.y));
  gl_FragColor = vec4(c, d * uAlpha * uFade);
}
`;
// low wisps drifting around the base / ring
const WISP_FS = /* glsl */`
uniform float uTime, uAlpha, uFade, uSeed, uMA; uniform vec2 uMouse, uSize; uniform vec3 uC1, uC2;
varying vec2 vUv; varying vec2 vP;
${NOISE}
void main(){
  float t = uTime;
  vec2 p = (vUv - 0.5) * uSize;
  vec2 dm = vP - uMouse; float m = exp(-dot(dm, dm) * 2.5) * uMA; p += dm * m * 0.8;
  vec2 q = p * 1.35 + vec2(t * 0.09, -t * 0.05);
  float g = fbm(q * 1.4 + vec2(t * 0.04 + uSeed, 0.0));
  float f = fbm(q + (g - 0.5) * 1.9);
  float mask = (1.0 - smoothstep(0.1, uSize.y * 0.5, abs(p.y))) * (1.0 - smoothstep(uSize.x * 0.22, uSize.x * 0.5, abs(p.x)));
  float d = smoothstep(0.42, 0.86, f) * mask;
  gl_FragColor = vec4(mix(uC1, uC2, g), d * uAlpha * uFade);
}
`;
// wide, slow ambient haze far behind everything
const HAZE_FS = /* glsl */`
uniform float uTime, uAlpha, uFade, uSeed, uMA; uniform vec2 uMouse, uSize; uniform vec3 uC1, uC2;
varying vec2 vUv; varying vec2 vP;
${NOISE}
void main(){
  float t = uTime;
  vec2 p = (vUv - 0.5) * uSize;
  vec2 q = p * 0.42 + vec2(t * 0.025, -t * 0.04);
  float g = fbm(q * 0.8 + vec2(0.0, t * 0.015));
  float f = fbm(q + (g - 0.5) * 2.2);
  vec2 e = vUv - 0.5; float vig = 1.0 - smoothstep(0.18, 0.5, length(e * vec2(1.0, 1.4)));
  float d = smoothstep(0.35, 0.9, f) * vig;
  gl_FragColor = vec4(mix(uC1, uC2, g), d * uAlpha * uFade);
}
`;
const GLOW_FS = /* glsl */`
uniform float uFade, uTime; uniform vec3 uGold, uEm;
varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float ring = exp(-pow((d - 0.43) * 13.0, 2.0));
  float core = exp(-d * d * 7.0);
  float pulse = 0.85 + 0.15 * sin(uTime * 1.6);
  vec3 c = (uGold * ring * 0.85 * pulse + uEm * core * 0.32) * uFade;
  gl_FragColor = vec4(c, min(1.0, max(c.r, max(c.g, c.b))));
}
`;
const SHADOW_FS = /* glsl */`
uniform float uOp; varying vec2 vUv;
void main(){ float d = length(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.0, 1.0, d)); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uOp); }
`;
const DUST_VS = /* glsl */`
attribute vec3 aRand; uniform float uTime, uPR, uFade, uSize;
varying float vA;
void main(){
  float t = uTime;
  float h = mod(position.y + t * (0.07 + aRand.z * 0.12), 3.8) - 1.25;
  float ang = aRand.y + t * (0.05 + aRand.z * 0.09);
  vec3 p = vec3(cos(ang) * aRand.x, h, sin(ang) * aRand.x);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.45 + 0.55 * sin(t * 2.1 + aRand.z * 40.0);
  vA = tw * smoothstep(-1.25, -0.8, h) * (1.0 - smoothstep(1.9, 2.55, h)) * uFade;
  gl_PointSize = uSize * (0.45 + aRand.z) * uPR * (7.0 / -mv.z);
}
`;
const DUST_FS = /* glsl */`
uniform vec3 uColor; varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); vec3 c = uColor * a * a * vA; gl_FragColor = vec4(c, min(1.0, max(c.r, max(c.g, c.b)))); }
`;

/* ---------------- scene ---------------- */
async function init() {
  if (!hero || !canvas || !stage) return;
  if (!hasWebGL2()) { hero.classList.add("no-gl"); return; }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  let tier = coarse ? (cores <= 4 || mem <= 2 ? 0 : 1) : 2;      // 0 low · 1 phone · 2 desktop
  let prMax = [1.75, 2.5, 2][tier];   // keep the tin crisp on high-DPI phones
  const OCT = tier === 2 ? 5 : 4;

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance", premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.62;
  pmrem.dispose();

  const camera = new PerspectiveCamera(28, 1, 0.1, 60);
  const rig = new Group(); scene.add(rig);          // intro + scroll transforms
  const spinner = new Group(); rig.add(spinner);    // drag / auto rotation
  const floatG = new Group(); spinner.add(floatG);  // bobbing

  /* textures */
  const loader = new TextureLoader();
  const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const load = n => loader.loadAsync(TEX + n + ".webp").then(t => { t.colorSpace = SRGBColorSpace; t.anisotropy = aniso; return t; });
  const [tFront, tRight, tBack, tTop] = await Promise.all(["front", "right", "back", "top"].map(load));

  /* the tin */
  const mat = map => new MeshPhysicalMaterial({ map, roughness: 0.36, metalness: 0.32, clearcoat: 1, clearcoatRoughness: 0.14 });
  const tin = new Mesh(new RoundedBoxGeometry(1, TIN_H, 1, 6, 0.075), [
    mat(tRight), mat(tRight), mat(tTop),
    new MeshPhysicalMaterial({ color: 0x060606, roughness: 0.5, metalness: 0.6 }),
    mat(tFront), mat(tBack)
  ]);
  floatG.add(tin);

  /* lights */
  const key = new DirectionalLight(0xfff0d8, 2.3); key.position.set(3, 4, 5); scene.add(key);
  const rim = new DirectionalLight(0xffc56b, 4.2); rim.position.set(-4, 2.2, -3.5); scene.add(rim);
  const rim2 = new DirectionalLight(0xffd79a, 2.2); rim2.position.set(4.5, 1, -3); scene.add(rim2);
  const em = new PointLight(0x2fe0a0, 5, 7, 2); em.position.set(-2.1, -0.4, -1.4); scene.add(em);

  /* gold ring + floor glow + contact shadow (in rig, not spinning) */
  const GOLD = new Color(0xf2c977), EM = new Color(0x1fb57d);
  const ring = new Mesh(new TorusGeometry(0.86, 0.007, 10, 220), new MeshBasicMaterial({ color: 0xf6d38c, toneMapped: false, transparent: true }));
  ring.rotation.x = Math.PI / 2; ring.position.y = RING_Y; rig.add(ring);
  const ring2 = new Mesh(new TorusGeometry(1.12, 0.004, 8, 220), new MeshBasicMaterial({ color: 0xf6d38c, toneMapped: false, transparent: true, opacity: 0.32 }));
  ring2.rotation.x = Math.PI / 2; ring2.position.y = RING_Y; rig.add(ring2);
  const glowU = { uFade: { value: 0 }, uTime: { value: 0 }, uGold: { value: GOLD }, uEm: { value: EM } };
  const glow = new Mesh(new PlaneGeometry(4, 4), new ShaderMaterial({ uniforms: glowU, vertexShader: PLANE_VS, fragmentShader: GLOW_FS, blending: AdditiveBlending, premultipliedAlpha: true, transparent: true, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = RING_Y - 0.004; rig.add(glow);
  const shU = { uOp: { value: 0.6 } };
  const shadow = new Mesh(new PlaneGeometry(1.9, 1.9), new ShaderMaterial({ uniforms: shU, vertexShader: PLANE_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = RING_Y + 0.002; rig.add(shadow);

  /* smoke planes */
  const mouse = new Vector2(99, 99);
  const smokes = [];
  const smoke = (fs, w, h, pos, alpha, seed, c1, c2, order) => {
    const u = {
      uTime: { value: 0 }, uAlpha: { value: alpha }, uFade: { value: 0 }, uSeed: { value: seed }, uMA: { value: 0 },
      uMouse: { value: new Vector2(99, 99) }, uSize: { value: new Vector2(w, h) }, uC1: { value: new Color(c1) }, uC2: { value: new Color(c2) }
    };
    const m = new Mesh(new PlaneGeometry(w, h), new ShaderMaterial({ uniforms: u, vertexShader: PLANE_VS, fragmentShader: fs, defines: { OCT }, transparent: true, depthWrite: false }));
    m.position.copy(pos); m.renderOrder = order; rig.add(m); smokes.push(m);
    return m;
  };
  const haze = tier > 0 ? smoke(HAZE_FS, 12, 7, new Vector3(0, 0.6, -3.2), 0.16, 3.1, 0x0f3d2c, 0x5a4626, -2) : null;
  const plumeH = 4.4;
  smoke(PLUME_FS, 3.2, plumeH, new Vector3(0, 0.05 + plumeH / 2, -0.75), 0.78, 1.7, 0xdfeee6, 0xf6e2b4, -1);
  const wisp = smoke(WISP_FS, 4.2, 1.5, new Vector3(0, RING_Y + 0.22, 0.75), 0.42, 7.3, 0xe9f2ed, 0xf3dcaa, 2);

  /* gold dust */
  const N = [80, 150, 260][tier];
  const pos = new Float32Array(N * 3), rnd = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3 + 1] = Math.random() * 3.8;
    rnd[i * 3] = 0.55 + Math.pow(Math.random(), 0.7) * 1.7;
    rnd[i * 3 + 1] = Math.random() * Math.PI * 2;
    rnd[i * 3 + 2] = Math.random();
  }
  const dg = new BufferGeometry();
  dg.setAttribute("position", new Float32BufferAttribute(pos, 3));
  dg.setAttribute("aRand", new Float32BufferAttribute(rnd, 3));
  const dustU = { uTime: { value: 0 }, uPR: { value: 1 }, uFade: { value: 0 }, uSize: { value: 7 }, uColor: { value: new Color(1.0, 0.82, 0.48) } };
  const dust = new Points(dg, new ShaderMaterial({ uniforms: dustU, vertexShader: DUST_VS, fragmentShader: DUST_FS, blending: AdditiveBlending, premultipliedAlpha: true, transparent: true, depthWrite: false }));
  dust.frustumCulled = false; dust.renderOrder = 3; rig.add(dust);

  /* ---------- layout: put the composition exactly where #stage is ---------- */
  let W = 1, H = 1, pr = Math.min(devicePixelRatio || 1, prMax), dist = 6; const _sz = new Vector2();
  const ELEV = 0.13;  // camera elevation (rad) — sees a bit of the lid
  function layout() {
    const cr = canvas.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(cr.width)); H = Math.max(1, Math.round(cr.height));
    if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
    const sz = renderer.getSize(_sz); if (sz.x !== W || sz.y !== H) renderer.setSize(W, H, false);
    dustU.uPR.value = pr;
    const cx = (sr.left + sr.width / 2 - cr.left) / W, cy = (sr.top + sr.height / 2 - cr.top) / H;
    const tf = 2 * Math.tan((camera.fov * Math.PI) / 360);
    dist = Math.max(COMP_H * H / (tf * sr.height * 0.86), COMP_W * H / (tf * sr.width * 0.98));
    camera.aspect = W / H;
    camera.setViewOffset(W, H, W * (0.5 - cx), H * (0.5 - cy), W, H);
    camera.updateProjectionMatrix();
  }
  layout();
  let rT, needLayout = false; const onResize = () => { clearTimeout(rT); rT = setTimeout(() => { needLayout = true; dirty = true; }, 80); };
  addEventListener("resize", onResize);
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(stage);

  /* ---------- interaction ---------- */
  const ray = new Raycaster(), ndc = new Vector2(), hit = new Vector3();
  const AUTO = reduce ? 0 : 0.32;           // rad/s idle spin
  let rotY = -0.6, vel = AUTO, tiltX = 0, tiltT = 0, drag = null, dirty = true, used = false;
  let par = new Vector2(), parT = new Vector2(), mAmt = 0;
  const setNdc = (x, y) => { const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
  const onTin = (x, y) => { setNdc(x, y); return ray.intersectObject(tin, false).length > 0; };
  const markUsed = () => { if (!used) { used = true; hero.classList.add("used"); } };

  canvas.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), lt: performance.now(), moved: 0 };
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) {
      if (e.pointerType === "mouse") canvas.style.cursor = onTin(e.clientX, e.clientY) ? "grab" : "";
      return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now();
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 6 && !drag.cap) { drag.cap = true; try { canvas.setPointerCapture(e.pointerId); } catch {} canvas.style.cursor = "grabbing"; markUsed(); }
    if (drag.cap) {
      rotY += dx * 0.011;
      vel = (dx * 0.011) / Math.max(0.008, (now - drag.lt) / 1000);
      tiltT = clamp(tiltT + dy * 0.004, -0.35, 0.35);
    }
    drag.x = e.clientX; drag.y = e.clientY; drag.lt = now; dirty = true;
  });
  const end = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const tap = drag.moved < 6 && performance.now() - drag.t < 350;
    if (tap && e.type === "pointerup" && onTin(e.clientX, e.clientY)) { vel += 11; markUsed(); }
    vel = clamp(vel, -14, 14);
    canvas.style.cursor = ""; drag = null; dirty = true;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // pointer parallax + smoke push (fine pointers only)
  if (!coarse) addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const r = hero.getBoundingClientRect(); if (e.clientY > r.bottom) return;
    parT.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    setNdc(e.clientX, e.clientY);
    mAmt = 1;
    for (const s of smokes) {
      const pl = new Plane().setFromNormalAndCoplanarPoint(new Vector3(0, 0, 1), s.getWorldPosition(new Vector3()));
      if (ray.ray.intersectPlane(pl, hit)) { s.worldToLocal(hit); s.material.uniforms.uMouse.value.set(hit.x, hit.y); }
    }
  }, { passive: true });

  /* ---------- visibility ---------- */
  let visible = true, running = false;
  const sync = () => {
    const should = visible && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); renderer.setAnimationLoop(frame); }
    else if (!should && running) { running = false; renderer.setAnimationLoop(null); }
  };
  new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }, { rootMargin: "80px" }).observe(hero);
  document.addEventListener("visibilitychange", sync);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); hero.classList.remove("gl-on"); running = false; renderer.setAnimationLoop(null); });

  /* ---------- loop ---------- */
  let last = performance.now(), time = reduce ? 6 : 0, t0 = -1, first = true;
  let perfN = 0, perfT = 0, degrade = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const moving = !reduce || drag || Math.abs(vel - AUTO) > 0.01 || Math.abs(tiltX - tiltT) > 0.001;
    if (!moving && !dirty) return;
    dirty = false;
    if (needLayout) { needLayout = false; layout(); }
    if (t0 < 0) t0 = now;
    const it = reduce ? 10 : (now - t0) / 1000;     // seconds since start
    if (!reduce) time += dt;

    // intro
    const k = reduce ? 1 : ease(it / 1.9);
    const fade = reduce ? 1 : smooth(0.2, 2.6, it);

    // spin with inertia → returns to idle speed
    if (!drag) { vel += (AUTO - vel) * Math.min(1, dt * 1.6); rotY += vel * dt; tiltT *= Math.pow(0.12, dt); }
    tiltX += (tiltT - tiltX) * Math.min(1, dt * 8);

    // scroll progress through hero
    const hr = hero.getBoundingClientRect();
    const sp = clamp(-hr.top / Math.max(1, hr.height), 0, 1);

    spinner.rotation.set(tiltX, rotY + (1 - k) * -3.4 + sp * 2.4, 0);
    const bob = reduce ? 0 : Math.sin(time * 1.25) * 0.055;
    floatG.position.y = bob; floatG.rotation.z = reduce ? 0 : Math.sin(time * 0.9) * 0.025;
    rig.position.y = 0.16 + (1 - k) * -0.75 + sp * 0.75;
    const sc = (0.55 + 0.45 * k) * (1 - sp * 0.18);
    rig.scale.setScalar(sc);
    ring.scale.setScalar(0.35 + 0.65 * k); ring2.scale.setScalar(0.2 + 0.8 * ease((it - 0.3) / 1.8));
    ring.material.opacity = k; ring2.material.opacity = 0.32 * ease((it - 0.3) / 1.8);
    shU.uOp.value = (0.62 - bob * 1.6) * k;
    glowU.uFade.value = k; glowU.uTime.value = time;

    // parallax camera
    par.lerp(parT, Math.min(1, dt * 3));
    mAmt *= Math.pow(0.35, dt);
    const ax = par.x * 0.16, ay = ELEV + par.y * 0.06;
    camera.position.set(Math.sin(ax) * dist * Math.cos(ay), Math.sin(ay) * dist, Math.cos(ax) * dist * Math.cos(ay));
    camera.lookAt(0, 0, 0);

    for (const s of smokes) { const u = s.material.uniforms; u.uTime.value = time; u.uFade.value = fade * (1 - sp * 0.6); u.uMA.value = mAmt; }
    dustU.uTime.value = time; dustU.uFade.value = fade;

    renderer.render(scene, camera);
    if (first) { first = false; hero.classList.add("gl-on"); }

    // adaptive quality: watch frame time once the intro has settled
    if (!reduce && it > 2.5 && degrade < 6) {
      perfT += dt; perfN++;
      if (perfN >= 60) {
        const avg = perfT / perfN; perfN = 0; perfT = 0;
        if (avg > 0.024) {
          // shed smoke detail first; sharpness of the tin is the last thing to go
          degrade++;
          if (haze && haze.visible) haze.visible = false;
          else if (wisp.visible) wisp.visible = false;
          else if (pr > 1.5) { pr = Math.max(1.5, pr - 0.5); needLayout = true; }
          else if (dust.visible) dust.visible = false;
          else if (pr > 1) { pr = 1; needLayout = true; degrade = 6; }
          else degrade = 6;
        } else degrade = 6;  // fast enough — stop checking
      }
    }
  }
  sync();
}

// start as soon as the module runs (textures load in parallel with the rest of the page)
init().catch(err => { console.warn("[hero3d]", err); if (hero) hero.classList.add("no-gl"); });
