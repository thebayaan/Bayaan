/* eslint-env es2020 */
// The two-way bootstrap of ../recitation-bench/natural/score.mjs, copied so that scoring here
// never loads the rules from anywhere but the frozen copy.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Point and 95% interval of Σnum/Σden, resampling two crossed units together. */
export function pigeonhole(rows, boot = 2000, seed = 12345) {
  const num = rows.reduce((x, r) => x + r.num, 0);
  const den = rows.reduce((x, r) => x + r.den, 0);
  const as = [...new Set(rows.map(r => r.a))];
  const bs = [...new Set(rows.map(r => r.b))];
  const out = {
    est: den ? num / den : null,
    lo: null,
    hi: null,
    num,
    den,
    unitsA: as.length,
    unitsB: bs.length,
  };
  if (!rows.length || !den || !boot) return out;
  const ia = new Map(as.map((x, i) => [x, i]));
  const ib = new Map(bs.map((x, i) => [x, i]));
  const cells = new Map();
  for (const r of rows) {
    const k = ia.get(r.a) * bs.length + ib.get(r.b);
    const c = cells.get(k) ?? {a: ia.get(r.a), b: ib.get(r.b), num: 0, den: 0};
    c.num += r.num;
    c.den += r.den;
    cells.set(k, c);
  }
  const list = [...cells.values()];
  const rand = mulberry32(seed);
  const stats = [];
  const wa = new Int32Array(as.length);
  const wb = new Int32Array(bs.length);
  for (let i = 0; i < boot; i++) {
    wa.fill(0);
    wb.fill(0);
    for (let j = 0; j < as.length; j++) wa[Math.floor(rand() * as.length)]++;
    for (let j = 0; j < bs.length; j++) wb[Math.floor(rand() * bs.length)]++;
    let n = 0;
    let d = 0;
    for (const c of list) {
      const w = wa[c.a] * wb[c.b];
      if (w) {
        n += w * c.num;
        d += w * c.den;
      }
    }
    if (d > 0) stats.push(n / d);
  }
  stats.sort((x, y) => x - y);
  if (stats.length) {
    out.lo = stats[Math.floor(0.025 * stats.length)];
    out.hi =
      stats[Math.min(stats.length - 1, Math.floor(0.975 * stats.length))];
  }
  return out;
}

export const q = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2);
};
export const fmtP = r =>
  r.est === null
    ? '-'
    : `${(100 * r.est).toFixed(1)}% [${(100 * (r.lo ?? 0)).toFixed(1)}, ${(100 * (r.hi ?? 0)).toFixed(1)}]`;
export const fmtR = r =>
  r.est === null
    ? '-'
    : `${(1000 * r.est).toFixed(2)} [${(1000 * (r.lo ?? 0)).toFixed(2)}, ${(1000 * (r.hi ?? 0)).toFixed(2)}]`;
