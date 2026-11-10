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

// ---------- notched log solid ----------
// base: CCW cross-section (y, z) already containing exact vertices on z = +/-h.
function logMesh({ L, centers, base, notchW, top = true, bottom = true, chamfer = null }) {
  const notched = base.filter((p) => (!top || p[1] <= h + EPS) && (!bottom || p[1] >= -h - EPS));
  const caps = [];
  if (top) caps.push(arc(base, (p) => p[1] >= h - EPS));
  if (bottom) caps.push(arc(base, (p) => p[1] <= -h + EPS));
  const T = [], V = (x, [y, z]) => [x, y, z];
  const seg = (x0, x1, A, B) => { const n = A.length; for (let i = 0; i < n; i++) { const j = (i + 1) % n; const a = V(x0, A[i]), b = V(x0, A[j]), c = V(x1, B[j]), d = V(x1, B[i]); T.push([a, b, c], [a, c, d]); } };
  const fan = (x, P, flip) => { const p = flip ? [...P].reverse() : P; for (let i = 1; i < p.length - 1; i++) T.push([V(x, p[0]), V(x, p[i]), V(x, p[i + 1])]); };
  const scaled = (s) => base.map(([y, z]) => [y * s, z * s]);
  let x0 = 0, x1 = L;
  if (chamfer) {
    const st = chamfer; // [[dx, scale], ...] from the end inwards, last scale = 1
    fan(0, scaled(st[0][1]), true); fan(L, scaled(st[0][1]), false);
    for (let k = 0; k < st.length - 1; k++) {
      seg(st[k][0], st[k + 1][0], scaled(st[k][1]), scaled(st[k + 1][1]));
      seg(L - st[k + 1][0], L - st[k][0], scaled(st[k + 1][1]), scaled(st[k][1]));
    }
    x0 = st[st.length - 1][0]; x1 = L - x0;
  } else { fan(0, base, true); fan(L, base, false); }
  const bounds = [x0];
  for (const c of centers) bounds.push(c - notchW / 2, c + notchW / 2);
  bounds.push(x1);
  for (let i = 0; i < bounds.length - 1; i++) {
    const isNotch = i % 2 === 1;
    seg(bounds[i], bounds[i + 1], isNotch ? notched : base, isNotch ? notched : base);
    if (i > 0) for (const cap of caps) fan(bounds[i], cap, !isNotch);
  }
  return T;
}
// log with one end cut on a slant (top edge longest)
function bevelMesh({ Ltop, base, phi }) {
  const zmax = Math.max(...base.map((p) => p[1]));
  const xe = (p) => Ltop - (zmax - p[1]) / Math.tan(phi);
  const T = [], n = base.length;
  for (let i = 0; i < n; i++) {
    const p = base[i], q = base[(i + 1) % n];
    const a = [0, ...p], b = [0, ...q], c = [xe(q), ...q], d = [xe(p), ...p];
    T.push([a, b, c], [a, c, d]);
  }
  const rev = [...base].reverse();
  for (let i = 1; i < n - 1; i++) T.push([[0, ...rev[0]], [0, ...rev[i]], [0, ...rev[i + 1]]]);
  for (let i = 1; i < n - 1; i++) T.push([[xe(base[0]), ...base[0]], [xe(base[i]), ...base[i]], [xe(base[i + 1]), ...base[i + 1]]]);
  return T;
}

// ---------- the part catalogue ----------
export function makeParts({ clearance = 0.2, flat = 0.8 } = {}) {
  const notchW = D + 2 * clearance;
  const yf = -R + flat;
  const withCuts = (P) => insertLine(insertLine(P, 1, h), 1, -h);
  const roundBase = withCuts(clipPoly(circle(96, R), 0, yf, true));      // round log with a printing flat on one side
  const octBase = withCuts(octagon(D));                                  // flats top, bottom and sides
  const halfBase = insertLine(clipPoly(circle(96, R), 1, -h, true), 1, h); // flat bottom at the bottom-notch floor
  const centersFor = (L, n) => Array.from({ length: n }, (_, k) => L / 2 + (k - (n - 1) / 2) * CENTERS);
  const parts = {};
  const add = (name, info, model, toPrint) => { parts[name] = { name, info, model, print: model.map((t) => t.map(toPrint)) }; };
  const logPrint = (yflat) => ([x, y, z]) => [x, -z, y - yflat];                 // lie on the side flat, notches sideways
  const logModelFromPrint = (yflat) => ([X, Y, Z]) => [X, Z + yflat, -Y];

  const log = (name, listing, Lin, n, opts = {}) => {
    const L = Lin * IN, centers = centersFor(L, n);
    const base = opts.oct ? octBase : roundBase, yflat = opts.oct ? -R : yf;
    add(name, { listing, length: L, centers, kind: 'log', note: opts.note }, logMesh({ L, centers, base, notchW, chamfer: opts.chamfer }), logPrint(yflat));
    parts[name].toModel = logModelFromPrint(yflat);
  };
  log('log_1insert_1-5_8', '1 Insert Log, 1 5/8', 1.625, 1);
  log('log_1insert_1-1_2_round', '1 Insert Log (Round), 1 1/2', 1.5, 1);
  log('log_1insert_1-1_2_octagonal', '1 Insert Log (Hex), 1 1/2', 1.5, 1, { oct: true, note: 'listed as hex; photo shows flats top and bottom, modelled as an octagon so it stacks' });
  log('log_2insert_4-1_2', '2 Insert Log, 4 1/2', 4.5, 2);
  log('log_2insert_6', '2 Insert Log, 6', 6, 2, { note: 'notch layout not visible in the photos; assumed 3 in centres, centred' });
  log('log_3insert_7-5_8', '3 Insert Log, 7 3/4', 7.625, 3, { note: 'sheet says 7 3/4; photo measures about 7.6 and the length rule (3 in centres, 7/16 in shoulders, PARTS_SPEC.md) gives 7 5/8' });
  log('log_4insert_10-5_8', '4 Insert Log, 10 5/8', 10.625, 4);
  log('beveled_end_4-3_4', 'Beveled End, 4 3/4', 4.75, 2, { chamfer: [[0, 0.6], [1.5, 0.82], [3.5, 0.95], [5, 1]], note: 'a 2-insert log with chamfered ends' });

  const half = (name, listing, Lin, n) => {
    const L = Lin * IN, centers = centersFor(L, n);
    add(name, { listing, length: L, centers, kind: 'half' }, logMesh({ L, centers, base: halfBase, notchW, bottom: false }), ([x, y, z]) => [x, y, z + h]);
    parts[name].toModel = ([X, Y, Z]) => [X, Y, Z - h];
  };
  half('half_log_4-1_2', 'Half Log, 4 1/2', 4.5, 2);
  half('half_log_7-1_2', 'Half Log, 7 1/2', 7.5, 3);

  // short log with one end cut at the roof angle of the wooden triangle (about 39 deg in the photos)
  add('beveled_end_1-1_2', { listing: 'Beveled End, 1 1/2 x 1 1/4', kind: 'bevel', note: 'top edge 1 1/2 in, end cut at 39 deg; the listed "1 1/4" is not explained by the photos' },
    bevelMesh({ Ltop: 1.5 * IN, base: roundBase, phi: (39 * Math.PI) / 180 }), logPrint(yf));
  parts['beveled_end_1-1_2'].toModel = logModelFromPrint(yf);

  for (const [name, Lin, listing] of [['solid_log_1-3_8', 1.375, 'Solid Log, 1 3/8'], ['solid_log_1-5_8', 1.625, 'Solid Log, 1 5/8']]) {
    const m = extrudeShell(circle(96, R).map(([x, y]) => [x + R, y + R]), 0, Lin * IN);
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
