// Writes every part in parts.mjs to ./stl as binary STL, in printing orientation, and checks each mesh.
// Usage: node log_generator.mjs [--clearance 0.2] [--flat 0.8] [--texture 1] [--out stl]   (--texture 0 = smooth logs)
import fs from 'node:fs';
import path from 'node:path';
import { makeParts } from './parts.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const opts = { clearance: +(args.clearance ?? 0.2), flat: +(args.flat ?? 0.8), texture: (args.texture ?? '1') !== '0' };
const outDir = args.out ?? 'stl';

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
  const parts = makeParts(opts);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (f.endsWith('.stl')) fs.unlinkSync(path.join(outDir, f));
  console.log('options (mm):', JSON.stringify(opts));
  let bad = 0;
  for (const p of Object.values(parts)) {
    const { open, vol, lo, size } = checkMesh(p.print);
    if (open || vol <= 0 || Math.abs(lo[2]) > 1e-6) bad++;
    writeSTL(path.join(outDir, `${p.name}.stl`), p.print);
    console.log(`${p.name.padEnd(30)} ${size.map((s) => s.toFixed(1)).join(' x ').padEnd(22)} mm  open edges ${open}  vol ${vol.toFixed(0)} mm3  bed z ${lo[2].toFixed(3)}  ${p.info.listing ?? '(extra, not in listing)'}`);
  }
  console.log(bad ? `${bad} part(s) FAILED mesh checks` : 'all parts watertight, positive volume, resting on z = 0');
}
