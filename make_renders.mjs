// Renders stills of the example buildings in assembly.mjs into images/examples/, with smooth and with wood-grain logs.
// Same geometry as the STLs (parts.mjs) and the same layouts that verify.mjs checks.
// Usage: node make_renders.mjs            all images
//        ONLY=porch node make_renders.mjs only images whose name contains "porch"; SCALE=0.5 for a quick preview
import fs from 'node:fs';
import { makeParts } from './parts.mjs';
import { buildings } from './assembly.mjs';
import { render, png, pack, orbit, lin, norm3, fbm, smoothstep, mix, itemsFor, PALETTES } from './render_lib.mjs';

const OUT = 'images/examples', SCALE = +(process.env.SCALE ?? 1), ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });
const B = { smooth: buildings(makeParts({ texture: false })), woodgrain: buildings(makeParts({ texture: true })) };

// studio: pale table top that fades into the backdrop
const BACK_TOP = lin([232, 236, 240]), BACK_BOT = lin([206, 212, 220]), TABLE = lin([226, 222, 214]);
const sky = (d) => { const t = smoothstep(-0.25, 0.45, d[2]); return [0, 1, 2].map((k) => mix(BACK_BOT[k], BACK_TOP[k], t) * 1.05); };
function table(cx, cy, half = 3000, n = 60) {
  const tris = [], s = (2 * half) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const [xa, xb, ya, yb] = [cx - half + i * s, cx - half + (i + 1) * s, cy - half + j * s, cy - half + (j + 1) * s];
    tris.push([[xa, ya, 0], [xb, ya, 0], [xb, yb, 0]], [[xa, ya, 0], [xb, yb, 0], [xa, yb, 0]]);
  }
  return { pos: pack(tris), mat: { shadow: false, shader: (p, n_, out) => { const k = 0.96 + 0.08 * fbm(p[0] / 90, p[1] / 14, 3); out[0] = TABLE[0] * k; out[1] = TABLE[1] * k; out[2] = TABLE[2] * k; }, spec: 0.02 } };
}
function shot(name, items, cam, { W = 1600, H = 1100, radius = 320, center = cam.target, aoR = 9, fogAt = 1100 } = {}) {
  if (!name.includes(ONLY)) return;
  const t0 = Date.now(), w = Math.round(W * SCALE), h = Math.round(H * SCALE);
  const pix = render([table(center[0], center[1]), ...items], {
    W: w, H: h, SS: 2, cam: orbit(cam),
    sun: { dir: norm3(cam.sun ?? [-0.55, -0.45, 0.7]), color: [2.7, 2.55, 2.3] },
    ambient: { sky: [0.36, 0.4, 0.46], ground: [0.2, 0.17, 0.14] }, sky,
    fog: (d) => smoothstep(fogAt, fogAt + 1700, d),
    shadow: { center, radius, res: 4096, soft: 1.6, bias: 0.3 }, ao: { radius: aoR, strength: 1 }, exposure: 0.92,
  });
  fs.writeFileSync(`${OUT}/${name}.png`, png(pix, w, h));
  console.log(`${name}.png  ${w}x${h}  ${items.reduce((a, it) => a + it.pos.length / 9, 0)} triangles  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

const IN = 25.4;
// 1. porch cabin, smooth logs
shot('porch_cabin_smooth', itemsFor(B.smooth.porch, PALETTES.classic), { az: -66, el: 15, dist: 640, target: [3 * IN, 4.4 * IN, 58], fov: 30 });
// 2. tall house, wood-grain logs
shot('tall_house_woodgrain', itemsFor(B.woodgrain.house, PALETTES.red), { az: -62, el: 15, dist: 640, target: [3 * IN, 3 * IN, 78], fov: 30 });
// 3. the same corner of the porch cabin in both finishes
for (const finish of ['smooth', 'woodgrain'])
  shot(`porch_corner_${finish}`, itemsFor(B[finish].porch, PALETTES.classic), { az: -52, el: 12, dist: 250, target: [5.2 * IN, 0.6 * IN, 44], fov: 30 }, { W: 1200, H: 900, radius: 200, aoR: 5 });
// 4. watchtower, wood-grain logs
shot('watchtower_woodgrain', itemsFor(B.woodgrain.tower, PALETTES.forest), { az: -60, el: 14, dist: 620, target: [1.5 * IN, 1.5 * IN, 88], fov: 30 }, { W: 1100, H: 1400 });
// 5. the other finish of each whole cabin, for comparison
shot('porch_cabin_woodgrain', itemsFor(B.woodgrain.porch, PALETTES.classic), { az: -66, el: 15, dist: 640, target: [3 * IN, 4.4 * IN, 58], fov: 30 });
shot('tall_house_smooth', itemsFor(B.smooth.house, PALETTES.red), { az: -62, el: 15, dist: 640, target: [3 * IN, 3 * IN, 78], fov: 30 });
// 6. all six buildings together (wood grain)
{
  const W = B.woodgrain, row = [];
  const put = (parts, pal, x, y, seed) => row.push(...itemsFor(parts, pal, [x, y, 0], seed));
  put(W.tower, PALETTES.forest, -250, 330, 1); put(W.house, PALETTES.red, -90, 250, 2); put(W.cabin, PALETTES.classic, 150, 200, 3);
  put(W.porch, PALETTES.classic, -230, -60, 4); put(W.cottage, PALETTES.red, 40, -70, 5); put(W.shed, PALETTES.forest, 230, -60, 6);
  shot('village_woodgrain', row, { az: -66, el: 24, dist: 1250, target: [60, 150, 55], fov: 30 }, { W: 1800, H: 1000, radius: 520, center: [60, 170, 60], aoR: 10, fogAt: 2000 });
}
// 7. the two-piece 10 5/8 in log and its dovetail splice, lying as the pieces print (on a side flat, notches sideways):
// joined (behind) and moved apart (in front). The tail goes into the socket across the log, not endways.
{
  const P = makeParts({ texture: true }), a = P['log_4insert_10-5_8_split_tongue'], b = P['log_4insert_10-5_8_split_groove'];
  const x0 = b.info.splice.x0, mid = x0 + b.info.splice.len / 2;
  const at = (p, dx, dy) => ({ name: p.name, tris: p.print.map((t) => t.map(([x, y, z]) => [x + dx, y + dy, z])) });
  const pair = (gap, dy) => [at(a, -gap / 2, dy), at(b, x0 + gap / 2, dy)];
  shot('split_log_joint', itemsFor([...pair(0, 30), ...pair(16, 0)], PALETTES.classic, [0, 0, 0], 11), { az: -96, el: 62, dist: 120, target: [mid, 15, 9], fov: 30 }, { W: 1400, H: 700, radius: 160, aoR: 3 });
  // the same halves with one extender between them: a 5-notch, 13 5/8 in log
  const c = P.log_extender_1insert_3, step = 3 * IN, row = (gap, dy) => [at(a, -gap, dy), at(c, x0, dy), at(b, x0 + step + gap, dy)];
  shot('split_log_extender', itemsFor([...row(0, 30), ...row(14, 0)], PALETTES.classic, [0, 0, 0], 11), { az: -93, el: 58, dist: 300, target: [x0 + step / 2, 15, 9], fov: 30 }, { W: 1600, H: 620, radius: 260, aoR: 3 });
  // the flat-bottomed pieces for the base course, lying as they print (flat side down, notches up): the dovetail is
  // cut straight down, so here the tail goes into the socket from above
  const ha = P['half_log_10-5_8_split_tongue'], hb = P['half_log_10-5_8_split_groove'], hc = P.half_log_extender_1insert_3;
  const hrow = (gap, dy) => [at(ha, -gap, dy), at(hc, x0, dy), at(hb, x0 + step + gap, dy)];
  shot('split_half_log_joint', itemsFor([...hrow(0, 30), ...hrow(14, 0)], PALETTES.classic, [0, 0, 0], 11), { az: -100, el: 52, dist: 250, target: [x0 + step / 2, 15, 7], fov: 30 }, { W: 1600, H: 700, radius: 200, aoR: 3 });
}
