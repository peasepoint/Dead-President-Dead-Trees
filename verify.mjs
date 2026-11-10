// Physical check of the test buildings in assembly.mjs, using the exact part geometry from parts.mjs.
// Every placed part is voxelised (0.5 mm), then for each part:
//   interference : volume shared with any other part (should be ~0: parts touch but never overlap)
//   support      : contacts directly below (other parts or the table); the part's centre of mass must lie inside
//                  the convex hull of those contacts, or it would tip
//   interlock    : shift the part 1.5 mm in +x, -x, +y, -y and see whether it collides with a neighbour
// Writes VERIFY.md and exits non-zero if any interference or unsupported part is found.
// Usage: node verify.mjs [--res 0.5] [--finish woodgrain|smooth]
// The wood-grain logs (default) are reported in VERIFY.md, the smooth logs in VERIFY_smooth.md.
import fs from 'node:fs';
import { makeParts } from './parts.mjs';
import { buildings } from './assembly.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const H = +(args.res ?? 0.5), V3 = H ** 3, SUPPORT_REACH = 2;

function voxelise(items) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const it of items) for (const t of it.tris) for (const p of t) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
  const ox = Math.floor(lo[0]) - 3 - 0.2731 * H, oy = Math.floor(lo[1]) - 3 - 0.4127 * H, oz = 0; // table at z = 0
  const nx = Math.ceil((hi[0] - ox) / H) + 4, ny = Math.ceil((hi[1] - oy) / H) + 4, nz = Math.ceil((hi[2] - oz) / H) + 4;
  const owner = new Uint8Array(nx * ny * nz), lists = [], overlap = new Map();
  let oddColumns = 0;
  items.forEach((it, idx) => {
    const id = idx + 1, cols = new Map(), list = [];
    for (const [a, b, c] of it.tris) {
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-12) continue;
      const i0 = Math.max(0, Math.ceil((Math.min(a[0], b[0], c[0]) - ox) / H - 0.5)), i1 = Math.min(nx - 1, Math.floor((Math.max(a[0], b[0], c[0]) - ox) / H - 0.5));
      const j0 = Math.max(0, Math.ceil((Math.min(a[1], b[1], c[1]) - oy) / H - 0.5)), j1 = Math.min(ny - 1, Math.floor((Math.max(a[1], b[1], c[1]) - oy) / H - 0.5));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = ox + (i + 0.5) * H, py = oy + (j + 0.5) * H;
        const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
        const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * a[2] + w1 * b[2] + w2 * c[2], key = j * nx + i;
        (cols.get(key) ?? cols.set(key, []).get(key)).push(z);
      }
    }
    for (const [key, zs] of cols) {
      zs.sort((p, q) => p - q);
      if (zs.length % 2) { oddColumns++; continue; }
      for (let m = 0; m < zs.length; m += 2) {
        const k0 = Math.max(0, Math.ceil((zs[m] - oz) / H - 0.5)), k1 = Math.min(nz - 1, Math.floor((zs[m + 1] - oz) / H - 0.5));
        for (let k = k0; k <= k1; k++) {
          const v = k * nx * ny + key;
          if (owner[v] && owner[v] !== id) { const pk = `${Math.min(owner[v], id)},${Math.max(owner[v], id)}`; overlap.set(pk, (overlap.get(pk) ?? 0) + 1); }
          else owner[v] = id;
          list.push(v);
        }
      }
    }
    lists.push(Int32Array.from(list));
  });
  return { owner, lists, overlap, nx, ny, nz, ox, oy, oz, oddColumns, minZ: lo[2] };
}

function hull(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
// signed distance of p inside a CCW convex polygon (positive = inside)
function insideMargin(poly, p) {
  if (poly.length < 3) return -Infinity;
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    m = Math.min(m, ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / L);
  }
  return m;
}

function analyse(label, items) {
  const t0 = Date.now();
  const G = voxelise(items), { owner, lists, nx, ny, nz } = G, layer = nx * ny;
  const rows = [];
  items.forEach((it, idx) => {
    const id = idx + 1, L = lists[idx];
    let sx = 0, sy = 0;
    const contacts = new Map(), supporters = new Set();
    let table = 0;
    for (const v of L) {
      const i = v % nx, j = Math.floor(v / nx) % ny, k = Math.floor(v / layer);
      sx += i; sy += j;
      // contact = another part (or the table) within SUPPORT_REACH voxels directly below; a 0.5 mm grid can show a
      // false gap of up to one voxel at a line contact, so two voxels are searched
      let o = -1;
      if (k === 0) { o = 0; table++; }
      else for (let d = 1; d <= SUPPORT_REACH && o < 0; d++) { if (k - d < 0) break; const b = owner[v - d * layer]; if (b === id) break; if (b) o = b; }
      if (o >= 0) { contacts.set(j * nx + i, [i, j]); if (o > 0) supporters.add(items[o - 1].name); }
    }
    const com = [sx / L.length, sy / L.length];
    const hp = hull([...contacts.values()]);
    const margin = insideMargin(hp, com) * H;
    const blocked = [];
    for (const [lab, d] of [['+x', 3], ['-x', -3], ['+y', 3 * nx], ['-y', -3 * nx]]) {
      let n = 0;
      for (const v of L) { const w = v + d; if (w < 0 || w >= owner.length) continue; const o = owner[w]; if (o && o !== id) n++; }
      if (n * V3 > 1) blocked.push(lab);
    }
    rows.push({ name: it.name, volume: L.length * V3, supported: margin > 0, margin, supporters: [...supporters], table: table > 0, blocked });
  });
  const overlaps = [...G.overlap].map(([k, n]) => { const [a, b] = k.split(',').map(Number); return { a: items[a - 1].name, b: items[b - 1].name, mm3: n * V3 }; }).sort((p, q) => q.mm3 - p.mm3);
  return { label, rows, overlaps, oddColumns: G.oddColumns, minZ: G.minZ, seconds: (Date.now() - t0) / 1000 };
}

const FINISH = args.finish ?? 'woodgrain';
if (!['woodgrain', 'smooth'].includes(FINISH)) { console.error(`--finish must be woodgrain or smooth (got ${FINISH})`); process.exit(2); }
const REPORT = FINISH === 'smooth' ? 'VERIFY_smooth.md' : 'VERIFY.md';
const P = makeParts({ texture: FINISH === 'woodgrain' });
const { cabin, shed, cottage } = buildings(P);
const results = [
  analyse('Cabin (6 x 9 in, large plastic gables, chimney)', cabin),
  analyse('Shed (3 x 6 in, wooden triangle gables)', shed),
  analyse('Cottage (3 x 6 in, small plastic gables, chimney)', cottage),
];

let md = `# Assembly verification\n\nGenerated by \`node verify.mjs${FINISH === 'smooth' ? ' --finish smooth' : ''}\` from the same geometry that is written to \`stl/${FINISH}/\`. Voxel size ${H} mm.\n\n`;
md += 'Checks per part: **interference** (volume shared with another part; any shared voxel counts), **support** (centre of mass inside the convex hull of contacts directly below, with the margin to the hull edge; a contact is another part or the table within ' + SUPPORT_REACH + ' voxels = ' + (SUPPORT_REACH * H).toFixed(1) + ' mm below, because voxel rounding can open a false gap of up to one voxel at line contacts), **interlock** (which 1.5 mm sideways pushes are blocked by a neighbour).\n\n';
let fail = 0;
for (const r of results) {
  const bigOverlaps = r.overlaps.filter((o) => o.mm3 > 1);
  const unsupported = r.rows.filter((x) => !x.supported);
  const onTable = [...new Set(r.rows.filter((x) => x.table).map((x) => x.name))];
  const walls = r.rows.filter((x) => /log|beveled_end_4/.test(x.name));
  const wallsLocked = walls.filter((x) => x.blocked.length === 4).length;
  fail += bigOverlaps.length + unsupported.length;
  md += `## ${r.label}\n\n`;
  md += `- Parts: **${r.rows.length}**; lowest point z = ${r.minZ.toFixed(3)} mm\n`;
  md += `- Interference over 1 mm3: **${bigOverlaps.length ? bigOverlaps.map((o) => `${o.a} / ${o.b} ${o.mm3.toFixed(1)} mm3`).join('; ') : 'none'}**` + (r.overlaps.length ? ` (largest contact rounding: ${r.overlaps[0].mm3.toFixed(2)} mm3)` : '') + '\n';
  md += `- Unsupported parts: **${unsupported.length ? unsupported.map((x) => x.name).join(', ') : 'none'}**\n`;
  md += `- Touching the table: ${onTable.join(', ')} (everything else is carried by other parts)\n`;
  md += `- Wall logs locked against all four sideways pushes: **${wallsLocked}/${walls.length}**\n`;
  md += `- Voxel columns skipped (ray hit an edge): ${r.oddColumns}\n\n`;
  md += '| # | Part | Volume (mm3) | Supported (CoM margin) | Rests on | Pushes blocked |\n|---|---|---|---|---|---|\n';
  r.rows.forEach((x, i) => {
    md += `| ${i + 1} | ${x.name} | ${x.volume.toFixed(0)} | ${x.supported ? 'yes' : '**NO**'} (${isFinite(x.margin) ? x.margin.toFixed(1) + ' mm' : 'no contacts'}) | ${[x.table ? 'table' : null, ...[...new Set(x.supporters)]].filter(Boolean).join(', ')} | ${x.blocked.join(' ') || 'none'} |\n`;
  });
  md += '\n';
  console.log(`${r.label}: ${r.rows.length} parts, interference>1mm3: ${bigOverlaps.length}, unsupported: ${unsupported.length}, walls locked: ${wallsLocked}/${walls.length}, odd columns: ${r.oddColumns}, ${r.seconds}s`);
  for (const o of r.overlaps.slice(0, 5)) console.log(`   overlap ${o.a} / ${o.b}: ${o.mm3.toFixed(2)} mm3`);
  for (const x of r.rows) if (!x.supported || x.blocked.length < 4) console.log(`   ${x.name}: supported=${x.supported} (${x.margin.toFixed(1)}), blocked=${x.blocked.join(' ') || 'none'}, on=${[...new Set(x.supporters)].join('|')}${x.table ? '|table' : ''}`);
}
fs.writeFileSync(REPORT, md);
console.log(fail ? `FAILED: ${fail} problem(s); see ${REPORT}` : `PASS: no interference, every part supported; see ${REPORT}`);
process.exit(fail ? 1 : 0);
