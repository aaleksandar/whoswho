// Graph model: one node per guest. An edge is a real thread from scorePair
// (shared chapter / interest / music cluster, a need↔offer fit, or the same neighbourhood).
// Each person keeps their strongest few, so a room that shares "east London" does not
// become a complete graph. rankMatches still sees every pair.

import { matchTags, scorePair } from './match.js';

const EDGES_PER_PERSON = 3;

/**
 * @param {object[]} guests
 * @returns {{nodes: object[], links: {source:number, target:number, shared:string[], score:number, reason:string}[]}}
 */
export function buildGraph(guests) {
  const nodes = guests.map((g) => ({ ...g, degree: 0 }));
  const candidates = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const scored = scorePair(nodes[i], nodes[j]);
      if (!scored.labels.length) continue;
      candidates.push({
        i,
        j,
        source: nodes[i].id,
        target: nodes[j].id,
        shared: scored.labels,
        score: scored.score,
        reason: scored.reason,
      });
    }
  }

  const byNode = new Map();
  for (const link of candidates) {
    if (!byNode.has(link.i)) byNode.set(link.i, []);
    if (!byNode.has(link.j)) byNode.set(link.j, []);
    byNode.get(link.i).push(link);
    byNode.get(link.j).push(link);
  }
  const keep = new Set();
  for (const list of byNode.values()) {
    const ranked = [...list].sort((a, b) => b.score - a.score || a.source - b.source || a.target - b.target);
    for (const link of ranked.slice(0, EDGES_PER_PERSON)) keep.add(link);
  }

  const links = [];
  for (const link of candidates) {
    if (!keep.has(link)) continue;
    links.push({
      source: link.source,
      target: link.target,
      shared: link.shared,
      score: link.score,
      reason: link.reason,
    });
    nodes[link.i].degree++;
    nodes[link.j].degree++;
  }
  return { nodes, links };
}

/** Tag -> count across guests (clusters, not only exact strings), most common first. */
export function topVibes(guests, limit = 8) {
  const counts = new Map();
  for (const g of guests) for (const v of matchTags(g)) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([vibe, count]) => ({ vibe, count }));
}

export { matchTags };
