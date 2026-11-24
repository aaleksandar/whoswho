// Pure graph model: guests -> nodes + links weighted by shared vibes.

/**
 * @param {{id:number, vibes:string[]}[]} guests
 * @returns {{nodes: object[], links: {source:number, target:number, shared:string[]}[]}}
 */
export function buildGraph(guests) {
  const nodes = guests.map((g) => ({ ...g, degree: 0 }));
  const sets = nodes.map((n) => new Set(n.vibes || []));
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = [...sets[i]].filter((v) => sets[j].has(v));
      if (shared.length) {
        links.push({ source: nodes[i].id, target: nodes[j].id, shared });
        nodes[i].degree++;
        nodes[j].degree++;
      }
    }
  }
  return { nodes, links };
}

/** Vibe -> count across guests, most popular first. */
export function topVibes(guests, limit = 8) {
  const counts = new Map();
  for (const g of guests) for (const v of g.vibes || []) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([vibe, count]) => ({ vibe, count }));
}
