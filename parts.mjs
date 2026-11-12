// Geometry for every part in the reference listing (millimetres), plus three non-listed extras.
// Used by log_generator.mjs (STL export), assembly.mjs (cabin layouts), verify.mjs and make_gif.mjs.
//
// Each part has:  model  = triangles in the assembly frame (see "frames" below)
//                 print  = the same solid rotated to its printing orientation (what goes in the STL)
//                 info   = listing name, quantity, notch centres, etc.
// Frames:
//  - logs, half logs, beveled pieces: axis along +x from 0 to length; the section is centred on z = 0, and in y the
//    width that sits in a notch (the round section less its printing flat) is centred on y = 0
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
export const HEX_DIP = 0.7;            // mm each flat of the hex log is cut below the round (1.28 would be a true hexagon)
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
// "gently hexagonal" section: a circle of radius r with six shallow flats cut `dip` deep (a true hexagon would be
// 0.134 r deep). Flats are top, bottom and four diagonals; the two sides stay on the circle, so it is as wide as a round log.
const softHex = (n, r, dip) => circle(n, r).map(([y, z]) => {
  const t = Math.atan2(z, y), f = Math.PI / 6 + (Math.PI / 3) * Math.round((t - Math.PI / 6) / (Math.PI / 3)), k = Math.min(1, (r - dip) / Math.cos(t - f) / r);
  return [y * k, z * k];
});
// regular octagon, r across the flats (so as wide as a round log of radius r), with flats top, bottom, both sides and
// on the four diagonals. Sampled at the same n angles as circle(n, r) so it can carry the same texture; with n a
// multiple of 16 the eight corners are vertices.
const octagon = (n, r) => circle(n, r).map(([y, z]) => {
  const t = Math.atan2(z, y), f = (Math.PI / 4) * Math.round(t / (Math.PI / 4)), k = 1 / Math.cos(t - f);
  return [y * k, z * k];
});
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
// width (mm) of the flat rim left round an inset end, by angle: thick on one side and thin on the other, like the wall
// of a hollow log (u runs from 0 at the thinnest point to 1 at the thickest)
function makeWall(seed) {
  const r = rng(seed), p1 = TAU * r(), p2 = TAU * r(), p3 = TAU * r();
  return (phi) => Math.min(1, Math.max(0, 0.5 + 0.34 * Math.sin(phi + p1) + 0.17 * Math.sin(2 * phi + p2) + 0.09 * Math.sin(3 * phi + p3)));
}
const texFor = (name, smooth) => ({ grain: makeGrain(hash(name)), rings: [makeRings(hash(name + '/a')), makeRings(hash(name + '/b'))],
  walls: [makeWall(hash(name + '/wall-a')), makeWall(hash(name + '/wall-b'))], smooth });
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

// section scale at distance d from an end, for a chamfer profile [[d, scale], ...] (last scale = 1)
function endScale(st, d) {
  if (!st || d >= st[st.length - 1][0]) return 1;
  for (let i = 0; i < st.length - 1; i++) if (d <= st[i + 1][0]) return st[i][1] + ((d - st[i][0]) / (st[i + 1][0] - st[i][0])) * (st[i + 1][1] - st[i][1]);
  return 1;
}

// ---------- logs that print standing on end ----------
export const STAND = {
  roof: 90,      // deg from vertical (as printed) of the wall at the upper end of each notch. 90 = square, held up while
                 // printing by the built-in support below; 45 leans it back so it needs none
  // built-in, break-away support under the upper wall of each notch: a comb of thin fins standing on the lower wall
  fin: 0.5,      // mm, thickness of the comb's spine and fins (one extrusion line)
  pitch: 2.4,    // mm between fins; the wall bridges the gaps
  gapTop: 0.2,   // mm between the fins and the wall they hold up (one layer), so they let go
  gapSide: 0.5,  // mm between the comb and the notch floor
  gapRim: 0.4,   // mm the fins stop short of the log's surface
  inset: 1.0,    // mm the end grain is sunk below the rim (wood-grain logs)
  wallMin: 1.2,  // mm, thinnest part of the flat rim round the inset: three 0.4 mm lines on the bed
  wallMax: 2.8,  // mm, thickest part of the rim
};
// End face of a wood-grain log that stands on end: a flat rim of uneven width (the wall of a hollow log), a 45 deg
// slope down to a floor STAND.inset deep, and the growth rings cut into that floor. Only the rim touches the bed; the
// slope carries the first layers over the hollow and the floor is bridged.
// Arguments as endCap, plus wall(phi) from makeWall.
function hollowCap(T, rim, xOf, inward, flip, ring, wall) {
  const tri = (a, b, c) => T.push(flip ? [c, b, a] : [a, b, c]);
  const n = rim.length, rad = rim.map((p) => Math.hypot(p[0], p[1])), rimR = Math.max(...rad);
  const wide = STAND.wallMin + (STAND.wallMax - STAND.wallMin) * Math.min(1, rimR / R); // narrower ends get a narrower rim
  const r1 = rim.map((p, i) => rad[i] - (STAND.wallMin + (wide - STAND.wallMin) * wall(Math.atan2(p[1], p[0])))), r2 = r1.map((v) => v - STAND.inset);
  if (Math.min(...r2) < 1) throw new Error('end face too small for an inset');
  const at = (i, r, depth) => { const t = r / rad[i], y = rim[i][0] * t, z = rim[i][1] * t; return [xOf(y, z) + inward * depth, y, z]; };
  const loops = [rim.map((_, i) => at(i, rad[i], 0)), rim.map((_, i) => at(i, r1[i], 0)), rim.map((_, i) => at(i, r2[i], STAND.inset))];
  const m = Math.max(2, Math.ceil(Math.max(...r2) / TEX.ringStep));
  for (let j = 1; j < m; j++) loops.push(rim.map((p, i) => {
    const r = r2[i] * (1 - j / m), t = r / rad[i];
    return at(i, r, STAND.inset + ring(p[0] * t, p[1] * t) * Math.min(1, (r2[i] - r) / TEX.edge));
  }));
  for (let j = 0; j < loops.length - 1; j++) {
    const outer = loops[j], inner = loops[j + 1];
    for (let i = 0; i < n; i++) { const k = (i + 1) % n; tri(outer[i], outer[k], inner[k]); tri(outer[i], inner[k], inner[i]); }
  }
  const last = loops[loops.length - 1], c = [xOf(0, 0) + inward * (STAND.inset + ring(0, 0)), 0, 0];
  for (let i = 0; i < n; i++) tri(c, last[i], last[(i + 1) % n]);
}
const capEnd = (T, rim, xOf, inward, flip, tex, e) => (tex ? hollowCap(T, rim, xOf, inward, flip, tex.rings[e], tex.walls[e]) : endCap(T, rim, xOf, inward, flip, null));
const sameVertex = (a, b) => Math.abs(a[0] - b[0]) < 2e-5 && Math.abs(a[1] - b[1]) < 2e-5 && Math.abs(a[2] - b[2]) < 2e-5 && a.every((v, i) => v.toFixed(5) === b[i].toFixed(5));

// Break-away supports for the square notches of a standing log, as separate closed shells (same frame as the log).
// One comb per notch: a spine along the notch floor with fins reaching out towards the log's surface. It stands on
// the lower notch wall and stops STAND.gapTop under the upper one. Twist it out with pliers.
function notchSupports({ centers, base, notchW }) {
  const T = [], f = STAND.fin, zs0 = h + STAND.gapSide, zs1 = zs0 + f;
  const top = base.filter((p) => p[1] > 0).sort((a, b) => a[0] - b[0]);
  const surf = (y) => { for (let i = 0; i < top.length - 1; i++) if (y >= top[i][0] && y <= top[i + 1][0]) return top[i][1] + ((y - top[i][0]) / (top[i + 1][0] - top[i][0] || 1)) * (top[i + 1][1] - top[i][1]); return -Infinity; };
  const reach = (y) => Math.min(surf(y - f / 2), surf(y + f / 2)) - STAND.gapRim;
  const fins = [];
  for (let k = 0; reach(k * STAND.pitch) > zs1 + 1; k++) fins.push(...(k ? [-k, k] : [0]).map((j) => j * STAND.pitch));
  fins.sort((a, b) => b - a);
  let ys = fins[0] + f / 2;
  while (reach(ys + 0.2) > zs1) ys += 0.2; // spine runs on past the last fin as far as it fits
  const poly = [[-ys, zs0], [ys, zs0], [ys, zs1]];
  for (const y of fins) { const zt = reach(y); poly.push([y + f / 2, zs1], [y + f / 2, zt], [y - f / 2, zt], [y - f / 2, zs1]); }
  poly.push([-ys, zs1]);
  const clean = poly.filter((p, i) => i === 0 || Math.hypot(p[0] - poly[i - 1][0], p[1] - poly[i - 1][1]) > 1e-9);
  for (const c of centers) for (const t of extrudeShell(clean, c - notchW / 2, c + notchW / 2 - STAND.gapTop)) {
    T.push(t.map(([y, z, x]) => [x, y, z]), t.map(([y, z, x]) => [x, y, -z]).reverse());
  }
  return T;
}

// A notched log built to print standing on the end at x = 0 (x is up on the printer). base: CCW cross-section (y, z),
// symmetric, with vertices on z = +/-h. Every cross-section has the same vertices; a notch is made by pulling the
// vertices beyond the notch floor down onto it, so the mesh is one continuous skin.
//  - the lower wall of each notch (as printed) is square
//  - the upper wall is square too by default (roof = 90) and is a flat overhang: notchSupports holds it up. With
//    roof < 90 it leans back at that angle from vertical instead, starting one clearance in from the square wall
// The sides are never trimmed: the log keeps its full section along its whole length.
function standingLogMesh({ L, centers, base, notchW, clearance, roof = STAND.roof, chamfer = null, tex = null }) {
  const zMax = Math.max(...base.map((p) => Math.abs(p[1])));
  const square = roof >= 89.9, k = square ? 0 : Math.tan((roof * Math.PI) / 180); // k: mm the wall moves outwards per mm of height
  const notches = centers.map((c) => { const lo = c - notchW / 2, hi = c + notchW / 2, fl = square ? hi : hi - clearance; return { lo, hi, fl, end: square ? hi : fl + (zMax - h) / k }; });
  const st = chamfer ?? [[0, 1]], x0 = st[st.length - 1][0];
  // |z| limit at x; side = -1 / +1 picks the value just below / above x where the limit jumps (the square walls)
  const zCap = (x, side) => {
    for (const n of notches) {
      if (x < n.lo - EPS || x > n.end + EPS) continue;
      if (Math.abs(x - n.lo) <= EPS) return side > 0 ? h : Infinity;
      if (x < n.fl - EPS) return h;
      if (square) return side < 0 ? h : Infinity;
      return Math.min(zMax, h + (x - n.fl) * k);
    }
    return Infinity;
  };
  const scale = (x) => endScale(st, Math.min(x, L - x));
  // stations along the log: every place the shape changes, with one on the sloped wall for each height a vertex sits at
  const levels = [...new Set(base.map((p) => +Math.abs(p[1]).toFixed(9)))].filter((z) => z > h + 1e-6);
  let xs = [0, L, ...st.flatMap(([d]) => [d, L - d])];
  for (const n of notches) {
    xs.push(n.lo, n.fl, n.hi, n.end);
    if (!square) for (const z of levels) xs.push(n.fl + (z - h) / k);
  }
  xs = xs.sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-7);
  if (tex) xs = xs.flatMap((x, i) => { if (i === 0) return [x]; const a = xs[i - 1], n = Math.ceil((x - a) / TEX.step); return Array.from({ length: n }, (_, j) => (j === n - 1 ? x : a + ((x - a) * (j + 1)) / n)); });
  const section = (x, side) => {
    const zc = zCap(x, side), s = scale(x);
    return base.map((p) => {
      let [y, z] = displace(p, x, tex);
      if (Math.abs(z) > zc - 1e-9) z = Math.sign(z) * zc;
      return [x, y * s, z * s];
    });
  };
  const rings = [];
  for (const x of xs) { rings.push(section(x, -1)); if (zCap(x, -1) !== zCap(x, 1)) rings.push(section(x, 1)); }
  const T = [], n = base.length;
  const tri = (a, b, c) => { if (!sameVertex(a, b) && !sameVertex(b, c) && !sameVertex(c, a)) T.push([a, b, c]); };
  capEnd(T, rings[0].map((p) => [p[1], p[2]]), () => 0, 1, true, tex, 0);
  for (let j = 0; j < rings.length - 1; j++) {
    const A = rings[j], B = rings[j + 1];
    for (let i = 0; i < n; i++) { const v = (i + 1) % n; tri(A[i], A[v], B[v]); tri(A[i], B[v], B[i]); }
  }
  capEnd(T, rings[rings.length - 1].map((p) => [p[1], p[2]]), () => L, -1, false, tex, 1);
  return T;
}

// ---------- notched log solid (prints lying down; used for the half logs) ----------
// base: CCW cross-section (y, z) already containing exact vertices on z = +/-h.
// tex (optional): { grain, rings: [end at 0, end at L], smooth(p) } from texFor
// pivotZ: the section shrinks towards (0, pivotZ) at chamfered ends (a half log passes -h so its bottom stays flat)
function logMesh({ L, centers, base, notchW, top = true, bottom = true, chamfer = null, tex = null, pivotZ = 0 }) {
  const idx = base.map((_, i) => i);
  const keep = idx.filter((i) => (!top || base[i][1] <= h + EPS) && (!bottom || base[i][1] >= -h - EPS));
  const caps = [];
  if (top) caps.push(arc(idx, (i) => base[i][1] >= h - EPS));
  if (bottom) caps.push(arc(idx, (i) => base[i][1] <= -h + EPS));
  const T = [];
  const section = (x, s) => base.map((p) => { const q = displace(p, x, tex); return [x, q[0] * s, s === 1 ? q[1] : pivotZ + (q[1] - pivotZ) * s]; });
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
// chamfer (optional): rounds the square end only, as in standingLogMesh; the slanted end is left as cut
function bevelMesh({ Ltop, base, phi, tex = null, chamfer = null }) { // prints standing on its square end (x = 0)
  const zmax = Math.max(...base.map((p) => p[1]));
  const xe = (z) => Ltop - (zmax - z) / Math.tan(phi);
  const T = [], n = base.length;
  const end = base.map((p) => { const q = displace(p, xe(p[1]), tex); return [xe(q[1]), q[0], q[1]]; }); // on the slanted cut
  // rows: with a chamfer, first at fixed x through the rounded end (x0 is well short of the slanted cut), then
  // spread from x0 to the cut; without one, spread from 0 to the cut
  let x0 = 0, fixed = [];
  if (chamfer) {
    x0 = chamfer[chamfer.length - 1][0];
    fixed = chamfer.map(([d]) => d);
    if (tex) fixed = fixed.flatMap((x, i) => { if (!i) return [x]; const a = fixed[i - 1], k = Math.ceil((x - a) / TEX.step); return Array.from({ length: k }, (_, j) => a + ((x - a) * (j + 1)) / k); });
    fixed.pop(); // x0 itself is the first spread row
  }
  const m = tex ? Math.ceil((Ltop - x0) / TEX.step) : 1;
  const at = (xi) => base.map((p, i) => { const x = xi(i), q = displace(p, x, tex), s = endScale(chamfer, x); return [x, q[0] * s, q[1] * s]; });
  const rows = [...fixed.map((x) => at(() => x)), ...Array.from({ length: m + 1 }, (_, j) => (j === m ? end : at((i) => x0 + ((end[i][0] - x0) * j) / m)))];
  let A = rows[0];
  capEnd(T, A.map((p) => [p[1], p[2]]), () => 0, 1, true, tex, 0);
  for (let j = 1; j < rows.length; j++) {
    const B = rows[j];
    for (let i = 0; i < n; i++) { const k = (i + 1) % n; T.push([A[i], A[k], B[k]], [A[i], B[k], B[i]]); }
    A = B;
  }
  capEnd(T, end.map((p) => [p[1], p[2]]), (y, z) => xe(z), -1, false, tex, 1);
  return T;
}

// ---------- the part catalogue ----------
// Rounded ends (taken from the old 4 3/4 in "beveled end" log): [distance in from the end (mm), section scale].
// The tip was 0.6; it is 0.665 so the first step, which is an overhang on the end that stands on the bed, is 45 deg.
export const ROUNDED_ENDS = [[0, 0.665], [1.5, 0.82], [3.5, 0.95], [5, 1]];
// set: 'standard' (every part: the 11 logs, smooth or wood grain, and the roof parts), or one of two logs-only sets
// with the same 11 logs: 'rounded' (round, with rounded ends) or 'octagonal' (regular octagonal section, flat ends)
export function makeParts({ clearance = 0.2, flat = 0, texture = true, set = 'standard', roof = STAND.roof, supports = true } = {}) {
  const oct = set === 'octagonal', ball = set === 'rounded';
  const ends = ball ? ROUNDED_ENDS : null; // chamfer profile for every log end
  // Every part that sits in a notch is MATE wide there: a full log diameter, now that the round logs stand on end and
  // need no printing flat. Half logs and gables are the same width. `flat` (default 0) narrows all of them, as the old
  // 0.8 mm printing flat did. The notch is MATE plus the clearance on each side.
  // (Fit-tested in PLA with logs lying down: 0.2 mm per side seats fully with slight play.)
  const MATE = D - flat, notchW = MATE + 2 * clearance;
  const yf = -R + flat, yShift = -flat / 2; // logs are placed so the mating width is centred on the log's nominal axis
  const withCuts = (P) => insertLine(insertLine(P, 1, h), 1, -h);
  const NC = 144; // facets round a log: 0.4 mm apart, with vertices exactly on the notch-floor lines (30 deg)
  const onFlat = (a, b) => a[0] <= yf + 1e-6 && b[0] <= yf + 1e-6, onBottom = (a, b) => a[1] <= -h + 1e-6 && b[1] <= -h + 1e-6;
  const section = oct ? octagon(NC, R) : circle(NC, R);                                    // the octagonal set is D across the flats, as wide as a round log
  const roundBase = withCuts(section);                                                      // round (or octagonal) log, printed standing on end
  const hexBase = withCuts(softHex(NC, R, HEX_DIP));                                        // the listing's "hex" log
  const halfBase = subdivide(insertLine(clipPoly(clipPoly(section, 0, yf, true), 1, -h, true), 1, h), (a, b) => onBottom(a, b) || onFlat(a, b)); // prints lying down: flat bottom at the bottom-notch floor, and one side cut flat to the mating width
  // wood texture: grain on the outside, rings on the ends; the face on the print bed stays smooth
  const tex = (name, smooth) => (texture ? texFor(name, smooth) : null);
  // the side cut flat to the mating width stays smooth; with flat = 0 an octagon's side is a real face and keeps its grain
  const halfSmooth = (p) => p[1] <= -h + 1e-6 || (p[0] <= yf + 1e-6 && !(oct && flat === 0));
  // the logs-only sets reuse the standard names with a suffix; info.replaces names the standard part each stands in for
  const sfx = oct ? '_oct' : ball ? '_rounded' : '';
  const O = oct ? ' (octagonal)' : ball ? ' (rounded ends)' : '';
  const centersFor = (L, n) => Array.from({ length: n }, (_, k) => L / 2 + (k - (n - 1) / 2) * CENTERS);
  const parts = {};
  const add = (name, info, model, toPrint) => { parts[name] = { name, info, model, print: model.map((t) => t.map(toPrint)) }; };
  const centred = (m) => m.map((t) => t.map(([x, y, z]) => [x, y + yShift, z]));  // section frame -> model frame
  const logPrint = ([x, y, z]) => [y, z, x];                                     // stand on the end at x = 0
  const logModelFromPrint = ([X, Y, Z]) => [Z, X, Y];

  const log = (name, listing, Lin, n, opts = {}) => {
    const L = Lin * IN, centers = centersFor(L, n);
    const base = opts.hex ? hexBase : roundBase;
    add(name, { listing, length: L, centers, kind: 'log', note: opts.note, replaces: opts.replaces }, standingLogMesh({ L, centers, base, notchW, clearance, roof, chamfer: ends, tex: tex(name, null) }), logPrint);
    parts[name].toModel = logModelFromPrint;
    if (supports && roof >= 89.9) parts[name].print.push(...notchSupports({ centers, base, notchW }).map((t) => t.map(logPrint)));
  };
  const std = (name, listing, Lin, n, opts = {}) => log(name + sfx, listing + O, Lin, n, { ...opts, replaces: [name] });
  std('log_1insert_1-5_8', '1 Insert Log, 1 5/8', 1.625, 1);
  // the octagonal set's 1 1/2 in plain log is octagonal, so "round" is dropped from its name
  log(oct ? 'log_1insert_1-1_2_oct' : `log_1insert_1-1_2_round${sfx}`, '1 Insert Log (Round), 1 1/2' + O, 1.5, 1, { replaces: ['log_1insert_1-1_2_round'] });
  // the hex log keeps its own section (a round log with six shallow flats) in every set, octagonal included
  std('log_1insert_1-1_2_hex', '1 Insert Log (Hex), 1 1/2', 1.5, 1, { hex: true, note: 'listed as hex; photo shows flats top and bottom; modelled as a round log with six shallow flats' });
  std('log_2insert_4-1_2', '2 Insert Log, 4 1/2', 4.5, 2);
  std('log_3insert_7-5_8', '3 Insert Log, 7 3/4', 7.625, 3, { note: 'sheet says 7 3/4; photo measures about 7.6 and the length rule (3 in centres, 7/16 in shoulders, PARTS_SPEC.md) gives 7 5/8' });
  std('log_4insert_10-5_8', '4 Insert Log, 10 5/8', 10.625, 4);
  // dropped: the 6 in 2-insert log and the 4 3/4 in rounded-end log, whose shoulders don't follow the length rule

  const half = (std, listing, Lin, n) => {
    const name = std + sfx, L = Lin * IN, centers = centersFor(L, n);
    add(name, { listing: listing + O, length: L, centers, kind: 'half', replaces: [std] }, centred(logMesh({ L, centers, base: halfBase, notchW, bottom: false, chamfer: ends, pivotZ: -h, tex: tex(name, halfSmooth) })), ([x, y, z]) => [x, y - yShift, z + h]);
    parts[name].toModel = ([X, Y, Z]) => [X, Y + yShift, Z - h];
  };
  half('half_log_4-1_2', 'Half Log, 4 1/2', 4.5, 2);
  half('half_log_7-1_2', 'Half Log, 7 1/2', 7.5, 3);

  // short log with one end cut at the roof angle of the wooden triangle (about 39 deg in the photos)
  const bev = `beveled_end_1-1_2${sfx}`;
  add(bev, { listing: 'Beveled End, 1 1/2 x 1 1/4' + O, kind: 'bevel', replaces: ['beveled_end_1-1_2'], note: 'top edge 1 1/2 in, end cut at 39 deg; the listed "1 1/4" is not explained by the photos' },
    bevelMesh({ Ltop: 1.5 * IN, base: roundBase, phi: (39 * Math.PI) / 180, chamfer: ends, tex: tex(bev, null) }), logPrint);
  parts[bev].toModel = logModelFromPrint;

  for (const [std, Lin, listing] of [['solid_log_1-3_8', 1.375, 'Solid Log, 1 3/8'], ['solid_log_1-5_8', 1.625, 'Solid Log, 1 5/8']]) {
    // a plain cylinder (or octagonal prism) standing on end: built along x like the other logs, then stood up
    const name = std + sfx;
    const m = standingLogMesh({ L: Lin * IN, centers: [], base: section, notchW, clearance, chamfer: ends, tex: tex(name, null) }).map((t) => t.map(([x, y, z]) => [y + R, z + R, x]));
    add(name, { listing: listing + O, kind: 'solid', replaces: [std] }, m, (p) => p);
    parts[name].toModel = (p) => p;
  }
  if (oct || ball) return parts; // logs-only sets: the gables, shingles, chimney and extras are shared

  // ---- gables: profile in XY, thickness T along Z in the print frame; model = (X, T/2 - Z, Y)
  const T = MATE; // as wide as a log is where it sits in a notch, so a gable fills the crossing log's notch slot the way a log does (thickness not visible in photos)
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
