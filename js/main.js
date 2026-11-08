// main.js · رصد: نسخة الاصطدام. سيارة رياضية فخمة على طريق المدينة الليلية تصطدم بسيارة أخرى،
// ثم تدخل الكاميرا السيارة، يخرج جهاز رصد ويكبر، ونمسك كل حساس على حدة مع بياناته ومؤثر يشرحه.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STEPS, CHAPTERS, SENSORS, C } from "./content.js";
import * as T from "./textures.js";
import * as W from "./world.js";
import { makeRealPrototype, TOP, LOWER } from "./realproto.js";

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const QS = new URLSearchParams(location.search);
const TEST = QS.has("shot");
const MOBILE = matchMedia("(max-width: 900px)").matches;
let QUALITY = QS.get("quality") === "low" || MOBILE ? 0 : 2;   // 2 كامل، 1 متوسط، 0 خفيف (يتغير تلقائياً حسب أداء الجهاز)
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LANE = 2.25, ZC = -322;                 // مسار السيارة وموقع الحادث
const STAGE = V(12.5, 0, ZC + 1);             // منصة الهولوغرام بجانب الطريق
const UNIT_Y = 1.25;                          // ارتفاع الجهاز فوق المنصة

function loadStep(f, label) { $("loadfill").style.width = `${Math.round(f * 100)}%`; if (label) $("loadstep").textContent = label; }

async function init() {
  loadStep(.05, "تحميل الخطوط العربية");
  const fam = '"IBM Plex Sans Arabic"';
  await Promise.all([300, 400, 600, 700].flatMap((w) => [document.fonts.load(`${w} 40px ${fam}`, "رصد"), document.fonts.load(`${w} 40px ${fam}`, "Rased 123")])).catch(() => {});
  loadStep(.1, "تحميل السيارة");
  let resp = await fetch("assets/car.glb").catch(() => null); const isGlb = !!(resp && resp.ok && !/html/.test(resp.headers.get("content-type") || ""));
  if (!isGlb) resp = await fetch("assets/car.js");
  const total = +resp.headers.get("content-length") || (isGlb ? 8544684 : 11400000), reader = resp.body.getReader(), chunks = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; loadStep(.1 + .7 * Math.min(1, got / total), `تحميل السيارة ${Math.round(100 * Math.min(1, got / total))}%`); }
  let buf;
  if (isGlb) buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
  else { const txt = new TextDecoder().decode(await new Blob(chunks).arrayBuffer()), b64 = txt.slice(txt.indexOf('"') + 1, txt.lastIndexOf('"'));
    const bin = atob(b64); buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); }
  const gltf = await new GLTFLoader().parseAsync(buf.buffer, "assets/");
  loadStep(.85, "بناء المدينة"); await new Promise((r) => requestAnimationFrame(r));
  build(gltf);
}

function build(gltf) {
  const canvasEl = $("cv");
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: "default", preserveDrawingBuffer: TEST });
  let DPR = Math.min(devicePixelRatio || 1, QUALITY === 2 ? 1.25 : 1);
  renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = QUALITY > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // إذا فقد المتصفح سياق الرسم (ضغط على كرت الشاشة) نعيد التشغيل تلقائياً بدل شاشة سوداء
  canvasEl.addEventListener("webglcontextlost", (e) => { e.preventDefault(); $("lost").hidden = false; try { localStorage.setItem("rased-q", "0"); } catch (x) { /* */ } });
  canvasEl.addEventListener("webglcontextrestored", () => location.reload());
  try { if (localStorage.getItem("rased-q") === "0") QUALITY = 0; } catch (x) { /* */ }

  const scene = new THREE.Scene(); scene.background = W.FOG.clone(); scene.fog = new THREE.FogExp2(W.FOG, .0042);
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .2, 4200);

  // بيئة انعكاس: سماء المدينة + لوحات ضوء ملونة
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; void main(){ float h=vP.y; vec3 c=mix(vec3(.02,.03,.07), vec3(.06,.09,.18), smoothstep(-.2,.7,h)); c+=vec3(.35,.25,.6)*exp(-abs(h)*8.)*.8; gl_FragColor=vec4(c,1.); }` })));
  const sb = (w, h, col, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); es.add(m); };
  sb(40, 10, new THREE.Color(1.6, 1.7, 2), [0, 40, 8]); sb(70, 4, new THREE.Color(.25, 1.1, 2.2), [46, 9, 0]);
  sb(70, 4, new THREE.Color(2, .6, 1.3), [-46, 7, -8]); sb(36, 3, new THREE.Color(2, 1.1, .35), [0, 6, -48]); sb(36, 3, new THREE.Color(.4, .7, 1.6), [0, 5, 48]);
  const envMap = pm.fromScene(es, .02).texture; scene.environment = envMap;

  // ---------------- المدينة ----------------
  const sky = W.makeSky(); scene.add(sky);
  scene.add(W.makeGround()); const city = W.makeCity(); scene.add(city); scene.add(W.makeLamps());
  const trails = W.makeTrails(); scene.add(trails);
  scene.add(new THREE.HemisphereLight(0x3a5aa8, 0x05060a, .35));
  const moon = new THREE.DirectionalLight(0x9fbcff, .6); moon.position.set(-80, 120, 60); scene.add(moon);

  // ---------------- السيارات (نموذج حقيقي) ----------------
  const hide = ["License Plate", "InteriorSteeringEmblem"];
  function makeCar(paint, accent, name) {
    const root = new THREE.Group(), inner = gltf.scene.clone(true); inner.rotation.y = Math.PI; inner.position.y = .16; root.add(inner);
    const mats = new Map();
    inner.traverse((o) => {
      if (hide.includes(o.name)) o.visible = false;
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false;
      const m0 = o.material; let m = mats.get(m0);
      if (!m) {
        m = m0.clone();
        const n = m0.name || "";
        if (n.startsWith("Paint 1")) { m.color.set(paint); m.metalness = .7; m.roughness = .28; if ("clearcoat" in m) { m.clearcoat = 1; m.clearcoatRoughness = .05; } m.envMapIntensity = 1.6; }
        else if (n.startsWith("Paint 2")) { m.color.set(accent); m.metalness = .6; m.roughness = .35; m.envMapIntensity = 1.2; }
        else if (n === "Glass") { m = new THREE.MeshPhysicalMaterial({ name: "Glass", color: 0x0a0e18, metalness: .3, roughness: .04, transparent: true, opacity: .5, depthWrite: false, envMapIntensity: 2 }); }
        else if (n === "Headlight") { m.emissive = new THREE.Color(1, 1, 1.15); m.emissiveIntensity = 6; }
        else if (n === "Brakelight") { m.emissive = new THREE.Color(1, .05, .06); m.emissiveIntensity = 5; }
        else if (n === "Signallight") { m.emissive = new THREE.Color(1, .55, .1); m.emissiveIntensity = 0; }
        // إزالة شعار Khronos من الخامات (يُعرف بمقاسه 512×128)
        const isLogo = (t) => t && t.image && t.image.width === 512 && t.image.height === 128;
        if (isLogo(m.emissiveMap)) { m.emissiveMap = null; m.emissive?.set(0x000000); }
        if (isLogo(m.map)) { m.map = null; m.color?.set(0x111111); }
        m.userData.baseOp = m.opacity; m.userData.baseTr = m.transparent;
        mats.set(m0, m);
      }
      o.material = m;
    });
    const wheels = ["WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR"].map((n) => inner.getObjectByName(n)).filter(Boolean);
    wheels.forEach((w) => { w.quaternion.identity(); w.updateMatrixWorld(true); [...w.children].filter((c) => /BrakePad/.test(c.name)).forEach((c) => w.parent.attach(c)); });
    // إضاءة أرضية وأضواء أمامية
    const under = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.8), new THREE.MeshBasicMaterial({ map: T.glowTexture("rgba(47,212,255,.9)"), transparent: true, opacity: name === "hero" ? .5 : 0, depthWrite: false, blending: THREE.AdditiveBlending, color: name === "hero" ? 0x2fd4ff : 0xffffff }));
    under.rotation.x = -Math.PI / 2; under.rotation.z = Math.PI / 2; under.position.y = .06; under.renderOrder = 2; root.add(under);
    const hl = new THREE.SpotLight(0xdfeaff, name === "hero" ? 60 : 0, 70, .42, .6, 1.2); hl.position.set(0, .7, -2.2); hl.target.position.set(0, 0, -20); root.add(hl, hl.target);
    root.userData = { mats: [...mats.values()], wheels, inner, under, sig: [...mats.values()].find((m) => m.name === "Signallight"), brake: [...mats.values()].find((m) => m.name === "Brakelight") };
    scene.add(root); return root;
  }
  const hero = makeCar("#0b35d8", "#05070c", "hero");     // أزرق سباق
  const other = makeCar("#c9ced6", "#2a2d33", "other");   // فضي
  hero.position.set(LANE, 0, ZC + 80); other.position.set(LANE, 0, ZC);
  const HU = hero.userData, OU = other.userData;

  // ---------------- جهاز رصد ----------------
  const unit = makeRealPrototype(envMap); scene.add(unit);
  const PU = unit.userData;
  const unitGlow = new THREE.PointLight(0x2fd4ff, 0, 4, 2); scene.add(unitGlow);
  const INCAR = V(0, .52, -.15);   // موقع الجهاز داخل السيارة (إحداثيات السيارة)
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(.3, 1.8, 2.6), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  scene.add(scan);

  // ---------------- منصة الهولوغرام ----------------
  const stageG = new THREE.Group(); stageG.position.copy(STAGE); scene.add(stageG);
  const topU = { uCol: { value: new THREE.Color(C.cyan) }, uTime: { value: 0 }, uOn: { value: 0 } };
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.8, 96), new THREE.ShaderMaterial({ uniforms: topU, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uTime; uniform float uOn; varying vec2 vP;
      void main(){ float r=length(vP), a=atan(vP.y,vP.x);
        float rings = smoothstep(.05,0.,abs(fract(r*1.2-uTime*.15)-.5)-.44) * .5;
        float sweep = pow(max(0., cos(a - uTime*.9)), 24.) * smoothstep(4.7, 1., r);
        float edge = smoothstep(4.5, 4.7, r) * (1.-smoothstep(4.7,4.8,r));
        float base = .55 * (1.-smoothstep(0.,4.8,r));
        vec3 c = uCol * (rings*.35 + sweep*.5 + edge*2.4) + vec3(.01,.02,.04)*base;
        float al = clamp(base*.9 + rings*.5 + sweep + edge*2., 0., 1.) * uOn;
        gl_FragColor = vec4(c*uOn, al); }` }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = .09; stageG.add(disc);
  const shadowCatch = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: .5 }));
  shadowCatch.rotation.x = -Math.PI / 2; shadowCatch.position.y = UNIT_Y + .006; shadowCatch.receiveShadow = true; stageG.add(shadowCatch);
  const neonM = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0 });
  const neons = [[4.75, .1, .05], [3.9, UNIT_Y - .02, .03], [5.3, .08, .025]].map(([r, y, t]) => { const n = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 160), neonM); n.rotation.x = Math.PI / 2; n.position.y = y; stageG.add(n); return n; });
  // صفيحة زجاجية يقف عليها الجهاز
  const glassPlate = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, .04, 96), new THREE.MeshPhysicalMaterial({ color: 0x0b1830, metalness: .3, roughness: .1, transparent: true, opacity: 0, envMapIntensity: 1.5 }));
  glassPlate.position.y = UNIT_Y - .03; glassPlate.receiveShadow = false; stageG.add(glassPlate);
  // مخاريط ضوء
  const coneMat = (col) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(col) }, uOp: { value: 0 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uOp; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(abs(dot(vN, vV)), 1.6); float a = pow(vY, 1.6) * f * uOp * .3; gl_FragColor = vec4(uCol*a, a); }` });
  const beams = [[V(-6, 14, 4), C.cyan], [V(6, 14, -4), C.purple], [V(1, 15, -7), C.amber]].map(([p, col]) => {
    const g = new THREE.ConeGeometry(2.4, 15, 48, 1, true); g.translate(0, -7.5, 0); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, coneMat(col)); m.position.copy(p).add(STAGE); m.lookAt(STAGE.clone().setY(1)); scene.add(m); return m;
  });
  const ND = QUALITY ? 400 : 150, dp = new Float32Array(ND * 3);
  for (let i = 0; i < ND; i++) dp.set([STAGE.x + (Math.random() - .5) * 14, Math.random() * 9, STAGE.z + (Math.random() - .5) * 14], i * 3);
  const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: T.glowTexture("rgba(200,230,255,1)"), size: .09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  // ---------------- إضاءة المنصة ----------------
  const key = new THREE.SpotLight(0xf2f6ff, 0, 40, .5, .55, 1.6); key.position.copy(STAGE).add(V(-4, 13, 7)); key.castShadow = QUALITY > 0;
  key.shadow.mapSize.set(QUALITY === 2 ? 2048 : 1024, QUALITY === 2 ? 2048 : 1024); key.shadow.bias = -.0006; key.shadow.normalBias = .04;
  key.target.position.copy(STAGE).setY(UNIT_Y + .8); scene.add(key, key.target);
  const spotA = new THREE.SpotLight(0x2fd4ff, 0, 40, .55, .6, 1.6); spotA.position.copy(STAGE).add(V(9, 9, -6)); spotA.target.position.copy(STAGE).setY(1.8); scene.add(spotA, spotA.target);
  const spotB = new THREE.SpotLight(0xa77bff, 0, 40, .55, .6, 1.6); spotB.position.copy(STAGE).add(V(-9, 7, -5)); spotB.target.position.copy(STAGE).setY(1.8); scene.add(spotB, spotB.target);
  const sensorLight = new THREE.PointLight(0xffffff, 0, 5, 2); scene.add(sensorLight);
  const crashLight = new THREE.SpotLight(0xffffff, 0, 30, .6, .7, 1.5); crashLight.position.set(LANE - 6, 10, ZC + 6); crashLight.target.position.set(LANE, 0, ZC + 3); scene.add(crashLight, crashLight.target);

  // ---------------- مؤثرات الحساسات ----------------
  const glow = (col, op = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.6), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, userData: { op } });
  const add = (o) => (scene.add(o), o);
  const fx = {};
  fx.mic = add(new THREE.Group()); fx.mic.userData.rings = [0, 1, 2, 3, 4].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 6, 96), glow(C.purple)); fx.mic.add(m); return m; });
  fx.mpu = add(new THREE.Group());
  [[V(1, 0, 0), "#ff5a6e"], [V(0, 1, 0), "#3ee08f"], [V(0, 0, 1), "#3b82ff"]].forEach(([d, col]) => {
    const g = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.1, 8), glow(col)); sh.position.y = .55; g.add(sh);
    const hd = new THREE.Mesh(new THREE.ConeGeometry(.07, .2, 14), glow(col)); hd.position.y = 1.18; g.add(hd); g.quaternion.setFromUnitVectors(V(0, 1, 0), d); fx.mpu.add(g); });
  const mpuArc = new THREE.Mesh(new THREE.TorusGeometry(.75, .012, 6, 64, Math.PI * 1.4), glow("#ffb547")); fx.mpu.add(mpuArc);
  fx.gps = add(new THREE.Group());
  const sats = [0, 1, 2, 3, 4].map((i) => {
    const s = new THREE.Group(); const bodyM = new THREE.MeshStandardMaterial({ color: 0xcfd6e0, metalness: .8, roughness: .3, transparent: true, opacity: 0 });
    s.add(new THREE.Mesh(new THREE.BoxGeometry(.35, .35, .5), bodyM));
    const panM = new THREE.MeshStandardMaterial({ color: 0x1e3f9a, emissive: 0x0a2a7a, metalness: .5, roughness: .3, transparent: true, opacity: 0 });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, .02, .4), panM); p.position.x = sx * .75; s.add(p); }
    const line = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1, 6, 1, true), glow(C.green, .7));
    fx.gps.add(s, line); s.userData = { a: i / 5 * Math.PI * 2, line, mats: [bodyM, panM] }; return s; });
  fx.gsm = add(new THREE.Group()); fx.gsm.userData.rings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, .016, 6, 64, Math.PI), glow(C.amber)); fx.gsm.add(m); return m; });
  const pulseM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 4, 5), toneMapped: false, transparent: true, opacity: 0 });
  const pulses = PU.wires.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), pulseM); unit.add(m); return m; });
  const haloM = glow(C.cyan); const halo = new THREE.Group(); scene.add(halo);
  const h1 = new THREE.Mesh(new THREE.RingGeometry(.62, .66, 64), haloM); h1.rotation.x = -Math.PI / 2; halo.add(h1);
  const h2 = new THREE.Mesh(new THREE.RingGeometry(.76, .775, 64, 1, 0, Math.PI * 1.3), haloM); h2.rotation.x = -Math.PI / 2; halo.add(h2);
  const beamM = new THREE.MeshBasicMaterial({ color: new THREE.Color(.3, 1.2, 2), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const hBeam = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .9, 40, 1, true), beamM); hBeam.position.y = -.45; halo.add(hBeam);
  const sHolo = T.holoCanvas(640, 400);
  const sHoloM = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .94), new THREE.MeshBasicMaterial({ map: sHolo.t, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  sHoloM.renderOrder = 9; scene.add(sHoloM);
  const sLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V()]), new THREE.LineBasicMaterial({ color: new THREE.Color(.5, 2, 3), transparent: true, opacity: 0, toneMapped: false }));
  scene.add(sLine);

  // ---------------- مؤثرات الاصطدام ----------------
  const NSP = 140, spPos = new Float32Array(NSP * 3), spVel = [];
  const spG = new THREE.BufferGeometry(); spG.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
  const sparks = new THREE.Points(spG, new THREE.PointsMaterial({ map: T.glowTexture("rgba(255,200,120,1)"), size: .28, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(3, 1.8, .8), opacity: 0 }));
  sparks.frustumCulled = false; scene.add(sparks);
  const NGL = 90, glPos = new Float32Array(NGL * 3), glVel = [];
  const glG = new THREE.BufferGeometry(); glG.setAttribute("position", new THREE.BufferAttribute(glPos, 3));
  const shards = new THREE.Points(glG, new THREE.PointsMaterial({ map: T.glowTexture("rgba(190,230,255,1)"), size: .12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.4, 2, 2.6), opacity: 0 }));
  shards.frustumCulled = false; scene.add(shards);
  const shock = new THREE.Mesh(new THREE.RingGeometry(.6, .8, 64), glow("#ffb070")); shock.rotation.x = -Math.PI / 2; scene.add(shock);
  const flashL = new THREE.PointLight(0xffb070, 0, 40, 2); scene.add(flashL);
  // منارة موقع الحادث (تظهر بعد تثبيت GPS)
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 60, 24, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOp: { value: 0 } }, vertexShader: `varying float vY; void main(){ vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uOp; varying float vY; void main(){ float a=(1.-vY)*uOp*.7; gl_FragColor=vec4(vec3(1.,.25,.35)*a*2.,a); }` }));
  beacon.position.set(LANE, 30, ZC); scene.add(beacon);
  const phone = new THREE.Group(); scene.add(phone);
  const phBody = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.55, .12), new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: .9, roughness: .25, transparent: true, opacity: 0, depthTest: false })); phBody.renderOrder = 50; phone.add(phBody);
  const phC = T.holoCanvas(540, 1100);
  const phS = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 2.36), new THREE.MeshBasicMaterial({ map: phC.t, color: new THREE.Color(.8, .8, .8), toneMapped: false, transparent: true, opacity: 0, depthTest: false })); phS.position.z = .061; phS.renderOrder = 51; phone.add(phS);

  // ---------------- التسميات ----------------
  const labels = [];
  function label(html, cls, getPos, cond, col) {
    const el = document.createElement("div"); el.className = `lb ${cls}`; if (col) el.style.setProperty("--c", col);
    el.innerHTML = `<div class="lb__box">${html}</div><div class="lb__stem"></div>`; $("labels").appendChild(el); labels.push({ el, getPos, cond, k: 0 }); return el;
  }
  const wp = (o, dy = 0) => o.getWorldPosition(new THREE.Vector3()).add(V(0, dy, 0));
  for (const [k, s] of Object.entries(SENSORS)) label(`<b><i class="lb__n">${s.n}</i> ${s.name}</b><small>${s.model}</small>`, "lb--sensor",
    () => wp(PU.parts[k].g, { mic: .45, mpu: 1.05, gps: .5, gsm: 1.1, esp: .35 }[k]), () => (cur().id === "overview" && stepTime() > 3.2) || cur().id === "fusion", s.color);
  label(`<b>هوائي GPS</b><small>patch antenna</small>`, "lb--sensor", () => wp(PU.parts.gpsAnt.g, .4), () => cur().id === "s-gps", C.green);
  label(`<b>جهاز رصد</b><small>Rased unit</small>`, "lb--sensor", () => wp(unit, .6), () => cur().id === "inside" && stepTime() > 1.2, C.cyan);
  label(`<b dir="ltr">24.716373, 46.641467</b><small>موقع الحادث</small>`, "", () => V(LANE, 4.2, ZC), () => cur().id === "result" || (cur().id === "crash" && crashT > 5.4), C.red);

  // ======================================================================
  let idx = 0, stepT0 = 0, now = 0, playing = false, voiceOn = false, speechDone = true, wordsShown = 0;
  let crashZ0 = -242, crashT = 0, impactAt = -1, slow = 1, shake = 0, rise = 0, ghost = 0, stageOn = 0, phaseCut = -1;
  const cur = () => STEPS[idx];
  const stepTime = () => now - stepT0;
  const camState = { look: V(0, 1.5, 0) };
  let tr = { from: null, t0: 0, D: 0, lift: 0 }, arriveT = 0;
  const Z_HIT = ZC + 4.12, CRASH_Z0 = ZC + 80, SPEED = 40;

  // ---------------- اللقطات ----------------
  const sensorCam = { mic: V(-4.2, 1.9, 1.4), mpu: V(-4.0, 2.2, 2.0), gps: V(-3.3, 2.6, 3.2), gsm: V(4.3, 2.0, 1.2), esp: V(1.4, 1.8, 4.4) };
  const sensorPull = { mic: V(-.6, .55, .3), mpu: V(-.45, .65, .15), gps: V(-.2, .55, .2), gsm: V(.45, .5, .15), esp: V(0, .45, .55) };
  const focusPoint = (k) => { const p = wp(PU.parts[k].g, .12); if (k === "gps") p.lerp(wp(PU.parts.gpsAnt.g, .12), .45); return p; };
  const U = (x, y, z) => STAGE.clone().add(V(x, y + UNIT_Y, z));
  function shot(s) {
    const hp = hero.position, st = stepTime();
    switch (s.id) {
      case "drive": {
        const ph = Math.floor(st / 4.6) % 3;
        if (ph === 0) return { p: hp.clone().add(V(2.4, 1.05, 7.4)), t: hp.clone().add(V(-.2, .75, -6)), fov: 50, sway: 0, lock: true, ph };
        if (ph === 1) return { p: hp.clone().add(V(-3.6, .5, -7.5)), t: hp.clone().add(V(0, .6, -1)), fov: 38, sway: 0, lock: true, ph };
        return { p: hp.clone().add(V(-8.5, 6.5, 1)), t: hp.clone().add(V(0, 0, -7)), fov: 46, sway: 0, lock: true, ph };
      }
      case "crash": { const push = clamp((crashT - 3.2) / 5, 0, 1);
        return { p: V(lerp(-9, -6.2, ease(push)), lerp(1.6, 2.8, ease(push)), ZC + lerp(5.5, 6.5, ease(push))), t: V(LANE, .9, lerp(ZC + 3.5, ZC + 1, ease(push))), fov: lerp(46, 40, push), sway: 0, ap: .2 }; }
      case "inside": return { p: hp.clone().add(V(-3.6, 2.7, 2.6)), t: hp.clone().add(V(0, .6, -.1)), fov: 34, sway: .25, ap: .5 };
      case "overview": return { p: U(-7.2, 5.2, 7.8), t: U(0, 1, .3), fov: 40, sway: .4, ap: .25 };
      case "fusion": return { p: U(6.8, 6.4, 8.2), t: U(0, 1.6, .3), fov: 40, sway: .4, ap: .25 };
      case "result": return { p: V(-3.5, 6.5, ZC + 17), t: V(6, 2.4, ZC + 1), fov: 46, sway: .1, ap: .15 };
      case "end": return { p: V(-9, 9, ZC + 24), t: V(7, 2.5, ZC + 1), fov: 46, sway: .25, ap: .1 };
    }
    if (!!SENSORS[s.sensor]) {
      const sp = focusPoint(s.sensor), d = sensorCam[s.sensor].clone();
      const dir = d.clone().normalize().negate(), right = dir.clone().cross(V(0, 1, 0)).normalize();
      const t = sp.clone().addScaledVector(right, .62).add(V(0, .3, 0));
      return { p: t.clone().add(d), t, fov: 36, sway: .1, right, sp, ap: .7 };
    }
    return { p: V(-8, 6, ZC + 8), t: V(0, 1.5, ZC), fov: 40, sway: 0 };
  }

  // ---------------- البيانات الحية ----------------
  const sim = { ev: -99, cyc: -1, buf: { a: [], b: [] }, v: {}, sms: 0, lastPush: 0 };
  const evK = (t) => { const d = t - sim.ev; if (d < 0) return 0; return d < .06 ? d / .06 : Math.exp(-(d - .06) * 2.4); };
  function simUpdate(t) {
    const s = cur(), n = () => Math.random() - .5, single = !!SENSORS[s.sensor] ? s.sensor : null;
    if (single) { const lt = stepTime(), c = Math.floor((lt - 2.4) / 6.5); if (lt > 2.4 && c !== sim.cyc) { sim.cyc = c; sim.ev = t; if (single === "gsm") setTimeout(() => sim.sms++, 1800); } }
    const e = evK(t), d = t - sim.ev, v = sim.v;
    v.rms = 150 + Math.abs(n()) * 120 + e * 2278; v.prob = clamp(.02 + Math.abs(n()) * .05 + e * 1.15, 0, .996);
    v.g = .98 + n() * .03 + e * 4.1 + (s.id === "drive" ? Math.abs(n()) * .12 : 0); v.gyro = 3.4 + Math.abs(n()) * 1.6 + e * 185; v.jerk = n() * .6 + e * 31;
    v.lat = 24.716396 + n() * 4e-6; v.lng = 46.641689 + n() * 4e-6; v.sats = 5 + (Math.sin(t * .3) > .6 ? 1 : 0); v.hdop = 1.3 + Math.sin(t * .7) * .2 + n() * .05;
    v.rssi = -71 + Math.round(n() * 4);
    v.stage = d < 0 || d > 3.6 ? 0 : d < .8 ? 1 : d < 2 ? 2 : 3; v.still = d > 1.1 && d < 3.6;
    if (t - sim.lastPush > 1 / 30) {
      sim.lastPush = t; const B = sim.buf, k = single; let a = 0, b = 0;
      if (k === "mic") { a = n() * (.25 + e * 2.2) * 2; b = v.prob; } else if (k === "mpu") { a = v.g; b = v.gyro / 60; }
      else if (k === "gps") { a = v.hdop; } else if (k === "gsm") { a = v.rssi; } else { a = 40 + Math.abs(n()) * 20 + e * 40; b = v.stage; }
      B.a.push(a); B.b.push(b); if (B.a.length > 120) { B.a.shift(); B.b.shift(); }
    }
  }
  const fmt = (x, d = 0) => x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const STAGES = ["استشعار", "اشتباه", "تأكيد", "تنبيه"];
  function liveText() {
    const v = sim.v, e = evK(now), up = Math.floor(now);
    return { "mic.rms": fmt(v.rms), "mic.prob": fmt(v.prob, 3), "mic.state": e > .25 ? "صوت تصادم!" : "استماع",
      "mpu.g": fmt(v.g, 2), "mpu.gyro": fmt(v.gyro, 1), "mpu.jerk": fmt(v.jerk, 2), "mpu.state": e > .25 ? "صدمة!" : v.still ? "سكون · تأكيد" : "طبيعي",
      "gps.lat": fmt(v.lat, 6), "gps.lng": fmt(v.lng, 6), "gps.sats": `${v.sats}`, "gps.fix": "نعم ✓",
      "gsm.sig": `${v.rssi} dBm`, "gsm.net": "مسجّل · GSM", "gsm.sms": `${sim.sms}`,
      "esp.stage": STAGES[v.stage], "esp.loop": "100 Hz", "esp.up": `${Math.floor(up / 60)}:${String(up % 60).padStart(2, "0")}`,
      hot: { "mic.rms": e > .25, "mic.prob": e > .25, "mic.state": e > .25, "mpu.g": e > .25, "mpu.state": e > .25, "esp.stage": v.stage === 3 } };
  }
  function holoSpec(k) {
    const v = sim.v, e = evK(now) > .25, B = sim.buf;
    if (k === "mic") return { title: "الميكروفون · INMP441", color: C.purple, alert: e, series: [{ data: B.a, color: "#c9a6ff" }], ranges: [[-2.4, 2.4]], rows: [["RMS", fmt(v.rms)], ["احتمال التصادم", fmt(v.prob, 3), e ? "#ff6b86" : null]] };
    if (k === "mpu") return { title: "حساس الحركة · MPU6050", color: C.red, alert: e, series: [{ data: B.a, color: "#ff8aa0" }, { data: B.b, color: "#7fe6ff" }], ranges: [[0, 5], [0, 5]], rows: [["|a| g", fmt(v.g, 2), e ? "#ff6b86" : null], ["gyro °/s", fmt(v.gyro, 0)], ["الحالة", e ? "IMPACT" : v.still ? "STILL" : "OK"]] };
    if (k === "gps") return { title: "الموقع · GPS", color: C.green, alert: false, series: [{ data: B.a, color: "#8ff0bd" }], ranges: [[.5, 2.5]], rows: [["Lat", fmt(v.lat, 6)], ["Lng", fmt(v.lng, 6)], ["Sats", `${v.sats} ✓`]] };
    if (k === "gsm") return { title: "الاتصال · SIM800L", color: C.amber, alert: v.stage === 3, series: [{ data: B.a, color: "#ffd08a" }], ranges: [[-90, -55]], rows: [["RSSI", `${v.rssi}`], ["SMS", `${sim.sms}`], ["AT", "OK", "#5ff0a6"]] };
    return { title: "المعالج · ESP32-S3", color: C.cyan, alert: v.stage === 3, series: [{ data: B.a, color: "#7fe6ff" }], ranges: [[0, 120]], rows: [["المرحلة", ["SENSE", "SUSPECT", "CONFIRM", "ALERT"][v.stage], v.stage === 3 ? "#ff6b86" : null], ["CPU", "240 MHz"]] };
  }

  // ---------------- الواجهة ----------------
  const rail = $("rail");
  CHAPTERS.forEach((c, i) => { const b = document.createElement("button"); b.type = "button"; b.innerHTML = `<span>${c.name}</span><i></i>`; b.title = c.name;
    b.onclick = () => { stopPlay(); go(STEPS.findIndex((s) => s.ch === i)); }; rail.appendChild(b); });
  const prog = $("prog"); STEPS.forEach(() => { const i = document.createElement("i"); i.innerHTML = "<b></b>"; prog.appendChild(i); });
  const panelIn = $("panel-inner"), subEl = $("sub");
  let panelTimer = 0, markTimer = 0, liveEls = [], tlEls = [];
  function renderPanel(s) {
    panelIn.classList.add("is-out"); clearTimeout(panelTimer);
    panelTimer = setTimeout(() => {
      panelIn.innerHTML = `<p class="p-kicker">${s.kicker}</p><h2 class="p-title">${s.title}</h2><p class="p-sub">${s.sub}</p>${s.body}`;
      panelIn.scrollTop = 0; liveEls = [...panelIn.querySelectorAll("[data-live]")]; tlEls = [...panelIn.querySelectorAll("[data-t]")];
      panelIn.classList.remove("is-out");
    }, REDUCED ? 0 : 320);
  }
  function renderSub(s) { subEl.innerHTML = s.narr.split(" ").map((w) => `<span class="w">${w}</span>`).join(" "); wordsShown = 0; s._words = s.narr.split(" ").length; }
  function showMark(s) {
    const m = $("mark"); clearTimeout(markTimer);
    const sen = SENSORS[s.sensor] || null;
    m.classList.toggle("is-final", s.id === "end");
    $("mark-num").textContent = s.id === "end" ? "شكراً" : sen ? String(sen.n).padStart(2, "0") : "";
    $("mark-name").textContent = s.id === "end" ? "راصد · رصد ذكي، وتحقّق قبل التنبيه" : sen ? sen.name : CHAPTERS[s.ch].name;
    m.style.setProperty("--mc", sen ? sen.color : C.cyan);
    if (!sen && !["end", "inside", "fusion"].includes(s.id)) return;
    m.classList.add("is-on"); if (s.id !== "end") markTimer = setTimeout(() => m.classList.remove("is-on"), 1900);
  }
  function cut() { const c = $("cut"); c.style.transition = "none"; c.style.opacity = "1"; requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transition = "opacity 420ms ease-out"; c.style.opacity = "0"; })); }
  function go(i, opt = {}) {
    i = clamp(i, 0, STEPS.length - 1);
    const prevCh = STEPS[idx]?.ch; idx = i; stepT0 = now;
    const s = cur(); $("mark").classList.remove("is-on");
    if (s.id === "crash") { crashT = 0; impactAt = -1; slow = 1; }
    if (s.id === "drive") phaseCut = -1;
    tr = { from: { pos: camera.position.clone(), look: camState.look.clone(), fov: camera.fov }, t0: now };
    const dest = shot(s), dist = tr.from.pos.distanceTo(dest.p);
    const hard = opt.instant || TEST;
    if (s.id === "crash") { crashZ0 = clamp(hero.position.z, ZC + 40, ZC + 120); }
    tr.D = hard ? 0 : (s.id === "drive" || s.id === "crash") ? 1.6 : clamp(1.9 + dist / 8, 2.2, dist > 60 ? 4.5 : 4); tr.lift = Math.min(dist * .12, dist > 60 ? 30 : 4);
    renderPanel(s); renderSub(s);
    [...rail.children].forEach((b, k) => { b.classList.toggle("is-on", k === s.ch); b.classList.toggle("is-done", k < s.ch); });
    $("count").textContent = `${i + 1} / ${STEPS.length}`;
    $("badge-sim").hidden = !(!!SENSORS[s.sensor]);
    if (s.ch !== prevCh || opt.force) showMark(s);
    try { history.replaceState(null, "", `#${s.id}`); } catch (e) { /* */ }
    sim.cyc = -1; speak(s); perf.reset();
  }
  const next = () => go(idx + 1), prev = () => go(idx - 1);
  $("next").onclick = () => { stopPlay(); next(); }; $("prev").onclick = () => { stopPlay(); prev(); };
  const playBtn = $("btn-play");
  function stopPlay() { playing = false; playBtn.setAttribute("aria-pressed", "false"); playBtn.querySelector("span").textContent = "تشغيل كفيلم"; }
  function startPlay() { playing = true; playBtn.setAttribute("aria-pressed", "true"); playBtn.querySelector("span").textContent = "إيقاف"; if (idx === STEPS.length - 1) go(0); else stepT0 = now; }
  playBtn.onclick = () => (playing ? stopPlay() : startPlay());
  const stepDur = (s) => clamp(s._words / 2.25 + 2.4, 8, 26) + (s.id === "crash" ? 3 : 0) + (s.id === "drive" ? 4 : 0);
  let arVoice = null, enVoice = null;
  const pickVoice = () => { if (!("speechSynthesis" in window)) return;
    // نفضّل الأصوات العصبية الطبيعية (Edge: Microsoft Hamed/Zariyah Online (Natural)) ثم اللهجة السعودية
    const score = (v) => (/natural|online|neural/i.test(v.name) ? 20 : 0) + (/^ar[-_]SA/i.test(v.lang) ? 8 : 0) + (/hamed|حامد/i.test(v.name) ? 3 : 0) + (/google/i.test(v.name) ? 4 : 0) + (v.localService ? 0 : 1);
    const vs = speechSynthesis.getVoices(); const ar = vs.filter((v) => /^ar/i.test(v.lang)).sort((a, b) => score(b) - score(a)); arVoice = ar[0] || null;
    const es = (v) => (/natural|online|neural/i.test(v.name) ? 20 : 0) + (/^en[-_]US/i.test(v.lang) ? 5 : 0) + (/^en[-_]GB/i.test(v.lang) ? 3 : 0) + (/google/i.test(v.name) ? 4 : 0);
    enVoice = vs.filter((v) => /^en/i.test(v.lang)).sort((a, b) => es(b) - es(a))[0] || null; };
  const SAY = { "MPU6050": "M P U sixty fifty", "ESP32": "E S P thirty-two", "SIM800L": "SIM eight hundred L", "INMP441": "I N M P four four one", "SIM800L GSM": "SIM eight hundred L, G S M", "GPS": "G P S", "GSM": "G S M" };
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(s) {
    speechDone = true; if (!voiceOn || !("speechSynthesis" in window)) return;
    try { speechSynthesis.cancel();
      // الأسماء الإنجليزية (MPU6050, GPS…) تُنطق بصوت إنجليزي، وبقية الجملة بالصوت العربي
      const parts = s.narr.split(/([A-Za-z][A-Za-z0-9-]*(?:[ +][A-Za-z][A-Za-z0-9-]*)*)/).filter((t) => t.trim());
      const segs = enVoice ? parts : [s.narr];
      let off = 0; speechDone = false;
      segs.forEach((t, i) => {
        const en = enVoice && /^[A-Za-z]/.test(t.trim());
        const u = new SpeechSynthesisUtterance(en ? (SAY[t.trim()] || t.trim()) : t);
        if (en) { u.voice = enVoice; u.lang = enVoice.lang; u.rate = .95; }
        else { u.lang = arVoice?.lang || "ar-SA"; if (arVoice) u.voice = arVoice; u.rate = /natural|online|neural/i.test(arVoice?.name || "") ? 1 : .92; }
        const base = off, nW = t.trim().split(/\s+/).length; off += nW;
        u.onboundary = (e) => { if (!en) wordsShown = Math.max(wordsShown, base + t.slice(0, e.charIndex).trim().split(/\s+/).filter(Boolean).length); };
        u.onend = () => { wordsShown = Math.max(wordsShown, base + nW); if (i === segs.length - 1) speechDone = true; };
        u.onerror = () => { if (i === segs.length - 1) speechDone = true; };
        speechSynthesis.speak(u);
      }); } catch (e) { speechDone = true; }
  }
  const voiceBtn = $("btn-voice");
  voiceBtn.onclick = () => { if (!("speechSynthesis" in window)) { voiceBtn.querySelector("span").textContent = "الصوت غير مدعوم"; return; }
    voiceOn = !voiceOn; voiceBtn.setAttribute("aria-pressed", String(voiceOn)); pickVoice(); if (voiceOn) speak(cur()); else speechSynthesis.cancel(); };
  $("btn-full").onclick = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) { /* */ } };
  addEventListener("keydown", (e) => {
    const k = e.key;
    if (["ArrowLeft", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); stopPlay(); next(); }
    else if (["ArrowRight", "ArrowUp", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); stopPlay(); prev(); }
    else if (k === "Home") { stopPlay(); go(0); } else if (k === "End") { stopPlay(); go(STEPS.length - 1); }
    else if (k === "p" || k === "P") playBtn.click(); else if (k === "v" || k === "V") voiceBtn.click(); else if (k === "f" || k === "F") $("btn-full").click();
  });
  let wheelLock = 0;
  addEventListener("wheel", (e) => { if (e.target.closest && e.target.closest(".panel")) return; if (performance.now() < wheelLock || Math.abs(e.deltaY) < 12) return; wheelLock = performance.now() + 1100; stopPlay(); e.deltaY > 0 ? next() : prev(); }, { passive: true });
  let tx0 = null; addEventListener("touchstart", (e) => { tx0 = e.touches[0].clientX; }, { passive: true });
  addEventListener("touchend", (e) => { if (tx0 == null) return; const dx = e.changedTouches[0].clientX - tx0; if (Math.abs(dx) > 60) { stopPlay(); dx > 0 ? next() : prev(); } tx0 = null; }, { passive: true });

  // ---------------- ما بعد المعالجة + جودة تتكيف مع الجهاز ----------------
  const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const fxObjs = [...beams, dust, sparks, shards, beacon];
  // عمق الميدان أُزيل: كان يسبب سواد نصف الشاشة على بعض الأجهزة عند تشغيله وإطفائه
  // حماية من بكسلات NaN/Inf التي يحوّلها التوهج إلى بقع سوداء تظهر وتختفي
  composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 40.0), clamp(c.a, 0.0, 1.0)); }" }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .55, .5, .86); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  function layout() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h;
    const pw = w > 900 ? Math.min(430, w * .33) : 0; camera.setViewOffset(w, h, -(pw * .5 - (w > 900 ? 40 : 0)), 0, w, h); camera.updateProjectionMatrix();
  }
  addEventListener("resize", layout); layout();
  const perf = { n: 0, t: 0, reset() { this.n = 0; this.t = 0; }, tick(dt) {
    return; this.n++; this.t += dt;
    if (this.t > 2.5) { const fps = this.n / this.t; this.reset();
      if (fps < 32 && QUALITY === 2) { QUALITY--; DPR = 1; renderer.setPixelRatio(1); composer.setPixelRatio(1); layout();
        if (QUALITY < 2) key.shadow.mapSize.set(1024, 1024); if (QUALITY === 0) { renderer.shadowMap.enabled = false; key.castShadow = false; }
        try { localStorage.setItem("rased-q", String(QUALITY)); } catch (x) { /* */ } } } } };

  // ======================================================================
  const clock = new THREE.Clock(), tmp = V(), tmp2 = V();
  const moodCol = new THREE.Color(C.cyan), moodB = new THREE.Color(C.purple), tc = new THREE.Color();
  let lastLive = 0, lastHolo = 0, frameN = 0;
  const opFade = (o, k) => o.traverse((m) => { if (m.material) { const mm = m.material; if (mm.userData.op === undefined) mm.userData.op = 1; mm.opacity = mm.userData.op * k; } });
  const qz = new THREE.Quaternion();

  function setGhost(car, g) {
    for (const m of car.userData.mats) {
      if (g > .01) { m.transparent = true; m.opacity = lerp(m.userData.baseOp ?? 1, .1, g); m.depthWrite = g < .5; }
      else { m.transparent = m.userData.baseTr; m.opacity = m.userData.baseOp ?? 1; m.depthWrite = true; }
    }
  }
  function spinWheels(car, dz) { car.userData.wheels.forEach((w) => { w.rotation.x -= dz / .54; }); }

  function frame() {
    const rawDt = Math.min(clock.getDelta(), TEST ? .25 : .05); now += rawDt; perf.tick(rawDt);
    const s = cur(), st = stepTime(); simUpdate(now);
    const single = SENSORS[s.sensor] ? s.sensor : null, focus = s.sensor || null;
    const unitStage = !["drive", "crash", "inside"].includes(s.id);

    // --- السيارات ---
    let hz = hero.position.z, oz = ZC, oyaw = 0, hpitch = 0, hyaw = 0, hroll = 0;
    if (s.id === "drive") {
      const D = 13, f = st < D - 2 ? D - st : 2 * Math.exp(-(st - (D - 2)) / 2);   // يقترب ثم يهدأ بسلاسة
      hz = CRASH_Z0 + 32 * f; const ph = Math.floor(st / 4.6) % 3;
      if (ph !== phaseCut) { if (phaseCut >= 0 && !TEST) tr = { from: { pos: camera.position.clone(), look: camState.look.clone(), fov: camera.fov }, t0: now, D: 1.8, lift: .6 }; phaseCut = ph; }
      hroll = Math.sin(now * 1.3) * .01; oz = ZC;
    } else if (s.id === "crash") {
      const dt2 = rawDt * slow; crashT += dt2;
      const t = crashT, dist0 = Math.max(8, crashZ0 - Z_HIT), v0 = 30, v1 = 18, acc = (v0 * v0 - v1 * v1) / (2 * dist0), IMP = (v0 - v1) / acc;
      if (t < IMP) { hz = crashZ0 - v0 * t + acc * t * t / 2; }
      else {
        if (impactAt < 0) { impactAt = crashT; sim.ev = now; shake = 1;
          const ip = V(LANE, .75, ZC + 2.05); flashL.position.copy(ip); shock.position.copy(ip).setY(.12);
          spVel.length = 0; for (let i = 0; i < NSP; i++) { spPos.set([ip.x + (Math.random() - .5) * 1.8, ip.y + (Math.random() - .5) * .4, ip.z], i * 3); spVel.push(V((Math.random() - .5) * 9, Math.random() * 6 + 1, (Math.random() - .7) * 9)); }
          glVel.length = 0; for (let i = 0; i < NGL; i++) { glPos.set([ip.x + (Math.random() - .5) * 1.6, ip.y + .3 + Math.random() * .4, ip.z + .3], i * 3); glVel.push(V((Math.random() - .5) * 6, Math.random() * 4, (Math.random() - .3) * 5)); }
          const fl = $("flash"); fl.style.transition = "none"; fl.style.opacity = ".45"; requestAnimationFrame(() => { fl.style.transition = "opacity 600ms ease-out"; fl.style.opacity = "0"; }); }
        const d = crashT - impactAt;
        hz = Z_HIT - 3.2 * (1 - Math.exp(-d * 2.8)); oz = ZC - 6 * (1 - Math.exp(-d * 2)); oyaw = .2 * (1 - Math.exp(-d * 2.5));
        hpitch = .045 * Math.exp(-d * 3) * Math.sin(d * 14); hyaw = -.07 * (1 - Math.exp(-d * 3));
      }
      // حركة بطيئة سينمائية لحظة الاصطدام
      const d2 = impactAt >= 0 ? crashT - impactAt : -1;
      slow = TEST ? 1 : d2 < 0 ? (crashT > 2.1 ? .45 : 1) : d2 < 1.1 ? .3 : lerp(slow, 1, .05);
    } else {
      hz = Z_HIT - 3.2; oz = ZC - 6; oyaw = .2; hyaw = -.07;
    }
    const dz = hz - hero.position.z; hero.position.z = hz; spinWheels(hero, dz);
    hero.rotation.set(hpitch, hyaw, hroll);
    const odz = oz - other.position.z; other.position.z = oz; other.rotation.y = oyaw; spinWheels(other, odz);
    const crashed = s.id !== "drive" && (s.id !== "crash" || impactAt >= 0);
    const blink = crashed ? (Math.sin(now * 8) > 0 ? 6 : 0) : 0;
    [HU, OU].forEach((u) => { if (u.sig) u.sig.emissiveIntensity = blink; });
    if (HU.brake) HU.brake.emissiveIntensity = s.id === "crash" && crashT > 1 ? 9 : 5;
    HU.under.material.opacity = crashed ? .25 : .5;

    // --- الشفافية: رؤية الجهاز داخل السيارة ---
    ghost = lerp(ghost, s.id === "inside" && st > .6 ? 1 : 0, 1 - Math.exp(-rawDt * 2.2)); setGhost(hero, ghost);
    scan.material.opacity = 0; scan.visible = scan.material.opacity > .01;
    if (scan.visible) { scan.position.set(hero.position.x, .7, hero.position.z + Math.sin(st * 1.6 - Math.PI / 2) * 2.2); scan.rotation.set(0, 0, 0); scan.lookAt(scan.position.x, .7, scan.position.z + 10); }

    // --- الجهاز: داخل السيارة ← يطير ويكبر فوق المنصة ---
    rise = lerp(rise, unitStage ? 1 : 0, 1 - Math.exp(-rawDt * (unitStage ? 1.4 : 3)));
    const inCar = hero.localToWorld(INCAR.clone()), onStage = STAGE.clone().setY(UNIT_Y);
    const rk = ease(clamp(rise, 0, 1));
    unit.position.lerpVectors(inCar, onStage, rk); unit.position.y += Math.sin(rk * Math.PI) * 5;
    unit.scale.setScalar(Math.exp(lerp(Math.log(.15), 0, rk)));
    qz.setFromEuler(new THREE.Euler(hpitch, hyaw, 0)); unit.quaternion.copy(qz).slerp(new THREE.Quaternion(), rk);
    unit.visible = s.id !== "drive" && s.id !== "crash" || TEST;
    if (s.id === "drive" || s.id === "crash") unit.visible = false;
    if (unitStage && ["overview", "fusion", "end", "result"].includes(s.id) && rise > .98) unit.rotation.y += rawDt * (s.id === "fusion" ? .1 : .14);
    else unit.rotation.y = lerp(unit.rotation.y, Math.round(unit.rotation.y / (Math.PI * 2)) * Math.PI * 2, 1 - Math.exp(-rawDt * 2.2));
    unitGlow.intensity = lerp(unitGlow.intensity, s.id === "inside" ? 10 : 0, .05); unitGlow.position.copy(unit.position).add(V(0, .4, 0));

    // --- المنصة والإضاءة ---
    stageOn = lerp(stageOn, unitStage ? 1 : 0, 1 - Math.exp(-rawDt * 1.5));
    let mc = single ? SENSORS[single].color : C.cyan, mb = single ? C.blue : s.id === "fusion" ? C.amber : C.purple;
    if (s.id === "end") { mc = C.cyan; mb = C.pink; }
    moodCol.lerp(tc.set(mc), 1 - Math.exp(-rawDt * 2)); moodB.lerp(tc.set(mb), 1 - Math.exp(-rawDt * 2));
    topU.uCol.value.copy(moodCol); topU.uTime.value = now; topU.uOn.value = stageOn;
    neonM.color.copy(moodCol).multiplyScalar(3); neonM.opacity = stageOn; glassPlate.material.opacity = .45 * stageOn;
    disc.visible = neons[0].visible = stageOn > .01;
    const fz = s.id === "fusion" ? .55 : 1; key.intensity = 320 * stageOn * fz; spotA.intensity = (single ? 260 : 420) * stageOn * fz; spotB.intensity = (single ? 220 : 360) * stageOn * fz;
    spotA.color.copy(moodCol); spotB.color.copy(moodB);
    beams.forEach((b, i) => { b.material.uniforms.uCol.value.copy(i === 1 ? moodB : i === 0 ? moodCol : tc.set(C.amber)); b.material.uniforms.uOp.value = stageOn * (single ? .45 : 1) * (.85 + .15 * Math.sin(now * 1.7 + i)); b.visible = stageOn > .01; });
    dust.material.opacity = .5 * stageOn; dust.visible = stageOn > .01;
    if (dust.visible) { const a = dg.attributes.position.array; for (let i = 0; i < ND; i++) { a[i * 3 + 1] += rawDt * .12; if (a[i * 3 + 1] > 9) a[i * 3 + 1] = 0; } dg.attributes.position.needsUpdate = true; }
    crashLight.intensity = lerp(crashLight.intensity, ["crash", "inside", "result", "end"].includes(s.id) ? 220 : 0, .05);
    crashLight.color.set(crashed ? (Math.sin(now * 8) > 0 ? "#ff5a6e" : "#3b82ff") : "#ffffff");
    sky.position.copy(camera.position); sky.userData.mat.uniforms.uGlow.value.copy(moodCol).multiplyScalar(.5).lerp(tc.set("#3a2a7a"), .5);

    // --- إمساك الحساسات ---
    const EXP = { mic: V(-.5, 1.05, -.3), mpu: V(-.3, 1.3, -.55), gps: V(.05, 1.55, -.3), gpsAnt: V(-.45, 1.2, .5), gsm: V(.55, 1.15, -.45), esp: V(0, .9, .55) };
    for (const [k, p] of Object.entries(PU.parts)) {
      const k2 = k === "gpsAnt" ? "gps" : k, isF = single === k2, all = focus === "all";
      const tgt = tmp.copy(p.home); if (isF) tgt.add(k === "gpsAnt" ? V(-.2, .45, .2) : sensorPull[k2]); if (all) tgt.add(EXP[k]);
      p.g.position.lerp(tgt, 1 - Math.exp(-rawDt * 3));
      p.g.scale.setScalar(lerp(p.g.scale.x, isF ? 1.18 : 1, 1 - Math.exp(-rawDt * 3)));
      p.g.rotation.y = lerp(p.g.rotation.y, isF && k !== "esp" ? Math.sin(now * .55) * .22 : 0, 1 - Math.exp(-rawDt * 2));
      p.g.rotation.x = lerp(p.g.rotation.x, isF ? -.12 : 0, 1 - Math.exp(-rawDt * 2));
    }
    if (single === "mpu") PU.parts.mpu.g.position.x += Math.sin(now * 70) * .03 * evK(now);
    if (unit.visible) { unit.updateMatrixWorld(true); PU.updateWires(); }
    const hp = single ? focusPoint(single) : null;
    haloM.opacity = lerp(haloM.opacity, single ? .9 : 0, .08); beamM.opacity = lerp(beamM.opacity, single ? .14 : 0, .08);
    if (single) { const hh = wp(PU.parts[single].g); halo.position.set(hh.x, UNIT_Y + (single === "esp" ? LOWER + .23 : TOP + .02), hh.z); if (single === "gps") { halo.position.x = hp.x; halo.position.z = hp.z; }
      haloM.color.set(SENSORS[single].color).multiplyScalar(2.6); beamM.color.copy(haloM.color).multiplyScalar(.5); }
    h2.rotation.z = now * 1.3; halo.scale.setScalar((single === "gsm" || single === "gps" ? 1.35 : 1) * (1 + Math.sin(now * 3) * .04));
    sensorLight.intensity = lerp(sensorLight.intensity, single ? 5 : 0, .06);
    if (hp) { sensorLight.position.copy(hp).add(V(0, .9, 0)); sensorLight.color.set(SENSORS[single].color); }
    PU.blue.material.color.setRGB(.6, 1.2, Math.sin(now * 3) > 0 ? 9 : 3);
    PU.parts.esp.g.userData.led.material.color.setRGB(...(Math.sin(now * 12) > 0 ? [.3, 3, 1.2] : [.1, .6, .3]));

    const fxOn = { mic: single === "mic", mpu: single === "mpu", gps: single === "gps", gsm: single === "gsm", esp: single === "esp" || s.id === "fusion" };
    for (const k of ["mic", "mpu", "gps", "gsm"]) { const kk = (fx[k + "K"] = lerp(fx[k + "K"] || 0, fxOn[k] ? 1 : 0, 1 - Math.exp(-rawDt * 3))); fx[k].visible = kk > .01; if (fx[k].visible) opFade(fx[k], kk); }
    if (fx.mic.visible) { fx.mic.position.copy(wp(PU.parts.mic.g, .14)); fx.mic.quaternion.copy(camera.quaternion);
      fx.mic.userData.rings.forEach((r, i) => { const u = (now * .55 + i / 5) % 1, ev = evK(now); r.scale.setScalar(2.4 * (1 - u) + .28); r.material.opacity *= Math.sin(u * Math.PI) * (1 + ev * 2); }); }
    if (fx.mpu.visible) { fx.mpu.position.copy(wp(PU.parts.mpu.g, .1)); const e = evK(now); fx.mpu.rotation.set(Math.sin(now * 40) * .08 * e, Math.sin(now * .6) * .3, Math.sin(now * 37) * .08 * e); mpuArc.rotation.z = now * 1.5; fx.mpu.scale.setScalar(1 + e * .25); }
    if (fx.gps.visible) { const ap = wp(PU.parts.gpsAnt.g, .15), kk = fx.gpsK;
      sats.forEach((sat, i) => { const a = sat.userData.a + now * .06, R = 4.2 + (i % 2) * .6; sat.position.set(ap.x + Math.cos(a) * R, ap.y + 2.6 + (i % 3) * .8, ap.z + Math.sin(a) * R); sat.lookAt(ap); sat.userData.mats.forEach((m) => { m.opacity = kk; });
        const ln = sat.userData.line, len = sat.position.distanceTo(ap); ln.position.copy(sat.position).lerp(ap, .5); ln.scale.set(1, len, 1);
        ln.quaternion.setFromUnitVectors(V(0, 1, 0), tmp2.copy(sat.position).sub(ap).normalize()); ln.material.opacity = kk * (.35 + .35 * Math.sin(now * 4 + i)); }); }
    if (fx.gsm.visible) { fx.gsm.position.copy(wp(PU.parts.gsm.g.userData.tip)); fx.gsm.quaternion.copy(camera.quaternion);
      fx.gsm.userData.rings.forEach((r, i) => { const u = (now * .7 + i / 4) % 1; r.scale.setScalar(.2 + u * 2.6); r.material.opacity *= (1 - u); }); }
    pulseM.opacity = lerp(pulseM.opacity, fxOn.esp ? 1 : 0, .1);
    PU.wires.forEach((w, i) => { const m = pulses[i]; m.visible = pulseM.opacity > .02 && !!w.curve; if (m.visible) m.position.copy(w.curve.getPointAt(1 - ((now * .5 + i * .13) % 1))); });

    // --- شاشة البيانات ---
    const sOn = !!single && st > 1.0 && rise > .95;
    sHoloM.material.opacity = lerp(sHoloM.material.opacity, sOn ? 1 : 0, 1 - Math.exp(-rawDt * 4)); sHoloM.visible = sHoloM.material.opacity > .01;
    sLine.visible = sHoloM.visible; sLine.material.opacity = sHoloM.material.opacity * .8;
    if (sHoloM.visible && single) {
      const sh = shot(s), hp2 = sh.sp.clone().addScaledVector(sh.right, 1.32).add(V(0, .68, 0));
      sHoloM.position.copy(hp2); sHoloM.quaternion.copy(camera.quaternion);
      if (now - lastHolo > 1 / 30) { lastHolo = now; T.drawHolo(sHolo, holoSpec(single)); }
      const lp = sLine.geometry.attributes.position; lp.setXYZ(0, sh.sp.x, sh.sp.y + .1, sh.sp.z); lp.setXYZ(1, hp2.x - sh.right.x * .75, hp2.y - .42, hp2.z - sh.right.z * .75); lp.needsUpdate = true;
    }

    // --- مؤثرات الاصطدام ---
    const di = s.id === "crash" && impactAt >= 0 ? crashT - impactAt : 99;
    flashL.intensity = di < .8 ? 450 * Math.exp(-di * 8) : 0;
    shock.visible = di < 1.4; if (shock.visible) { shock.scale.setScalar(1 + di * 10); shock.material.opacity = (1 - di / 1.4) * .9; }
    sparks.material.opacity = di < 2 ? 1 - di / 2 : 0; sparks.visible = sparks.material.opacity > 0;
    shards.material.opacity = di < 2.6 ? 1 - di / 2.6 : 0; shards.visible = shards.material.opacity > 0;
    const pdt = rawDt * slow;
    if (sparks.visible) { for (let i = 0; i < NSP; i++) { const v = spVel[i]; v.y -= 12 * pdt; spPos[i * 3] += v.x * pdt; spPos[i * 3 + 1] = Math.max(.03, spPos[i * 3 + 1] + v.y * pdt); spPos[i * 3 + 2] += v.z * pdt; } spG.attributes.position.needsUpdate = true; }
    if (shards.visible) { for (let i = 0; i < NGL; i++) { const v = glVel[i]; v.y -= 9 * pdt; glPos[i * 3] += v.x * pdt; glPos[i * 3 + 1] = Math.max(.02, glPos[i * 3 + 1] + v.y * pdt); glPos[i * 3 + 2] += v.z * pdt; if (glPos[i * 3 + 1] <= .02) { v.multiplyScalar(.6); } } glG.attributes.position.needsUpdate = true; }
    if (s.id === "crash" && impactAt >= 0) sim.ev = now - (crashT - impactAt);
    const beaconOn = s.id === "result" || (s.id === "crash" && di > 2.8 && di < 90);
    beacon.material.uniforms.uOp.value = lerp(beacon.material.uniforms.uOp.value, beaconOn ? 1 : 0, .05); beacon.visible = beacon.material.uniforms.uOp.value > .01;
    const phOn = s.id === "result";
    const pk = lerp(phBody.material.opacity, phOn ? 1 : 0, 1 - Math.exp(-rawDt * 3)); phBody.material.opacity = pk; phS.material.opacity = pk; phone.visible = pk > .01;
    if (phone.visible) { camera.updateMatrixWorld(); const cq = camera.quaternion, dist = 4.6, halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist, halfW = halfH * camera.aspect;
      phone.position.copy(camera.position).add(V(halfW * .34, -halfH * .03 + Math.sin(now) * .02 - (1 - pk) * .6, -dist).applyQuaternion(cq));
      phone.quaternion.copy(cq); phone.rotateY(-.12); phone.scale.setScalar(halfH * 1.55 / 2.55);
      if ((frameN & 1) === 0) T.drawPhone(phC, clamp((st - .5) / 2, 0, 1)); }

    // --- الكاميرا ---
    const dest = shot(s);
    let pos, look, fov; const k = tr.D > 0 ? clamp((now - tr.t0) / tr.D, 0, 1) : 1, ke = ease(k);
    if (k < 1) { pos = tmp.copy(tr.from.pos).lerp(dest.p, ke); pos.y += Math.sin(Math.PI * ke) * tr.lift; look = tmp2.copy(tr.from.look).lerp(dest.t, ease(clamp(k * 1.12, 0, 1))); fov = lerp(tr.from.fov, dest.fov, ke); arriveT = now; }
    else { const ta = now - arriveT, sw = REDUCED || dest.lock ? 0 : dest.sway * Math.sin(ta * .16) * Math.min(1, ta * .45);
      pos = tmp.copy(dest.p).sub(dest.t).applyAxisAngle(V(0, 1, 0), sw).add(dest.t); if (!dest.lock) pos.y += Math.sin(ta * .21) * .06; look = tmp2.copy(dest.t); fov = dest.fov; }
    if (s.id === "drive" && !REDUCED) { pos.x += (Math.random() - .5) * .025; pos.y += (Math.random() - .5) * .02; }
    if (!REDUCED) { look.x += Math.sin(now * .7) * .012; look.y += Math.sin(now * .53) * .01; }
    if (shake > .001) { pos.x += (Math.random() - .5) * shake * .45; pos.y += (Math.random() - .5) * shake * .35; shake *= Math.exp(-rawDt * 2.6); }
    camera.position.copy(pos); camState.look.copy(look); camera.lookAt(look); camera.fov = fov; camera.updateProjectionMatrix();
    bloom.strength = lerp(bloom.strength, single ? .32 : s.id === "fusion" ? .26 : .55, .05);

    trails.userData.update(now, camera.position, s.id === "drive" ? 1 : .35);
    city.userData.mat.uniforms.uTime.value = now;

    // --- التسميات واللوح ---
    const w = innerWidth, h = innerHeight;
    for (const L of labels) {
      const on = L.cond(); L.k = lerp(L.k, on ? 1 : 0, 1 - Math.exp(-rawDt * (on ? 3 : 6)));
      if (L.k < .01) { L.el.style.opacity = 0; continue; }
      const p = L.getPos(); p.project(camera); if (p.z > 1) { L.el.style.opacity = 0; continue; }
      L.el.style.opacity = L.k; L.el.style.transform = `translate(${((p.x * .5 + .5) * w).toFixed(1)}px, ${((-p.y * .5 + .5) * h).toFixed(1)}px) translate(-50%, -100%)`;
    }
    if (now - lastLive > .1) {
      lastLive = now; const lt = liveText();
      if (s.id === "crash" && impactAt < 0 || s.id === "drive") { lt["mic.prob"] = fmt(.02 + Math.random() * .03, 3); lt["esp.stage"] = STAGES[0]; lt["mic.rms"] = fmt(300 + Math.random() * 200); lt.hot = {}; }
      for (const el of liveEls) { const kk = el.dataset.live; el.textContent = lt[kk] ?? "—"; el.parentElement.classList.toggle("is-hot", !!lt.hot[kk]); }
      const pipe = $("p-pipe"); if (pipe) [...pipe.children].forEach((sp, i) => { sp.classList.toggle("is-on", i === sim.v.stage); sp.classList.toggle("is-alert", i === 3 && sim.v.stage === 3); });
      tlEls.forEach((el) => el.classList.toggle("is-done", s.id === "crash" && impactAt >= 0 && crashT - impactAt >= parseFloat(el.dataset.t) - 2.6));
    }
    const target2 = voiceOn && !speechDone ? wordsShown : Math.floor(st * 2.6) + 1;
    const ws = subEl.children; for (let i = 0; i < ws.length; i++) { const on = i < target2; if (ws[i]._on !== on) { ws[i]._on = on; ws[i].classList.toggle("on", on); } }
    const pr = prog.children; for (let i = 0; i < pr.length; i++) { const f = i < idx ? 1 : i > idx ? 0 : playing ? clamp(st / stepDur(s), 0, 1) : 1; pr[i].firstChild.style.transform = `scaleX(${f})`; }
    if (playing) { const done = voiceOn ? (speechDone && st > 4) : st > stepDur(s); if (done) { if (idx < STEPS.length - 1) next(); else stopPlay(); } }

    composer.render(); frameN++;
    requestAnimationFrame(frame);
  }

  const start = STEPS.findIndex((s) => `#${s.id}` === location.hash);
  idx = -1; go(start >= 0 ? start : 0, { instant: true, force: true });
  if (unitStageStart()) { rise = 1; stageOn = 1; }
  function unitStageStart() { return !["drive", "crash", "inside"].includes(cur().id); }
  const s0 = shot(cur()); camera.position.copy(s0.p); camState.look.copy(s0.t);
  loadStep(1, "جاهز"); setTimeout(() => $("loader").classList.add("is-done"), 350);
  window.__rased = { go, scene, camera, STEPS };
  requestAnimationFrame(frame);
}

init().catch((e) => { console.error(e); $("loadstep").textContent = "تعذر تشغيل المشهد: " + e.message; });
