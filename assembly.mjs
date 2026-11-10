// Two test buildings made only from listed parts, in world coordinates (mm, z up, table at z = 0).
//  CABIN: 6 in x 9 in between wall centres, plastic gables, 9 in shingles, doorway in front, window in back.
//  SHED:  3 in x 6 in between wall centres, wooden triangle gables, 6 in shingles.
// Wall rules (as in the brand's own builds): end walls (along x) take the even courses, side walls (along y) the odd
// courses; course 0 of the end walls is half logs, so every building sits flat on the table.
import { h, R, PITCH, CENTERS } from './parts.mjs';

export const zc = (c) => h + c * PITCH; // centre height of course c (course 0 = half logs, flat bottom on z = 0)

// ---- where a rigid shingle comes to rest on a gable's top edge (2D, gable-local x/z, left slope rising to +x) ----
// profile: polyline of the left half of the top edge, eave to peak (vertical risers allowed).
function yAt(prof, x) {
  let y = -Infinity;
  for (let i = 0; i < prof.length - 1; i++) {
    const [p, q] = [prof[i], prof[i + 1]];
    if (x < Math.min(p[0], q[0]) - 1e-9 || x > Math.max(p[0], q[0]) + 1e-9) continue;
    y = Math.max(y, Math.abs(q[0] - p[0]) < 1e-12 ? Math.max(p[1], q[1]) : p[1] + ((x - p[0]) / (q[0] - p[0])) * (q[1] - p[1]));
  }
  return y;
}
// steepest line from point A (length L) that stays on or above the profile; returns the angle and touching point
function steepest(prof, A, L, phi0) {
  let phi = phi0, S = null;
  for (let it = 0; it < 20; it++) {
    const xe = A[0] + L * Math.cos(phi);
    let best = -Infinity, Sb = null;
    for (const v of prof) if (v[0] > A[0] + 1e-9 && v[0] <= xe + 1e-9) { const a = Math.atan2(v[1] - A[1], v[0] - A[0]); if (a > best) { best = a; Sb = v; } }
    const ye = yAt(prof, xe);
    if (isFinite(ye)) { const a = Math.atan2(ye - A[1], xe - A[0]); if (a > best) { best = a; Sb = [xe, ye]; } }
    S = Sb;
    if (Math.abs(best - phi) < 1e-12) break;
    phi = best;
  }
  return { phi, S };
}
// Lower-bottom corner placed on the profile at xs; the shingle rotates down onto the profile. If its centre of mass
// lies beyond the second contact it tips forward over that contact until its upper corner lands.
function restShingle(prof, xs, w) {
  const C = [xs, yAt(prof, xs)];
  const a = steepest(prof, C, w, 0);
  if (!a.S || !isFinite(C[1])) return null; // runs off the peak
  const dS = Math.hypot(a.S[0] - C[0], a.S[1] - C[1]);
  if (w / 2 <= dS) return { C, phi: a.phi, contacts: [0, dS] };
  const b = steepest(prof, a.S, w - dS, a.phi);
  if (!b.S) return null;
  const phi = b.phi, C2 = [a.S[0] - dS * Math.cos(phi), a.S[1] - dS * Math.sin(phi)];
  return { C: C2, phi, contacts: [dS, dS + Math.hypot(b.S[0] - a.S[0], b.S[1] - a.S[1])] };
}
// Lay shingles up one slope, each with its lower edge `gap` clear of the previous shingle (or the eave lip).
// Returns null if the sequence would cross the peak (x = xMax) or a shingle could not rest stably.
export function layRoof(prof, xMax, startX, widths, t, gap) {
  const poses = [];
  let barrier = startX ?? -Infinity, reach = -Infinity;
  for (const sh of widths) {
    let xs = isFinite(barrier) ? barrier + gap : prof[0][0], pose = null;
    for (let it = 0; it < 6; it++) {
      pose = restShingle(prof, xs, sh.width);
      if (!pose) return null;
      if (!isFinite(barrier)) break;
      const lowTopX = Math.min(pose.C[0], pose.C[0] - t * Math.sin(pose.phi));
      const need = barrier + gap - lowTopX;
      if (Math.abs(need) < 1e-6) break;
      xs += need;
    }
    const { C, phi, contacts } = pose, d = [Math.cos(phi), Math.sin(phi)], n = [-Math.sin(phi), Math.cos(phi)];
    if (!(contacts[0] <= sh.width / 2 && sh.width / 2 <= contacts[1])) return null;
    const corners = [C, [C[0] + sh.width * d[0], C[1] + sh.width * d[1]], [C[0] + t * n[0], C[1] + t * n[1]], [C[0] + sh.width * d[0] + t * n[0], C[1] + sh.width * d[1] + t * n[1]]];
    const maxX = Math.max(...corners.map((p) => p[0]));
    if (maxX > xMax - 0.2) return null;
    poses.push({ C, phi });
    barrier = maxX; reach = maxX;
  }
  return { poses, reach };
}

export function buildings(P) {
  const mapT = (tris, f) => tris.map((t) => t.map(f));
  const place = (name, f, caption, mat) => ({ name, tris: mapT(P[name].model, f), caption, mat });
  // log along x on course c, wall line y = yw, with notch k at world x = xw
  const xLog = (name, c, yw, xw, k = 0, cap) => { const o = xw - P[name].info.centers[k]; return place(name, ([x, y, z]) => [x + o, yw + y, zc(c) + z], cap, 'log'); };
  // log along y on course c, wall line x = xw, with notch k at world y = yw
  const yLog = (name, c, xw, yw, k = 0, cap) => { const o = yw - P[name].info.centers[k]; return place(name, ([x, y, z]) => [xw - y, x + o, zc(c) + z], cap, 'log'); };
  // gable acting as an end-wall log on course K, centred at xc on wall line yw
  const gable = (name, K, yw, xc, cap) => { const W = P[name].info.W; return place(name, ([x, y, z]) => [xc - W / 2 + x, yw + y, zc(K) - R + z], cap, 'roof'); };
  // shingle resting on a gable slope: lower-bottom corner C (gable-local x, z) and tilt phi; spans y0..y0+length
  const shingle = (name, gName, K, xc, right, C, phi, y0, cap) => {
    const g = P[gName].info, sh = P[name].info, c = Math.cos(phi), sn = Math.sin(phi);
    const O = [xc - g.W / 2 + (right ? g.W - C[0] : C[0]), right ? y0 : y0 + sh.length, zc(K) - R + C[1]];
    const ex = right ? [0, 1, 0] : [0, -1, 0], ey = right ? [-c, 0, sn] : [c, 0, sn], ez = right ? [sn, 0, c] : [-sn, 0, c];
    return place(name, ([x, y, z]) => [0, 1, 2].map((i) => O[i] + x * ex[i] + y * ey[i] + z * ez[i]), cap, 'shingle');
  };
  const roofRows = (gName, K, xc, y0, len) => {
    const g = P[gName].info, gap = 0.5;
    const flat = P[`shingle_flat_${len}`].info, ridge = P[`shingle_ridge_${len}`].info;
    // try k flats followed by one ridge shingle (or flats only); keep the layout that reaches closest to the peak
    let best = null;
    for (let k = 0; k <= 10; k++) for (const withRidge of [true, false]) {
      const seq = [...Array(k).fill(['flat', flat]), ...(withRidge ? [['ridge', ridge]] : [])];
      if (!seq.length) continue;
      const lay = layRoof(g.profile, g.W / 2, g.startX, seq.map((s) => s[1]), flat.t, gap);
      if (lay && (!best || lay.reach > best.lay.reach)) best = { seq, lay };
    }
    const out = [];
    best.seq.forEach(([kind], i) => {
      const { C, phi } = best.lay.poses[i];
      for (const right of [false, true]) out.push(shingle(`shingle_${kind}_${len}`, gName, K, xc, right, C, phi, y0, `SHINGLES: ROW ${i + 1}/${best.seq.length}`));
    });
    return out;
  };

  // chimney straddling the ridge at (xc, yc): lowered until its V-cut base first touches the roof below it
  const chimney = (roof, xc, yc, cap = 'CHIMNEY') => {
    const ci = P.chimney.info, half = ci.W / 2, hd = ci.D / 2, step = 0.25;
    const vprof = (dx) => ci.Vd * (1 - Math.abs(dx) / half); // height of the chimney's underside above its prong tips
    let z0 = -Infinity;
    const tris = roof.flatMap((it) => it.tris);
    for (let dx = -half; dx <= half + 1e-9; dx += step) for (let dy = -hd; dy <= hd + 1e-9; dy += step) {
      const x = xc + dx, y = yc + dy;
      for (const [a, b, c] of tris) {
        const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(area) < 1e-12) continue;
        const w0 = ((b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x)) / area, w1 = ((c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x)) / area, w2 = 1 - w0 - w1;
        if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
        z0 = Math.max(z0, w0 * a[2] + w1 * b[2] + w2 * c[2] - vprof(dx));
      }
    }
    return place('chimney', ([x, y, z]) => [xc + x, yc + y, z0 + 0.05 + z], cap, 'chimney');
  };
  const roofOf = (items) => items.filter((it) => it.name.startsWith('shingle'));

  // ---------------- CABIN ----------------
  const cabin = [];
  {
    const WID = 2 * CENTERS, LEN = 3 * CENTERS, K = 8, front = 0, back = LEN;
    const q = (c) => `WALLS: COURSE ${c + 1}/${K}`;
    cabin.push(xLog('half_log_7-1_2', 0, front, 0, 0, 'HALF LOGS: FLAT BASE'), xLog('half_log_7-1_2', 0, back, 0, 0, 'HALF LOGS: FLAT BASE'));
    for (let c = 1; c < K; c++) {
      if (c % 2) { cabin.push(yLog('log_4insert_10-5_8', c, 0, 0, 0, q(c)), yLog('log_4insert_10-5_8', c, WID, 0, 0, q(c))); continue; }
      // front wall: doorway in the left bay on courses 2 and 4 (short logs at the corner, 2-insert across the right bay)
      if (c === 2 || c === 4) {
        cabin.push(xLog(c === 2 ? 'log_1insert_1-1_2_octagonal' : 'log_1insert_1-1_2_round', c, front, 0, 0, q(c)), xLog('log_2insert_4-1_2', c, front, CENTERS, 0, q(c)));
      } else cabin.push(xLog('log_3insert_7-5_8', c, front, 0, 0, q(c)));
      // back wall: window in the left bay on course 4
      if (c === 4) cabin.push(xLog('log_1insert_1-5_8', c, back, 0, 0, q(c)), xLog('log_2insert_4-1_2', c, back, CENTERS, 0, q(c)));
      else cabin.push(xLog('log_3insert_7-5_8', c, back, 0, 0, q(c)));
    }
    const G = 'gable_plastic_8-1_2', xc = WID / 2;
    cabin.push(gable(G, K, front, xc, 'PLASTIC GABLES'), gable(G, K, back, xc, 'PLASTIC GABLES'));
    cabin.push(...roofRows(G, K, xc, 0, 9));
    cabin.push(chimney(roofOf(cabin), xc, 0.65 * LEN));
  }

  // ---------------- SHED ----------------
  const shed = [];
  {
    const WID = CENTERS, LEN = 2 * CENTERS, K = 8, front = 0, back = LEN;
    shed.push(xLog('half_log_4-1_2', 0, front, 0), xLog('half_log_4-1_2', 0, back, 0));
    const ends = { 2: ['log_2insert_4-1_2', 'log_2insert_4-1_2'], 4: ['beveled_end_4-3_4', 'log_2insert_6'], 6: ['log_2insert_4-1_2', 'log_2insert_4-1_2'] };
    for (let c = 1; c < K; c++) {
      if (c % 2) shed.push(yLog('log_3insert_7-5_8', c, 0, 0), yLog('log_3insert_7-5_8', c, WID, 0));
      else shed.push(xLog(ends[c][0], c, front, 0), xLog(ends[c][1], c, back, 0));
    }
    const G = 'gable_wood_triangle_4x2', xc = WID / 2;
    shed.push(gable(G, K, front, xc), gable(G, K, back, xc));
    shed.push(...roofRows(G, K, xc, 0, 6));
  }

  // ---------------- COTTAGE ----------------
  // 3 x 6 in like the shed, but with the small two-notch plastic gables and a chimney
  const cottage = [];
  {
    const WID = CENTERS, LEN = 2 * CENTERS, K = 8, front = 0, back = LEN;
    cottage.push(xLog('half_log_4-1_2', 0, front, 0), xLog('half_log_4-1_2', 0, back, 0));
    for (let c = 1; c < K; c++) {
      if (c % 2) cottage.push(yLog('log_3insert_7-5_8', c, 0, 0), yLog('log_3insert_7-5_8', c, WID, 0));
      else cottage.push(xLog('log_2insert_4-1_2', c, front, 0), xLog('log_2insert_4-1_2', c, back, 0));
    }
    const G = 'gable_plastic_small_2notch', xc = WID / 2;
    cottage.push(gable(G, K, front, xc), gable(G, K, back, xc));
    cottage.push(...roofRows(G, K, xc, 0, 6));
    cottage.push(chimney(roofOf(cottage), xc, 0.5 * LEN));
  }
  return { cabin, shed, cottage };
}
