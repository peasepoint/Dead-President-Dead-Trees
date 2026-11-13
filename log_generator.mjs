// Writes every part in parts.mjs as binary STL, in printing orientation, and checks each mesh.
// Five folders are written under <out>:
//   roof_parts/          gables, shingles, chimney, door and window: the same for every log set
//   smooth/              the logs, plain
//   flat_end_round/      the logs with wood grain and growth rings in their flat ends
//   flat_end_octagonal/  the logs with an octagonal section, wood grain and flat ends
//   ball_end_round/      the logs with rounded ends and wood grain
// Each log folder also gets the 4-notch log as two halves that join with a dovetail, and an extender for them
// (--splice-clearance: gap per face; --splice-round: radius on the joint's edges, 0 for sharp).
// Usage: node log_generator.mjs [--clearance 0.2] [--flat 0.8] [--splice-clearance 0.3] [--splice-round 0.8] [--set all|<folder>] [--out stl]
import fs from 'node:fs';
import path from 'node:path';
import { makeParts } from './parts.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const opts = { clearance: +(args.clearance ?? 0.2), flat: +(args.flat ?? 0.8), spliceClearance: +(args['splice-clearance'] ?? 0.3), spliceRound: +(args['splice-round'] ?? 0.8) };
const outRoot = args.out ?? 'stl';
const LOG_KINDS = ['log', 'half', 'bevel', 'solid'];
const isLog = (p) => LOG_KINDS.includes(p.info.kind);
// folder name -> makeParts options and which of the parts it gets
export const SETS = {
  roof_parts: { make: { texture: false }, keep: (p) => !isLog(p) },
  smooth: { make: { texture: false }, keep: isLog },
  flat_end_round: { make: { texture: true }, keep: isLog },
  flat_end_octagonal: { make: { texture: true, set: 'octagonal' }, keep: isLog },
  ball_end_round: { make: { texture: true, set: 'rounded' }, keep: isLog },
};
const ALIASES = { woodgrain: 'flat_end_round', rounded_woodgrain: 'ball_end_round', octagonal: 'flat_end_octagonal', roof: 'roof_parts', both: 'all' }; // older names
const pick = args.set ?? args.finish ?? 'all';
const only = ALIASES[pick] ?? pick;
if (only !== 'all' && !(only in SETS)) { console.error(`--set must be all or one of ${Object.keys(SETS).join(', ')} (got ${pick})`); process.exit(2); }

export function checkMesh(t) {
  const key = (v) => v.map((n) => n.toFixed(5)).join(',');
  const edges = new Map();
  let vol = 0;
  for (const [a, b, c] of t) {
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = key(u) + '>' + key(v), r = key(v) + '>' + key(u);
      if (edges.get(r)) edges.set(r, edges.get(r) - 1); else edges.set(k, (edges.get(k) ?? 0) + 1);
    }
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  // reduce, not Math.min(...array): textured meshes have too many triangles to spread into arguments
  const lo = [0, 1, 2].map((i) => t.reduce((m, tr) => Math.min(m, tr[0][i], tr[1][i], tr[2][i]), Infinity));
  const hi = [0, 1, 2].map((i) => t.reduce((m, tr) => Math.max(m, tr[0][i], tr[1][i], tr[2][i]), -Infinity));
  return { open: [...edges.values()].filter((v) => v !== 0).length, vol, lo, size: hi.map((v, i) => v - lo[i]) };
}
function writeSTL(file, t) {
  const buf = Buffer.alloc(84 + t.length * 50);
  buf.write('log cabin part', 0);
  buf.writeUInt32LE(t.length, 80);
  t.forEach(([a, b, c], i) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = Math.hypot(...n) || 1; n = n.map((x) => x / m);
    let o = 84 + i * 50;
    for (const x of [...n, ...a, ...b, ...c]) { buf.writeFloatLE(x, o); o += 4; }
  });
  fs.writeFileSync(file, buf);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('options (mm):', JSON.stringify(opts));
  let bad = 0;
  for (const [name, set] of Object.entries(SETS)) {
    if (only !== 'all' && only !== name) continue;
    const parts = Object.values(makeParts({ ...opts, ...set.make })).filter(set.keep), outDir = path.join(outRoot, name);
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of fs.readdirSync(outDir)) if (f.endsWith('.stl')) fs.unlinkSync(path.join(outDir, f));
    console.log(`\n${outDir}/`);
    for (const p of parts) {
      const { open, vol, lo, size } = checkMesh(p.print);
      if (open || vol <= 0 || Math.abs(lo[2]) > 1e-6) bad++;
      writeSTL(path.join(outDir, `${p.name}.stl`), p.print);
      console.log(`${p.name.padEnd(30)} ${size.map((s) => s.toFixed(1)).join(' x ').padEnd(22)} mm  open edges ${open}  vol ${vol.toFixed(0)} mm3  bed z ${lo[2].toFixed(3)}  ${p.info.listing ?? '(extra, not in listing)'}`);
    }
  }
  console.log(bad ? `\n${bad} part(s) FAILED mesh checks` : '\nall parts watertight, positive volume, resting on z = 0');
  process.exit(bad ? 1 : 0);
}
