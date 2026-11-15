// Dazzlers: the parts that dress a building up. None is a copy of an original part; all are designed for this project.
// They follow the same rules as the rest of the set:
//  - they fit the system (a log's notch, the 3 in notch spacing, the chimney, the roof ridge, a solid log's size)
//  - they print without supports. Most are flat shapes of different heights standing on the bed, so every wall is
//    upright; a part's thick layer is the one that fits the system, and its thin layers are the decoration.
// Called from makeParts() in parts.mjs. Print frame: outline in X/Y, heights along Z, resting on Z = 0.
// Model frame (pictures): upright, the outline's Y becomes height.
import { IN, D, R, NOTCH_D, CENTERS, extrudeShell } from './parts.mjs';

const TAU = 2 * Math.PI;
const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
// a clean counter-clockwise outline: repeated points dropped
const outline = (P) => {
  const out = P.filter((p, i) => { const q = P[(i + P.length - 1) % P.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
  return area2(out) < 0 ? out.reverse() : out;
};
const slab = (P, z0, z1) => extrudeShell(outline(P), z0, z1);
const shift = (P, dx, dy = 0) => P.map(([x, y]) => [x + dx, y + dy]);
const arcPts = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
// a flat bottom edge from x = 0 to W with a log notch at each centre, like the bottom of a gable
const notchedBottom = (W, centres, nw) => [[0, 0], ...centres.flatMap((c) => [[c - nw / 2, 0], [c - nw / 2, NOTCH_D], [c + nw / 2, NOTCH_D], [c + nw / 2, 0]]), [W, 0]];
// solid of revolution round the z axis. prof = [[r, z, grooved?], ...] from the bottom centre to the top centre;
// rOf(r, z, j, grooved) may vary the radius round the part
function lathe(prof, n, rOf = (r) => r) {
  const ring = ([r, z, g]) => Array.from({ length: n }, (_, j) => { const a = (TAU * j) / n, q = r > 0 ? rOf(r, z, j, g) : 0; return [q * Math.cos(a), q * Math.sin(a), z]; });
  const rings = prof.map(ring), T = [], same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-9;
  const tri = (a, b, c) => { if (!same(a, b) && !same(b, c) && !same(a, c)) T.push([a, b, c]); };
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) {
    const k = (j + 1) % n, a = rings[i][j], b = rings[i][k], c = rings[i + 1][k], d = rings[i + 1][j];
    tri(a, b, c); tri(a, c, d);
  }
  return T;
}

// ctx: { MATE, notchW, clearance, chimney: { W, D, H, Vd, wall, pocket } }
export function addDazzlers(parts, ctx) {
  const { MATE, notchW: nw, clearance, chimney: ch } = ctx;
  const upright = (T) => ([X, Y, Z]) => [X, T / 2 - Z, Y]; // print frame -> model frame, for a part T thick
  // layers: [[outline, z0, z1], ...] in the print frame
  const add = (name, info, layers, T, model = null) => {
    const print = layers.flatMap(([P, z0, z1]) => slab(P, z0, z1)), toModel = upright(T);
    parts[name] = { name, info: { ...info, kind: 'dazzler', source: 'own design' }, print, model: model ?? print.map((t) => t.map(toModel)), toModel };
  };

  // ---- doors and windows: blocks that fill a wall opening and lock into it.
  // An opening is a bay of a wall where the logs stop short on one or more courses: a log end on each side, a whole
  // log below and above. The part is as deep as the wall (MATE, the logs' side flats) and its top and bottom edges
  // are saddles shaped like the top of an octagonal log, plus the clearance. A round log fits the same saddle (it is
  // the octagon's inscribed circle), so the part sits on the log below and the log above caps it, and it cannot
  // move in or out of the wall; the log ends either side stop it sliding along. The saddle's sides are 45 deg, so it
  // prints without supports with its inside face on the bed and its outside face, which carries the detail, on top.
  // Widths: an opening is 1 1/2 in wide between a 1 1/2 in log and a 2-notch log, 1.44 in with a 1 5/8 in log on one
  // side, and 1.37 in with one each side (the watchtower's slits). The door fits the first two and the window all
  // three, with the clearance each side of the narrowest.
  // Elevation frame: u across the opening from the left jamb, v up from the centre of the log below, depth z from the
  // inside face (z = 0) to the outside face (z = MATE); details stand proud of the outside face. Seated on the log
  // below, the part's lowest point is info.vBase above that log's centre.
  {
    const rc = R + clearance, yk = rc * (Math.SQRT2 - 1), half = MATE / 2;
    // saddle height above the log centre at depth z (y = half - z is the offset from the wall's centre line)
    const sad = (z) => Math.min(rc, rc * Math.SQRT2 - Math.abs(half - z)) - clearance;      // seated: the flat touches the crown
    const zk = [0, half - yk, half + yk, MATE];
    const vb0 = sad(0), rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const circ = (cu, cv, r, n = 28) => Array.from({ length: n }, (_, k) => [cu + r * Math.cos((TAU * k) / n), cv + r * Math.sin((TAU * k) / n)]);
    // a prism along u (u0..u1) whose cross-section is the polygon P of [v, z] points
    const prismU = (P, u0, u1) => extrudeShell(outline(P), u0, u1).map((t) => t.map(([v, z, u]) => [u, v, z]));
    // cross-sections: the whole height between the saddles, or a rail from one saddle to a flat edge at v
    const both = (span) => [...zk.map((z) => [sad(z), z]), ...[...zk].reverse().map((z) => [span - 2 * clearance - sad(z), z])];
    const bottomRail = (v) => [...zk.map((z) => [sad(z), z]), [v, MATE], [v, 0]];
    const topRail = (span, v) => [[v, 0], [v, MATE], ...[...zk].reverse().map((z) => [span - 2 * clearance - sad(z), z])];
    const face = (P, a, b) => slab(P, MATE + a, MATE + b);                                   // a layer standing a..b proud of the outside face
    const finish = (name, info, tris, span) => {
      const print = tris.map((t) => t.map(([x, y, z]) => [x, y - vb0, z])), toModel = upright(MATE);
      parts[name] = { name, info: { ...info, kind: 'dazzler', source: 'own design', vBase: vb0, span, depth: MATE }, print, model: print.map((t) => t.map(toModel)), toModel };
    };
    const jambs = { door: 1.5 * IN - (1 / 16) * IN - 2 * clearance, window: 1.5 * IN - (1 / 8) * IN - 2 * clearance };
    // openings: centre to centre of the logs below and above is span = logs high + 1 log diameters
    const door = (name, listing, logs, color) => {
      const W = jambs.door, span = (logs + 1) * D, top = span - 2 * clearance - vb0;            // face runs vb0..top at the outside face
      const fw = 2.4, gap = 0.5, crownB = R;
      const T = [...prismU(both(span), 0, W)];
      // frame: two jambs and a head standing 1.6 proud, the head with a drip cap on top of it
      T.push(...face(rect(0, vb0, fw, top - fw), 0, 1.6), ...face(rect(W - fw, vb0, W, top - fw), 0, 1.6), ...face(rect(0, top - fw, W, top), 0, 1.6));
      T.push(...face(rect(0, top - 1.2, W, top), 1.6, 2.4));
      // threshold across the bottom
      T.push(...face(rect(fw, vb0, W - fw, crownB), 0, 0.9));
      // leaf: five vertical boards with grooves between them
      const l0 = fw + gap, l1 = W - fw - gap, n = 5, g = 0.6, bw = (l1 - l0 - (n - 1) * g) / n, lb = crownB, lt = top - fw - gap;
      for (let k = 0; k < n; k++) T.push(...face(rect(l0 + k * (bw + g), lb, l0 + k * (bw + g) + bw, lt), 0, 0.6));
      // ledges and a brace in a Z: two ledges across the boards and a diagonal falling towards the hinges
      const lh = 3.6, vL = lb + 0.16 * (lt - lb), vU = lt - 0.16 * (lt - lb) - lh, bu0 = l0 + 0.6, bu1 = l1 - 0.6, bwH = 4.2;
      T.push(...face(rect(bu0, vL, bu1, vL + lh), 0.6, 1.4), ...face(rect(bu0, vU, bu1, vU + lh), 0.6, 1.4));
      T.push(...face([[bu0, vL + lh], [bu0 + bwH, vL + lh], [bu1, vU], [bu1 - bwH, vU]], 0.6, 1.4));
      // strap hinges on the ledges, from the hinge jamb, each ending in a spear point; a knuckle on the jamb
      for (const v of [vL, vU]) {
        const c = v + lh / 2, s0 = bu0, s1 = bu0 + 0.42 * (bu1 - bu0);
        T.push(...face([[s0, c - 1], [s1 - 2.6, c - 1], [s1 - 2.6, c - 1.5], [s1, c], [s1 - 2.6, c + 1.5], [s1 - 2.6, c + 1], [s0, c + 1]], 1.4, 1.9));
        for (const du of [0.25, 0.42]) T.push(...face(circ(s0 + du * (bu1 - bu0) - 1.4, c, 0.45, 12), 1.9, 2.2)); // nail heads
        T.push(...face(rect(0.5, c - 2.4, fw - 0.4, c + 2.4), 1.6, 2.6));
      }
      // latch side: a back plate on the boards between the ledges, a knob, and a keyhole plate below it
      const lc = (vL + lh + vU) / 2, pu = bu1 - 2.8;
      T.push(...face(rect(pu - 2.2, lc - 4.5, pu + 2.2, lc + 3.2), 0.6, 1.1));
      T.push(...face(circ(pu, lc + 0.8, 1.9), 1.1, 2.4), ...face(circ(pu, lc + 0.8, 1.4), 2.4, 3.3)); // knob: a boss and a smaller cap, so nothing overhangs
      T.push(...face([[pu - 0.5, lc - 3.6], [pu + 0.5, lc - 3.6], [pu + 0.5, lc - 2.4], [pu, lc - 1.9], [pu - 0.5, lc - 2.4]], 1.1, 1.4));
      finish(name, { listing, color, logsHigh: logs, width: W, fits: `a doorway ${logs} logs high: on the log below, under the log above, between two log ends` }, T, span);
    };
    door('door', 'Door, board and batten', 2, [150, 62, 44]);
    door('door_tall', 'Tall Door, board and batten', 3, [150, 62, 44]);

    // window: a sash of six lights, open right through so you can see in; rails top and bottom carry the saddles,
    // stiles and glazing bars run the full depth so each starts on the bed. Outside: a casing, a head cap and a sill.
    {
      const W = jambs.window, span = 2 * D, top = span - 2 * clearance - vb0, s = 2.6, bar = 1.3;
      const r0 = R + 1.6, r1 = span - 2 * clearance - R - 1.6;                                // rails' inner edges, just inside the crowns
      const T = [...prismU(bottomRail(r0), 0, W), ...prismU(topRail(span, r1), 0, W)];
      const full = (P) => slab(P, 0, MATE);
      T.push(...full(rect(0, r0, s, r1)), ...full(rect(W - s, r0, W, r1)));
      // three lights across, two high
      const pw = (W - 2 * s - 2 * bar) / 3, vm = (r0 + r1) / 2;
      const xb = [s + pw, s + 2 * pw + bar];
      for (const x of xb) T.push(...full(rect(x, r0, x + bar, r1)));
      for (const [a, b] of [[s, xb[0]], [xb[0] + bar, xb[1]], [xb[1] + bar, W - s]]) T.push(...full(rect(a, vm - bar / 2, b, vm + bar / 2)));
      // outside: casing round the sides and head, a cap over the head, and a sill that stands out further below
      T.push(...face(rect(0, r0, s, r1), 0, 1.2), ...face(rect(W - s, r0, W, r1), 0, 1.2), ...face(rect(0, r1, W, top), 0, 1.2));
      T.push(...face(rect(0, top - 1.4, W, top), 1.2, 2.2));
      T.push(...face(rect(0, vb0, W, r0), 0, 1.6), ...face(rect(0, r0 - 1.8, W, r0), 1.6, 2.8));
      finish('window', { listing: 'Window, six lights', color: [232, 226, 204], logsHigh: 1, width: W, fits: 'a window one log high: on the log below, under the log above, between two log ends' }, T, span);
    }
  }

  // ---- picket fence: as long as a 2-notch log, with the same two notches underneath, so it stands on the table or
  // locks across two logs. The sill is as thick as a log; nine pickets on 1/2 in centres, so fences butt end to end
  // without a break in the rhythm.
  {
    const L = 4.5 * IN, sill = 12, top = 40, tip = 5, pw = 8.5, step = IN / 2, n = Math.round(L / step), tPicket = 6;
    const centres = [L / 2 - CENTERS / 2, L / 2 + CENTERS / 2], bottom = notchedBottom(L, centres, nw);
    const pickets = [];
    for (let k = n - 1; k >= 0; k--) { const x0 = k * step + (step - pw) / 2; pickets.push([x0 + pw, sill], [x0 + pw, top - tip], [x0 + pw / 2 + 1, top], [x0 + pw / 2 - 1, top], [x0, top - tip], [x0, sill]); }
    add('picket_fence', { listing: 'Picket Fence, 4 1/2', color: [244, 240, 228], length: L, centers: centres, fits: 'two log notches 3 in apart, or the table' },
      [[[...bottom, [L, sill], ...pickets, [0, sill]], 0, tPicket], [[...bottom, [L, sill], [0, sill]], tPicket, MATE]], MATE);
  }

  // ---- flag: a block with one notch underneath, as thick as a log, that sits in the top notch of any log; a pole
  // with a ball on top; and a swallow-tailed flag caught mid-wave, with three raised stripes.
  {
    const W = 1.5 * IN, bh = 12, c = W / 2, pole = 2.5, top = 100, ball = 4.5, tPole = 5, tFlag = 2.4, tStripe = 3.2;
    const base = [...notchedBottom(W, [c], nw), [W, bh], [0, bh]];
    const yj = top + 2 - Math.sqrt(ball * ball - pole * pole), a0 = Math.atan2(yj - top - 2, pole);
    const mast = [[c - pole, bh], [c + pole, bh], ...arcPts(c, top + 2, ball, a0, Math.PI - a0, 24)];
    const x0 = c + pole, len = 46, y0 = 68, fh = 28, tail = 9;
    const wave = (x) => { const u = (x - x0) / len; return 3.2 * u * Math.sin(TAU * u * 1.15) - 4 * u * u; }; // droops and ripples towards the fly
    const xs = (a, b, m = 24) => Array.from({ length: m + 1 }, (_, k) => a + ((b - a) * k) / m);
    const band = (f0, f1, xa, xb) => [...xs(xa, xb).map((x) => [x, y0 + fh * f0 + wave(x)]), ...xs(xb, xa).map((x) => [x, y0 + fh * f1 + wave(x)])];
    const xe = x0 + len, cloth = [...xs(x0, xe).map((x) => [x, y0 + wave(x)]), [xe - tail, y0 + fh / 2 + wave(xe - tail)], ...xs(xe, x0).map((x) => [x, y0 + fh + wave(x)])];
    const stripes = [[0.1, 0.26], [0.42, 0.58], [0.74, 0.9]].map(([f0, f1]) => [band(f0, f1, x0 + 1.5, xe - tail - 2), tFlag, tStripe]);
    add('flag', { listing: 'Flag on a Pole', color: [196, 52, 48], fits: 'the top notch of any log, or the table' },
      [[base, 0, MATE], [mast, 0, tPole], [cloth, 0, tFlag], ...stripes], MATE);
  }

  // ---- weathervane: a rooster on an arrow. Its base has the chimney's V cut underneath and sits astride the ridge
  // the same way; the vane is a thin plate flush with one face of the base.
  {
    const W = ch.W, bh = ch.Vd + 8, cx = W / 2, m = 2, tVane = 4, bev = 3;
    const base = [[0, 0], [cx, ch.Vd], [W, 0], [W, bh - bev], [W - bev, bh], [bev, bh], [0, bh - bev]];
    const yb0 = bh + 20, yb1 = yb0 + 4, yc = yb0 + 2, xr = W + 12, xl = -12;
    // the rooster faces the arrowhead; x from the mast, y from the top of the arrow's shaft
    const rooster = [[5, 0], [9, 5], [11, 11], [12.8, 12.6], [11.6, 15.4], [15.6, 17.4], [11.6, 19], [11.2, 22.6], [9.6, 20.6], [8, 23.6], [6.4, 21], [5, 22.6], [4.4, 18.6],
      [3.4, 13.6], [0, 9.6], [-4, 9.2], [-7.6, 13], [-9.6, 19], [-13.6, 23.4], [-16.4, 16.6], [-14.4, 9.4], [-11, 4], [-7, 1.4], [-4.6, 0]];
    const vane = [[cx - m, bh], [cx + m, bh], [cx + m, yb0], [xr, yb0], [xr, yc - 6.5], [xr + 11, yc], [xr, yc + 6.5], [xr, yb1],
      ...shift(rooster, cx, yb1),
      [xl + 10, yb1], [xl + 5, yc + 7], [xl - 5, yc + 7], [xl, yc], [xl - 5, yc - 7], [xl + 5, yc - 7], [xl + 10, yb0], [cx - m, yb0]];
    add('weathervane', { listing: 'Rooster Weathervane', color: [58, 60, 66], fits: 'the ridge of a stepped-gable roof, like the chimney' },
      [[base, 0, ch.D], [vane, 0, tVane]], ch.D);
  }

  // ---- chimney smoke: a plug that drops into the chimney's open top, and a plume of puffs drifting downwind.
  {
    const pw = ch.W - 2 * ch.wall - 2 * clearance, pd = ch.D - 2 * ch.wall - 2 * clearance, ph = 10, rise = 52, tPlume = 8, n = 60;
    const xc = (t) => 13 * t * t + 2.5 * Math.sin(TAU * t), half = (t) => 8.5 + 6.5 * t;
    const puff = (t, k, p) => 0.8 + 0.3 * Math.abs(Math.sin(Math.PI * (k * t + p)));
    const right = Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [xc(t) + half(t) * puff(t, 4, 0.15), ph + rise * t]; });
    const left = Array.from({ length: n + 1 }, (_, i) => { const t = 1 - i / n; return [xc(t) - half(t) * puff(t, 3.5, 0.55), ph + rise * t]; });
    const r0 = right.at(-1)[0] - xc(1), r1 = xc(1) - left[0][0];
    const cap = Array.from({ length: 23 }, (_, i) => { const a = (Math.PI * (i + 1)) / 24, r = (r0 + ((r1 - r0) * a) / Math.PI) * (1 + 0.14 * Math.sin(3 * a)); return [xc(1) + r * Math.cos(a), ph + rise + 0.85 * r * Math.sin(a)]; });
    const plug = [[-pw / 2, 0], [pw / 2, 0], [pw / 2, ph], [-pw / 2, ph]];
    add('chimney_smoke', { listing: 'Chimney Smoke', color: [176, 180, 186], fits: "the chimney's open top" },
      [[shift([[-pw / 2, 0], [pw / 2, 0], [pw / 2, ph], ...right, ...cap, ...left, [-pw / 2, ph]], pw / 2 + 4), 0, tPlume], [shift(plug, pw / 2 + 4), tPlume, pd]], pd);
  }

  // ---- rain barrel: the size of the short solid log (3/4 in across, 1 3/8 in tall), so it stands wherever one does:
  // by the door, or as a porch post. Bulging staves with a groove between each, four hoops, and a sunk lid.
  {
    const H = 1.375 * IN, hoop = 0.5, hoops = [[2, 5], [10.5, 13], [H - 13, H - 10.5], [H - 5, H - 2]], N = 96, staves = 12;
    const stave = (z) => R - hoop - 1.9 + 1.9 * Math.sin((Math.PI * z) / H);
    const lift = (z) => Math.max(0, ...hoops.map(([a, b]) => Math.min(hoop, z - a + hoop, b + hoop - z)));
    const zs = [...new Set([...Array.from({ length: 34 }, (_, i) => 0.6 + ((H - 1.2) * i) / 33), ...hoops.flatMap(([a, b]) => [a - hoop, a, b, b + hoop])].map((z) => +z.toFixed(4)))].sort((a, b) => a - b);
    const lid = 1.5, rim = 2.2;
    const prof = [[0, 0], [stave(0) - 0.6, 0], ...zs.map((z) => [stave(z) + lift(z), z, true]), [stave(H) - 0.6, H], [stave(H) - rim, H], [stave(H) - rim, H - lid], [0, H - lid]];
    const print = lathe(prof, N, (r, z, j, g) => (g && j % (N / staves) === 0 ? r - 0.35 * (1 - lift(z) / hoop) : r)).map((t) => t.map(([x, y, z]) => [x + R, y + R, z]));
    parts.rain_barrel = { name: 'rain_barrel', info: { listing: 'Rain Barrel, 1 3/8', kind: 'dazzler', source: 'own design', color: [150, 96, 52], fits: 'anywhere a 1 3/8 in solid log stands' }, print, model: print, toModel: (p) => p };
  }

  // ---- pine tree: two flat trees that slot together at right angles, the way two logs cross. One has a slot down
  // from the top, the other a slot up from the bottom. One STL holds both.
  {
    const t = IN / 8, s = t / 2 + clearance, ys = 34, tw = 11, th = 10;
    // right-hand edge, trunk to the last ledge; each tier's tip is blunted
    const side = [[tw, 0], [tw, th], [28.4, th], [29.6, th + 1.6], [12, 36], [21.8, 36], [22.8, 37.4], [8, 60], [15, 60], [15.9, 61.2]];
    const edge = (hw) => [hw, 60 + ((16 - hw) / 16) * 28]; // where the top tier is hw wide on each side
    const mirror = (P) => [...P].reverse().map(([x, y]) => [-x, y]);
    const down = [...side, edge(5.5), [s, edge(5.5)[1]], [s, ys]];                       // slot down from a flat top
    const up = [[s, 0], ...side, edge(2.5)];                                             // slot up from the bottom
    const A = [...down, ...mirror(down)], B = [[s, ys], ...up, ...mirror(up), [-s, ys]];
    const flatA = slab(shift(A, 30), 0, t), flatB = slab(shift(B, 94), 0, t);
    const model = [...slab(A, 0, t).map((tr) => tr.map(([X, Y, Z]) => [X, t / 2 - Z, Y])), ...slab(B, 0, t).map((tr) => tr.map(([X, Y, Z]) => [Z - t / 2, X, Y]))];
    parts.pine_tree = { name: 'pine_tree', info: { listing: 'Pine Tree, two halves', kind: 'dazzler', source: 'own design', color: [44, 110, 62], fits: 'the table; the two halves slot together' }, print: [...flatA, ...flatB], model, toModel: (p) => p };
  }
  return parts;
}
