// Renders, for every listed part in parts.mjs, a still image (images/<name>.png) and a rotating GIF (images/<name>.gif).
// Parts are shown in their assembly orientation (logs lying along their length, gables upright).
// Software rasteriser, PNG and GIF encoders; no dependencies beyond Node.  Usage: node make_part_images.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import { makeParts } from './parts.mjs';

const OUT = 'images', W = 320, H = 240, SS = 3, RW = W * SS, RH = H * SS, FRAMES = 24;
const MATS = { log: [196, 140, 84], half: [150, 100, 58], plastic: [236, 132, 40], wood: [164, 104, 60], shingle: [92, 150, 70] };
const matFor = (name) => (name.startsWith('half') ? 'half' : name.includes('plastic') ? 'plastic' : name.includes('wood_triangle') ? 'wood' : name.startsWith('shingle') ? 'shingle' : 'log');
const BG_TOP = [232, 238, 245], BG_BOT = [196, 206, 218];

const norm3 = (v) => { const m = Math.hypot(...v); return v.map((x) => x / m); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const L1 = norm3([-0.45, -0.55, 0.75]), L2 = norm3([0.6, 0.35, 0.25]);
const zbuf = new Float32Array(RW * RH), rgb = new Uint8Array(RW * RH * 3);

function render(tris, base, cam) {
  for (let y = 0; y < RH; y++) { const t = y / (RH - 1); for (let x = 0; x < RW; x++) { const i = (y * RW + x) * 3; for (let k = 0; k < 3; k++) rgb[i + k] = BG_TOP[k] * (1 - t) + BG_BOT[k] * t; } }
  zbuf.fill(0);
  const el = (cam.el * Math.PI) / 180, az = (cam.az * Math.PI) / 180;
  const eye = [cam.target[0] + cam.dist * Math.cos(el) * Math.cos(az), cam.target[1] + cam.dist * Math.cos(el) * Math.sin(az), cam.target[2] + cam.dist * Math.sin(el)];
  const f = norm3([cam.target[0] - eye[0], cam.target[1] - eye[1], cam.target[2] - eye[2]]), r = norm3(cross(f, [0, 0, 1])), u = cross(r, f);
  const fl = RH / 2 / Math.tan((cam.fov / 2) * Math.PI / 180), cx = RW / 2, cy = RH / 2;
  const proj = (p) => { const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], z = dot(d, f); return [cx + (fl * dot(d, r)) / z, cy - (fl * dot(d, u)) / z, z]; };
  for (const v of tris) {
    const n = norm3(cross([v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]], [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]]));
    if (!n.every(Number.isFinite)) continue;
    const shade = Math.min(1, 0.3 + 0.62 * Math.max(0, dot(n, L1)) + 0.25 * Math.max(0, dot(n, L2))), k = 0.22 + shade * 0.95;
    const col = base.map((c) => Math.min(255, c * k));
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
  const out = new Uint8Array(W * H * 3), n = SS * SS;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = [0, 0, 0];
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) { const o = ((y * SS + dy) * RW + x * SS + dx) * 3; s[0] += rgb[o]; s[1] += rgb[o + 1]; s[2] += rgb[o + 2]; }
    const o = (y * W + x) * 3; out[o] = s[0] / n; out[o + 1] = s[1] / n; out[o + 2] = s[2] / n;
  }
  return out;
}

// ---------- PNG ----------
function png(pix) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(pix.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- GIF (per-part palette: material ramp + background ramp) ----------
function gifEncoder(base) {
  const pal = [];
  for (let i = 0; i < 200; i++) { const k = 0.2 + (i / 199) * 0.97; pal.push(base.map((c) => Math.min(255, Math.round(c * k)))); }
  for (let i = 0; i < 56; i++) { const t = i / 55; pal.push([0, 1, 2].map((k) => Math.round(BG_TOP[k] * (1 - t) + BG_BOT[k] * t))); }
  const lut = new Uint8Array(32768);
  for (let i = 0; i < 32768; i++) {
    const r = ((i >> 10) << 3) + 4, g = (((i >> 5) & 31) << 3) + 4, b = ((i & 31) << 3) + 4;
    let best = 0, bd = 1e9;
    for (let p = 0; p < 256; p++) { const q = pal[p], d = (q[0] - r) ** 2 + (q[1] - g) ** 2 + (q[2] - b) ** 2; if (d < bd) { bd = d; best = p; } }
    lut[i] = best;
  }
  const u16 = (n) => [n & 255, n >> 8];
  const parts = [Buffer.from([...Buffer.from('GIF89a'), ...u16(W), ...u16(H), 0xf7, 0, 0]), Buffer.from(pal.flat()), Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0])];
  const lzw = (pixels) => {
    const out = []; let cur = 0, bits = 0, size = 9, next = 258; const dict = new Map();
    const emit = (code, sz) => { cur |= code << bits; bits += sz; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
    emit(256, size);
    let prefix = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
      const k = pixels[i], key = prefix * 256 + k, v = dict.get(key);
      if (v !== undefined) { prefix = v; continue; }
      emit(prefix, size);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; } else { emit(256, size); dict.clear(); next = 258; size = 9; }
      prefix = k;
    }
    emit(prefix, size); emit(257, size); if (bits > 0) out.push(cur & 255);
    return out;
  };
  return {
    add(pix, delay) {
      const idx = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) idx[i] = lut[((pix[i * 3] >> 3) << 10) | ((pix[i * 3 + 1] >> 3) << 5) | (pix[i * 3 + 2] >> 3)];
      parts.push(Buffer.from([0x21, 0xf9, 4, 0x04, ...u16(delay), 0, 0]), Buffer.from([0x2c, 0, 0, 0, 0, ...u16(W), ...u16(H), 0, 8]));
      const data = lzw(idx);
      for (let i = 0; i < data.length; i += 255) { const c = data.slice(i, i + 255); parts.push(Buffer.from([c.length, ...c])); }
      parts.push(Buffer.from([0]));
    },
    buffer() { return Buffer.concat([...parts, Buffer.from([0x3b])]); },
  };
}

// ---------- per part ----------
fs.mkdirSync(OUT, { recursive: true });
const P = makeParts();
for (const p of Object.values(P)) {
  if (!p.info.listing) continue;
  const pts = p.model.flat();
  const lo = [0, 1, 2].map((i) => Math.min(...pts.map((v) => v[i]))), hi = [0, 1, 2].map((i) => Math.max(...pts.map((v) => v[i])));
  const c = lo.map((v, i) => (v + hi[i]) / 2), rad = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
  const tris = p.model.map((t) => t.map((v) => [v[0] - c[0], v[1] - c[1], v[2] - c[2]]));
  const fov = 30, cam = { el: 24, fov, target: [0, 0, 0], dist: (rad / Math.sin(Math.atan(Math.tan((fov / 2) * Math.PI / 180) * (W / H)))) * 1.02 };
  const base = MATS[matFor(p.name)];
  fs.writeFileSync(`${OUT}/${p.name}.png`, png(render(tris, base, { ...cam, az: -55 })));
  const g = gifEncoder(base);
  for (let i = 0; i < FRAMES; i++) g.add(render(tris, base, { ...cam, az: -55 + (360 * i) / FRAMES }), 8);
  fs.writeFileSync(`${OUT}/${p.name}.gif`, g.buffer());
  console.log(`${p.name}: png ${(fs.statSync(`${OUT}/${p.name}.png`).size / 1024).toFixed(0)} KB, gif ${(fs.statSync(`${OUT}/${p.name}.gif`).size / 1024).toFixed(0)} KB`);
}
