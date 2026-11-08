// world.js · المدينة الليلية، الطريق، خطوط الضوء، السيارة
import * as THREE from "three";
import { glowTexture, warnTexture, canvas, tex } from "./textures.js";

export const ROAD_HALF = 9;
export const FOG = new THREE.Color("#060b18");

function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// ---------- السماء ----------
export function makeSky() {
  const g = new THREE.SphereGeometry(3000, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uGlow: { value: new THREE.Color("#3a2a7a") } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uGlow; varying vec3 vP;
      void main(){ float h = vP.y;
        vec3 top = vec3(.010,.018,.045), mid = vec3(.03,.05,.11);
        vec3 c = mix(mid, top, smoothstep(0., .5, h));
        c += uGlow * .55 * exp(-abs(h)*9.) + vec3(.05,.12,.25)*exp(-abs(h)*22.);
        gl_FragColor = vec4(c,1.); }`,
  });
  const sky = new THREE.Mesh(g, m);
  // نجوم
  const r = rnd(11), n = 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(r() * .85 + .12);
    pos.set([Math.cos(th) * Math.sin(ph) * 2800, Math.cos(ph) * 2800, Math.sin(th) * Math.sin(ph) * 2800], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, color: 0x9fb8ff, transparent: true, opacity: .7, fog: false }));
  const grp = new THREE.Group(); grp.add(sky, stars); grp.userData.mat = m; return grp;
}

// ---------- الأرض والطريق ----------
export function makeGround() {
  const grp = new THREE.Group();
  const gm = new THREE.ShaderMaterial({
    uniforms: { uFog: { value: FOG }, uDen: { value: .0042 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uFog; uniform float uDen; varying vec3 vW; varying float vD;
      float line(float x, float w){ float f = abs(fract(x)-.5); return smoothstep(w, 0., .5-f); }
      void main(){
        vec3 c = vec3(.012,.02,.04);
        float g = max(line(vW.x/12., .035), line(vW.z/12., .035));
        c += vec3(.05,.35,.6) * g * .35;
        float ff = 1. - exp(-vD*vD*uDen*uDen);
        gl_FragColor = vec4(mix(c, uFog, ff), 1.);
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), gm);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; grp.add(ground);

  // الطريق: إسفلت لامع مع خطوط المسارات
  const c = canvas(512, 512), x = c.getContext("2d");
  x.fillStyle = "#0b0e15"; x.fillRect(0, 0, 512, 512);
  const r = rnd(5); for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(255,255,255,${r() * .04})`; x.fillRect(r() * 512, r() * 512, 2, 2); }
  x.fillStyle = "rgba(255,255,255,.75)"; for (const lx of [128, 384]) x.fillRect(lx - 4, 0, 8, 260);
  x.fillStyle = "#f2b33d"; x.fillRect(252, 0, 4, 512); x.fillRect(260, 0, 4, 512);
  x.fillStyle = "rgba(255,255,255,.85)"; x.fillRect(8, 0, 8, 512); x.fillRect(496, 0, 8, 512);
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 120);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 1800),
    new THREE.MeshStandardMaterial({ map: t, roughness: .32, metalness: .55, color: 0xffffff }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.0, -650); grp.add(road);
  grp.userData.ground = gm;
  return grp;
}

// ---------- المباني (نوافذ مضيئة مولدة في الـshader) ----------
export function makeCity() {
  const r = rnd(42), boxes = [];
  const add = (x, z, w, d, h) => boxes.push([x, z, w, d, h]);
  for (let z = 180; z > -1500; z -= 14 + r() * 10) {
    for (const side of [-1, 1]) {
      let x = side * ((side > 0 ? 46 : 22) + r() * 10);
      for (let k = 0; k < 7; k++) {
        const w = 8 + r() * 14, d = 8 + r() * 12, near = k < 2;
        const h = (near ? 8 + r() * 26 : 18 + r() * 90) * (r() > .93 ? 2.2 : 1);
        add(x + side * w / 2, z + (r() - .5) * 6, w, d, h);
        x += side * (w + 6 + r() * 16);
      }
    }
  }
  // أفق بعيد
  for (let i = 0; i < 260; i++) {
    const a = (r() - .5) * 2.6, R = 700 + r() * 500, w = 20 + r() * 40;
    add(Math.sin(a) * R, -900 + -Math.cos(a) * R * .9, w, w, 60 + r() * 220);
  }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uFog: { value: FOG }, uDen: { value: .0042 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vW; varying vec3 vN; varying float vD; varying float vSeed; varying float vH;
      void main(){ vec4 w = modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz;
        vN = normalize(mat3(instanceMatrix)*normal); vSeed = instanceMatrix[3].x*.13+instanceMatrix[3].z*.71; vH = instanceMatrix[1].y;
        vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uFog; uniform float uDen; uniform float uTime; varying vec3 vW; varying vec3 vN; varying float vD; varying float vSeed; varying float vH;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 base = mix(vec3(.018,.026,.05), vec3(.035,.05,.09), clamp(vW.y/120.,0.,1.));
        vec3 c = base;
        if (abs(vN.y) < .5) {
          float u = abs(vN.x) > .5 ? vW.z : vW.x;
          vec2 g = vec2(u/2.4, vW.y/3.3); vec2 cell = floor(g); vec2 f = fract(g);
          float win = step(.2,f.x)*step(f.x,.8)*step(.28,f.y)*step(f.y,.78);
          float hh = h21(cell + vSeed);
          float lit = step(.66, hh) * win;
          float fw = max(fwidth(g.x), fwidth(g.y));
          float detail = clamp(1.6 - fw * 3., 0., 1.);       // تنعيم النوافذ البعيدة لمنع الوميض
          vec3 wc = mix(vec3(1.,.72,.42), vec3(.45,.78,1.), step(.83, hh));
          vec3 lw = wc * lit * (.55 + .5*h21(cell*1.7)) + vec3(.03,.06,.12) * win * (1.-lit);
          c += mix(vec3(.11,.09,.08), lw, detail);
          c *= vW.x > 30. ? .42 : 1.;                        // خلفية أهدأ خلف محطات العرض
          float top = smoothstep(vH-1.2, vH, vW.y); c += vec3(.15,.5,.9) * top * .5 * step(.55, fract(vSeed*3.1));
        } else { c = vec3(.02,.03,.055); }
        float ff = 1. - exp(-vD*vD*uDen*uDen*.55);
        gl_FragColor = vec4(mix(c, uFog*1.4, ff), 1.);
      }`,
  });
  const im = new THREE.InstancedMesh(geo, mat, boxes.length), m4 = new THREE.Matrix4();
  boxes.forEach(([x, z, w, d, h], i) => { m4.makeScale(w, h, d); m4.setPosition(x, 0, z); im.setMatrixAt(i, m4); });
  im.frustumCulled = false; im.userData.mat = mat;
  return im;
}

// ---------- أعمدة الإنارة ----------
export function makeLamps() {
  const grp = new THREE.Group(), pts = [];
  const poles = []; for (let z = 150; z > -1450; z -= 32) for (const s of [-1, 1]) poles.push([s * (ROAD_HALF + 1.2), z]);
  const pg = new THREE.CylinderGeometry(.08, .12, 9, 6); pg.translate(0, 4.5, 0);
  const pm = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: .7, roughness: .4 }), poles.length);
  const m4 = new THREE.Matrix4();
  poles.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); pm.setMatrixAt(i, m4); pts.push(x - Math.sign(x) * 1.4, 9, z); });
  grp.add(pm);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  grp.add(new THREE.Points(g, new THREE.PointsMaterial({ map: glowTexture("rgba(255,214,160,1)"), size: 3.4, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a8 })));
  return grp;
}

// ---------- خطوط ضوء السيارات ----------
export function makeTrails() {
  const n = 160, geo = new THREE.BoxGeometry(.18, .1, 1);
  const mk = (col) => new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: col, toneMapped: false }), n);
  const red = mk(new THREE.Color(4, .25, .35)), white = mk(new THREE.Color(2.4, 2.8, 4));
  const r = rnd(9), data = [];
  for (let i = 0; i < n; i++) data.push({ lane: [-7.2, -4.4][i % 2] + (r() - .5) * .3, off: r() * 600, sp: 30 + r() * 25, len: 4 + r() * 10, y: .45 + r() * .25 });
  const grp = new THREE.Group(); grp.add(red, white); grp.frustumCulled = false; red.frustumCulled = white.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  grp.userData.update = (t, cam, dens = 1) => {
    const cz = cam.z;
    // تختفي الخطوط القريبة جداً من الكاميرا، وتُغلق المنطقة أثناء اختبار التصادم
    const vis = (x, z) => { const dx = x - cam.x, dz = z - cam.z; return Math.min(1, Math.max(0, (Math.sqrt(dx * dx + dz * dz) - 9) / 10)); };
    data.forEach((d, i) => {
      const span = 640, base = cz + 150, on = i / data.length < dens ? 1 : 0;
      const zr = base - ((d.off + t * d.sp) % span);          // باتجاه -z (أضواء خلفية حمراء)
      let k = on * vis(-d.lane, zr); p.set(-d.lane, d.y, zr); s.set(k, k, d.len * k + .001); m4.compose(p, q, s); red.setMatrixAt(i, m4);
      const zw = base - span + ((d.off * 1.7 + t * d.sp) % span); // بالاتجاه المعاكس (أضواء أمامية)
      k = on * vis(d.lane, zw); p.set(d.lane, d.y, zw); s.set(k, k, d.len * k + .001); m4.compose(p, q, s); white.setMatrixAt(i, m4);
    });
    red.instanceMatrix.needsUpdate = white.instanceMatrix.needsUpdate = true;
  };
  return grp;
}

// ---------- السيارة (سيدان) ----------
export function makeCar(envMap) {
  const car = new THREE.Group(), body = new THREE.Group(); car.add(body);
  const s = new THREE.Shape();
  s.moveTo(0.06, 0.38); s.lineTo(0.0, 0.62); s.quadraticCurveTo(0.02, 0.92, 0.3, 0.98); s.lineTo(1.05, 1.04);
  s.quadraticCurveTo(1.45, 1.3, 1.85, 1.43); s.lineTo(2.8, 1.45); s.quadraticCurveTo(3.25, 1.3, 3.62, 1.08);
  s.lineTo(4.45, 0.92); s.quadraticCurveTo(4.72, 0.86, 4.72, 0.6); s.lineTo(4.68, 0.38);
  s.lineTo(4.22, 0.38); s.absarc(3.75, 0.38, 0.47, 0, Math.PI, false); s.lineTo(1.47, 0.38);
  s.absarc(1.0, 0.38, 0.47, 0, Math.PI, false); s.lineTo(0.06, 0.38);
  const W = 1.86;
  const bg = new THREE.ExtrudeGeometry(s, { depth: W - .16, bevelEnabled: true, bevelThickness: .08, bevelSize: .07, bevelSegments: 4, curveSegments: 18 });
  bg.translate(-2.36, 0, -(W - .16) / 2);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x0a2c86, metalness: .55, roughness: .3, clearcoat: 1, clearcoatRoughness: .08, envMap, envMapIntensity: 1.4 });
  const bm = new THREE.Mesh(bg, paint); body.add(bm);
  // الزجاج
  const gsh = new THREE.Shape(); gsh.moveTo(1.12, 1.06); gsh.quadraticCurveTo(1.5, 1.3, 1.88, 1.41); gsh.lineTo(2.78, 1.43);
  gsh.quadraticCurveTo(3.2, 1.28, 3.55, 1.08); gsh.lineTo(1.12, 1.06);
  const gg = new THREE.ExtrudeGeometry(gsh, { depth: W - .08, bevelEnabled: false, curveSegments: 12 }); gg.translate(-2.36, 0.005, -(W - .08) / 2);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x050a14, metalness: .9, roughness: .04, envMap, envMapIntensity: 2, transparent: true, opacity: .82 });
  body.add(new THREE.Mesh(gg, glass));
  // الإطارات
  const tg = new THREE.CylinderGeometry(.42, .42, .3, 28); tg.rotateX(Math.PI / 2);
  const rimG = new THREE.CylinderGeometry(.27, .27, .32, 10); rimG.rotateX(Math.PI / 2);
  const tm = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: .8 }), rmat = new THREE.MeshStandardMaterial({ color: 0x9aa3b5, metalness: 1, roughness: .25, envMap });
  const wheels = [];
  for (const [x, z] of [[-1.36, .86], [-1.36, -.86], [1.39, .86], [1.39, -.86]]) {
    const w = new THREE.Group(); w.add(new THREE.Mesh(tg, tm)); const rm = new THREE.Mesh(rimG, rmat); w.add(rm);
    w.position.set(x, .42, z); car.add(w); wheels.push(w);
  }
  // الأضواء
  const tailM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, .3, .35), toneMapped: false });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(.05, .07, 1.62), tailM); tail.position.set(-2.38, .86, 0); body.add(tail);
  const headM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3.6, 5), toneMapped: false });
  for (const z of [-.66, .66]) { const h = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .42), headM); h.position.set(2.33, .78, z); body.add(h); }
  const under = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.6), new THREE.MeshBasicMaterial({ map: glowTexture("rgba(47,212,255,.9)"), transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending }));
  under.rotation.x = -Math.PI / 2; under.position.y = .03; car.add(under);
  // كشافات
  const hl = new THREE.SpotLight(0xcfe4ff, 40, 60, .45, .6, 1.2); hl.position.set(2.2, .8, 0); hl.target.position.set(14, 0, 0); car.add(hl, hl.target);
  // الجهاز داخل السيارة (يتوهج عند الحادث)
  const dev = new THREE.Mesh(new THREE.BoxGeometry(.34, .14, .26), new THREE.MeshBasicMaterial({ color: new THREE.Color(.4, 2.2, 3), toneMapped: false }));
  dev.position.set(.6, .95, 0); body.add(dev);
  car.rotation.y = Math.PI / 2; // المقدمة باتجاه -z
  car.userData = { wheels, body, tailM, dev, under, paint };
  return car;
}

// ---------- حلقة رصد الهولوغرامية ----------
export function makeHoloRing() {
  const g = new THREE.Group();
  const add = (ri, ro, op, seg = 96) => { const m = new THREE.Mesh(new THREE.RingGeometry(ri, ro, seg), new THREE.MeshBasicMaterial({ color: new THREE.Color(.3, 1.6, 2.4), transparent: true, opacity: op, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(m); return m; };
  const r1 = add(2.0, 2.12, .9), r2 = add(2.35, 2.38, .5), r3 = add(1.75, 1.8, .4);
  const arcG = new THREE.RingGeometry(2.55, 2.68, 64, 1, 0, Math.PI * 1.2);
  const arc = new THREE.Mesh(arcG, r1.material.clone()); arc.material.opacity = .8; g.add(arc);
  const icon = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: warnTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false }));
  icon.position.z = .01; g.add(icon);
  g.userData = { r2, arc, r3 };
  return g;
}
