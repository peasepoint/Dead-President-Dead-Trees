// Renders images/examples/cabin_landscape.gif: the porch cabin (wood-grain logs) in a mountain meadow, with pines,
// a lake, drifting clouds and chimney smoke. The cabin is the exact part geometry; everything around it is
// procedural (height field, shaders, cone-tier pines). The camera sways and the loop is seamless.
// Usage: node make_landscape_gif.mjs          the GIF, plus a full-size still (cabin_landscape.png)
//        FRAME=10 node make_landscape_gif.mjs one frame as a PNG preview (frame_10.png in the same folder)
import fs from 'node:fs';
import { makeParts } from './parts.mjs';
import { buildings } from './assembly.mjs';
import { itemsFor, PALETTES, render, png, gif, pack, orbit, lin, norm3, hash2, noise2, fbm, smoothstep, mix, clamp01 } from './render_lib.mjs';

const OUT = 'images/examples', W = 560, H = 350, FRAMES = 48, DELAY = 8;
const C = [76.2, 114.3];                      // centre of the cabin
const LAKE = [520, 1750], LAKE_R = 1150, WL = -42; // lake behind the cabin, water level
const SUN = norm3([-0.62, -0.5, 0.4]);

// ---------- terrain ----------
const lakeD = (x, y) => (Math.hypot(x - LAKE[0], y - LAKE[1]) / LAKE_R) * (1 + 0.5 * (fbm(x / 800 + 3, y / 800 + 1, 3) - 0.5));
function height(x, y) {
  const d = Math.hypot(x - C[0], y - C[1]);
  let z = (fbm(x / 1500 + 5, y / 1500 + 9, 5) - 0.5) * 620 * smoothstep(240, 3200, d) + (fbm(x / 240, y / 240, 4) - 0.5) * 46;
  const ridge = 1 - Math.abs(2 * fbm(x / 9000 + 2.3, y / 9000 + 4.1, 6) - 1);
  z += smoothstep(6000, 17000, d) * (ridge * ridge * 3600 + 300);
  z = mix(-170, z, smoothstep(0.62, 1.3, lakeD(x, y)));
  return z * smoothstep(230, 640, d);
}
function terrainMesh() {
  const SEG = 320, radii = [0];
  for (let r = 14; r < 46000; r *= 1.045) radii.push(r);
  const pt = (i, j) => { const a = (j / SEG) * 2 * Math.PI, x = C[0] + radii[i] * Math.cos(a), y = C[1] + radii[i] * Math.sin(a); return [x, y, height(x, y)]; };
  const tris = [];
  for (let i = 0; i < radii.length - 1; i++) for (let j = 0; j < SEG; j++) {
    const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
    if (i) tris.push([a, b, c], [a, c, d]); else tris.push([a, b, c]);
  }
  return tris;
}
const GRASS_A = lin([62, 98, 42]), GRASS_B = lin([92, 118, 52]), GRASS_DRY = lin([138, 136, 76]), DIRT = lin([118, 92, 62]), ROCK = lin([118, 114, 110]), ROCK_D = lin([78, 76, 78]);
const SNOW = lin([240, 244, 250]), FOREST = lin([34, 62, 38]), SAND = lin([170, 156, 118]);
const setMix = (out, a, b, t) => { out[0] = mix(a[0], b[0], t); out[1] = mix(a[1], b[1], t); out[2] = mix(a[2], b[2], t); };
const blend = (out, c, t) => { out[0] = mix(out[0], c[0], t); out[1] = mix(out[1], c[1], t); out[2] = mix(out[2], c[2], t); };
const pathX = (y) => C[0] + 70 * Math.sin((y + 20) / 260);
function terrainShader(p, n, out, m) {
  const x = p[0], y = p[1], d = Math.hypot(x - C[0], y - C[1]), e = 1.5 + d * 0.004;
  // normal from the height field (smoother than the mesh facets), plus fine bumps close to the camera
  const bump = (1 - smoothstep(600, 2200, d)) * 2.2;
  const hx = height(x + e, y) - height(x - e, y) + bump * (noise2(x / 4 + 9, y / 4) - noise2(x / 4 - 9, y / 4 + 5)), hy = height(x, y + e) - height(x, y - e) + bump * (noise2(x / 4, y / 4 + 9) - noise2(x / 4 + 5, y / 4 - 9));
  const nn = norm3([-hx, -hy, 2 * e]); n[0] = nn[0]; n[1] = nn[1]; n[2] = nn[2];
  const slope = 1 - nn[2];
  setMix(out, GRASS_A, GRASS_B, smoothstep(0.3, 0.7, fbm(x / 70, y / 70, 4)));
  blend(out, GRASS_DRY, 0.55 * smoothstep(0.5, 0.75, fbm(x / 420 + 11, y / 420, 3)));
  const blade = 0.72 + 0.56 * noise2(x / 2.6, y / 2.6) * (1 - smoothstep(900, 2600, d)) + 0.28 * smoothstep(900, 2600, d);
  out[0] *= blade; out[1] *= blade; out[2] *= blade;
  // wild flowers in the meadow
  if (d < 2200) { const cx = Math.floor(x / 7), cy = Math.floor(y / 7), hsh = hash2(cx, cy); if (hsh > 0.975 && fbm(x / 300, y / 300, 2) > 0.5 && Math.hypot(x / 7 - cx - 0.5, y / 7 - cy - 0.5) < 0.33) blend(out, hsh > 0.988 ? [0.9, 0.85, 0.75] : [0.9, 0.62, 0.08], 0.9); }
  // forest cover on the far hills, rock on steep ground, snow on the peaks
  blend(out, FOREST, smoothstep(2600, 5200, d) * smoothstep(0.38, 0.52, fbm(x / 1300, y / 1300, 4)) * (0.75 + 0.25 * noise2(x / 60, y / 60)));
  const rk = smoothstep(0.1, 0.24, slope + 0.06 * (fbm(x / 200, y / 200, 3) - 0.5)) + smoothstep(1500, 2400, p[2]);
  if (rk > 0) { const c = [0, 0, 0]; setMix(c, ROCK_D, ROCK, fbm(x / 500, y / 160 + p[2] / 90, 4)); blend(out, c, clamp01(rk)); }
  blend(out, SNOW, smoothstep(1900, 2700, p[2] + 900 * (fbm(x / 1500, y / 1500, 4) - 0.5)) * (1 - smoothstep(0.3, 0.55, slope)));
  // shore, the path to the porch and the trodden ground round the cabin
  blend(out, SAND, 1 - smoothstep(WL + 4, WL + 26, p[2]));
  const edge = 9 * (fbm(x / 30, y / 30, 3) - 0.5);
  let dirt = y < 0 && y > -1500 ? 1 - smoothstep(11, 22, Math.abs(x - pathX(y)) + edge) : 0;
  dirt = Math.max(dirt, 0.85 * (1 - smoothstep(120, 185, Math.max(Math.abs(x - C[0]) * 1.25, Math.abs(y - C[1])) + 2 * edge)));
  if (dirt > 0) { const k = 0.8 + 0.4 * noise2(x / 5, y / 5); blend(out, [DIRT[0] * k, DIRT[1] * k, DIRT[2] * k], dirt); }
  m.spec = 0.01;
}

// ---------- sky ----------
const ZEN = lin([44, 96, 180]), HOR = lin([176, 204, 232]), GLOW = lin([255, 226, 180]);
let TIME = 0; // 0..1 round the loop
function sky(d) {
  const z = Math.max(0, d[2]), t = Math.pow(1 - z, 7), s = Math.max(0, d[0] * SUN[0] + d[1] * SUN[1] + d[2] * SUN[2]);
  const c = [0, 1, 2].map((k) => mix(ZEN[k], HOR[k], t) * 1.5 + GLOW[k] * (0.5 * Math.pow(s, 6) + 6 * Math.pow(s, 600)));
  if (d[2] > 0.015) {
    const k = 1 / (d[2] + 0.12), u = d[0] * k * 0.9 + 0.12 * Math.cos(TIME * 6.2832), v = d[1] * k * 0.9 + 0.12 * Math.sin(TIME * 6.2832);
    const cover = smoothstep(0.56, 0.76, fbm(u, v, 6)) * smoothstep(0.015, 0.1, d[2]);
    if (cover > 0) { const lit = 0.72 + 0.5 * smoothstep(0.45, 0.8, fbm(u + 0.12 * SUN[0], v + 0.12 * SUN[1], 4)); for (let i = 0; i < 3; i++) c[i] = mix(c[i], [1.75, 1.68, 1.62][i] * lit, cover * 0.9); }
  }
  return c;
}

// ---------- water ----------
const DEEP = [0.012, 0.05, 0.075];
function waterShader(p, n, out, m, dir) {
  const a = TIME * 6.2832, x = p[0], y = p[1], d = Math.hypot(x - C[0], y - C[1]), amp = 0.05 / (1 + d / 5000);
  const nx = amp * (noise2(x / 34 + 3 * Math.cos(a), y / 12 + 3 * Math.sin(a)) + 0.6 * noise2(x / 13 - 2 * Math.sin(a), y / 6 + 2 * Math.cos(a)) - 0.8);
  const ny = amp * (noise2(x / 30 + 17 - 3 * Math.sin(a), y / 11 + 3 * Math.cos(a)) + 0.6 * noise2(x / 12 + 5 + 2 * Math.cos(a), y / 5 - 2 * Math.sin(a)) - 0.8);
  const nn = norm3([nx, ny, 1]), dn = dir[0] * nn[0] + dir[1] * nn[1] + dir[2] * nn[2];
  const R = norm3([dir[0] - 2 * dn * nn[0], dir[1] - 2 * dn * nn[1], Math.abs(dir[2] - 2 * dn * nn[2])]);
  const F = 0.03 + 0.97 * Math.pow(1 - Math.min(1, -dn), 5), s = sky(R);
  // the far shore and its trees mirrored as a dark band under the horizon
  const band = 1 - smoothstep(0.02, 0.1 + 0.05 * noise2(x / 90, 3), R[2]);
  m.emit = [0, 1, 2].map((k) => mix(DEEP[k], mix(s[k], [0.03, 0.07, 0.05][k], band * 0.85), F));
  n[0] = 0; n[1] = 0; n[2] = 1;
}

// ---------- pines ----------
function pine(x, y, z0, Ht, seed, foliage, trunks) {
  const rnd = (i) => hash2(seed * 7 + i, seed * 3 + 11), SEG = 14, tr = Ht * 0.02;
  for (let j = 0; j < 6; j++) {
    const a0 = (j / 6) * 6.2832, a1 = ((j + 1) / 6) * 6.2832, zt = z0 + Ht * 0.3;
    const p0 = [x + tr * Math.cos(a0), y + tr * Math.sin(a0), z0 - 8], p1 = [x + tr * Math.cos(a1), y + tr * Math.sin(a1), z0 - 8];
    trunks.push([p0, p1, [p1[0], p1[1], zt]], [p0, [p1[0], p1[1], zt], [p0[0], p0[1], zt]]);
  }
  const tiers = 13 + Math.floor(rnd(1) * 5), lean = [(rnd(2) - 0.5) * 0.06, (rnd(3) - 0.5) * 0.06];
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, zb = z0 + Ht * (0.16 + 0.84 * t * 0.92), zt = Math.min(z0 + Ht, zb + Ht * (0.2 - 0.08 * t)), rb = Ht * 0.17 * (1 - t) ** 0.8 * (0.8 + 0.4 * rnd(10 + i)) + Ht * 0.012;
    const cx = x + lean[0] * (zb - z0), cy = y + lean[1] * (zb - z0), apex = [x + lean[0] * (zt - z0), y + lean[1] * (zt - z0), zt], rot = rnd(20 + i) * 6.2832, rim = [];
    for (let j = 0; j < SEG; j++) { const a = rot + (j / SEG) * 6.2832, rr = rb * (0.55 + 0.9 * rnd(40 + i * SEG + j) * (j % 2 ? 1 : 0.6)); rim.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a), zb - rb * (0.25 + 0.5 * rnd(90 + i * SEG + j))]); }
    const hub = [cx, cy, zb + rb * 0.25];
    for (let j = 0; j < SEG; j++) { const a = rim[j], b = rim[(j + 1) % SEG]; foliage.push([a, b, apex], [b, a, hub]); }
  }
}
const PINE_A = lin([20, 48, 30]), PINE_B = lin([44, 80, 42]);
function forest() {
  const foliage = [[], [], []], trunks = [], CAMAZ = (-68 * Math.PI) / 180;
  let n = 0;
  for (let gx = -30; gx <= 30; gx++) for (let gy = -30; gy <= 30; gy++) {
    const x = C[0] + (gx + hash2(gx, gy) - 0.5) * 150, y = C[1] + (gy + hash2(gy + 50, gx) - 0.5) * 150, dx = x - C[0], dy = y - C[1], d = Math.hypot(dx, dy);
    if (d < 350 || d > 4300) continue;
    if (fbm(x / 800 + 20, y / 800, 3) < 0.47 - 0.1 * smoothstep(1500, 3500, d) || hash2(gx + 9, gy - 4) < 0.25) continue;
    let da = Math.abs(Math.atan2(dy, dx) - CAMAZ); if (da > Math.PI) da = 2 * Math.PI - da;
    if (da < 0.62 && d < 1700) continue;                       // keep the view of the cabin open
    let db = Math.abs(Math.atan2(dy, dx) - CAMAZ - Math.PI); if (db > Math.PI) db = Math.abs(2 * Math.PI - db);
    if (db < 0.5 && hash2(gx - 7, gy + 3) < 0.8) continue;       // and most of the view past it to the lake
    if (Math.abs(x - pathX(y)) < 60 && y < 0) continue;
    const z = height(x, y);
    if (z < WL + 12 || lakeD(x, y) < 0.95 || z > 2000) continue;
    pine(x, y, z, 250 + 230 * hash2(gx * 3, gy * 5), n, foliage[n % 3], trunks); n++;
  }
  const shade = (k) => (p, nn, out) => { const t = clamp01(0.15 + 0.25 * k + 0.6 * noise2(p[0] / 14 + p[2] / 9, p[1] / 14 - p[2] / 11)), g = 0.45 + 0.9 * noise2(p[0] / 2.2 + p[2] * 1.3, p[1] / 2.2 - p[2] * 0.9); out[0] = mix(PINE_A[0], PINE_B[0], t) * g; out[1] = mix(PINE_A[1], PINE_B[1], t) * g; out[2] = mix(PINE_A[2], PINE_B[2], t) * g; };
  console.log(`${n} pines`);
  return [...foliage.map((f, k) => ({ pos: pack(f), mat: { shader: shade(k), spec: 0.02 } })), { pos: pack(trunks), mat: { color: [70, 50, 36] } }];
}

// ---------- scene ----------
const cabin = buildings(makeParts({ texture: true })).porch;
const cabinItems = itemsFor(cabin, PALETTES.forest);
const chim = cabin.find((it) => it.name === 'chimney').tris.flat();
const chimTop = [0, 1, 2].map((k) => (k === 2 ? Math.max(...chim.map((p) => p[2])) : chim.reduce((a, p) => a + p[k], 0) / chim.length));
const waterTris = []; { const n = 40, s = 120; for (let i = -n; i < n; i++) for (let j = -n; j < n; j++) { const xa = LAKE[0] + i * s, ya = LAKE[1] + j * s; if (Math.min(lakeD(xa, ya), lakeD(xa + s, ya + s)) > 1.5) continue; waterTris.push([[xa, ya, WL], [xa + s, ya, WL], [xa + s, ya + s, WL]], [[xa, ya, WL], [xa + s, ya + s, WL], [xa, ya + s, WL]]); } }
const scene = [
  { pos: pack(terrainMesh()), mat: { shader: terrainShader, shadow: false } },
  { pos: pack(waterTris), mat: { shader: waterShader, shadow: false } },
  ...forest(), ...cabinItems,
];
console.log(`${scene.reduce((a, it) => a + it.pos.length / 9, 0)} triangles`);

function frame(i, w, h) {
  TIME = i / FRAMES;
  const a = TIME * 6.2832;
  const cam = orbit({ az: -68 + 13 * Math.sin(a), el: 9 + 1.5 * Math.cos(a), dist: 900 + 50 * Math.cos(a), target: [C[0], C[1] + 30, 135], fov: 36 });
  cam.eye[2] = Math.max(cam.eye[2], height(cam.eye[0], cam.eye[1]) + 60);
  // chimney smoke: puffs rise, spread and thin out; evenly spaced ages make the loop seamless
  const sprites = [];
  for (let k = 0; k < 16; k++) {
    const age = (TIME * 2 + k / 16) % 1, wob = 10 * Math.sin(k * 2.4 + age * 5);
    sprites.push({ p: [chimTop[0] + 150 * age ** 1.6 + wob * age, chimTop[1] + 60 * age ** 1.6 - wob * age, chimTop[2] + 4 + 250 * age ** 0.85], r: 9 + 62 * age, a: 0.6 * Math.min(1, age * 7) * (1 - age) ** 1.3, color: [0.5, 0.5, 0.54] });
  }
  return render(scene, {
    W: w, H: h, SS: 2, cam, sun: { dir: SUN, color: [3.5, 3.0, 2.3] },
    ambient: { sky: [0.3, 0.4, 0.58], ground: [0.13, 0.15, 0.09] }, sky,
    fog: (d, p) => 0.92 * (1 - Math.exp(-d / 45000 - Math.max(0, d - 2500) / (26000 + 14 * Math.max(0, p[2])))),
    shadow: { center: [C[0], C[1], 100], radius: 1500, res: 4096, soft: 1.3, bias: 1.4 }, ao: { radius: 14, strength: 1 }, exposure: 0.8, sprites,
  });
}

if (process.env.FRAME !== undefined) {
  const s = +(process.env.SCALE ?? 2), pix = frame(+process.env.FRAME, W * s, H * s);
  fs.writeFileSync(`${OUT}/frame_${process.env.FRAME}.png`, png(pix, W * s, H * s));
} else {
  const frames = [], t0 = Date.now();
  for (let i = 0; i < FRAMES; i++) { frames.push(frame(i, W, H)); if (i % 8 === 7) console.log(`frame ${i + 1}/${FRAMES}  ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
  const g = gif(frames, W, H, DELAY);
  fs.writeFileSync(`${OUT}/cabin_landscape.gif`, g);
  console.log(`wrote ${OUT}/cabin_landscape.gif (${(g.length / 1e6).toFixed(1)} MB)`);
  fs.writeFileSync(`${OUT}/cabin_landscape.png`, png(frame(0, 1680, 1050), 1680, 1050));
  console.log(`wrote ${OUT}/cabin_landscape.png`);
}
