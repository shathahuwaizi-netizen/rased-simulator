// textures.js · كل الخامات مرسومة برمجياً على canvas (لا صور خارجية)
import * as THREE from "three";
import { ICONS } from "./content.js";

export const FONT = '"IBM Plex Sans Arabic", system-ui, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

export function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
export function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; return t;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function icon(ctx, name, x, y, size, color, lw = 1.7) {
  const p = new Path2D(ICONS[name] || ICONS.spark);
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(p); ctx.restore();
}
function wrap(ctx, text, maxW) {
  const words = text.split(" "), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function hexA(hex, a) { const c = new THREE.Color(hex); return `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`; }

// ---------- لوحة دوائر مطبوعة ----------
export function pcbTexture({ color = "#1a3fa8", label = "", sub = "", w = 512, h = 400, seed = 1, pads = true }) {
  const c = canvas(w, h), x = c.getContext("2d");
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = color; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w * .4, h * .3, 10, w * .5, h * .5, w * .8);
  g.addColorStop(0, "rgba(255,255,255,.10)"); g.addColorStop(1, "rgba(0,0,0,.25)"); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = "rgba(255,255,255,.13)"; x.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    let px = rnd() * w, py = rnd() * h; x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 3; k++) { if (rnd() > .5) px += (rnd() - .5) * 220; else py += (rnd() - .5) * 220; x.lineTo(px, py); }
    x.stroke();
  }
  for (let i = 0; i < 30; i++) { x.fillStyle = "rgba(220,200,140,.55)"; x.beginPath(); x.arc(rnd() * w, rnd() * h, 3 + rnd() * 3, 0, 7); x.fill(); }
  if (pads) {
    for (let i = 0; i < Math.floor(w / 34); i++) {
      for (const yy of [16, h - 16]) {
        x.fillStyle = "#d8b45a"; x.beginPath(); x.arc(20 + i * 34, yy, 10, 0, 7); x.fill();
        x.fillStyle = "#222"; x.beginPath(); x.arc(20 + i * 34, yy, 4.5, 0, 7); x.fill();
      }
    }
  }
  x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 3; x.strokeRect(36, 36, w - 72, h - 72);
  x.fillStyle = "rgba(255,255,255,.92)"; x.font = `700 ${Math.round(h * .12)}px ${MONO}`; x.textAlign = "left";
  if (label) x.fillText(label, 52, h - 58);
  x.font = `500 ${Math.round(h * .07)}px ${MONO}`; if (sub) x.fillText(sub, 52, h - 58 - h * .14);
  return tex(c);
}
export function chipTexture(label, bg = "#151515", fg = "#cfcfcf", w = 256, h = 256) {
  const c = canvas(w, h), x = c.getContext("2d");
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = "rgba(255,255,255,.06)"; x.beginPath(); x.arc(30, 30, 12, 0, 7); x.fill();
  x.fillStyle = fg; x.font = `700 ${h * .16}px ${MONO}`; x.textAlign = "center";
  const ls = label.split("\n"); ls.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (ls.length - 1) / 2) * h * .2 + h * .05));
  return tex(c);
}
export function shieldTexture(label) { // غطاء SIM800 / ESP32 المعدني
  const c = canvas(256, 256), x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, "#e8eaee"); g.addColorStop(.5, "#b9bec7"); g.addColorStop(1, "#d9dce2");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.fillStyle = "#d9dbe0"; x.fillRect(22, 30, 212, 120);
  x.fillStyle = "#c8102e"; x.font = `800 40px ${MONO}`; x.textAlign = "center"; x.fillText(label, 128, 82);
  x.fillStyle = "#333"; x.font = `500 18px ${MONO}`; x.fillText("IMEI 8648 0204 1176", 128, 118); x.fillText("CE 0682", 128, 190);
  for (let i = 0; i < 9; i++) { x.fillStyle = "#111"; x.fillRect(30 + i * 22, 214, 12, 12); }
  return tex(c);
}

// ---------- بطاقة معلومات ثلاثية الأبعاد ----------
export function cardTexture({ num = "", icon: ic = "spark", title = "", text = "", color = "#2fd4ff", big = "", w = 1024, h = 620, glow = false }) {
  const c = canvas(w, h), x = c.getContext("2d");
  rr(x, 8, 8, w - 16, h - 16, 44);
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "rgba(16,32,62,.97)"); g.addColorStop(1, "rgba(6,12,28,.95)");
  x.fillStyle = g; x.fill();
  x.lineWidth = glow ? 7 : 4; x.strokeStyle = hexA(color, glow ? .95 : .6); x.stroke();
  const tg = x.createLinearGradient(0, 0, w, 0); tg.addColorStop(0, hexA(color, 0)); tg.addColorStop(.5, hexA(color, .9)); tg.addColorStop(1, hexA(color, 0));
  x.fillStyle = tg; x.fillRect(80, 10, w - 160, 5);
  x.direction = "rtl"; x.textAlign = "right";
  // أيقونة + رقم (يمين)
  x.fillStyle = hexA(color, .14); x.beginPath(); x.arc(w - 120, 120, 66, 0, 7); x.fill();
  x.lineWidth = 3; x.strokeStyle = hexA(color, .7); x.stroke();
  icon(x, ic, w - 166, 74, 92, color, 1.6);
  if (num) { x.font = `300 120px ${FONT}`; x.fillStyle = hexA(color, .9); x.textAlign = "left"; x.direction = "ltr"; x.fillText(num, 60, 160); x.direction = "rtl"; x.textAlign = "right"; }
  let y = 250;
  if (big) { x.font = `700 92px ${FONT}`; x.fillStyle = color; x.direction = "ltr"; x.textAlign = "right"; x.fillText(big, w - 70, y + 20); x.direction = "rtl"; y += 110; }
  x.font = `700 ${title.length > 24 ? 60 : 72}px ${FONT}`; x.fillStyle = "#f2f8ff";
  for (const l of wrap(x, title, w - 120).slice(0, 2)) { x.fillText(l, w - 64, y); y += 82; }
  x.font = `400 46px ${FONT}`; x.fillStyle = "rgba(205,225,245,.9)"; y += 10;
  for (const l of wrap(x, text, w - 120).slice(0, 3)) { x.fillText(l, w - 64, y); y += 60; }
  return tex(c);
}

// ---------- شاشة هولوغرام للبيانات الحية (تُرسم كل إطار) ----------
export function holoCanvas(w = 640, h = 400) { const c = canvas(w, h); return { c, x: c.getContext("2d"), t: tex(c) }; }
export function drawHolo(H, { title, color, rows, series, ranges, alert }) {
  const { c, x } = H, w = c.width, h = c.height;
  x.clearRect(0, 0, w, h);
  rr(x, 4, 4, w - 8, h - 8, 26); x.fillStyle = "rgba(4,14,28,.78)"; x.fill();
  x.lineWidth = 3; x.strokeStyle = alert ? "rgba(255,64,96,.95)" : hexA(color, .75); x.stroke();
  x.direction = "rtl"; x.textAlign = "right"; x.font = `600 30px ${FONT}`; x.fillStyle = "#eef7ff"; x.fillText(title, w - 30, 50);
  x.direction = "ltr"; x.textAlign = "left"; x.font = `600 20px ${MONO}`; x.fillStyle = alert ? "#ff6b86" : hexA(color, .95);
  x.fillText(alert ? "● EVENT" : "● LIVE", 28, 46);
  // الرسم البياني
  const gx = 28, gy = 76, gw = w - 56, gh = h * .46;
  x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(gx, gy + gh * i / 4); x.lineTo(gx + gw, gy + gh * i / 4); x.stroke(); }
  (series || []).forEach((s, si) => {
    const [lo, hi] = ranges[si] || [0, 1];
    x.beginPath(); x.lineWidth = 3; x.strokeStyle = s.color; x.shadowColor = s.color; x.shadowBlur = 10;
    s.data.forEach((v, i) => { const px = gx + gw * i / (s.data.length - 1), py = gy + gh - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo) * gh; i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.stroke(); x.shadowBlur = 0;
  });
  // القيم
  const cols = rows.length, cw = gw / cols;
  rows.forEach(([lab, val, col], i) => {
    const cx = gx + gw - cw * (i + 1) + 8;
    x.font = `500 19px ${FONT}`; x.fillStyle = "rgba(190,210,230,.8)"; x.direction = "rtl"; x.textAlign = "right"; x.fillText(lab, cx + cw - 16, gy + gh + 46);
    x.font = `700 34px ${MONO}`; x.fillStyle = col || "#ffffff"; x.direction = "ltr"; x.textAlign = "right"; x.fillText(val, cx + cw - 16, gy + gh + 92);
  });
  H.t.needsUpdate = true;
}

// ---------- شاشة المراقبة التسلسلية ----------
export function drawTerminal(H, lines, shown, title = "Serial Monitor · 115200 baud") {
  const { c, x } = H, w = c.width, h = c.height;
  x.clearRect(0, 0, w, h); rr(x, 4, 4, w - 8, h - 8, 22); x.fillStyle = "rgba(3,8,14,.9)"; x.fill();
  x.lineWidth = 3; x.strokeStyle = "rgba(47,212,255,.7)"; x.stroke();
  x.fillStyle = "rgba(47,212,255,.12)"; x.fillRect(6, 6, w - 12, 50);
  x.direction = "ltr"; x.textAlign = "left"; x.font = `600 22px ${MONO}`; x.fillStyle = "#9feaff"; x.fillText("Output   " + title, 26, 40);
  x.font = `500 23px ${MONO}`;
  const n = Math.floor(shown), lh = 33, maxL = Math.floor((h - 80) / lh), st = Math.max(0, n - maxL);
  for (let i = st; i < Math.min(n + 1, lines.length); i++) {
    let l = lines[i]; if (i === n) l = l.slice(0, Math.floor((shown - n) * l.length));
    x.fillStyle = /CRASH|CONFIRMED|DETECTED|🚨|FINAL/.test(l) ? "#ff6b86" : /YES|OK|Fix/.test(l) ? "#5ff0a6" : "#cfe6f5";
    x.fillText(l, 26, 90 + (i - st) * lh);
  }
  H.t.needsUpdate = true;
}

// ---------- شاشة الهاتف (رسائل SMS الفعلية من الاختبار) ----------
export function drawPhone(H, k) {
  const { c, x } = H, w = c.width, h = c.height;
  x.fillStyle = "#000"; x.fillRect(0, 0, w, h);
  x.fillStyle = "#fff"; x.font = `600 30px ${FONT}`; x.direction = "ltr"; x.textAlign = "left"; x.fillText("7:21", 50, 60);
  x.textAlign = "right"; x.fillText("5G ▮▮▮", w - 40, 60);
  x.fillStyle = "#1c1c1e"; x.fillRect(0, 90, w, 170);
  x.fillStyle = "#8e8e93"; x.beginPath(); x.arc(w / 2, 150, 40, 0, 7); x.fill();
  x.fillStyle = "#ddd"; x.textAlign = "center"; x.font = `500 24px ${FONT}`; x.fillText("+966 56 274 1287", w / 2, 230);
  const msgs = ["24.716373,46.641467", "24.716358,46.641459", "24.716435,46.641530"];
  msgs.forEach((m, i) => {
    const a = Math.min(1, Math.max(0, k * 3 - i)); if (a <= 0) return;
    const y = 300 + i * 260 + (1 - a) * 40; x.globalAlpha = a;
    rr(x, 40, y, w - 140, 200, 30); x.fillStyle = "#2c2c2e"; x.fill();
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = `500 30px ${FONT}`; x.fillText("Accident detected!", 70, y + 50); x.fillText("Location:", 70, y + 92);
    x.fillStyle = "#3d9bff"; x.font = `500 26px ${MONO}`; x.fillText("maps.google.com/?", 70, y + 134); x.fillText("q=" + m, 70, y + 172);
    x.globalAlpha = 1;
  });
  H.t.needsUpdate = true;
}

// ---------- خريطة هولوغرام (رسم تخطيطي، ليست صورة خرائط حقيقية) ----------
export function mapTexture() {
  const w = 1024, c = canvas(w, w), x = c.getContext("2d");
  x.fillStyle = "#06121f"; x.fillRect(0, 0, w, w);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) { x.fillStyle = `rgba(60,120,170,${.08 + rnd() * .12})`; x.fillRect(rnd() * w, rnd() * w, 30 + rnd() * 90, 30 + rnd() * 90); }
  x.strokeStyle = "rgba(47,212,255,.35)"; x.lineWidth = 4;
  for (let i = 0; i < 12; i++) { const p = rnd() * w; x.beginPath(); x.moveTo(p, 0); x.lineTo(p + (rnd() - .5) * 200, w); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(w, p + (rnd() - .5) * 200); x.stroke(); }
  x.strokeStyle = "rgba(62,224,143,.85)"; x.lineWidth = 16; x.beginPath(); x.moveTo(0, w * .62); x.bezierCurveTo(w * .3, w * .55, w * .6, w * .45, w, w * .3); x.stroke();
  x.strokeStyle = "rgba(47,212,255,.9)"; x.lineWidth = 3; x.strokeRect(6, 6, w - 12, w - 12);
  return tex(c);
}

// ---------- أيقونة التحذير (شعار رصد) ----------
export function warnTexture(color = "#2fd4ff") {
  const c = canvas(512, 512), x = c.getContext("2d");
  x.shadowColor = color; x.shadowBlur = 30;
  icon(x, "car", 96, 140, 320, color, 1.3);
  x.lineWidth = 16; x.strokeStyle = color; x.lineJoin = "round";
  x.beginPath(); x.moveTo(256, 90); x.lineTo(346, 250); x.lineTo(166, 250); x.closePath(); x.stroke();
  x.lineCap = "round"; x.beginPath(); x.moveTo(256, 150); x.lineTo(256, 200); x.stroke(); x.beginPath(); x.arc(256, 228, 8, 0, 7); x.fillStyle = color; x.fill();
  return tex(c);
}
export function glowTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
  const c = canvas(128, 128), x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(.25, inner.replace(/[\d.]+\)$/, ".5)")); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}
export function avatarTexture(initials, color) {
  const c = canvas(256, 256), x = c.getContext("2d");
  const g = x.createRadialGradient(128, 110, 10, 128, 128, 128); g.addColorStop(0, hexA(color, .55)); g.addColorStop(1, "rgba(8,14,30,.95)");
  x.fillStyle = g; x.beginPath(); x.arc(128, 128, 122, 0, 7); x.fill(); x.lineWidth = 6; x.strokeStyle = color; x.stroke();
  x.fillStyle = "#fff"; x.font = `600 92px ${FONT}`; x.textAlign = "center"; x.fillText(initials, 128, 160);
  return tex(c);
}
