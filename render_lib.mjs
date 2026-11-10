// Software renderer shared by make_renders.mjs (stills of the example buildings) and make_landscape_gif.mjs.
// Deferred shading on a supersampled G-buffer: sun with a shadow map, sky/ground ambient with screen-space ambient
// occlusion, specular highlights, distance fog, soft sprites (smoke), filmic tone mapping. PNG and GIF encoders.
// No dependencies beyond Node.
import zlib from 'node:zlib';

export const norm3 = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const lin = (c) => c.map((v) => (v / 255) ** 2.2);          // sRGB 0..255 -> linear 0..1
export const mix = (a, b, t) => a + (b - a) * t;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- value noise ----------
export const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
  return mix(mix(hash2(xi, yi), hash2(xi + 1, yi), u), mix(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), w);
}
export function fbm(x, y, oct = 5) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise2(x, y); n += a; a *= 0.5; const t = x * 1.6 + y * 1.2; y = (y * 1.6 - x * 1.2) + 7.3; x = t + 3.1; }
  return s / n;
}

// triangles ([[x,y,z] x3] ...) -> flat Float32Array, optionally transformed
export function pack(tris, f) {
  const out = new Float32Array(tris.length * 9);
  let o = 0;
  for (const t of tris) for (const p of t) { const q = f ? f(p) : p; out[o++] = q[0]; out[o++] = q[1]; out[o++] = q[2]; }
  return out;
}

// ---------- the buildings of assembly.mjs as render items ----------
// colours (sRGB). Each building picks a roof palette.
const WOOD = [132, 76, 40];
export const PALETTES = {
  classic: { gable: [206, 98, 28], shingle: [44, 104, 54], chimney: [214, 172, 36] },
  red: { gable: [120, 70, 38], shingle: [140, 40, 32], chimney: [112, 104, 98] },
  forest: { gable: [120, 70, 38], shingle: [40, 86, 56], chimney: [150, 60, 44] },
};
// one render item per placed part; logs vary a little in tone, like stained wood from different boards
export function itemsFor(parts, pal, shift = [0, 0, 0], seed = 0) {
  return parts.map((it, i) => {
    const n = it.name, plastic = n.includes('plastic');
    let color, spec = 0.05, gloss = 20;
    if (n === 'chimney') { color = pal.chimney; spec = 0.12; gloss = 40; }
    else if (n.startsWith('shingle')) { const k = 0.93 + 0.14 * hash2(i, seed + 7); color = pal.shingle.map((c) => c * k); spec = 0.1; gloss = 30; }
    else if (n.startsWith('gable')) { color = pal.gable; if (plastic) { spec = 0.15; gloss = 50; } }
    else { const k = 0.88 + 0.24 * hash2(i, seed + 1), w = 0.97 + 0.06 * hash2(i, seed + 2); color = [WOOD[0] * k * w, WOOD[1] * k, WOOD[2] * k / w]; spec = 0.07; gloss = 18; }
    return { pos: pack(it.tris, ([x, y, z]) => [x + shift[0], y + shift[1], z + shift[2]]), mat: { color, spec, gloss } };
  });
}

// camera from azimuth / elevation (degrees) and distance around a target
export function orbit({ az, el, dist, target, fov = 30 }) {
  const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180;
  return { eye: [target[0] + dist * Math.cos(e) * Math.cos(a), target[1] + dist * Math.cos(e) * Math.sin(a), target[2] + dist * Math.sin(e)], target, fov };
}

// items: [{ pos: Float32Array (pack), mat: { color: [r,g,b] sRGB | shader(p, n, out), spec, gloss, shadow: false to not cast } }]
// opts:  W, H, SS, cam {eye, target, fov}, sun {dir, color}, ambient {sky, ground} (linear), sky(dir) -> linear rgb,
//        fog(dist, p) -> 0..1, shadow {center, radius, res, soft}, ao {radius, strength}, exposure, sprites [{p, r, a, color}]
// returns Uint8Array W*H*3 (sRGB)
export function render(items, opts) {
  const { W, H, SS = 2, cam, sun, ambient, sky, fog = null, shadow, ao = { radius: 8, strength: 1 }, exposure = 1, sprites = [] } = opts;
  const RW = W * SS, RH = H * SS, N = RW * RH;
  const zb = new Float32Array(N), gn = new Float32Array(N * 3), gid = new Int16Array(N).fill(-1);
  const f = norm3([cam.target[0] - cam.eye[0], cam.target[1] - cam.eye[1], cam.target[2] - cam.eye[2]]), r = norm3(cross(f, [0, 0, 1])), u = cross(r, f);
  const fl = RH / 2 / Math.tan(((cam.fov / 2) * Math.PI) / 180), cx = RW / 2, cy = RH / 2, [ex, ey, ez] = cam.eye, NEAR = 2;

  // ---- G-buffer ----
  items.forEach((it, id) => {
    const P = it.pos;
    for (let i = 0; i < P.length; i += 9) {
      const ax = P[i] - ex, ay = P[i + 1] - ey, az = P[i + 2] - ez, bx = P[i + 3] - ex, by = P[i + 4] - ey, bz = P[i + 5] - ez, cx_ = P[i + 6] - ex, cy_ = P[i + 7] - ey, cz = P[i + 8] - ez;
      const za = ax * f[0] + ay * f[1] + az * f[2], zb_ = bx * f[0] + by * f[1] + bz * f[2], zc = cx_ * f[0] + cy_ * f[1] + cz * f[2];
      if (za < NEAR || zb_ < NEAR || zc < NEAR) continue;
      const xa = cx + (fl * (ax * r[0] + ay * r[1] + az * r[2])) / za, ya = cy - (fl * (ax * u[0] + ay * u[1] + az * u[2])) / za;
      const xb = cx + (fl * (bx * r[0] + by * r[1] + bz * r[2])) / zb_, yb = cy - (fl * (bx * u[0] + by * u[1] + bz * u[2])) / zb_;
      const xc = cx + (fl * (cx_ * r[0] + cy_ * r[1] + cz * r[2])) / zc, yc = cy - (fl * (cx_ * u[0] + cy_ * u[1] + cz * u[2])) / zc;
      const area = (xb - xa) * (yc - ya) - (yb - ya) * (xc - xa);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(xa, xb, xc) - 0.5)), x1 = Math.min(RW - 1, Math.floor(Math.max(xa, xb, xc) - 0.5));
      const y0 = Math.max(0, Math.ceil(Math.min(ya, yb, yc) - 0.5)), y1 = Math.min(RH - 1, Math.floor(Math.max(ya, yb, yc) - 0.5));
      if (x0 > x1 || y0 > y1) continue;
      // face normal (world), flipped to face the camera
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy_ - ay), ny = (bz - az) * (cx_ - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy_ - ay) - (by - ay) * (cx_ - ax);
      const nl = Math.hypot(nx, ny, nz);
      if (!(nl > 0)) continue;
      const s = (nx * ax + ny * ay + nz * az > 0 ? -1 : 1) / nl; nx *= s; ny *= s; nz *= s;
      const ia = 1 / za, ib = 1 / zb_, ic = 1 / zc, inv = 1 / area;
      for (let y = y0; y <= y1; y++) {
        const py = y + 0.5;
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const w0 = ((xb - px) * (yc - py) - (yb - py) * (xc - px)) * inv, w1 = ((xc - px) * (ya - py) - (yc - py) * (xa - px)) * inv, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const d = w0 * ia + w1 * ib + w2 * ic, idx = y * RW + x;
          if (d > zb[idx]) { zb[idx] = d; gid[idx] = id; const o = idx * 3; gn[o] = nx; gn[o + 1] = ny; gn[o + 2] = nz; }
        }
      }
    }
  });

  // ---- shadow map (orthographic, looking down the sun direction) ----
  const L = norm3(sun.dir), sa = norm3(cross(L, Math.abs(L[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), sb = cross(L, sa);
  const SR = shadow.res ?? 4096, sm = new Float32Array(SR * SR).fill(-1e30), sScale = SR / (2 * shadow.radius);
  const sc = shadow.center, sca = dot(sc, sa), scb = dot(sc, sb);
  for (const it of items) {
    if (it.mat.shadow === false) continue;
    const P = it.pos;
    for (let i = 0; i < P.length; i += 9) {
      const X = [0, 0, 0], Y = [0, 0, 0], Z = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        const px = P[i + 3 * k], py = P[i + 3 * k + 1], pz = P[i + 3 * k + 2];
        X[k] = (px * sa[0] + py * sa[1] + pz * sa[2] - sca) * sScale + SR / 2; Y[k] = (px * sb[0] + py * sb[1] + pz * sb[2] - scb) * sScale + SR / 2; Z[k] = px * L[0] + py * L[1] + pz * L[2];
      }
      const area = (X[1] - X[0]) * (Y[2] - Y[0]) - (Y[1] - Y[0]) * (X[2] - X[0]);
      if (Math.abs(area) < 1e-12) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(X[0], X[1], X[2]) - 0.5)), x1 = Math.min(SR - 1, Math.floor(Math.max(X[0], X[1], X[2]) - 0.5));
      const y0 = Math.max(0, Math.ceil(Math.min(Y[0], Y[1], Y[2]) - 0.5)), y1 = Math.min(SR - 1, Math.floor(Math.max(Y[0], Y[1], Y[2]) - 0.5));
      const inv = 1 / area;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((X[1] - px) * (Y[2] - py) - (Y[1] - py) * (X[2] - px)) * inv, w1 = ((X[2] - px) * (Y[0] - py) - (Y[2] - py) * (X[0] - px)) * inv, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * Z[0] + w1 * Z[1] + w2 * Z[2], idx = y * SR + x;
        if (d > sm[idx]) sm[idx] = d;
      }
    }
  }
  const soft = shadow.soft ?? 1.5, bias = shadow.bias ?? 0.35, texel = 1 / sScale;
  const lit = (px, py, pz, ndl) => {
    const sx = (px * sa[0] + py * sa[1] + pz * sa[2] - sca) * sScale + SR / 2, sy = (px * sb[0] + py * sb[1] + pz * sb[2] - scb) * sScale + SR / 2;
    if (sx < 4 || sy < 4 || sx > SR - 5 || sy > SR - 5) return 1;
    const d = px * L[0] + py * L[1] + pz * L[2] + bias + texel * soft * 1.5 * Math.min(4, Math.sqrt(1 - ndl * ndl) / Math.max(0.1, ndl));
    let s = 0;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (sm[Math.floor(sy + j * soft) * SR + Math.floor(sx + i * soft)] <= d) s++;
    return s / 25;
  };

  // ---- ambient occlusion (screen space, from the depth buffer) ----
  const aoBuf = new Float32Array(N).fill(1);
  const posAt = (idx, out) => { const z = 1 / zb[idx], sx = ((idx % RW) + 0.5 - cx) / fl, sy = -(Math.floor(idx / RW) + 0.5 - cy) / fl; out[0] = ex + (f[0] + r[0] * sx + u[0] * sy) * z; out[1] = ey + (f[1] + r[1] * sx + u[1] * sy) * z; out[2] = ez + (f[2] + r[2] * sx + u[2] * sy) * z; };
  if (ao.strength > 0) {
    const TAPS = 12, p = [0, 0, 0], q = [0, 0, 0], R2 = ao.radius * ao.radius;
    for (let idx = 0; idx < N; idx++) {
      if (!zb[idx]) continue;
      posAt(idx, p);
      const o = idx * 3, nx = gn[o], ny = gn[o + 1], nz = gn[o + 2], x = idx % RW, y = (idx / RW) | 0;
      const rad = Math.min(48 * SS, Math.max(2, ao.radius * fl * zb[idx])), rot = hash2(x, y) * 6.2832;
      let occ = 0;
      for (let t = 0; t < TAPS; t++) {
        const rr = rad * Math.sqrt((t + 0.5) / TAPS), an = rot + t * 2.39996;
        const sx = Math.round(x + rr * Math.cos(an)), sy = Math.round(y + rr * Math.sin(an));
        if (sx < 0 || sy < 0 || sx >= RW || sy >= RH) continue;
        const j = sy * RW + sx;
        if (!zb[j]) continue;
        posAt(j, q);
        const vx = q[0] - p[0], vy = q[1] - p[1], vz = q[2] - p[2], d2 = vx * vx + vy * vy + vz * vz;
        if (d2 > R2 * 4 || d2 < 1e-9) continue;
        occ += Math.max(0, (vx * nx + vy * ny + vz * nz) / Math.sqrt(d2) - 0.08) / (1 + d2 / R2);
      }
      aoBuf[idx] = Math.max(0, 1 - (ao.strength * 2.2 * occ) / TAPS);
    }
    // 5x5 box blur (two passes) to hide the per-pixel rotation
    const tmp = new Float32Array(N);
    for (const [src, dst, step] of [[aoBuf, tmp, 1], [tmp, aoBuf, RW]]) for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const idx = y * RW + x; let s = 0, n = 0;
      for (let k = -2; k <= 2; k++) { const xx = step === 1 ? x + k : x, yy = step === 1 ? y : y + k; if (xx < 0 || yy < 0 || xx >= RW || yy >= RH) continue; const j = yy * RW + xx; if (!zb[j] !== !zb[idx]) continue; s += src[j]; n++; }
      dst[idx] = n ? s / n : 1;
    }
  }

  // ---- shading ----
  const hdr = new Float32Array(N * 3), p = [0, 0, 0], n = [0, 0, 0], alb = [0, 0, 0], dir = [0, 0, 0];
  const albedo = items.map((it) => (it.mat.color ? lin(it.mat.color) : null));
  for (let idx = 0; idx < N; idx++) {
    const o = idx * 3, sx = ((idx % RW) + 0.5 - cx) / fl, sy = -(Math.floor(idx / RW) + 0.5 - cy) / fl;
    dir[0] = f[0] + r[0] * sx + u[0] * sy; dir[1] = f[1] + r[1] * sx + u[1] * sy; dir[2] = f[2] + r[2] * sx + u[2] * sy;
    const dl = Math.hypot(dir[0], dir[1], dir[2]); dir[0] /= dl; dir[1] /= dl; dir[2] /= dl;
    if (!zb[idx]) { const c = sky(dir); hdr[o] = c[0]; hdr[o + 1] = c[1]; hdr[o + 2] = c[2]; continue; }
    const dist = dl / zb[idx];
    p[0] = ex + dir[0] * dist; p[1] = ey + dir[1] * dist; p[2] = ez + dir[2] * dist;
    n[0] = gn[o]; n[1] = gn[o + 1]; n[2] = gn[o + 2];
    const mat = items[gid[idx]].mat, m = { spec: mat.spec ?? 0.04, gloss: mat.gloss ?? 24, emit: null };
    if (mat.shader) mat.shader(p, n, alb, m, dir); else { const a = albedo[gid[idx]]; alb[0] = a[0]; alb[1] = a[1]; alb[2] = a[2]; }
    const ndl = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const sh = ndl > 0 ? lit(p[0], p[1], p[2], ndl) : 0, A = aoBuf[idx], up = n[2] * 0.5 + 0.5;
    // specular (Blinn-Phong)
    let hx = L[0] - dir[0], hy = L[1] - dir[1], hz = L[2] - dir[2]; const hl = Math.hypot(hx, hy, hz) || 1;
    const sp = m.spec * Math.pow(Math.max(0, (n[0] * hx + n[1] * hy + n[2] * hz) / hl), m.gloss) * sh * (ndl > 0 ? 1 : 0);
    const fg = fog ? fog(dist, p) : 0;
    for (let k = 0; k < 3; k++) {
      const amb = mix(ambient.ground[k], ambient.sky[k], up) * A * (0.55 + 0.45 * A);
      let c = alb[k] * (sun.color[k] * ndl * sh * (0.75 + 0.25 * A) + amb) + sun.color[k] * sp;
      if (m.emit) c = m.emit[k];
      hdr[o + k] = c;
    }
    if (fg > 0) { const c = sky(norm3([dir[0], dir[1], Math.max(0.02, Math.abs(dir[2]) * 0.3)])); for (let k = 0; k < 3; k++) hdr[o + k] = mix(hdr[o + k], c[k], fg); }
  }

  // ---- soft sprites (smoke), depth-tested, drawn back to front ----
  const sp = sprites.map((s) => { const d = [s.p[0] - ex, s.p[1] - ey, s.p[2] - ez], z = dot(d, f); return { ...s, z, x: cx + (fl * dot(d, r)) / z, y: cy - (fl * dot(d, u)) / z, pr: (s.r * fl) / z }; }).filter((s) => s.z > NEAR).sort((a, b) => b.z - a.z);
  for (const s of sp) {
    const x0 = Math.max(0, Math.floor(s.x - s.pr)), x1 = Math.min(RW - 1, Math.ceil(s.x + s.pr)), y0 = Math.max(0, Math.floor(s.y - s.pr)), y1 = Math.min(RH - 1, Math.ceil(s.y + s.pr));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const idx = y * RW + x;
      if (zb[idx] && 1 / zb[idx] < s.z) continue;
      const d2 = ((x - s.x) ** 2 + (y - s.y) ** 2) / (s.pr * s.pr);
      if (d2 >= 1) continue;
      const a = s.a * (1 - d2) * (1 - d2), o = idx * 3;
      for (let k = 0; k < 3; k++) hdr[o + k] = mix(hdr[o + k], s.color[k], a);
    }
  }

  // ---- tone map (ACES fit), box downsample, gamma ----
  const out = new Uint8Array(W * H * 3), tm = (x) => { x *= exposure; return clamp01((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s0 = 0, s1 = 0, s2 = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) { const o = ((y * SS + dy) * RW + x * SS + dx) * 3; s0 += tm(hdr[o]); s1 += tm(hdr[o + 1]); s2 += tm(hdr[o + 2]); }
    const o = (y * W + x) * 3, k = 1 / (SS * SS);
    out[o] = Math.round(255 * (s0 * k) ** (1 / 2.2)); out[o + 1] = Math.round(255 * (s1 * k) ** (1 / 2.2)); out[o + 2] = Math.round(255 * (s2 * k) ** (1 / 2.2));
  }
  return out;
}

// ---------- PNG (8-bit RGB) ----------
export function png(pix, W, H) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) Buffer.from(pix.buffer, pix.byteOffset + y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- GIF (one 256-colour palette for all frames, median cut, ordered dither) ----------
export function gif(frames, W, H, delay) {
  // palette: median cut over a 15-bit histogram of every frame
  const hist = new Map();
  for (const fr of frames) for (let i = 0; i < fr.length; i += 3) { const k = ((fr[i] >> 3) << 10) | ((fr[i + 1] >> 3) << 5) | (fr[i + 2] >> 3); hist.set(k, (hist.get(k) ?? 0) + 1); }
  const cols = [...hist].map(([k, n]) => ({ c: [((k >> 10) << 3) + 4, (((k >> 5) & 31) << 3) + 4, ((k & 31) << 3) + 4], n }));
  let boxes = [cols];
  const range = (b) => [0, 1, 2].map((i) => { let lo = 255, hi = 0; for (const e of b) { lo = Math.min(lo, e.c[i]); hi = Math.max(hi, e.c[i]); } return hi - lo; });
  while (boxes.length < 256) {
    let bi = -1, best = 0;
    boxes.forEach((b, i) => { if (b.length < 2) return; const s = Math.max(...range(b)) * Math.sqrt(b.reduce((a, e) => a + e.n, 0)); if (s > best) { best = s; bi = i; } });
    if (bi < 0) break;
    const b = boxes[bi], rg = range(b), ax = rg.indexOf(Math.max(...rg));
    b.sort((p, q) => p.c[ax] - q.c[ax]);
    const total = b.reduce((a, e) => a + e.n, 0); let acc = 0, cut = 1;
    for (let i = 0; i < b.length - 1; i++) { acc += b[i].n; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
  }
  const pal = boxes.map((b) => { const t = b.reduce((a, e) => a + e.n, 0); return [0, 1, 2].map((i) => Math.round(b.reduce((a, e) => a + e.c[i] * e.n, 0) / t)); });
  while (pal.length < 256) pal.push([0, 0, 0]);
  const cache = new Int16Array(32768).fill(-1);
  const nearest = (r, g, b) => {
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    if (cache[k] >= 0) return cache[k];
    let bi = 0, bd = 1e9;
    for (let i = 0; i < 256; i++) { const q = pal[i], d = (q[0] - r) ** 2 * 0.9 + (q[1] - g) ** 2 * 1.2 + (q[2] - b) ** 2 * 0.7; if (d < bd) { bd = d; bi = i; } }
    return (cache[k] = bi);
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const lzw = (pixels) => {
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
  };
  const u16 = (v) => [v & 255, v >> 8], cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const parts = [Buffer.from([...Buffer.from('GIF89a'), ...u16(W), ...u16(H), 0xf7, 0, 0]), Buffer.from(pal.flat()), Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0])];
  for (const fr of frames) {
    const px = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 3, d = (BAYER[(y & 3) * 4 + (x & 3)] - 7.5) * 0.55; px[y * W + x] = nearest(cl(fr[o] + d), cl(fr[o + 1] + d), cl(fr[o + 2] + d)); }
    parts.push(Buffer.from([0x21, 0xf9, 4, 0x04, ...u16(delay), 0, 0]), Buffer.from([0x2c, 0, 0, 0, 0, ...u16(W), ...u16(H), 0, 8]));
    const data = lzw(px);
    for (let i = 0; i < data.length; i += 255) { const c = data.slice(i, i + 255); parts.push(Buffer.from([c.length, ...c])); }
    parts.push(Buffer.from([0]));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}
