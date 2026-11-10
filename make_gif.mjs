// Renders cabin_build.gif: the listed parts, then the verified cabin built course by course, then the shed.
// Uses the same geometry as the STLs (parts.mjs) and the same layout that verify.mjs checks (assembly.mjs).
// Software rasteriser + GIF encoder, no dependencies.  Usage: node make_gif.mjs [out.gif]
// Debug one frame: ONLY=60 node make_gif.mjs frame.gif
import fs from 'node:fs';
import { makeParts } from './parts.mjs';
import { buildings } from './assembly.mjs';

const OUT = process.argv[2] ?? 'cabin_build.gif';
const W = 400, H = 300, SS = 2, RW = W * SS, RH = H * SS;
const P = makeParts();
const { cabin, shed, cottage } = buildings(P);

// ---------- palette ----------
const MATS = { log: [196, 140, 84], half: [150, 100, 58], plastic: [236, 132, 40], wood: [164, 104, 60], shingle: [92, 150, 70], chimney: [240, 204, 40], ground: [118, 128, 112] };
const MAT_ORDER = Object.keys(MATS), RAMP = 30, palette = [];
for (const m of MAT_ORDER) for (let i = 0; i < RAMP; i++) { const f = 0.22 + (i / (RAMP - 1)) * 0.95; palette.push(MATS[m].map((c) => Math.min(255, Math.round(c * f)))); }
const BG_N = 28, BG0 = palette.length;
for (let i = 0; i < BG_N; i++) { const t = i / (BG_N - 1); palette.push([0, 1, 2].map((k) => Math.round([222, 232, 242][k] * (1 - t) + [168, 186, 206][k] * t))); }
const IDX_WHITE = palette.length; palette.push([255, 255, 255]);
const IDX_BAR = palette.length; palette.push([40, 34, 30]);
while (palette.length < 256) palette.push([0, 0, 0]);
const LUT = new Uint8Array(32768);
for (let i = 0; i < 32768; i++) {
  const r = ((i >> 10) << 3) + 4, g = (((i >> 5) & 31) << 3) + 4, b = ((i & 31) << 3) + 4;
  let best = 0, bd = 1e9;
  for (let p = 0; p < 255; p++) { const q = palette[p]; const d = (q[0] - r) ** 2 + (q[1] - g) ** 2 + (q[2] - b) ** 2; if (d < bd) { bd = d; best = p; } }
  LUT[i] = best;
}
const matFor = (name) => (name === 'chimney' ? 'chimney' : name.startsWith('half') ? 'half' : name.includes('plastic') ? 'plastic' : name.includes('wood_triangle') ? 'wood' : name.startsWith('shingle') ? 'shingle' : 'log');

// ---------- scenes ----------
const mapT = (tris, f) => tris.map((t) => t.map(f));
const item = (tris, mat, dz = 0) => ({ tris, mat, dz });
// showcase: every listed part as printed, laid out in rows
const showItems = [];
{
  let x = 0, y = 0, rowH = 0;
  for (const p of Object.values(P)) {
    if (!p.info.listing) continue;
    const xs = p.print.flat().map((v) => v[0]), ys = p.print.flat().map((v) => v[1]);
    const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...ys) - Math.min(...ys);
    if (x + w > 600) { x = 0; y += rowH + 14; rowH = 0; }
    const dx = x - Math.min(...xs), dy = y - Math.min(...ys);
    showItems.push(item(mapT(p.print, ([a, b, c]) => [a + dx, b + dy, c]), matFor(p.name)));
    x += w + 14; rowH = Math.max(rowH, d);
  }
}
const SHED_DX = 290, COTTAGE_DX = 470; // shed and cottage placed beside the cabin
const groups = [];
for (const it of cabin) {
  const g = groups[groups.length - 1];
  const entry = item(it.tris, matFor(it.name));
  if (g && g.cap === it.caption) g.items.push(entry); else groups.push({ cap: it.caption, items: [entry] });
}
groups.push({ cap: 'SHED: WOODEN TRIANGLE GABLES', items: shed.map((it) => item(mapT(it.tris, ([x, y, z]) => [x + SHED_DX, y, z]), matFor(it.name))) });
groups.push({ cap: 'COTTAGE: SMALL GABLES, CHIMNEY', items: cottage.map((it) => item(mapT(it.tris, ([x, y, z]) => [x + COTTAGE_DX, y, z]), matFor(it.name))) });

// ---------- renderer ----------
const zbuf = new Float32Array(RW * RH), rgb = new Uint8Array(RW * RH * 3);
const norm3 = (v) => { const m = Math.hypot(...v); return v.map((x) => x / m); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const L1 = norm3([-0.45, -0.55, 0.75]), L2 = norm3([0.6, 0.35, 0.25]);
function render(cam, drawItems) {
  for (let y = 0; y < RH; y++) { const p = palette[BG0 + Math.round((y / (RH - 1)) * (BG_N - 1))]; for (let x = 0; x < RW; x++) { const i = (y * RW + x) * 3; rgb[i] = p[0]; rgb[i + 1] = p[1]; rgb[i + 2] = p[2]; } }
  zbuf.fill(0);
  const el = (cam.el * Math.PI) / 180, az = (cam.az * Math.PI) / 180;
  const eye = [cam.target[0] + cam.dist * Math.cos(el) * Math.cos(az), cam.target[1] + cam.dist * Math.cos(el) * Math.sin(az), cam.target[2] + cam.dist * Math.sin(el)];
  const f = norm3([cam.target[0] - eye[0], cam.target[1] - eye[1], cam.target[2] - eye[2]]), r = norm3(cross(f, [0, 0, 1])), u = cross(r, f);
  const fl = RH / 2 / Math.tan((17.5 * Math.PI) / 180), cx = RW / 2, cy = RH / 2;
  const proj = (p) => { const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], z = dot(d, f); return [cx + (fl * dot(d, r)) / z, cy - (fl * dot(d, u)) / z, z]; };
  for (const { tris, mat, dz = 0 } of drawItems) {
    const base = MATS[mat];
    for (const tri of tris) {
      const v = dz ? tri.map((p) => [p[0], p[1], p[2] + dz]) : tri;
      const n = norm3(cross([v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]], [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]]));
      const shade = Math.min(1, 0.3 + 0.62 * Math.max(0, dot(n, L1)) + 0.25 * Math.max(0, dot(n, L2))), k = 0.22 + shade * 0.95;
      const col = [Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k)];
      const a = proj(v[0]), b = proj(v[1]), c = proj(v[2]);
      if (a[2] < 1 || b[2] < 1 || c[2] < 1) continue;
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(RW - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(RH - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      const iz = [1 / a[2], 1 / b[2], 1 / c[2]];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area, w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * iz[0] + w1 * iz[1] + w2 * iz[2], idx = y * RW + x;
        if (d > zbuf[idx]) { zbuf[idx] = d; const o = idx * 3; rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2]; }
      }
    }
  }
}
const ground = (cx, cy, half) => {
  const tris = [], n = 30, s = (2 * half) / n, z = -0.05;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const [xa, xb, ya, yb] = [cx - half + i * s, cx - half + (i + 1) * s, cy - half + j * s, cy - half + (j + 1) * s];
    tris.push([[xa, ya, z], [xb, ya, z], [xb, yb, z]], [[xa, ya, z], [xb, yb, z], [xa, yb, z]]);
  }
  return item(tris, 'ground');
};

// ---------- text ----------
const FONT = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000', G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111', M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 11001 10101 10011 10001 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001', Y: '10001 10001 01010 00100 00100 00100 00100',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00010 00100 01000 11111', 3: '11110 00001 00001 01110 00001 00001 11110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110', 6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100', '/': '00001 00001 00010 00100 01000 10000 10000', ':': '00000 00100 00100 00000 00100 00100 00000',
  ' ': '00000 00000 00000 00000 00000 00000 00000', '-': '00000 00000 00000 11111 00000 00000 00000', ',': '00000 00000 00000 00000 00110 00100 01000',
};
function drawText(px, text, x, y, s) {
  const w = text.length * 6 * s + 8 * s;
  for (let yy = y - 3 * s; yy < y + 10 * s; yy++) for (let xx = x - 4 * s; xx < x - 4 * s + w; xx++) if (xx >= 0 && xx < W && yy >= 0 && yy < H) px[yy * W + xx] = IDX_BAR;
  [...text].forEach((ch, i) => (FONT[ch] ?? FONT[' ']).split(' ').forEach((row, ry) => [...row].forEach((bit, rx) => {
    if (bit !== '1') return;
    for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) { const xx = x + (i * 6 + rx) * s + a, yy = y + ry * s + b; if (xx < W && yy < H) px[yy * W + xx] = IDX_WHITE; }
  })));
}

// ---------- GIF ----------
function lzw(pixels) {
  const out = []; let cur = 0, bits = 0;
  const emit = (code, size) => { cur |= code << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
  let size = 9, next = 258; const dict = new Map();
  emit(256, size);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i], key = prefix * 256 + k, v = dict.get(key);
    if (v !== undefined) { prefix = v; continue; }
    emit(prefix, size);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; } else { emit(256, size); dict.clear(); next = 258; size = 9; }
    prefix = k;
  }
  emit(prefix, size); emit(257, size);
  if (bits > 0) out.push(cur & 255);
  return out;
}
const u16 = (n) => [n & 255, n >> 8];
const gif = [Buffer.from([...Buffer.from('GIF89a'), ...u16(W), ...u16(H), 0xf7, 0, 0]), Buffer.from(palette.flat()), Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0])];
function addFrame(px, delay) {
  gif.push(Buffer.from([0x21, 0xf9, 4, 0x04, ...u16(delay), 0, 0]), Buffer.from([0x2c, 0, 0, 0, 0, ...u16(W), ...u16(H), 0, 8]));
  const data = lzw(px);
  for (let i = 0; i < data.length; i += 255) { const c = data.slice(i, i + 255); gif.push(Buffer.from([c.length, ...c])); }
  gif.push(Buffer.from([0]));
}

// ---------- timeline ----------
const frames = [], FALL = [40, 20, 0, 0];
for (let i = 0; i < 18; i++) frames.push({ scene: 'show', items: showItems, cap: 'EVERY LISTED PART, AS PRINTED', delay: 9 });
const placed = [];
for (const g of groups) {
  const scene = /^(SHED|COTTAGE)/.test(g.cap) ? 'both' : 'cabin';
  for (const dz of FALL) frames.push({ scene, items: [...placed, ...g.items.map((it) => ({ ...it, dz }))], cap: g.cap, delay: 8 });
  placed.push(...g.items);
}
for (let i = 0; i < 36; i++) frames.push({ scene: 'both', items: placed, cap: 'VERIFIED: FITS AND STANDS', delay: i === 35 ? 250 : 8 });

const N = frames.length, dAz = 2.0, az0 = 300 - dAz * (N - 1);
const ONLY = process.env.ONLY === undefined ? null : +process.env.ONLY;
const grounds = { show: ground(300, 160, 1600), cabin: ground(76, 114, 1600), both: ground(275, 114, 2000) };
const cams = { show: { el: 38, dist: 1050, target: [300, 150, 0] }, cabin: { el: 26, dist: 600, target: [76, 114, 50] }, both: { el: 24, dist: 1080, target: [275, 114, 45] } };
console.log(`${N} frames`);
frames.forEach((fr, i) => {
  if (ONLY !== null && i !== ONLY) return;
  render({ ...cams[fr.scene], az: az0 + i * dAz }, [grounds[fr.scene], ...fr.items]);
  const px = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) { const o = ((y * SS + dy) * RW + x * SS + dx) * 3; r += rgb[o]; g += rgb[o + 1]; b += rgb[o + 2]; }
    const n = SS * SS;
    px[y * W + x] = LUT[(((r / n) >> 3) << 10) | (((g / n) >> 3) << 5) | ((b / n) >> 3)];
  }
  drawText(px, fr.cap, 12, H - 24, 2);
  addFrame(px, fr.delay);
});
gif.push(Buffer.from([0x3b]));
fs.writeFileSync(OUT, Buffer.concat(gif));
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)`);
