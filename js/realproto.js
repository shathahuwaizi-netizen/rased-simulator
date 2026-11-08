// realproto.js · عربة رصد الحقيقية كما في الصورة:
// سطح علوي أسود (جسر) عليه: ميكروفون فضي، MPU6050 أحمر، هوائي GPS مربع كبير، لوحة GPS زرقاء، لوحة SIM800L زرقاء كبيرة
// وطابق أمامي سفلي: لوحة توصيل سوداء بأطراف خضراء على قاعدة صفراء، ويركب عليها ESP32-S3، وعجلات ميكانوم صفراء.
import * as THREE from "three";
import { canvas, tex, pcbTexture, chipTexture } from "./textures.js";

const MONO = 'ui-monospace, Menlo, Consolas, monospace';
export const TOP = 1.8;     // سطح الجسر العلوي
export const LOWER = 1.0;   // سطح الطابق الأمامي

function holesPCB(color, w, h, { label = "", sub = "", seed = 1, holes = true, labelCol = "rgba(255,255,255,.9)" } = {}) {
  const t = pcbTexture({ color, label: "", w, h, seed, pads: false });
  const c = t.image, x = c.getContext("2d");
  if (holes) for (const [px, py] of [[34, 34], [w - 34, 34], [34, h - 34], [w - 34, h - 34]]) {
    x.fillStyle = "#e0b552"; x.beginPath(); x.arc(px, py, 22, 0, 7); x.fill(); x.fillStyle = "#111"; x.beginPath(); x.arc(px, py, 12, 0, 7); x.fill();
  }
  x.fillStyle = labelCol; x.font = `700 ${Math.round(h * .085)}px ${MONO}`; x.textAlign = "center";
  if (label) x.fillText(label, w / 2, h - 30); if (sub) { x.font = `500 ${Math.round(h * .06)}px ${MONO}`; x.fillText(sub, w / 2, 56); }
  t.needsUpdate = true; return t;
}
function grilleTex() {
  const c = canvas(256, 256), x = c.getContext("2d");
  const g = x.createRadialGradient(110, 100, 10, 128, 128, 128); g.addColorStop(0, "#f2f3f5"); g.addColorStop(.8, "#a9adb5"); g.addColorStop(1, "#6e737c");
  x.fillStyle = g; x.beginPath(); x.arc(128, 128, 128, 0, 7); x.fill();
  x.fillStyle = "#26282d";
  const pts = [[128, 128]]; for (let i = 0; i < 6; i++) pts.push([128 + Math.cos(i / 6 * 6.283) * 46, 128 + Math.sin(i / 6 * 6.283) * 46]);
  for (let i = 0; i < 12; i++) pts.push([128 + Math.cos(i / 12 * 6.283 + .26) * 88, 128 + Math.sin(i / 12 * 6.283 + .26) * 88]);
  pts.forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 13, 0, 7); x.fill(); });
  return tex(c);
}
function simTex() {
  const c = canvas(320, 360), x = c.getContext("2d");
  x.fillStyle = "#f3f1ea"; x.fillRect(0, 0, 320, 360);
  x.fillStyle = "#d4202f"; x.fillRect(18, 18, 70, 64); x.fillStyle = "#fff"; x.font = `700 30px ${MONO}`; x.fillText("S", 38, 62);
  x.fillStyle = "#111"; x.font = `800 44px ${MONO}`; x.fillText("SIM800L", 100, 66);
  x.font = `500 18px ${MONO}`; x.fillText("S2-1065J-Z143H", 22, 120);
  for (let i = 0; i < 40; i++) { x.fillRect(22 + i * 6.8, 140, (i * 7) % 3 + 1.5, 60); }
  x.fillText("IMEI 8648020411", 22, 230); for (let i = 0; i < 40; i++) x.fillRect(22 + i * 6.8, 245, (i * 5) % 3 + 1.5, 46);
  x.font = `700 26px ${MONO}`; x.fillText("CE 0682", 110, 336);
  return tex(c);
}
function shieldTex(lines = [], tint = "#c9ccd2") {
  const c = canvas(256, 256), x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, "#e6e8ec"); g.addColorStop(.5, tint); g.addColorStop(1, "#dcdfe4");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 4; x.strokeRect(10, 10, 236, 236);
  for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .12})`; x.fillRect(Math.random() * 256, Math.random() * 256, 30, 1); }
  x.fillStyle = "#333"; x.font = `700 26px ${MONO}`; x.textAlign = "center"; lines.forEach((l, i) => x.fillText(l, 128, 110 + i * 34));
  return tex(c);
}

export function makeRealPrototype(envMap) {
  const root = new THREE.Group();
  const M = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMap }, o));
  const black = M({ color: 0x0b0c0f, roughness: .5, metalness: .15 });
  const blackMatte = M({ color: 0x121317, roughness: .85 });
  const metal = M({ color: 0xc3c7cf, roughness: .32, metalness: .95 });
  const gold = M({ color: 0xd9a63c, roughness: .25, metalness: 1 });
  const yellow = M({ color: 0xc89d0c, roughness: .55, envMapIntensity: .5 });
  const greyRoll = M({ color: 0x55585f, roughness: .6 });
  const pinsM = M({ color: 0xb8a060, metalness: 1, roughness: .3 });
  const dupM = M({ color: 0x15161a, roughness: .6 });
  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = root) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const topMat = (map, extra = {}) => [black, black, M(Object.assign({ map, roughness: .42, metalness: .1 }, extra)), black, black, black];

  // ---------- الهيكل السفلي ----------
  box(2.9, .62, 3.3, black, 0, .62, .35);                              // جسم الشاسيه
  box(3.1, .05, 3.5, blackMatte, 0, LOWER - .03, .35);                 // سطح الطابق السفلي
  // الجسر العلوي: شكل U مقلوب بزوايا دائرية
  const s = new THREE.Shape(), R = .18, Wd = 2.02, H0 = LOWER, H1 = TOP, th = .07;
  s.moveTo(-Wd, H0); s.lineTo(-Wd, H1 - R); s.quadraticCurveTo(-Wd, H1, -Wd + R, H1); s.lineTo(Wd - R, H1); s.quadraticCurveTo(Wd, H1, Wd, H1 - R); s.lineTo(Wd, H0);
  s.lineTo(Wd - th, H0); s.lineTo(Wd - th, H1 - R); s.quadraticCurveTo(Wd - th, H1 - th, Wd - R, H1 - th); s.lineTo(-Wd + R, H1 - th); s.quadraticCurveTo(-Wd + th, H1 - th, -Wd + th, H1 - R); s.lineTo(-Wd + th, H0); s.closePath();
  const bridgeG = new THREE.ExtrudeGeometry(s, { depth: 2.35, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2, curveSegments: 10 });
  bridgeG.translate(0, -.035, -1.4);
  const bridge = new THREE.Mesh(bridgeG, M({ color: 0x0c0d10, roughness: .38, metalness: .2 })); root.add(bridge);
  // البطارية والصندوق الأمامي مع ضوء أزرق
  const front = new THREE.Group(); front.position.set(0, 0, 2.15); root.add(front);
  box(1.35, .5, .75, M({ color: 0x18191d, roughness: .55 }), 0, .52, .05, front);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(.62, .025, 8, 48), M({ color: 0x050505, roughness: .4 })); coil.rotation.x = Math.PI / 2; coil.position.set(0, .82, 0); front.add(coil);
  const coil2 = coil.clone(); coil2.scale.setScalar(.92); coil2.position.y = .86; front.add(coil2);
  const blue = new THREE.Mesh(new THREE.SphereGeometry(.055, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 1.2, 9), toneMapped: false }));
  blue.position.set(.18, .5, .44); front.add(blue);
  box(.12, .16, .02, M({ color: 0xdddddd }), .5, .62, .43, front);

  // ---------- عجلات ميكانوم ----------
  const wheels = [];
  const plateG = new THREE.CylinderGeometry(.3, .3, .06, 9); plateG.rotateZ(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(.16, .16, .5, 16); hubG.rotateZ(Math.PI / 2);
  const rollG = new THREE.CapsuleGeometry(.105, .2, 4, 10);
  for (const [x, z] of [[-1.82, -.75], [1.82, -.75], [-1.82, 1.55], [1.82, 1.55]]) {
    const w = new THREE.Group(); w.position.set(x, .56, z); root.add(w);
    const spin = new THREE.Group(); w.add(spin);
    for (const dx of [-.2, .2]) { const p = new THREE.Mesh(plateG, yellow); p.position.x = dx; spin.add(p); }
    spin.add(new THREE.Mesh(hubG, yellow));
    const n = 9, im = new THREE.InstancedMesh(rollG, greyRoll, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const sg = Math.sign(x * z || 1);
    for (let i = 0; i < n; i++) {
      const th = i / n * Math.PI * 2, t = new THREE.Vector3(0, -Math.sin(th), Math.cos(th));
      const ax = t.multiplyScalar(Math.SQRT1_2).add(new THREE.Vector3(sg * Math.SQRT1_2, 0, 0)).normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
      m4.compose(new THREE.Vector3(0, Math.cos(th) * .43, Math.sin(th) * .43), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4);
    }
    spin.add(im);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .5, 10), black); axle.rotation.z = Math.PI / 2; axle.position.x = -Math.sign(x) * .35; w.add(axle);
    wheels.push(spin);
  }

  // ---------- الطابق الأمامي: قاعدة صفراء + لوحة التوصيل ----------
  box(2.3, .06, 1.05, yellow, .2, LOWER + .03, 1.45);
  const expT = holesPCB("#111216", 640, 240, { label: "ESP32 EXPANSION", seed: 3 });
  const exp = box(2.3, .05, .78, topMat(expT), 0, LOWER + .09, 1.42);
  const term = box(2.15, .17, .2, M({ color: 0x1c8a40, roughness: .6, envMapIntensity: .5 }), 0, LOWER + .2, 1.73);
  for (let i = 0; i < 14; i++) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .03, 10), metal); sc.position.set(-.98 + i * .151, LOWER + .3, 1.73); root.add(sc); }
  for (const zz of [1.2, 1.5]) for (let i = 0; i < 18; i++) { box(.05, .1, .05, i % 4 === 0 ? M({ color: 0xd62828 }) : yellow, -.95 + i * .112, LOWER + .17, zz); }

  // ---------- الوحدات (قابلة للإمساك) ----------
  const parts = {};
  function part(key, x, y, z, build) { const g = new THREE.Group(); g.position.set(x, y, z); build(g); root.add(g); parts[key] = { g, home: g.position.clone() }; return g; }
  const headers = (g, n, x0, z, step = .085, y = .03) => { const pts = []; for (let i = 0; i < n; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.03, .16, .03), pinsM); p.position.set(x0 + i * step, y + .08, z); g.add(p);
      const d = new THREE.Mesh(new THREE.BoxGeometry(.07, .2, .07), dupM); d.position.set(x0 + i * step, y + .25, z); g.add(d); pts.push(new THREE.Vector3(x0 + i * step, y + .35, z)); } return pts; };

  // 1 · الميكروفون: علبة فضية مثقبة
  part("mic", -1.55, TOP, -.95, (g) => {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .24, 40), [metal, M({ map: grilleTex(), metalness: .8, roughness: .35 }), metal]);
    can.position.y = .12; g.add(can);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .03, 40), dupM); base.position.y = .015; g.add(base);
    g.userData.pins = [new THREE.Vector3(.1, .2, -.2), new THREE.Vector3(.18, .2, -.12)];
  });
  // 2 · MPU6050 أحمر
  part("mpu", -.85, TOP, -.85, (g) => {
    box(.78, .04, .6, topMat(holesPCB("#c8172a", 400, 300, { label: "MPU-6050", sub: "GY-521", seed: 4 })), 0, .02, 0, g);
    box(.18, .04, .18, topMat(chipTexture("MPU\n6050")), .06, .06, .02, g);
    g.userData.pins = headers(g, 6, -.22, -.24);
  });
  // 3 · GPS: هوائي مربع كبير + لوحة زرقاء
  const ant = part("gpsAnt", -.82, TOP, .25, (g) => {
    box(1.0, .04, .98, topMat(holesPCB("#1f8a3c", 400, 400, { seed: 5 })), 0, .02, 0, g);
    box(.86, .11, .84, [metal, metal, M({ map: shieldTex([], "#bfc3ca"), metalness: .85, roughness: .38 }), metal, metal, metal], 0, .095, 0, g);
    const notch = box(.18, .02, .1, metal, .33, .16, -.3, g);
  });
  part("gps", .1, TOP, -.25, (g) => {
    box(.76, .04, 1.26, topMat(holesPCB("#1d4fc4", 300, 500, { label: "GPS", sub: "VCC RX TX GND", seed: 6 })), 0, .02, 0, g);
    box(.46, .07, .46, [metal, metal, M({ map: shieldTex(["u-blox", "NEO-6M"], "#d9dbe0"), metalness: .5, roughness: .4 }), metal, metal, metal], 0, .075, .05, g);
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .05, 24), metal); cell.position.set(.15, .065, .45); g.add(cell);
    const ufl = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .05, 12), gold); ufl.position.set(-.23, .07, .45); g.add(ufl);
    g.userData.pins = headers(g, 4, -.13, -.55);
  });
  // 4 · SIM800L: لوحة زرقاء كبيرة، حامل شريحة، وحدة SIM800L، موصل SMA ذهبي
  part("gsm", 1.25, TOP, -.22, (g) => {
    box(1.32, .04, 1.36, topMat(holesPCB("#1d4fc4", 500, 520, { seed: 8 })), 0, .02, 0, g);
    box(.52, .07, .62, M({ color: 0x2a62d8, roughness: .45 }), -.3, .06, .1, g);
    box(.42, .02, .5, metal, -.3, .105, .1, g);
    box(.56, .06, .64, [metal, metal, M({ map: simTex(), roughness: .55 }), metal, metal, metal], .32, .06, .12, g);
    box(.22, .06, .14, M({ color: 0x8a6a1a, roughness: .4 }), .3, .06, -.38, g);
    const sma = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .42, 18), gold); sma.position.set(.52, .25, -.56); g.add(sma);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .06, 6), gold); nut.position.set(.52, .14, -.56); g.add(nut);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, .5), toneMapped: false }));
    tip.position.set(.52, .5, -.56); g.add(tip); g.userData.tip = tip;
    g.userData.pins = headers(g, 5, -.55, -.58);
  });
  // 5 · ESP32-S3 على لوحة التوصيل
  part("esp", -.15, LOWER + .22, 1.36, (g) => {
    box(1.3, .04, .5, topMat(holesPCB("#121a2e", 520, 200, { label: "LOLIN S3 · ESP32-S3", seed: 12, holes: false })), 0, .02, 0, g);
    box(.5, .06, .36, [metal, metal, M({ map: shieldTex(["ESP32-S3", "WROOM-1"]), metalness: .7, roughness: .35 }), metal, metal, metal], .25, .07, 0, g);
    box(.14, .07, .18, metal, -.62, .06, 0, g);
    const led = box(.05, .03, .05, new THREE.MeshBasicMaterial({ color: new THREE.Color(.3, 3, 1.2), toneMapped: false }), -.4, .05, .15, g);
    g.userData.led = led;
  });

  // ---------- الأسلاك: من رؤوس الوحدات تقوس فوق السطح وتنزل للوحة التوصيل ----------
  const COLS = [0x111111, 0xf07d1b, 0xd42a2a, 0x2a52d4, 0x26a35a, 0x8a3fd1, 0xf1c40f, 0xeeeeee, 0x8a8f99, 0x17a2a0];
  const wires = []; let wi = 0;
  const dest = (i) => new THREE.Vector3(-.95 + (i % 18) * .112, LOWER + .27, i % 2 ? 1.2 : 1.5);
  for (const k of ["mic", "mpu", "gps", "gsm"]) {
    const pins = parts[k].g.userData.pins || [];
    pins.forEach((p, j) => { const mesh = new THREE.Mesh(new THREE.BufferGeometry(), M({ color: COLS[wi % COLS.length], roughness: .7, envMapIntensity: .35 })); root.add(mesh);
      wires.push({ k, p, d: dest(wi * 1 + 1), mesh, h: .35 + ((wi * 37) % 7) * .07, last: -1 }); wi++; });
  }
  // كابل الهوائي الرمادي
  const coax = new THREE.Mesh(new THREE.BufferGeometry(), M({ color: 0x9aa0a8, roughness: .5 })); root.add(coax);
  const tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
  function updateWires(force) {
    root.updateMatrixWorld(true);
    for (const w of wires) {
      const pg = parts[w.k].g, sig = pg.position.x * 3 + pg.position.y * 7 + pg.position.z * 11 + pg.rotation.y + pg.scale.x;
      if (!force && Math.abs(sig - w.last) < 1e-4) continue; w.last = sig;
      const a = pg.localToWorld(tv.copy(w.p)); root.worldToLocal(a);
      const b = w.d, mid = a.clone().lerp(b, .45); mid.y = Math.max(a.y, TOP) + w.h;
      const c = new THREE.CatmullRomCurve3([a.clone(), a.clone().add(new THREE.Vector3(0, .35, 0)), mid, new THREE.Vector3(b.x, TOP + .35, (b.z + 1.0) / 2 + .3), b.clone().add(new THREE.Vector3(0, .1, 0)), b.clone()]);
      w.mesh.geometry.dispose(); w.mesh.geometry = new THREE.TubeGeometry(c, 48, .016, 6, false); w.curve = c;
    }
    const ga = parts.gpsAnt.g, gb = parts.gps.g;
    const a = root.worldToLocal(ga.localToWorld(tv.set(.33, .2, -.3))), b = root.worldToLocal(gb.localToWorld(tv2.set(-.23, .1, .45)));
    const c = new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(.05, .35, -.05)), a.clone().lerp(b, .5).add(new THREE.Vector3(0, .45, .1)), b.clone().add(new THREE.Vector3(0, .25, 0)), b]);
    coax.geometry.dispose(); coax.geometry = new THREE.TubeGeometry(c, 30, .022, 6, false);
  }
  updateWires(true);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.userData = { parts, wheels, wires, updateWires, blue };
  return root;
}
