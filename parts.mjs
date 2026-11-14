// Geometry for every part in the reference listing (millimetres), plus the dazzlers: dress-up parts that are not
// in any listing (dazzlers.mjs).
// Used by log_generator.mjs (STL export), assembly.mjs (cabin layouts), verify.mjs and make_gif.mjs.
//
// Each part has:  model  = triangles in the assembly frame (see "frames" below)
//                 print  = the same solid rotated to its printing orientation (what goes in the STL)
//                 info   = listing name, quantity, notch centres, etc.
// Frames:
//  - logs, base logs, beveled pieces: axis along +x from 0 to length; the section is centred on z = 0, and in y the
//    width that sits in a notch (the round section less its printing flat) is centred on y = 0
//    (a base log keeps that virtual centre; its flat bottom is at z = -h)
//  - gables: width along x from 0, thickness centred on y = 0, bottom at z = 0
//  - shingles: length along x, width along y, thickness along z (groove up)
import { addDazzlers } from './dazzlers.mjs';

export const IN = 25.4;
export const D = 0.75 * IN;            // log diameter
export const R = D / 2;
export const NOTCH_D = (3 / 16) * IN;  // notch depth, top and bottom
export const h = R - NOTCH_D;          // half-height kept through a notch (also: base-log flat is at z = -h)
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
// move one cross-section vertex inwards by the grain depth. Vertices on the notch-floor lines (and on tex.levels, the
// heights a splice joint is cut at) slide sideways only, so those cuts stay flat and at their exact height.
// tex.levelAxis = 0: the joint is cut upright instead, tex.levels are distances either side of the middle of the log,
// and the vertices on them slide up and down only.
function displace(p, x, tex) {
  if (!tex || (tex.smooth && tex.smooth(p))) return p;
  const d = tex.grain(Math.atan2(p[1], p[0]), x);
  if (!d) return p;
  const r = Math.hypot(p[0], p[1]);
  const la = tex.levelAxis ?? 1, onLevel = tex.levels?.some((v) => Math.abs(Math.abs(p[la]) - v) < 1e-7);
  if (onLevel && la === 0) return [p[0], p[1] - (Math.sign(p[1]) * d * r) / Math.abs(p[1])];
  if (Math.abs(Math.abs(p[1]) - h) < 1e-7 || onLevel) return [p[0] - (Math.sign(p[0]) * d * r) / Math.abs(p[0]), p[1]];
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

// ---------- notched log solid ----------
const EASE_STEPS = 6; // steps in a rounded rim
// round the inner corners of a path [[x, y], ...] with the given radii (one for each inner corner): each becomes an arc
// of n steps that meets both of its sides smoothly. The path's two end points are dropped: they only give directions.
function filletPath(P, radii, n = 8) {
  const out = [];
  for (let i = 1; i < P.length - 1; i++) {
    const c = P[i], r = radii[i - 1], unit = (q) => { const v = [q[0] - c[0], q[1] - c[1]], m = Math.hypot(...v); return [v[0] / m, v[1] / m, m]; };
    const u = unit(P[i - 1]), v = unit(P[i + 1]);
    if (!(r > 0)) { out.push(c); continue; }
    const half = Math.acos(u[0] * v[0] + u[1] * v[1]) / 2, t = r / Math.tan(half), b = unit([c[0] + u[0] + v[0], c[1] + u[1] + v[1]]);
    const o = [c[0] + (b[0] * r) / Math.sin(half), c[1] + (b[1] * r) / Math.sin(half)]; // the arc's centre
    const a0 = Math.atan2(c[1] + u[1] * t - o[1], c[0] + u[0] * t - o[0]);
    let da = Math.atan2(c[1] + v[1] * t - o[1], c[0] + v[0] * t - o[0]) - a0;
    da -= TAU * Math.round(da / TAU);
    for (let k = 0; k <= n; k++) out.push(k === 0 ? [c[0] + u[0] * t, c[1] + u[1] * t] : k === n ? [c[0] + v[0] * t, c[1] + v[1] * t] : [o[0] + r * Math.cos(a0 + (da * k) / n), o[1] + r * Math.sin(a0 + (da * k) / n)]);
  }
  return out;
}
// base: CCW cross-section (y, z) already containing exact vertices on z = +/-h.
// tex (optional): { grain, rings: [end at 0, end at L], smooth(p) } from texFor
// pivotZ: the section shrinks towards (0, pivotZ) at chamfered ends (a base log passes -h so its bottom stays flat)
// joints (optional): [end at 0, end at L], each null or a dovetail splice that replaces the plain end. Both are cut
// straight across the log (along y), so the joint has the same outline all the way through and prints as upright walls:
//   { type: 'tongue', len, prof, ease }  a tail sticks out len. prof = [[d, g], ...]: its half-height g at distance d
//                                        from the shoulder (d from 0 to len), corners already rounded
//   { type: 'groove', len, prof, ease }  a socket len deep between two tines. prof = [[d, g], ...]: its half-height g
//                                        at distance d from the tips of the tines (d from 0 to len)
// ease (optional): radius that rounds the outer rim of the shoulder (tongue) or of the tine tips (groove), by lowering
// the crown of the log there. The side flats are not moved, so the piece still lies flat on the bed.
// base must then also contain exact vertices on z = +/-g for the first g of a tail's prof, and for the first, the
// last and the smallest g of a socket's prof.
// foot (optional, on a socket with axis 1): { bed, zIn, zOut, ramp } brings the underside of the tines down onto the bed
// plane y = bed, so that they do not start printing in mid air (see feet below).
// axis (optional, on a joint): 1 = as above, the default. 0 = the joint is cut straight down through the log instead
// (along z), for a part that prints on its flat bottom: read y for z above, and the two pieces go together from above.
function logMesh({ L, centers, base, notchW, top = true, bottom = true, chamfer = null, tex = null, pivotZ = 0, joints = [null, null] }) {
  const idx = base.map((_, i) => i);
  const slice = (g, ax = 1) => idx.filter((i) => Math.abs(base[i][ax]) <= g + EPS);                     // what is left between two cuts
  const caps = (g, t = true, b = true, ax = 1) => [...(t ? [arc(idx, (i) => base[i][ax] >= g - EPS)] : []), ...(b ? [arc(idx, (i) => base[i][ax] <= -g + EPS)] : [])];
  // each kind of span: the loops of section vertices that are solid in it, and the loops that are cut away
  const full = { solid: [idx], cut: [] };
  const notch = { solid: [idx.filter((i) => (!top || base[i][1] <= h + EPS) && (!bottom || base[i][1] >= -h - EPS))], cut: caps(h, top, bottom) };
  const gs = (j) => j.prof.map((q) => q[1]);
  const jointKind = (j) => { const ax = j.axis ?? 1; return j.type === 'tongue' ? { solid: [slice(gs(j)[0], ax)], cut: caps(gs(j)[0], true, true, ax), tail: true, ax } : { solid: caps(Math.min(...gs(j)), true, true, ax), cut: [slice(gs(j).at(-1), ax)], socket: true, ax }; };
  // rounded rims: within r of the plane x = at, every vertex beyond the level zc sinks towards it, the outermost by most
  const eases = [];
  // feet: under a socket cut across a log that lies on a side flat, the tines' inner edges would start in mid air,
  // because the socket is wider than the flat. From x0 to x1 the underside of the log comes down onto the bed plane
  // out to zIn each side of the axis, then rises back to the log's own outline by zOut; past x1 it fades out over ramp.
  const feet = [];
  const footed = (x, q) => {
    for (const { x0, x1, ramp, bed, zIn, zOut } of feet) {
      const wx = x < x0 - ramp || x > x1 + ramp ? 0 : x < x0 ? (x - (x0 - ramp)) / ramp : x > x1 ? (x1 + ramp - x) / ramp : 1, a = Math.abs(q[1]);
      if (wx > 0 && q[0] < 0 && a < zOut) { const w = wx * (a <= zIn ? 1 : (zOut - a) / (zOut - zIn)); return [bed + (q[0] - bed) * (1 - w), q[1]]; }
    }
    return q;
  };
  const eased = (x, q0) => {
    const q = footed(x, q0);
    for (const { at, r, zc, ax, top } of eases) {
      const d = Math.abs(x - at), a = Math.abs(q[ax]);
      if (d < r && a > zc) { const o = [...q]; o[ax] = Math.sign(q[ax]) * (a - (r - Math.sqrt(r * r - (r - d) * (r - d))) * ((a - zc) / (top - zc))); return o; }
    }
    return q;
  };
  // a tine at a point where the socket is g high: the vertices of its loop that the socket has cut away move to where
  // the cut crosses the log's outline (loops run CCW, so those vertices are at the two ends of the loop)
  const trim = (S, loop, g, ax) => {
    const sg = Math.sign(base[loop[Math.floor(loop.length / 2)]][ax]), zb = (i) => sg * base[i][ax], kept = (i) => zb(i) >= g - EPS;
    const k0 = loop.findIndex(kept), k1 = loop.length - 1 - [...loop].reverse().findIndex(kept);
    const cross = (i, o) => { const t = (g - zb(i)) / (zb(o) - zb(i)); return t > 1 - 1e-9 ? S[o] : S[i].map((v, k) => v + t * (S[o][k] - v)); };
    const a = k0 > 0 ? cross(loop[k0 - 1], loop[k0]) : null, b = k1 < loop.length - 1 ? cross(loop[k1 + 1], loop[k1]) : null;
    loop.forEach((i, k) => { if (k < k0) S[i] = a; else if (k > k1) S[i] = b; });
  };
  const T = [];
  // s: the section's scale (in z only for a tail, which widens towards its tip), or for a socket its half-height there
  const section = (x, s, kind) => {
    if (kind.socket) { const S = base.map((p) => { const q = eased(x, displace(p, x, tex)); return [x, q[0], q[1]]; }); for (const loop of kind.solid) trim(S, loop, s, kind.ax); return S; }
    if (kind.tail) return base.map((p) => { const q = [...eased(x, displace(p, x, tex))]; q[kind.ax] *= s; return [x, q[0], q[1]]; }); // a tail narrows across its cut only
    return base.map((p) => { const q = eased(x, displace(p, x, tex)); return [x, q[0] * s, s === 1 ? q[1] : pivotZ + (q[1] - pivotZ) * s]; });
  };
  const same = (p, q) => p === q || (p[0] === q[0] && p[1] === q[1] && p[2] === q[2]);
  const tri = (a, b, c) => { if (!same(a, b) && !same(b, c) && !same(a, c)) T.push([a, b, c]); }; // trimmed tine vertices coincide
  const skin = (A, B, sel) => { const n = sel.length; for (let i = 0; i < n; i++) { const u = sel[i], v = sel[(i + 1) % n]; tri(A[u], A[v], B[v]); tri(A[u], B[v], B[u]); } };
  const face = (S, loop, flip) => { // flat face across the section: a notch wall, a joint shoulder or a joint tip
    const pts = loop.map((i) => S[i]).filter((p, k, a) => !same(p, a[(k + a.length - 1) % a.length])); // trimmed tine vertices coincide
    if (pts.length < 3) return;
    for (const [a, b, c] of earClip(pts.map((p) => [p[1], p[2]]))) T.push(flip ? [pts[c], pts[b], pts[a]] : [pts[a], pts[b], pts[c]]);
  };
  // spans along x: [x from, scale from, x to, scale to, kind]
  const spans = [], st = chamfer ?? [[0, 1]]; // chamfer: [[dx, scale], ...] from the end inwards, last scale = 1
  const [j0, j1] = joints;
  // a joint's spans, one for each step of its profile. xOf: distance along the profile -> x; inner: x of its inner end
  const jointSpans = (j, end, inner) => {
    const kind = jointKind(j), tongue = j.type === 'tongue', g0 = gs(j)[0];
    const xOf = (d) => (tongue ? inner + (end ? d : -d) : end ? L - d : d);
    const pts = j.prof.map(([d, g]) => [xOf(d), tongue ? g / g0 : g]).sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < pts.length - 1; k++) spans.push([...pts[k], ...pts[k + 1], kind]);
    if (j.ease) {
      if (!tongue && j.prof.some(([d, g]) => d < j.ease && g > g0 + EPS)) throw new Error('socket widens inside its rounded rim');
      eases.push({ at: xOf(0), r: j.ease, zc: g0, dir: end ? -1 : 1, ax: kind.ax, top: Math.max(...base.map((p) => Math.abs(p[kind.ax]))) });
    }
    if (j.foot && !tongue) feet.push({ x0: Math.min(xOf(0), xOf(j.len)), x1: Math.max(xOf(0), xOf(j.len)), ...j.foot });
  };
  let x0, x1;
  if (j0) { jointSpans(j0, 0, j0.len); x0 = j0.len; }
  else { for (let k = 0; k < st.length - 1; k++) spans.push([st[k][0], st[k][1], st[k + 1][0], st[k + 1][1], full]); x0 = st[st.length - 1][0]; }
  x1 = L - (j1 ? j1.len : st[st.length - 1][0]);
  const bounds = [x0];
  for (const c of centers) bounds.push(c - notchW / 2, c + notchW / 2);
  bounds.push(x1);
  for (let i = 0; i < bounds.length - 1; i++) spans.push([bounds[i], 1, bounds[i + 1], 1, i % 2 === 1 ? notch : full]);
  if (j1) jointSpans(j1, 1, x1);
  else for (let k = st.length - 2; k >= 0; k--) spans.push([L - st[k + 1][0], st[k + 1][1], L - st[k][0], st[k][1], full]);
  const cutSpans = (x) => {
    const i = spans.findIndex((sp) => sp[0] < x - 1e-6 && x < sp[2] - 1e-6);
    if (i < 0) return;
    const [xa, sa, xb, sb, kind] = spans[i], sx = sa + ((x - xa) / (xb - xa)) * (sb - sa);
    spans.splice(i, 1, [xa, sa, x, sx, kind], [x, sx, xb, sb, kind]);
  };
  // a rounded rim is a quarter circle: cut the spans it runs through into short steps
  for (const { at, r, dir } of eases) for (let k = 1; k <= EASE_STEPS; k++) cutSpans(at + dir * r * (1 - Math.cos((k * Math.PI) / 2 / EASE_STEPS)));
  for (const { x0, x1, ramp } of feet) { cutSpans(x0 - ramp); cutSpans(x1 + ramp); } // a foot fades out in a straight line
  let last = null, prev = null;
  spans.forEach(([xa, sa, xb, sb, kind], si) => {
    const n = tex ? Math.max(1, Math.ceil((xb - xa) / TEX.step)) : 1;
    let A = section(xa, sa, kind);
    if (si === 0) { if (j0) for (const loop of kind.solid) face(A, loop, true); else endCap(T, A.map((p) => [p[1], p[2]]), () => xa, 1, true, tex?.rings[0]); }
    else if (prev !== kind) { for (const loop of kind.cut) face(A, loop, false); for (const loop of prev.cut) face(A, loop, true); } // step between two kinds of span
    for (let k = 1; k <= n; k++) {
      const B = k === n ? section(xb, sb, kind) : section(xa + ((xb - xa) * k) / n, sa + ((sb - sa) * k) / n, kind);
      for (const loop of kind.solid) skin(A, B, loop);
      A = B;
    }
    last = A; prev = kind;
  });
  if (j1) for (const loop of prev.solid) face(last, loop, false);
  else endCap(T, last.map((p) => [p[1], p[2]]), () => L, -1, false, tex?.rings[1]);
  return T;
}
// log with one end cut on a slant (top edge longest)
// chamfer (optional): rounds the square end only, as logMesh does; the slanted end is left as cut
function bevelMesh({ Ltop, base, phi, tex = null, chamfer = null }) {
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
  endCap(T, A.map((p) => [p[1], p[2]]), () => 0, 1, true, tex?.rings[0]);
  for (let j = 1; j < rows.length; j++) {
    const B = rows[j];
    for (let i = 0; i < n; i++) { const k = (i + 1) % n; T.push([A[i], A[k], B[k]], [A[i], B[k], B[i]]); }
    A = B;
  }
  endCap(T, end.map((p) => [p[1], p[2]]), (y, z) => xe(z), -1, false, tex?.rings[1]);
  return T;
}

// ---------- the part catalogue ----------
// Rounded ends (taken from the old 4 3/4 in "beveled end" log): [distance in from the end (mm), section scale]
export const ROUNDED_ENDS = [[0, 0.6], [1.5, 0.82], [3.5, 0.95], [5, 1]];
// set: 'standard' (every part: the 10 logs, smooth or wood grain, and the roof parts), or one of two logs-only sets
// with the same 10 logs: 'rounded' (round, with rounded ends) or 'octagonal' (octagonal section, flat ends)
export function makeParts({ clearance = 0.2, flat = 0.8, texture = true, set = 'standard', spliceClearance = 0.05, spliceRound = 0.8 } = {}) {
  const oct = set === 'octagonal', ball = set === 'rounded';
  const ends = ball ? ROUNDED_ENDS : null; // chamfer profile for every log end
  // Every part that sits in a notch is MATE wide there: the round logs are, because of their flats, and the
  // octagonal log, base logs and gables are trimmed to match. The notch is that width plus the clearance on each side.
  // `flat` is the total width taken off the log, split into an equal flat on each side: the bed side and the side
  // opposite it, so the log lies on the bed the same way it would stand on the other flat.
  // (Fit-tested in PLA: an 18.65 mm notch round an 18.25 mm log, 0.2 mm per side, seats fully with slight play.)
  const MATE = D - flat, notchW = MATE + 2 * clearance;
  const yf = -R + flat / 2, yTop = R - flat / 2; // the two flats, in the section frame (bed flat at yf)
  const yShift = 0; // the flats are symmetric about the log's axis, so nothing to shift
  const withCuts = (P) => insertLine(insertLine(P, 1, h), 1, -h);
  const bothFlats = (P) => clipPoly(clipPoly(P, 0, yf, true), 0, yTop, false);
  const NC = 144; // facets round a log: 0.4 mm apart, with vertices exactly on the notch-floor lines (30 deg)
  const onFlat = (a, b) => (a[0] <= yf + 1e-6 && b[0] <= yf + 1e-6) || (a[0] >= yTop - 1e-6 && b[0] >= yTop - 1e-6), onBottom = (a, b) => a[1] <= -h + 1e-6 && b[1] <= -h + 1e-6;
  const roundBase = subdivide(withCuts(bothFlats(circle(NC, R))), onFlat);       // round log with an equal flat on each side
  const octBase = subdivide(withCuts(bothFlats(octagon(D))), () => true);       // flats top, bottom and sides; the two side flats are cut to the same depth as the round logs' flats
  // the octagonal set uses octBase for every log; its base logs are the same octagon cut at the bottom-notch floor
  const halfBase = oct ? subdivide(insertLine(clipPoly(bothFlats(octagon(D)), 1, -h, true), 1, h), () => true)
    : subdivide(insertLine(clipPoly(bothFlats(circle(NC, R)), 1, -h, true), 1, h), (a, b) => onBottom(a, b) || onFlat(a, b)); // flat bottom at the bottom-notch floor; equal side flats like the round logs, so it fits a notch
  // wood texture: grain on the outside, rings on the ends; the face on the print bed stays smooth
  const tex = (name, smooth) => (texture ? texFor(name, smooth) : null);
  const sideFlat = (p) => p[0] <= yf + 1e-6 || p[0] >= yTop - 1e-6;
  const roundSmooth = sideFlat, octSmooth = roundSmooth, halfSmooth = (p) => p[1] <= -h + 1e-6 || sideFlat(p);
  const logBase = oct ? octBase : roundBase, logSmooth = oct ? octSmooth : roundSmooth;
  // the logs-only sets reuse the standard names with a suffix; info.replaces names the standard part each stands in for
  const sfx = oct ? '_oct' : ball ? '_rounded' : '';
  const O = oct ? ' (octagonal)' : ball ? ' (rounded ends)' : '';
  const centersFor = (L, n) => Array.from({ length: n }, (_, k) => L / 2 + (k - (n - 1) / 2) * CENTERS);
  const parts = {};
  const add = (name, info, model, toPrint) => { parts[name] = { name, info, model, print: model.map((t) => t.map(toPrint)) }; };
  const centred = (m) => m.map((t) => t.map(([x, y, z]) => [x, y + yShift, z]));  // section frame -> model frame
  const yBed = yf + yShift;                                                      // the printing flat, in the model frame
  const logPrint = ([x, y, z]) => [x, -z, y - yBed];                             // lie on the side flat, notches sideways
  const logModelFromPrint = ([X, Y, Z]) => [X, Z + yBed, -Y];

  const log = (std, listing, Lin, n, opts = {}) => {
    const name = opts.name ?? std + sfx, L = Lin * IN, centers = centersFor(L, n);
    add(name, { listing: listing + O, length: L, centers, kind: 'log', note: opts.note, replaces: [std] }, centred(logMesh({ L, centers, base: logBase, notchW, chamfer: ends, tex: tex(name, logSmooth) })), logPrint);
    parts[name].toModel = logModelFromPrint;
  };
  log('log_1insert_1-5_8', '1 Insert Log, 1 5/8', 1.625, 1);
  // in the octagonal set this one is octagonal too, so "round" is dropped from its name
  log('log_1insert_1-1_2_round', '1 Insert Log (Round), 1 1/2', 1.5, 1, oct ? { name: 'log_1insert_1-1_2_oct' } : {});
  // dropped: the listing's 1 1/2 in "hex" log, the same size as the round one (in the octagonal set, the same shape)
  log('log_2insert_4-1_2', '2 Insert Log, 4 1/2', 4.5, 2);
  log('log_3insert_7-5_8', '3 Insert Log, 7 3/4', 7.625, 3, { note: 'sheet says 7 3/4; photo measures about 7.6 and the length rule (3 in centres, 7/16 in shoulders, PARTS_SPEC.md) gives 7 5/8' });
  log('log_4insert_10-5_8', '4 Insert Log, 10 5/8', 10.625, 4);

  // ---- the longest log in two pieces, for beds shorter than 270 mm. The pieces meet halfway between the two middle
  // notches in a dovetail splice: a tail on one piece, wider at its tip than at its neck, slides sideways into a
  // matching socket in the end of the other. It is the dovetail of a hewn-log cabin corner, turned to join two logs
  // end to end, and from outside the wall it shows as a dovetail on the face of the log.
  // The joint is cut straight through from one printing flat to the other, so on the bed (logs lie on a flat) every
  // face of it is an upright wall: no overhangs, no supports. In the wall the tines above and below the tail keep the
  // two pieces level and the dovetail stops them pulling apart.
  // A middle piece with a socket at one end and a tail at the other extends the log by 3 in per notch.
  // The fit is a press fit, so a row of joined pieces stays straight when it is picked up. The joint bears on two
  // pairs of faces only: the sloping sides of the tail against the sides of the socket, and the tips of the tines
  // against the other piece's shoulder. The shoulders meet with no gap; they are what stops the joint hinging. The
  // tail's sides are spliceClearance inside the socket's (0.05 mm: printed PLA closes that up). The tail's tip stops
  // SPLICE.relief short of the socket's floor, so it can never hold the shoulders apart.
  // (Printed in PLA with 0.3 mm on every face and a 1 in 4 slope, a row of five pieces sagged: each joint could open
  // 1.2 mm endways before the dovetail took up.)
  // len: the socket's depth; neck: the socket's height at the shoulder line; slope: how fast it widens (2 in 5, 22
  // deg). The steeper the sides, the less endways play a given gap leaves: gap / slope.
  // The socket is wider than the printing flat, so each tine gets a foot that brings its inner edge down onto the bed
  // (printed without one, the tines of the round logs came out ragged along that edge).
  const SPLICE = { len: IN / 4, neck: 4.2, slope: 2 / 5, relief: 0.2 };
  const spliceBase = (base, levels, axis = 1) => levels.reduce((P, g) => insertLine(insertLine(P, axis, g), axis, -g), base);
  {
    const std = 'log_4insert_10-5_8', L = 10.625 * IN, all = centersFor(L, 4), xs = L / 2 - SPLICE.len / 2; // xs: the shoulder line on the whole log
    const lt = SPLICE.len - SPLICE.relief;                      // the tail's length: it stops short of the socket's floor
    const socketAt = (d) => SPLICE.neck / 2 + d * SPLICE.slope; // socket half-height, d from the shoulder line
    const root = socketAt(0) - spliceClearance, tip = socketAt(lt) - spliceClearance, mouth = socketAt(0), floor = socketAt(SPLICE.len);
    if (floor >= h) throw new Error('splice socket is deeper than the notches: the tines would be too thin');
    // Every edge of the joint is rounded, as the corners of a hewn log are, and so nothing sharp is left for small
    // hands. The inside corners (the socket's floor, the tail's neck) get the radius spliceRound. The edges that stick
    // out (the tail's tip, the tips of the tines) get a little more, so each stands clear of the corner it fits into
    // and the joint closes on its flat faces, not on its corners. The rims where the shoulder and the tines meet the
    // outside of the log are rounded too.
    const rIn = spliceRound, rOut = rIn > 0 ? rIn + SPLICE.relief : 0, far = 4 * h;
    const tailProf = filletPath([[0, far], [0, root], [lt, tip], [lt, -far]], [rIn, rOut]);                     // from the shoulder to the tip
    const socketProf = filletPath([[0, far], [0, mouth], [SPLICE.len, floor], [SPLICE.len, -far]], [rOut, rIn]); // from the tine tips to the floor
    for (const [prof, len] of [[tailProf, lt], [socketProf, SPLICE.len]]) {
      if (prof.some((q, k) => k && q[0] < prof[k - 1][0] - 1e-9) || prof.at(-1)[1] <= 0) throw new Error('splice-round is too large for the dovetail');
      prof[0][0] = 0; prof.at(-1)[0] = len;
    }
    const gTail = tailProf.map((q) => q[1]), gSocket = socketProf.map((q) => q[1]);
    // flatBottom: the same piece as a base log, for the base course. It prints on its flat bottom, so its dovetail is
    // cut straight down through the log instead of across it: the same outline, seen from above. Every face of the
    // joint is again an upright wall on the bed, and the two pieces go together from above, not from the side.
    const piece = (base_, type, listing, note, x0, Lp, centers, joints, levels, flatBottom = false) => {
      const name = `${base_}${sfx}`, t = tex(name, flatBottom ? halfSmooth : logSmooth), axis = flatBottom ? 0 : 1;
      if (t) { t.levels = levels; t.levelAxis = axis; }
      const info = { listing: `${listing}${O}`, length: Lp, centers, kind: flatBottom ? 'half' : 'log', splice: { type, of: std, x0, len: SPLICE.len, tailLen: lt, round: rIn, tail: tailProf, socket: socketProf, axis }, note };
      // lying on a side flat, the tines get a foot: without one their inner edges start above the bed (see logMesh)
      joints = joints.map((j) => j && { ...j, axis, ...(j.type === 'groove' && !flatBottom ? { foot: { bed: yf, zIn: floor + 0.4, zOut: floor + 1.6, ramp: 1.5 } } : {}) });
      if (flatBottom) {
        add(name, info, centred(logMesh({ L: Lp, centers, base: spliceBase(halfBase, levels, 0), notchW, bottom: false, chamfer: ends, pivotZ: -h, joints, tex: t })), ([x, y, z]) => [x, y - yShift, z + h]);
        parts[name].toModel = ([X, Y, Z]) => [X, Y + yShift, Z - h];
        return;
      }
      add(name, info, centred(logMesh({ L: Lp, centers, base: spliceBase(logBase, levels), notchW, chamfer: ends, joints, tex: t })), logPrint);
      parts[name].toModel = logModelFromPrint;
    };
    // tongue piece: the whole log's 0 .. L/2 - len/2 (its shoulder) plus the tail; groove piece: L/2 - len/2 .. L
    const halfNote = `half of the two-piece ${std}; the pair replaces one whole log`;
    const tail = { type: 'tongue', len: lt, prof: tailProf, ease: rIn }, socket = { type: 'groove', len: SPLICE.len, prof: socketProf, ease: rIn };
    const tailLevels = [gTail[0]], socketLevels = [...new Set([gSocket[0], Math.min(...gSocket), gSocket.at(-1)])];
    const extL = CENTERS + lt, extCentres = [SPLICE.len / 2 + CENTERS / 2];
    piece(`${std}_split_tongue`, 'tongue', '4 Insert Log, 10 5/8: tongue half', halfNote, 0, xs + lt, all.slice(0, 2), [null, tail], tailLevels);
    piece(`${std}_split_groove`, 'groove', '4 Insert Log, 10 5/8: groove half', halfNote, xs, L - xs, all.slice(2).map((c) => c - xs), [socket, null], socketLevels);
    // extender: goes between the two halves (socket towards the tongue half, tail towards the groove half) and adds one
    // notch and 3 in, so the notches stay on 3 in centres. Several can be chained. Not in the reference lot.
    // In its own frame x = 0 is the tips of its tines, on the shoulder line of the piece before it.
    piece('log_extender_1insert_3', 'extender', 'Extender for the two-piece log, 1 insert, 3', 'goes between the two halves of the two-piece log; each one adds a notch and 3 in',
      xs, extL, extCentres, [socket, tail], [...new Set([...socketLevels, ...tailLevels])]);
    // the same three pieces as base logs: flat underneath, notches on top only, the same lengths and notch places.
    // Not in the reference lot either, which has no base log this long.
    const baseNote = 'flat underneath, for the base course; joins only with the other flat-bottomed pieces';
    piece('base_log_10-5_8_split_tongue', 'tongue', 'Base Log, 10 5/8: tongue half', baseNote, 0, xs + lt, all.slice(0, 2), [null, tail], tailLevels, true);
    piece('base_log_10-5_8_split_groove', 'groove', 'Base Log, 10 5/8: groove half', baseNote, xs, L - xs, all.slice(2).map((c) => c - xs), [socket, null], socketLevels, true);
    piece('base_log_extender_1insert_3', 'extender', 'Extender for the two-piece base log, 1 insert, 3', 'flat underneath; goes between the two halves of the two-piece base log',
      xs, extL, extCentres, [socket, tail], [...new Set([...socketLevels, ...tailLevels])], true);
  }

  const half = (std, listing, Lin, n) => {
    const name = std + sfx, L = Lin * IN, centers = centersFor(L, n);
    // rounded ends shrink towards the bottom, so the flat side stays flat on the bed
    add(name, { listing: listing + O, length: L, centers, kind: 'half', replaces: [std] }, centred(logMesh({ L, centers, base: halfBase, notchW, bottom: false, chamfer: ends, pivotZ: -h, tex: tex(name, halfSmooth) })), ([x, y, z]) => [x, y - yShift, z + h]);
    parts[name].toModel = ([X, Y, Z]) => [X, Y + yShift, Z - h];
  };
  half('base_log_4-1_2', 'Base Log, 4 1/2', 4.5, 2);
  half('base_log_7-1_2', 'Base Log, 7 1/2', 7.5, 3);

  // short log with one end cut at the roof angle of the wooden triangle (about 39 deg in the photos)
  const bev = 'beveled_end_1-1_2' + sfx; // the square end is the one rounded in the rounded set
  add(bev, { listing: 'Beveled End, 1 1/2 x 1 1/4' + O, kind: 'bevel', replaces: ['beveled_end_1-1_2'], note: 'top edge 1 1/2 in, end cut at 39 deg; the listed "1 1/4" is not explained by the photos' },
    centred(bevelMesh({ Ltop: 1.5 * IN, base: logBase, phi: (39 * Math.PI) / 180, chamfer: ends, tex: tex(bev, logSmooth) })), logPrint);
  parts[bev].toModel = logModelFromPrint;

  // solid logs stand on end and sit in no notch, so they keep the full section: no side flats
  const solidBase = oct ? subdivide(octagon(D), () => true) : circle(NC, R);
  for (const [std, Lin, listing] of [['solid_log_1-3_8', 1.375, 'Solid Log, 1 3/8'], ['solid_log_1-5_8', 1.625, 'Solid Log, 1 5/8']]) {
    // a plain cylinder (or octagonal prism) standing on end: built along x like the other logs, then stood up
    const name = std + sfx;
    const m = logMesh({ L: Lin * IN, centers: [], base: solidBase, notchW, top: false, bottom: false, chamfer: ends, tex: tex(name, null) }).map((t) => t.map(([x, y, z]) => [y + R, z + R, x]));
    add(name, { listing: listing + O, kind: 'solid', replaces: [std] }, m, (p) => p);
    parts[name].toModel = (p) => p;
  }
  if (oct || ball) return parts; // logs-only sets: the gables, shingles, chimney and dazzlers are shared

  // ---- gables: profile in XY, thickness T along Z in the print frame; model = (X, T/2 - Z, Y)
  const T = MATE; // as wide as a log is where it sits in a notch, so a gable fills the crossing log's notch slot the way a log does (thickness not visible in photos)
  const gableAdd = (name, info, poly) => {
    add(name, info, extrudeShell(poly, 0, T).map((t) => t.map(([X, Y, Z]) => [X, T / 2 - Z, Y])), ([x, y, z]) => [x, z, T / 2 - y]);
    parts[name].toModel = ([X, Y, Z]) => [X, T / 2 - Z, Y];
    parts[name].print = extrudeShell(poly, 0, T);
  };
  const nw = notchW, nd = NOTCH_D;
  // Shingles: 1/8 in thick. A flat shingle is 18.5 mm wide (0.73 in), so that six lie edge to edge between the eave lip
  // and the peak of the large gable and four on the small one. (The listing photo measured 0.79 to 0.8 in, but six that
  // wide would be 7 mm longer than the gable's slope.)
  const tS = IN / 8, wFlat = 18.5, wRidge = 1.125 * IN;
  // Orange (or red) plastic gables: mirror-symmetric, flat bottom with notches on 3 in centres, stepped slopes, hooked
  // eave lips. The large one is measured from the listing photo; the small one from a second photo of several gables,
  // which shows it with two notches and the same step shape. Both share e0, lip and riser sizes.
  // Steps: one per flat shingle, as on the 1974 Frontiersman set, whose box shows six shingles on each slope of the
  // large gable lying edge to edge in one plane; close-ups of the gables show six steps a side on the large one and
  // four on the small. Each tread is as long as a shingle is wide (plus `seat`), and the riser between treads is much
  // lower than a shingle is thick, so neighbouring shingles butt edge to edge and the lowest one butts the eave lip.
  // The lip's inner face leans back square to the first tread, so the shingle's edge meets it face to face.
  const e0 = 7.5, lipT = 5.4, lipH = 3.6, rr = 0.8;
  const plasticGable = (name, info, W, n, notchOffsets, Hfixed, treadLen) => {
    const half_ = W / 2, ph = (half_ - lipT) / n;
    // tread rise: from the listed height for the large gable; for the small one, whatever makes its treads as long as the large one's
    const tr = Hfixed ? (Hfixed - e0 - (n - 1) * rr) / n : Math.sqrt(treadLen ** 2 - ph ** 2);
    const H = e0 + n * tr + (n - 1) * rr, len = Math.hypot(ph, tr);
    if (len < wFlat + 0.1) throw new Error(`${name}: a ${wFlat} mm shingle does not fit its ${len.toFixed(2)} mm steps`);
    const Lp = [[0, e0 + lipH], [lipT - (lipH * tr) / ph, e0 + lipH], [lipT, e0]], treads = [];
    for (let k = 0; k < n; k++) { const x = lipT + k * ph, y = e0 + k * (tr + rr); treads.push([[x, y], [x + ph, y + tr]]); Lp.push([x + ph, y + tr]); if (k < n - 1) Lp.push([x + ph, y + tr + rr]); }
    const bottom = [[0, 0]];
    for (const o of notchOffsets) { const cx = half_ + o; bottom.push([cx - nw / 2, 0], [cx - nw / 2, nd], [cx + nw / 2, nd], [cx + nw / 2, 0]); }
    bottom.push([W, 0]);
    const poly = [...bottom, ...Lp.map((p) => [W - p[0], p[1]]), ...Lp.slice(0, -1).reverse()];
    // th: the angle a shingle lies at (the tread's); treads: each tread's lower and upper end, left slope, eave to peak
    gableAdd(name, { ...info, kind: 'gable', W, H, T, steps: n, notchXs: notchOffsets.map((o) => half_ + o), th: Math.atan2(tr, ph), treads, treadLen: len, riser: rr, profile: Lp, startX: lipT }, poly);
    return { slope: tr / ph, len };
  };
  const large = plasticGable('gable_plastic_8-1_2', { listing: 'Plastic Orange Roof, 2 1/4 x 8 1/2', source: 'listing' }, 8.5 * IN, 6, [-CENTERS, 0, CENTERS], 2.25 * IN);
  const plasticSlope = large.slope;
  plasticGable('gable_plastic_small_2notch', { listing: 'Small plastic gable, 2 notches (from a second photo; about 5.8 x 1.6)', source: 'gable photo' }, 5.8 * IN, 4, [-CENTERS / 2, CENTERS / 2], null, large.len);
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

  // ---- shingles (sizes are set above, with the gables)
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
  // the ridge. The V's sides are cut at the angle the shingles lie at on the plastic gables (24 deg; photo: about 27 deg).
  // Model frame: width along x centred on 0, depth along y centred on 0, V apex... bottom prong tips at z = 0.
  {
    const Wc = 1.375 * IN, Dc = 1.0 * IN, Hc = 1.2 * IN, wall = 0.12 * IN, pocket = 0.5 * IN;
    const Vd = (Wc / 2) * plasticSlope;                 // V depth so its sides match the shingles' slope (photo: about 0.36 in)
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

  // ---- dazzlers: the door, the window and the other dress-up parts of my own design (dazzlers.mjs)
  addDazzlers(parts, { MATE, notchW, clearance, chimney: { ...parts.chimney.info, wall: 0.12 * IN, pocket: 0.5 * IN } });
  return parts;
}
