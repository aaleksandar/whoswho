// A paper city for anywhere that isn't London: districts as Voronoi cells
// around the centre, in the same shape as /data/london-3d.json
// ({boroughs: [{n, r: [ring]}]}, km, x east, y north), so the Map and the
// Cloud draw it the same way. Seeded by the city's name, so every screen at a
// party (and every reload) builds the same city.

const R = 19; // km, about the size of paper London
const CELLS = 34;

function rng(seedText) {
  let s = 2166136261;
  for (let i = 0; i < seedText.length; i++) { s ^= seedText.charCodeAt(i); s = Math.imul(s, 16777619); }
  s = (s >>> 0) % 2147483646 + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// Keep the part of `poly` on a's side of the bisector between a and b.
function clip(poly, a, b) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = b[0] - a[0], ny = b[1] - a[1];
  const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny; // < 0 is a's side
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0) !== (sq < 0) && sp !== sq) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

const centroid = (poly) => {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], k = p[0] * q[1] - q[0] * p[1];
    a += k; x += (p[0] + q[0]) * k; y += (p[1] + q[1]) * k;
  }
  return a ? [x / (3 * a), y / (3 * a)] : poly[0];
};

/** {boroughs, thames: null, generic: true} for a city {name, lat, lng}. */
export function genCity(city) {
  const rnd = rng(`${city.name}:${city.lat}:${city.lng}`);
  // the outline: a squashed, turned ellipse (convex, so cells clip cleanly)
  const ax = R * (0.95 + rnd() * 0.2), ay = R * (0.8 + rnd() * 0.15), turn = rnd() * Math.PI;
  const outline = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2, x = Math.cos(a) * ax, y = Math.sin(a) * ay;
    outline.push([x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)]);
  }
  // seeds denser in the middle, like a real city's districts
  let seeds = [];
  while (seeds.length < CELLS) {
    const r = Math.pow(rnd(), 0.75) * R * 0.95, a = rnd() * Math.PI * 2;
    seeds.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const cells = () => seeds.map((s, i) => seeds.reduce((poly, t, j) => (j === i || poly.length < 3 ? poly : clip(poly, s, t)), outline));
  // a couple of rounds of relaxing, so no district is a sliver
  for (let it = 0; it < 2; it++) seeds = cells().map((p, i) => (p.length >= 3 ? centroid(p) : seeds[i]));
  const boroughs = [];
  cells().forEach((poly, i) => {
    if (poly.length < 3) return;
    const [cx, cy] = centroid(poly);
    // nibble at the edge so the city isn't a perfect oval
    if (Math.hypot(cx, cy) > R * 0.7 && rnd() < 0.22) return;
    const ring = poly.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
    ring.push(ring[0]);
    boroughs.push({ n: `District ${i + 1}`, r: [ring] });
  });
  return { boroughs, thames: null, generic: true };
}
