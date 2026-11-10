// Geometry for every part in the reference listing (millimetres), plus three non-listed extras.
// Used by log_generator.mjs (STL export), assembly.mjs (cabin layouts), verify.mjs and make_gif.mjs.
//
// Each part has:  model  = triangles in the assembly frame (see "frames" below)
//                 print  = the same solid rotated to its printing orientation (what goes in the STL)
//                 info   = listing name, quantity, notch centres, etc.
// Frames:
//  - logs, half logs, beveled pieces: axis along +x from 0 to length; the round section is centred on y = 0, z = 0
//    (a half log keeps that virtual centre; its flat bottom is at z = -h)
//  - gables: width along x from 0, thickness centred on y = 0, bottom at z = 0
//  - shingles: length along x, width along y, thickness along z (groove up)
export const IN = 25.4;
export const D = 0.75 * IN;            // log diameter
export const R = D / 2;
export const NOTCH_D = (3 / 16) * IN;  // notch depth, top and bottom
export const h = R - NOTCH_D;          // half-height kept through a notch (also: half-log flat is at z = -h)
export const PITCH = (3 / 8) * IN;     // course-to-course rise
export const CENTERS = 3 * IN;         // notch centre spacing
const EPS = 1e-9;

// ---------- polygon helpers ----------
export function earClip(poly) {
  const idx = poly.map((_, i) => i), out = [];
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inTri = (p, a, b, c) => cr(a, b, p) >= -1e-9 && cr(b, c, p) >= -1e-9 && cr(c, a, p) >= -1e-9;
  for (let guard = 0; idx.length > 3 && guard < 100000; guard++) {
    let found = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = poly[ia], b = poly[ib], c = poly[ic];
      if (cr(a, b, c) <= 1e-9) continue;
      if (idx.some((j) => j !== ia && j !== ib && j !== ic && inTri(poly[j], a, b, c))) continue;
      out.push([ia, ib, ic]); idx.splice(i, 1); found = true; break;
    }
    if (!found) throw new Error('earClip failed (polygon not simple or not CCW)');
  }
  out.push([...idx]);
  return out;
}
export function extrudeShell(poly, z0, z1) {
  const t = [], n = poly.length;
  for (const [a, b, c] of earClip(poly)) {
    t.push([[...poly[a], z1], [...poly[b], z1], [...poly[c], z1]]);
    t.push([[...poly[c], z0], [...poly[b], z0], [...poly[a], z0]]);
  }
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    t.push([[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1]], [[p[0], p[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]]);
  }
  return t;
}
export function plate(ow, oh, z0, z1, hole) {
  const xs = [0, ...(hole ? [hole.x0, hole.x1] : []), ow], ys = [0, ...(hole ? [hole.y0, hole.y1] : []), oh];
  const t = [], quad = (a, b, c, d) => { t.push([a, b, c], [a, c, d]); };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    if (hole && i === 1 && j === 1) continue;
    const [xa, xb, ya, yb] = [xs[i], xs[i + 1], ys[j], ys[j + 1]];
    quad([xa, ya, z1], [xb, ya, z1], [xb, yb, z1], [xa, yb, z1]);
    quad([xa, yb, z0], [xb, yb, z0], [xb, ya, z0], [xa, ya, z0]);
  }
  const wall = (p, q) => quad([p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]);
  for (let i = 0; i < xs.length - 1; i++) wall([xs[i], 0], [xs[i + 1], 0]);
  for (let j = 0; j < ys.length - 1; j++) wall([ow, ys[j]], [ow, ys[j + 1]]);
  for (let i = xs.length - 1; i > 0; i--) wall([xs[i], oh], [xs[i - 1], oh]);
  for (let j = ys.length - 1; j > 0; j--) wall([0, ys[j]], [0, ys[j - 1]]);
  if (hole) {
    wall([hole.x0, hole.y0], [hole.x0, hole.y1]); wall([hole.x0, hole.y1], [hole.x1, hole.y1]);
    wall([hole.x1, hole.y1], [hole.x1, hole.y0]); wall([hole.x1, hole.y0], [hole.x0, hole.y0]);
  }
  return t;
}
const circle = (n, r) => Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n; return [r * Math.cos(a), r * Math.sin(a)]; });
const octagon = (af) => { const rc = af / 2 / Math.cos(Math.PI / 8); return Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + (i * Math.PI) / 4; return [rc * Math.cos(a), rc * Math.sin(a)]; }); };
function insertLine(P, axis, v) {
  const out = [], n = P.length;
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n]; out.push([...a]);
    const da = a[axis] - v, db = b[axis] - v;
    if ((da < -1e-9 && db > 1e-9) || (da > 1e-9 && db < -1e-9)) {
      const t = da / (da - db), p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; p[axis] = v; out.push(p);
    }
  }
  for (const p of out) if (Math.abs(p[axis] - v) < 1e-7) p[axis] = v;
  return out;
}
const clipPoly = (P, axis, v, ge) => insertLine(P, axis, v).filter((p) => (ge ? p[axis] >= v - 1e-9 : p[axis] <= v + 1e-9));
function arc(P, pred) {
  const n = P.length; let s = -1;
  for (let i = 0; i < n; i++) if (pred(P[i]) && !pred(P[(i + n - 1) % n])) { s = i; break; }
  const out = [];
  for (let k = 0; k < n && pred(P[(s + k) % n]); k++) out.push(P[(s + k) % n]);
  return out;
}

// ---------- wood texture ----------
// Shallow grooves cut INTO the surface (never raised), so the fit of every part is unchanged.
//  - grain: wandering lengthwise streaks on the outside of a log, like the stained wooden originals
//  - rings: concentric growth rings on the cut ends
// Notch floors and walls, and the face a part prints on, stay smooth.
export const TEX = {
  grainDepth: 0.25, // mm, deepest grain streak
  ringDepth: 0.2,   // mm, end-grain rings
  step: 2,          // mm between cross-sections along a log
  ringStep: 0.3,    // mm between the loops that make up an end face
  edge: 0.6,        // mm, rings fade out this close to the rim
  facet: 0.6,       // mm, longest edge on a flat face that carries texture
};
const TAU = 2 * Math.PI;
const hash = (s) => { let x = 2166136261; for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return x >>> 0; };
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const bump = (u) => (u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * u)); // smooth groove profile, at most about 35 deg steep
// depth (mm) of the grain at angle theta round the log and distance x along it
function makeGrain(seed) {
  const r = rng(seed), C = TAU * R, lines = [];
  const drift = { a: 0.5, k: TAU / (70 + 50 * r()), p: TAU * r() }; // all streaks lean together
  for (let s = 2 * r(); s < C - 1.2; s += 1.5 + 2 * r()) {
    lines.push({ s, w: 0.55 + 0.35 * r(), d: 0.5 + 0.5 * r(), a1: 0.2 + 0.5 * r(), k1: TAU / (30 + 40 * r()), p1: TAU * r(),
      a2: 0.05 + 0.12 * r(), k2: TAU / (11 + 12 * r()), p2: TAU * r(), ke: TAU / (25 + 45 * r()), pe: TAU * r(), bias: 0.15 + 0.5 * r() });
  }
  return (theta, x) => {
    const s = (((theta % TAU) + TAU) % TAU) * R, lean = drift.a * Math.sin(drift.k * x + drift.p);
    let best = 0;
    for (const g of lines) {
      let ds = Math.abs(s - (g.s + lean + g.a1 * Math.sin(g.k1 * x + g.p1) + g.a2 * Math.sin(g.k2 * x + g.p2))) % C;
      if (ds > C / 2) ds = C - ds;
      if (ds >= g.w) continue;
      const env = Math.min(1, Math.max(0, 1.5 * (g.bias + Math.sin(g.ke * x + g.pe)))); // streaks fade in and out
      best = Math.max(best, g.d * env * bump(ds / g.w));
    }
    return TEX.grainDepth * best;
  };
}
// depth (mm) of the growth rings at (y, z) on an end face: slightly uneven circles round an off-centre pith
function makeRings(seed) {
  const r = rng(seed), pith = [(r() - 0.5) * 1.4, (r() - 0.5) * 1.4], radii = [];
  for (let q = 0.9 + 0.6 * r(), gap = 1.7; q < R + 1.5; q += gap * (0.85 + 0.3 * r()), gap = Math.max(1.2, gap * 0.9)) radii.push(q);
  const a2 = 0.04 * r(), p2 = TAU * r(), a3 = 0.03 * r(), p3 = TAU * r(), w = 0.42;
  return (y, z) => {
    const dy = y - pith[0], dz = z - pith[1], phi = Math.atan2(dz, dy);
    const rho = Math.hypot(dy, dz) * (1 + a2 * Math.sin(2 * phi + p2) + a3 * Math.sin(3 * phi + p3));
    let best = 0;
    for (const q of radii) best = Math.max(best, bump(Math.abs(rho - q) / w));
    return TEX.ringDepth * best;
  };
}
const texFor = (name, smooth) => ({ grain: makeGrain(hash(name)), rings: [makeRings(hash(name + '/a')), makeRings(hash(name + '/b'))], smooth });
// split long straight edges so a flat face has enough vertices to carry texture
function subdivide(P, pred, maxLen = TEX.facet) {
  const out = [];
  P.forEach((a, i) => {
    const b = P[(i + 1) % P.length]; out.push(a);
    if (!pred(a, b)) return;
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxLen);
    for (let k = 1; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  });
  return out;
}
// move one cross-section vertex inwards by the grain depth. Vertices on the notch-floor lines slide sideways only,
// so the notch floors stay flat and at their exact height.
function displace(p, x, tex) {
  if (!tex || (tex.smooth && tex.smooth(p))) return p;
  const d = tex.grain(Math.atan2(p[1], p[0]), x);
  if (!d) return p;
  const r = Math.hypot(p[0], p[1]);
  if (Math.abs(Math.abs(p[1]) - h) < 1e-7) return [p[0] - (Math.sign(p[0]) * d * r) / Math.abs(p[0]), p[1]];
  return [(p[0] * (r - d)) / r, (p[1] * (r - d)) / r];
}
// end face: loops of the rim shrunk towards the log axis, each vertex sunk by the ring depth.
// rim = [y, z] (CCW), xOf(y, z) = the face, inward = +1 / -1 (direction into the solid), flip = face looks towards -x
function endCap(T, rim, xOf, inward, flip, ring) {
  const tri = (a, b, c) => T.push(flip ? [c, b, a] : [a, b, c]);
  const m = ring ? Math.max(2, Math.ceil(Math.max(...rim.map((p) => Math.hypot(p[0], p[1]))) / TEX.ringStep)) : 1;
  const pt = (p, t) => {
    const y = p[0] * t, z = p[1] * t;
    const d = ring ? ring(y, z) * Math.min(1, ((1 - t) * Math.hypot(p[0], p[1])) / TEX.edge) : 0;
    return [xOf(y, z) + inward * d, y, z];
  };
  let outer = rim.map((p) => pt(p, 1));
  const n = rim.length;
  for (let j = 1; j < m; j++) {
    const inner = rim.map((p) => pt(p, 1 - j / m));
    for (let i = 0; i < n; i++) { const k = (i + 1) % n; tri(outer[i], outer[k], inner[k]); tri(outer[i], inner[k], inner[i]); }
    outer = inner;
  }
  const c = pt([0, 0], 0);
  for (let i = 0; i < n; i++) tri(c, outer[i], outer[(i + 1) % n]);
}

// ---------- notched log solid ----------
// base: CCW cross-section (y, z) already containing exact vertices on z = +/-h.
// tex (optional): { grain, rings: [end at 0, end at L], smooth(p) } from texFor
function logMesh({ L, centers, base, notchW, top = true, bottom = true, chamfer = null, tex = null }) {
  const idx = base.map((_, i) => i);
  const keep = idx.filter((i) => (!top || base[i][1] <= h + EPS) && (!bottom || base[i][1] >= -h - EPS));
  const caps = [];
  if (top) caps.push(arc(idx, (i) => base[i][1] >= h - EPS));
  if (bottom) caps.push(arc(idx, (i) => base[i][1] <= -h + EPS));
  const T = [];
  const section = (x, s) => base.map((p) => { const q = displace(p, x, tex); return [x, q[0] * s, q[1] * s]; });
  const skin = (A, B, sel) => { const n = sel.length; for (let i = 0; i < n; i++) { const u = sel[i], v = sel[(i + 1) % n]; T.push([A[u], A[v], B[v]], [A[u], B[v], B[u]]); } };
  const wall = (S, cap, flip) => { // notch wall: the part of the section above (below) the notch floor
    const pts = cap.map((i) => S[i]);
    for (const [a, b, c] of earClip(pts.map((p) => [p[1], p[2]]))) T.push(flip ? [pts[c], pts[b], pts[a]] : [pts[a], pts[b], pts[c]]);
  };
  // spans along x: [x from, scale from, x to, scale to, is a notch, is a body span]
  const spans = [], st = chamfer ?? [[0, 1]]; // chamfer: [[dx, scale], ...] from the end inwards, last scale = 1
  const x0 = st[st.length - 1][0], x1 = L - x0;
  for (let k = 0; k < st.length - 1; k++) spans.push([st[k][0], st[k][1], st[k + 1][0], st[k + 1][1], false, false]);
  const bounds = [x0];
  for (const c of centers) bounds.push(c - notchW / 2, c + notchW / 2);
  bounds.push(x1);
  for (let i = 0; i < bounds.length - 1; i++) spans.push([bounds[i], 1, bounds[i + 1], 1, i % 2 === 1, i > 0]);
  for (let k = st.length - 2; k >= 0; k--) spans.push([L - st[k + 1][0], st[k + 1][1], L - st[k][0], st[k][1], false, false]);
  let last = null;
  spans.forEach(([xa, sa, xb, sb, isNotch, capped], si) => {
    const n = tex ? Math.max(1, Math.ceil((xb - xa) / TEX.step)) : 1;
    let A = section(xa, sa);
    if (si === 0) endCap(T, A.map((p) => [p[1], p[2]]), () => xa, 1, true, tex?.rings[0]);
    if (capped) for (const cap of caps) wall(A, cap, !isNotch);
    for (let k = 1; k <= n; k++) {
      const B = k === n ? section(xb, sb) : section(xa + ((xb - xa) * k) / n, sa + ((sb - sa) * k) / n);
      skin(A, B, isNotch ? keep : idx);
      A = B;
    }
    last = A;
  });
  endCap(T, last.map((p) => [p[1], p[2]]), () => L, -1, false, tex?.rings[1]);
  return T;
}
// log with one end cut on a slant (top edge longest)
function bevelMesh({ Ltop, base, phi, tex = null }) {
  const zmax = Math.max(...base.map((p) => p[1]));
  const xe = (z) => Ltop - (zmax - z) / Math.tan(phi);
  const T = [], n = base.length;
  const end = base.map((p) => { const q = displace(p, xe(p[1]), tex); return [xe(q[1]), q[0], q[1]]; }); // on the slanted cut
  const m = tex ? Math.ceil(Ltop / TEX.step) : 1;
  const row = (j) => (j === m ? end : base.map((p, i) => { const x = (end[i][0] * j) / m, q = displace(p, x, tex); return [x, q[0], q[1]]; }));
  let A = row(0);
  endCap(T, A.map((p) => [p[1], p[2]]), () => 0, 1, true, tex?.rings[0]);
  for (let j = 1; j <= m; j++) {
    const B = row(j);
    for (let i = 0; i < n; i++) { const k = (i + 1) % n; T.push([A[i], A[k], B[k]], [A[i], B[k], B[i]]); }
    A = B;
  }
  endCap(T, end.map((p) => [p[1], p[2]]), (y, z) => xe(z), -1, false, tex?.rings[1]);
  return T;
}

// ---------- the part catalogue ----------
// Rounded ends (taken from the old 4 3/4 in "beveled end" log): [distance in from the end (mm), section scale]
export const ROUNDED_ENDS = [[0, 0.6], [1.5, 0.82], [3.5, 0.95], [5, 1]];
// The notched logs that make up the rounded-end set: [name, listing, length (in), notches, options]
const ROUNDED_LOGS = [
  ['log_1insert_1-5_8_rounded', '1 Insert Log, 1 5/8 (rounded ends)', 1.625, 1],
  ['log_1insert_1-1_2_round_rounded', '1 Insert Log (Round), 1 1/2 (rounded ends)', 1.5, 1],
  ['log_1insert_1-1_2_octagonal_rounded', '1 Insert Log (Hex), 1 1/2 (rounded ends)', 1.5, 1, { oct: true }],
  ['log_2insert_4-1_2_rounded', '2 Insert Log, 4 1/2 (rounded ends)', 4.5, 2],
  ['log_2insert_4-3_4_rounded', 'Beveled End, 4 3/4 (the original rounded-end log)', 4.75, 2],
  ['log_3insert_7-5_8_rounded', '3 Insert Log, 7 5/8 (rounded ends)', 7.625, 3],
  ['log_4insert_10-5_8_rounded', '4 Insert Log, 10 5/8 (rounded ends)', 10.625, 4],
];

// set: 'standard' (every part, smooth or wood grain) or 'rounded' (only the notched logs, all with rounded ends)
export function makeParts({ clearance = 0.2, flat = 0.8, texture = true, set = 'standard' } = {}) {
  const notchW = D + 2 * clearance;
  const yf = -R + flat;
  const withCuts = (P) => insertLine(insertLine(P, 1, h), 1, -h);
  const NC = 144; // facets round a log: 0.4 mm apart, with vertices exactly on the notch-floor lines (30 deg)
  const onFlat = (a, b) => a[0] <= yf + 1e-6 && b[0] <= yf + 1e-6, onBottom = (a, b) => a[1] <= -h + 1e-6 && b[1] <= -h + 1e-6;
  const roundBase = subdivide(withCuts(clipPoly(circle(NC, R), 0, yf, true)), onFlat);       // round log with a printing flat on one side
  const octBase = subdivide(withCuts(octagon(D)), () => true);                              // flats top, bottom and sides
  const halfBase = subdivide(insertLine(clipPoly(circle(NC, R), 1, -h, true), 1, h), onBottom); // flat bottom at the bottom-notch floor
  // wood texture: grain on the outside, rings on the ends; the face on the print bed stays smooth
  const tex = (name, smooth) => (texture ? texFor(name, smooth) : null);
  const roundSmooth = (p) => p[0] <= yf + 1e-6, octSmooth = (p) => p[0] <= -R + 1e-6, halfSmooth = (p) => p[1] <= -h + 1e-6;
  const centersFor = (L, n) => Array.from({ length: n }, (_, k) => L / 2 + (k - (n - 1) / 2) * CENTERS);
  const parts = {};
  const add = (name, info, model, toPrint) => { parts[name] = { name, info, model, print: model.map((t) => t.map(toPrint)) }; };
  const logPrint = (yflat) => ([x, y, z]) => [x, -z, y - yflat];                 // lie on the side flat, notches sideways
  const logModelFromPrint = (yflat) => ([X, Y, Z]) => [X, Z + yflat, -Y];

  const log = (name, listing, Lin, n, opts = {}) => {
    const L = Lin * IN, centers = centersFor(L, n);
    const base = opts.oct ? octBase : roundBase, yflat = opts.oct ? -R : yf;
    add(name, { listing, length: L, centers, kind: 'log', note: opts.note }, logMesh({ L, centers, base, notchW, chamfer: opts.chamfer, tex: tex(name, opts.oct ? octSmooth : roundSmooth) }), logPrint(yflat));
    parts[name].toModel = logModelFromPrint(yflat);
  };
  if (set === 'rounded') {
    for (const [name, listing, Lin, n, opts = {}] of ROUNDED_LOGS) log(name, listing, Lin, n, { ...opts, chamfer: ROUNDED_ENDS });
    return parts;
  }
  log('log_1insert_1-5_8', '1 Insert Log, 1 5/8', 1.625, 1);
  log('log_1insert_1-1_2_round', '1 Insert Log (Round), 1 1/2', 1.5, 1);
  log('log_1insert_1-1_2_octagonal', '1 Insert Log (Hex), 1 1/2', 1.5, 1, { oct: true, note: 'listed as hex; photo shows flats top and bottom, modelled as an octagon so it stacks' });
  log('log_2insert_4-1_2', '2 Insert Log, 4 1/2', 4.5, 2);
  log('log_3insert_7-5_8', '3 Insert Log, 7 3/4', 7.625, 3, { note: 'sheet says 7 3/4; photo measures about 7.6 and the length rule (3 in centres, 7/16 in shoulders, PARTS_SPEC.md) gives 7 5/8' });
  log('log_4insert_10-5_8', '4 Insert Log, 10 5/8', 10.625, 4);
  // the 4 3/4 in rounded-end log is in the rounded set (ROUNDED_LOGS above); the 6 in 2-insert log was dropped

  const half = (name, listing, Lin, n) => {
    const L = Lin * IN, centers = centersFor(L, n);
    add(name, { listing, length: L, centers, kind: 'half' }, logMesh({ L, centers, base: halfBase, notchW, bottom: false, tex: tex(name, halfSmooth) }), ([x, y, z]) => [x, y, z + h]);
    parts[name].toModel = ([X, Y, Z]) => [X, Y, Z - h];
  };
  half('half_log_4-1_2', 'Half Log, 4 1/2', 4.5, 2);
  half('half_log_7-1_2', 'Half Log, 7 1/2', 7.5, 3);

  // short log with one end cut at the roof angle of the wooden triangle (about 39 deg in the photos)
  add('beveled_end_1-1_2', { listing: 'Beveled End, 1 1/2 x 1 1/4', kind: 'bevel', note: 'top edge 1 1/2 in, end cut at 39 deg; the listed "1 1/4" is not explained by the photos' },
    bevelMesh({ Ltop: 1.5 * IN, base: roundBase, phi: (39 * Math.PI) / 180, tex: tex('beveled_end_1-1_2', roundSmooth) }), logPrint(yf));
  parts['beveled_end_1-1_2'].toModel = logModelFromPrint(yf);

  for (const [name, Lin, listing] of [['solid_log_1-3_8', 1.375, 'Solid Log, 1 3/8'], ['solid_log_1-5_8', 1.625, 'Solid Log, 1 5/8']]) {
    // a plain cylinder standing on end: built along x like the other logs, then stood up
    const m = logMesh({ L: Lin * IN, centers: [], base: circle(NC, R), notchW, top: false, bottom: false, tex: tex(name, null) }).map((t) => t.map(([x, y, z]) => [y + R, z + R, x]));
    add(name, { listing, kind: 'solid' }, m, (p) => p);
    parts[name].toModel = (p) => p;
  }

  // ---- gables: profile in XY, thickness T along Z in the print frame; model = (X, T/2 - Z, Y)
  const T = D; // 3/4 in: fills the crossing log's notch slot the way a log does (thickness not visible in photos)
  const gableAdd = (name, info, poly) => {
    add(name, info, extrudeShell(poly, 0, T).map((t) => t.map(([X, Y, Z]) => [X, T / 2 - Z, Y])), ([x, y, z]) => [x, z, T / 2 - y]);
    parts[name].toModel = ([X, Y, Z]) => [X, T / 2 - Z, Y];
    parts[name].print = extrudeShell(poly, 0, T);
  };
  const nw = notchW, nd = NOTCH_D;
  // Orange plastic gables: mirror-symmetric, flat bottom with notches on 3 in centres, stepped slopes, hooked eave lips.
  // The large one is measured from the listing photo; the small one from a second photo of several gables, which
  // shows it with two notches, the same step shape and the same pitch. Both share e0, lip and riser sizes.
  const e0 = 7.5, lipT = 5.4, lipH = 3.6, rr = 2.9;
  const plasticGable = (name, info, W, n, notchOffsets, Hfixed) => {
    const half_ = W / 2, ph = (half_ - lipT) / n;
    // tread rise: from the listed height for the large gable; for others, the same overall nose slope as the large one
    const tr = Hfixed ? (Hfixed - e0 - (n - 1) * rr) / n : plasticSlope * ph - rr;
    const H = e0 + n * tr + (n - 1) * rr;
    const Lp = [[0, e0 + lipH], [lipT, e0 + lipH], [lipT, e0]];
    for (let k = 0; k < n; k++) { const x = lipT + k * ph, y = e0 + k * (tr + rr); Lp.push([x + ph, y + tr]); if (k < n - 1) Lp.push([x + ph, y + tr + rr]); }
    const bottom = [[0, 0]];
    for (const o of notchOffsets) { const cx = half_ + o; bottom.push([cx - nw / 2, 0], [cx - nw / 2, nd], [cx + nw / 2, nd], [cx + nw / 2, 0]); }
    bottom.push([W, 0]);
    const poly = [...bottom, ...Lp.map((p) => [W - p[0], p[1]]), ...Lp.slice(0, -1).reverse()];
    const m = (tr + rr) / ph, th = Math.atan(m), c = Math.cos(th), s = Math.sin(th);
    const plane = (right, sv, hh = 0) => (right ? [W - lipT - sv * c + hh * s, e0 + sv * s + hh * c] : [lipT + sv * c - hh * s, e0 + sv * s + hh * c]);
    gableAdd(name, { ...info, kind: 'gable', W, H, T, steps: n, notchXs: notchOffsets.map((o) => half_ + o), th, plane, sApex: (half_ - lipT) / c, profile: Lp, startX: lipT }, poly);
    return m;
  };
  let plasticSlope = 0;
  plasticSlope = plasticGable('gable_plastic_8-1_2', { listing: 'Plastic Orange Roof, 2 1/4 x 8 1/2', source: 'listing' }, 8.5 * IN, 7, [-CENTERS, 0, CENTERS], 2.25 * IN);
  plasticGable('gable_plastic_small_2notch', { listing: 'Small plastic gable, 2 notches (from a second photo; about 5.8 x 1.6)', source: 'gable photo' }, 5.8 * IN, 5, [-CENTERS / 2, CENTERS / 2], null);
  { // wooden triangle, measured from the photo (listed 4 x 2; measures about 4 7/8 x 2)
    const W = 4.875 * IN, H = 2 * IN, half_ = W / 2;
    const bottom = [[0, 0]];
    for (const cx of [half_ - CENTERS / 2, half_ + CENTERS / 2]) bottom.push([cx - nw / 2, 0], [cx - nw / 2, nd], [cx + nw / 2, nd], [cx + nw / 2, 0]);
    bottom.push([W, 0]);
    const poly = [...bottom, [half_, H]];
    const th = Math.atan(H / half_), c = Math.cos(th), s = Math.sin(th);
    const plane = (right, sv, hh = 0) => (right ? [W - sv * c + hh * s, sv * s + hh * c] : [sv * c - hh * s, sv * s + hh * c]);
    gableAdd('gable_wood_triangle_4x2', { listing: 'Triangle, 4 x 2', kind: 'gable', W, H, T, notchXs: [half_ - CENTERS / 2, half_ + CENTERS / 2], th, plane, sApex: Math.hypot(half_, H), profile: [[0, 0], [half_, H]], startX: null }, poly);
  }

  // ---- shingles
  const tS = IN / 8, wFlat = 0.8 * IN, wRidge = 1.125 * IN;
  for (const [Lin, listing] of [[6, 'Flat Shingle, 6'], [9, 'Flat Shingle, 9'], [11, 'Flat Shingle, 11']]) {
    const name = `shingle_flat_${Lin}`;
    add(name, { listing, kind: 'shingle', length: Lin * IN, width: wFlat, t: tS }, plate(Lin * IN, wFlat, 0, tS), (p) => p);
    parts[name].toModel = (p) => p;
  }
  for (const [Lin, tag, listing] of [[5.625, '5-5_8', 'Ridge Shingle, 5 5/8'], [6, '6', 'Ridge Shingle, 6'], [9, '9', 'Ridge Shingle, 9']]) {
    const name = `shingle_ridge_${tag}`, L = Lin * IN, g = 0.8, gd = 0.8;
    const prof = [[0, 0], [wRidge, 0], [wRidge, tS], [wRidge / 2 + g, tS], [wRidge / 2, tS - gd], [wRidge / 2 - g, tS], [0, tS]];
    const m = extrudeShell(prof, 0, L).map((t) => t.map(([x, y, z]) => [z, x, y]));
    add(name, { listing, kind: 'shingle', length: L, width: wRidge, t: tS }, m, (p) => p);
    parts[name].toModel = (p) => p;
  }

  // ---- chimney (yellow, from the gable photo): open-topped block with an inverted-V cut in its base that straddles
  // the ridge. The V's sides are cut at the plastic gables' pitch (photo: about 27 deg).
  // Model frame: width along x centred on 0, depth along y centred on 0, V apex... bottom prong tips at z = 0.
  {
    const Wc = 1.375 * IN, Dc = 1.0 * IN, Hc = 1.2 * IN, wall = 0.12 * IN, pocket = 0.5 * IN;
    const Vd = (Wc / 2) * plasticSlope;                 // V depth so its sides match the roof pitch (photo: about 0.36 in)
    const zp = Hc - pocket;
    const prof = [[0, 0], [Wc / 2, Vd], [Wc, 0], [Wc, zp], [0, zp]];
    const lower = extrudeShell(prof, 0, Dc).map((t) => t.map(([u, v, w]) => [u, Dc - w, v]));          // V-cut solid base
    const upper = plate(Wc, Dc, zp, Hc, { x0: wall, x1: Wc - wall, y0: wall, y1: Dc - wall });          // open-topped walls
    const model = [...lower, ...upper].map((t) => t.map(([x, y, z]) => [x - Wc / 2, y - Dc / 2, z]));
    // print upside down: open top on the bed, V facing up, so no supports are needed
    add('chimney', { listing: 'Chimney (from the gable photo; about 1 3/8 x 1.2 in)', source: 'gable photo', kind: 'chimney', W: Wc, D: Dc, H: Hc, Vd },
      model, ([x, y, z]) => [x + Wc / 2, -y + Dc / 2, Hc - z]);
    parts.chimney.toModel = ([X, Y, Z]) => [X - Wc / 2, -(Y - Dc / 2), Hc - Z];
  }

  // ---- extras that are NOT in any reference photo (kept from the earlier design)
  const gap = CENTERS - D - 2 * clearance, wallH = (n) => (n - 1) * PITCH + D;
  const extras = {
    extra_door: plate(gap, wallH(4) - 2 * clearance, 0, IN / 8),
    extra_window: (() => { const w = gap, hh = wallH(3) - 2 * clearance, ow = 1.125 * IN, oh = 0.625 * IN; return plate(w, hh, 0, IN / 8, { x0: (w - ow) / 2, x1: (w + ow) / 2, y0: (hh - oh) / 2, y1: (hh + oh) / 2 }); })(),
  };
  for (const [name, m] of Object.entries(extras)) { add(name, { listing: null, kind: 'extra' }, m, (p) => p); parts[name].toModel = (p) => p; }
  return parts;
}
