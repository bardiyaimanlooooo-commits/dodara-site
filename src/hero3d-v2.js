/*
 * Dodara v2 — WebGL hero: the tin opens.
 * Separate lid + body, tobacco visible inside, the lid floats open after the
 * intro and smoke rises out of the tin into the page-wide smoke simulation
 * (assets/fluid.js) via "dodara:smoke" events.
 * Drag / swipe the stage to rotate, tap the tin to open / close the lid.
 *
 * Source file. Build:  cd src && npm install && npm run build
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial,
  ShaderMaterial, PlaneGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute, Points, TextureLoader, CanvasTexture,
  SRGBColorSpace, ACESFilmicToneMapping, PMREMGenerator, AdditiveBlending, DirectionalLight, PointLight, Color, Vector2, Vector3, Raycaster, Quaternion
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const hero = document.querySelector(".hero");
const canvas = document.getElementById("gl");
const stage = document.getElementById("stage");

const TEX = "/assets/3d/";
const TIN_H = 1.03;
const LID_F = { right: 0.181, front: 0.168, back: 0.173 };   // lid seam height in each photo (fraction from top)
const LID_H = TIN_H * 0.176, BODY_H = TIN_H - LID_H;
const BODY_Y = -TIN_H / 2 + BODY_H / 2, LID_Y = TIN_H / 2 - LID_H / 2;
const RING_Y = -0.84;
const COMP_H = 2.2, COMP_W = 2.1, COMP_CY = 0.04;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeIO = t => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const smooth = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hasWebGL2 = () => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } };

/* ---------- shaders (glow ring, contact shadow, gold dust) ---------- */
const PLANE_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GLOW_FS = `uniform float uFade, uTime, uOpen; uniform vec3 uGold, uEm; varying vec2 vUv;
void main(){ float d = length(vUv - 0.5) * 2.0; float ring = exp(-pow((d - 0.43) * 13.0, 2.0)); float core = exp(-d * d * 7.0);
  float pulse = 0.85 + 0.15 * sin(uTime * 1.6); vec3 c = (uGold * ring * 0.85 * pulse + uEm * core * (0.3 + 0.25 * uOpen)) * uFade;
  gl_FragColor = vec4(c, min(1.0, max(c.r, max(c.g, c.b)))); }`;
const SHADOW_FS = `uniform float uOp; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = 1.0 - smoothstep(0.0, 1.0, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uOp); }`;
const DUST_VS = `attribute vec3 aRand; uniform float uTime, uPR, uFade, uSize; varying float vA;
void main(){ float t = uTime; float h = mod(position.y + t * (0.07 + aRand.z * 0.12), 3.8) - 1.25; float ang = aRand.y + t * (0.05 + aRand.z * 0.09);
  vec3 p = vec3(cos(ang) * aRand.x, h, sin(ang) * aRand.x); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float tw = 0.45 + 0.55 * sin(t * 2.1 + aRand.z * 40.0); vA = tw * smoothstep(-1.25, -0.8, h) * (1.0 - smoothstep(1.9, 2.55, h)) * uFade;
  gl_PointSize = uSize * (0.45 + aRand.z) * uPR * (7.0 / -mv.z); }`;
const DUST_FS = `uniform vec3 uColor; varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); vec3 c = uColor * a * a * vA; gl_FragColor = vec4(c, min(1.0, max(c.r, max(c.g, c.b)))); }`;

/* ---------- procedural tobacco (seen when the lid is off) ---------- */
function tobaccoTexture() {
  const S = 512, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  g.fillStyle = "#1c1c1c"; g.fillRect(0, 0, S, S);                       // tin wall edge
  const rim = 30, r = 46;
  const rr = (x, y, w, h, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); };
  const edge = g.createLinearGradient(0, 0, S, S); edge.addColorStop(0, "#5a5a5a"); edge.addColorStop(.5, "#1a1a1a"); edge.addColorStop(1, "#3c3c3c");
  rr(6, 6, S - 12, S - 12, r); g.fillStyle = edge; g.fill();
  rr(rim, rim, S - 2 * rim, S - 2 * rim, r - 14); g.save(); g.clip();
  g.fillStyle = "#2b170b"; g.fillRect(0, 0, S, S);
  const cols = ["#4a2a12", "#6b3d18", "#7d4a1e", "#3a210f", "#8f5a26", "#5a3315", "#a2692e"];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) {                                     // shredded leaf fibres
    const x = rnd() * S, y = rnd() * S, len = 6 + rnd() * 26, a = rnd() * Math.PI * 2, bend = (rnd() - .5) * 12;
    g.strokeStyle = cols[(rnd() * cols.length) | 0]; g.globalAlpha = .55 + rnd() * .45; g.lineWidth = .8 + rnd() * 2.6; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * len / 2 + bend, y + Math.sin(a) * len / 2 - bend, x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 420; i++) {                                      // molasses glints
    const x = rnd() * S, y = rnd() * S; g.fillStyle = `rgba(255,${190 + rnd() * 40 | 0},120,${.08 + rnd() * .22})`;
    g.beginPath(); g.ellipse(x, y, 1 + rnd() * 3, .6 + rnd() * 1.4, rnd() * 3, 0, 7); g.fill();
  }
  const sh = g.createRadialGradient(S / 2, S / 2, S * .2, S / 2, S / 2, S * .62);   // inner shadow at the wall
  sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.75)"); g.fillStyle = sh; g.fillRect(0, 0, S, S);
  g.restore();
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/* remap the V coordinate of the four side faces of a RoundedBoxGeometry */
function remapSides(geo, ranges) {
  const uv = geo.attributes.uv, per = uv.count / 6;
  for (let i = 0; i < uv.count; i++) { const r = ranges[Math.floor(i / per)]; if (r) uv.setY(i, r[0] + uv.getY(i) * (r[1] - r[0])); }
  uv.needsUpdate = true; return geo;
}

async function init() {
  if (!hero || !canvas || !stage) return;
  if (!hasWebGL2()) { hero.classList.add("no-gl"); return; }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  const tier = coarse ? (cores <= 4 || mem <= 2 ? 0 : 1) : 2;
  const prMax = [1.75, 2.5, 2][tier];

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: (devicePixelRatio || 1) < 2, powerPreference: "high-performance", premultipliedAlpha: true });
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
  const rig = new Group(); scene.add(rig);
  const spinner = new Group(); rig.add(spinner);
  const floatG = new Group(); spinner.add(floatG);

  const loader = new TextureLoader();
  const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const load = n => loader.loadAsync(TEX + n + ".webp").then(t => { t.colorSpace = SRGBColorSpace; t.anisotropy = aniso; return t; });
  const [tFront, tRight, tBack, tTop] = await Promise.all(["front", "right", "back", "top"].map(load));
  const tTob = tobaccoTexture(); tTob.anisotropy = aniso;

  /* body + lid share the photos; UVs pick the part below / above the seam */
  const paint = map => new MeshPhysicalMaterial({ map, roughness: 0.36, metalness: 0.32, clearcoat: 1, clearcoatRoughness: 0.14 });
  const mR = paint(tRight), mF = paint(tFront), mB = paint(tBack), mT = paint(tTop);
  const dark = new MeshPhysicalMaterial({ color: 0x0b0b0b, roughness: 0.38, metalness: 0.7 });
  const tob = new MeshStandardMaterial({ map: tTob, roughness: 0.62, metalness: 0.05 });
  const bodyR = { right: [0, 1 - LID_F.right], front: [0, 1 - LID_F.front], back: [0, 1 - LID_F.back] };
  const lidR = { right: [1 - LID_F.right, 1], front: [1 - LID_F.front, 1], back: [1 - LID_F.back, 1] };
  const body = new Mesh(remapSides(new RoundedBoxGeometry(1, BODY_H, 1, 6, 0.075), [bodyR.right, bodyR.right, null, null, bodyR.front, bodyR.back]),
    [mR, mR, tob, dark, mF, mB]);
  body.position.y = BODY_Y; floatG.add(body);
  const lid = new Mesh(remapSides(new RoundedBoxGeometry(1.022, LID_H, 1.022, 5, 0.08), [lidR.right, lidR.right, null, null, lidR.front, lidR.back]),
    [mR, mR, mT, dark, mF, mB]);
  const lidG = new Group(); lidG.position.y = LID_Y; lidG.add(lid); floatG.add(lidG);

  /* lights */
  const key = new DirectionalLight(0xfff0d8, 2.3); key.position.set(3, 4, 5); scene.add(key);
  const rim = new DirectionalLight(0xffc56b, 4.2); rim.position.set(-4, 2.2, -3.5); scene.add(rim);
  const rim2 = new DirectionalLight(0xffd79a, 2.2); rim2.position.set(4.5, 1, -3); scene.add(rim2);
  const em = new PointLight(0x2fe0a0, 5, 7, 2); em.position.set(-2.1, -0.4, -1.4); scene.add(em);
  const ember = new PointLight(0xffb060, 0, 2.2, 2); ember.position.set(0, 0.55, 0.2); floatG.add(ember);   // warm glow from inside when open

  /* ring, glow, shadow */
  const GOLD = new Color(0xf2c977), EM = new Color(0x1fb57d);
  const ring = new Mesh(new TorusGeometry(0.86, 0.007, 10, 220), new MeshBasicMaterial({ color: 0xf6d38c, toneMapped: false, transparent: true }));
  ring.rotation.x = Math.PI / 2; ring.position.y = RING_Y; rig.add(ring);
  const ring2 = new Mesh(new TorusGeometry(1.12, 0.004, 8, 220), new MeshBasicMaterial({ color: 0xf6d38c, toneMapped: false, transparent: true, opacity: 0.32 }));
  ring2.rotation.x = Math.PI / 2; ring2.position.y = RING_Y; rig.add(ring2);
  const glowU = { uFade: { value: 0 }, uTime: { value: 0 }, uOpen: { value: 0 }, uGold: { value: GOLD }, uEm: { value: EM } };
  const glow = new Mesh(new PlaneGeometry(4, 4), new ShaderMaterial({ uniforms: glowU, vertexShader: PLANE_VS, fragmentShader: GLOW_FS, blending: AdditiveBlending, premultipliedAlpha: true, transparent: true, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = RING_Y - 0.004; rig.add(glow);
  const shU = { uOp: { value: 0.6 } };
  const shadow = new Mesh(new PlaneGeometry(1.9, 1.9), new ShaderMaterial({ uniforms: shU, vertexShader: PLANE_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = RING_Y + 0.002; rig.add(shadow);

  /* gold dust */
  const N = [70, 140, 240][tier];
  const pos = new Float32Array(N * 3), rnd = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3 + 1] = Math.random() * 3.8; rnd[i * 3] = 0.55 + Math.pow(Math.random(), 0.7) * 1.7; rnd[i * 3 + 1] = Math.random() * Math.PI * 2; rnd[i * 3 + 2] = Math.random(); }
  const dg = new BufferGeometry(); dg.setAttribute("position", new Float32BufferAttribute(pos, 3)); dg.setAttribute("aRand", new Float32BufferAttribute(rnd, 3));
  const dustU = { uTime: { value: 0 }, uPR: { value: 1 }, uFade: { value: 0 }, uSize: { value: 7 }, uColor: { value: new Color(1.0, 0.82, 0.48) } };
  const dust = new Points(dg, new ShaderMaterial({ uniforms: dustU, vertexShader: DUST_VS, fragmentShader: DUST_FS, blending: AdditiveBlending, premultipliedAlpha: true, transparent: true, depthWrite: false }));
  dust.frustumCulled = false; dust.renderOrder = 3; rig.add(dust);

  /* ---------- layout: composition centred in #stage ---------- */
  let W = 1, H = 1, pr = Math.min(devicePixelRatio || 1, prMax), dist = 6; const _sz = new Vector2();
  const ELEV = 0.3;  // higher than v1 so you can look into the open tin
  let heroTop = 0, heroH = 1, cvLeft = 0, cvTop = 0;
  function layout() {
    const cr = canvas.getBoundingClientRect(), sr = stage.getBoundingClientRect(), hb = hero.getBoundingClientRect();
    heroTop = hb.top + scrollY; heroH = hb.height; cvLeft = cr.left + scrollX; cvTop = cr.top + scrollY;
    W = Math.max(1, Math.round(cr.width)); H = Math.max(1, Math.round(cr.height));
    if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
    const sz = renderer.getSize(_sz); if (sz.x !== W || sz.y !== H) renderer.setSize(W, H, false); dustU.uPR.value = pr;
    const cx = (sr.left + sr.width / 2 - cr.left) / W, cy = (sr.top + sr.height / 2 - cr.top) / H;
    const tf = 2 * Math.tan((camera.fov * Math.PI) / 360);
    dist = Math.max(COMP_H * H / (tf * sr.height * 0.84), COMP_W * H / (tf * sr.width * 0.96));
    camera.aspect = W / H; camera.setViewOffset(W, H, W * (0.5 - cx), H * (0.5 - cy), W, H); camera.updateProjectionMatrix();
  }
  layout();
  let rT, needLayout = false; const onResize = () => { clearTimeout(rT); rT = setTimeout(() => { needLayout = true; dirty = true; }, 80); };
  addEventListener("resize", onResize);
  if ("ResizeObserver" in window) { const ro = new ResizeObserver(onResize); ro.observe(stage); ro.observe(hero); }

  /* ---------- interaction (on the stage element) ---------- */
  const ray = new Raycaster(), ndc = new Vector2();
  const AUTO = reduce ? 0 : 0.28;
  let rotY = -0.6, vel = AUTO, tiltX = 0, tiltT = 0, drag = null, dirty = true, used = false;
  let par = new Vector2(), parT = new Vector2();
  let openT = 0, openGoal = reduce ? 1 : 0, autoOpened = reduce;
  const setNdc = (x, y) => { const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
  const onTin = (x, y) => { setNdc(x, y); return ray.intersectObjects([body, lid], false).length > 0; };
  const markUsed = () => { if (!used) { used = true; hero.classList.add("used"); } };
  const hit = stage;
  hit.addEventListener("pointerdown", e => { if (e.button > 0) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), lt: performance.now(), moved: 0 }; });
  hit.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) { if (e.pointerType === "mouse") hit.style.cursor = onTin(e.clientX, e.clientY) ? "pointer" : "grab"; return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now();
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 6 && !drag.cap) { drag.cap = true; try { hit.setPointerCapture(e.pointerId); } catch {} hit.style.cursor = "grabbing"; markUsed(); }
    if (drag.cap) { rotY += dx * 0.011; vel = (dx * 0.011) / Math.max(0.008, (now - drag.lt) / 1000); tiltT = clamp(tiltT + dy * 0.004, -0.35, 0.35); }
    drag.x = e.clientX; drag.y = e.clientY; drag.lt = now; dirty = true;
  });
  const end = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const tap = drag.moved < 6 && performance.now() - drag.t < 350;
    if (tap && e.type === "pointerup" && onTin(e.clientX, e.clientY)) { openGoal = openGoal > 0.5 ? 0 : 1; autoOpened = true; vel += 4; markUsed(); if (openGoal) burst = 10; }
    vel = clamp(vel, -14, 14); hit.style.cursor = ""; drag = null; dirty = true;
  };
  hit.addEventListener("pointerup", end); hit.addEventListener("pointercancel", end);
  if (!coarse) addEventListener("pointermove", e => { if (e.pointerType === "mouse") parT.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1); }, { passive: true });

  /* ---------- smoke out of the open tin ---------- */
  const mouth = new Vector3();
  const qA = new Quaternion(), qB = new Quaternion(), qC = new Quaternion(), qD = new Quaternion(), lidOff = new Vector3();
  const AX = new Vector3(1, 0, 0), AY = new Vector3(0, 1, 0), AZ = new Vector3(0, 0, 1);
  let burst = 0, puffT = 0;
  function puff(now, strength) {
    const r = { left: cvLeft - scrollX, top: cvTop - scrollY, width: W, height: H };
    mouth.set((Math.random() - .5) * 0.55, BODY_H / 2 + 0.02, (Math.random() - .5) * 0.55);
    body.localToWorld(mouth); mouth.project(camera);
    if (mouth.z > 1) return;
    const x = r.left + (mouth.x + 1) / 2 * r.width, y = r.top + (1 - mouth.y) / 2 * r.height;
    if (y < -50 || y > innerHeight + 50) return;
    const k = .2 + Math.random() * .14;
    const warm = Math.random() < .35;
    dispatchEvent(new CustomEvent("dodara:smoke", { detail: { x, y, dx: (Math.random() - .5) * 22, dy: -(34 + Math.random() * 30) * strength,
      color: warm ? [.9 * k, .72 * k, .42 * k] : [.82 * k, .84 * k, .8 * k], r: 0.0006 + Math.random() * .0007 } }));
  }

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
  let last = performance.now(), time = reduce ? 6 : 0, t0 = -1, first = true, perfN = 0, perfT = 0, degrade = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const moving = !reduce || drag || Math.abs(vel - AUTO) > 0.01 || Math.abs(tiltX - tiltT) > 0.001 || Math.abs(openT - openGoal) > 0.001;
    if (!moving && !dirty) return;
    dirty = false;
    if (needLayout) { needLayout = false; layout(); }
    if (t0 < 0) t0 = now;
    const it = reduce ? 10 : (now - t0) / 1000;
    if (!reduce) time += dt;
    const k = reduce ? 1 : ease(it / 1.9);
    const fade = reduce ? 1 : smooth(0.2, 2.6, it);

    if (!autoOpened && it > 2.3) { autoOpened = true; openGoal = 1; burst = 12; }
    openT += (openGoal - openT) * Math.min(1, dt * (openGoal > openT ? 2.2 : 3.2));
    const o = easeIO(openT);

    if (!drag) { vel += (AUTO - vel) * Math.min(1, dt * 1.6); rotY += vel * dt; tiltT *= Math.pow(0.12, dt); }
    tiltX += (tiltT - tiltX) * Math.min(1, dt * 8);
    const sp = clamp((scrollY - heroTop) / Math.max(1, heroH), 0, 1);

    spinner.rotation.set(tiltX + o * 0.1, rotY + (1 - k) * -3.4 + sp * 2.4, 0);
    const bob = reduce ? 0 : Math.sin(time * 1.25) * 0.05;
    floatG.position.y = bob; floatG.rotation.z = reduce ? 0 : Math.sin(time * 0.9) * 0.02;
    // the lid floats up, tips toward the viewer and drifts a little
    // lid: lifts, tips toward the camera (in world space) and drifts; closes back exactly onto the body
    const lb = reduce ? 0 : Math.sin(time * 1.6 + 1) * 0.035 * o;
    const th = spinner.rotation.y, yawOff = o * 0.38 + (reduce ? 0 : Math.sin(time * .7) * .08 * o);
    qA.setFromAxisAngle(AY, -th); qB.setFromAxisAngle(AX, o * 0.42); qC.setFromAxisAngle(AY, th + yawOff); qD.setFromAxisAngle(AZ, -o * 0.08);
    lidG.quaternion.copy(qA).multiply(qD).multiply(qB).multiply(qC);
    lidOff.set(o * 0.04, 0, -o * 0.1).applyAxisAngle(AY, -th);
    lidG.position.set(lidOff.x, LID_Y + o * 0.46 + lb, lidOff.z);
    ember.intensity = o * 1.05;

    rig.position.y = -COMP_CY + (1 - k) * -0.75 + sp * 0.75;
    rig.scale.setScalar((0.55 + 0.45 * k) * (1 - sp * 0.18));
    ring.scale.setScalar(0.35 + 0.65 * k); ring2.scale.setScalar(0.2 + 0.8 * ease((it - 0.3) / 1.8));
    ring.material.opacity = k; ring2.material.opacity = 0.32 * ease((it - 0.3) / 1.8);
    shU.uOp.value = (0.62 - bob * 1.6) * k;
    glowU.uFade.value = k; glowU.uTime.value = time; glowU.uOpen.value = o;

    par.lerp(parT, Math.min(1, dt * 3));
    const ax = par.x * 0.16, ay = ELEV + par.y * 0.05;
    camera.position.set(Math.sin(ax) * dist * Math.cos(ay), Math.sin(ay) * dist, Math.cos(ax) * dist * Math.cos(ay));
    camera.lookAt(0, 0, 0);
    dustU.uTime.value = time; dustU.uFade.value = fade;

    renderer.render(scene, camera);
    if (first) { first = false; hero.classList.add("gl-on"); }

    // smoke: a burst when the lid lifts, then a steady trickle while it is open
    if (!reduce && o > 0.55 && sp < 0.85) {
      if (burst > 0) { puff(now, 1.6); burst--; }
      else if (now - puffT > (coarse ? 120 : 85)) { puffT = now; puff(now, 1); }
    }

    if (!reduce && it > 2.5 && degrade < 6) {
      perfT += dt; perfN++;
      if (perfN >= 60) {
        const avg = perfT / perfN; perfN = 0; perfT = 0;
        if (avg > 0.024) { degrade++; if (pr > 1.5) { pr = Math.max(1.5, pr - 0.5); needLayout = true; } else if (dust.visible) dust.visible = false; else if (pr > 1) { pr = 1; needLayout = true; degrade = 6; } else degrade = 6; }
        else degrade = 6;
      }
    }
  }
  try { await renderer.compileAsync(scene, camera); } catch {}
  sync();
}

// start as soon as the module runs (textures load in parallel with the rest of the page)
init().catch(err => { console.warn("[hero3d]", err); if (hero) hero.classList.add("no-gl"); });
