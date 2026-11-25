// Deterministic, offline matching. No network.
// Scores need↔offer complementarity, shared life chapter, interest and music
// clusters (so "philosophy" meets "philosophical", "deep house" meets "house music"),
// and neighbourhood proximity.
//
// Night quests (not built yet) can reuse matchTags(guest): stable labels for
// "find someone who's into X" without redoing this grouping.

import { normalizeVibe } from './vibes.js';
import {
  AREAS, AREA_GROUPS, CHAPTERS, COMPLEMENTS,
} from './catalog.js';

/** Cluster aliases. Short aliases (< 6 chars) only match the whole tag, so "music"
 *  does not swallow "house music", while "psychology" still catches "jungian psychology". */
export const CLUSTERS = [
  { id: 'philosophy', label: 'philosophy', aliases: ['philosophy', 'philosophical', 'philosopher', 'ethics', 'metaphysics'] },
  { id: 'futurism', label: 'futurism', aliases: ['futurism', 'futures', 'speculative futures'] },
  { id: 'consciousness', label: 'consciousness', aliases: ['consciousness', 'awareness', 'nondual'] },
  { id: 'psychology', label: 'psychology', aliases: ['psychology', 'psychological', 'jungian', 'jungian psychology', 'shadow work', 'inner work', 'therapy'] },
  { id: 'history', label: 'history', aliases: ['history', 'historical'] },
  { id: 'urbanism', label: 'urbanism', aliases: ['urbanism', 'urban', 'cities', 'city life'] },
  { id: 'third-places', label: 'third places', aliases: ['third places', 'third place'] },
  { id: 'spirituality', label: 'spirituality', aliases: ['spirituality', 'spiritual', 'mysticism'] },
  { id: 'art', label: 'art', aliases: ['art', 'painting', 'drawing', 'illustration'] },
  { id: 'poetry', label: 'poetry', aliases: ['poetry', 'poems', 'poem'] },
  { id: 'love', label: 'love & relationships', aliases: ['love & relationships', 'love and relationships', 'relationships', 'intimacy'] },
  { id: 'music', label: 'music', aliases: ['music'] },
  { id: 'film', label: 'film', aliases: ['film', 'films', 'cinema', 'movies'] },
  { id: 'books', label: 'books', aliases: ['books', 'reading', 'literature', 'novels'] },
  { id: 'travel', label: 'travel', aliases: ['travel', 'travelling', 'traveling'] },
  { id: 'nature', label: 'nature', aliases: ['nature', 'outdoors', 'hiking'] },
  { id: 'meditation', label: 'meditation', aliases: ['meditation', 'mindfulness', 'vipassana'] },
  { id: 'deep-house', label: 'deep house', aliases: ['deep house', 'house music', 'soulful house', 'house'] },
  { id: 'techno', label: 'techno', aliases: ['techno'] },
  { id: 'jazz', label: 'jazz', aliases: ['jazz'] },
  { id: 'ambient', label: 'ambient', aliases: ['ambient', 'soundscapes'] },
  { id: 'hiphop', label: 'hip hop', aliases: ['hip hop', 'hip-hop', 'rap'] },
  { id: 'soul', label: 'soul', aliases: ['soul', 'neo-soul', 'r&b', 'rnb'] },
  { id: 'folk', label: 'folk', aliases: ['folk', 'singer-songwriter', 'acoustic'] },
  { id: 'classical', label: 'classical', aliases: ['classical', 'orchestra'] },
  { id: 'disco', label: 'disco', aliases: ['disco', 'nu-disco'] },
  { id: 'funk', label: 'funk', aliases: ['funk'] },
  { id: 'dnb', label: 'drum & bass', aliases: ['drum & bass', 'drum and bass', 'dnb', 'jungle'] },
  { id: 'indie', label: 'indie', aliases: ['indie', 'indie rock'] },
];

const NAME_STOP = new Set(['the', 'and', 'for', 'with', 'song', 'songs', 'track', 'tracks', 'music', 'soundtrack', 'various', 'remix']);

function phraseMatch(text, alias) {
  if (text === alias) return true;
  if (alias.length < 6) return false;
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${esc}(?:\\s|$)`).test(text);
}

export function labelsForTag(raw) {
  const text = normalizeVibe(typeof raw === 'string' ? raw : '');
  if (!text) return [];
  const labels = [];
  for (const cluster of CLUSTERS) {
    if (cluster.aliases.some((alias) => phraseMatch(text, alias)) && !labels.includes(cluster.label)) {
      labels.push(cluster.label);
    }
  }
  if (!labels.length) labels.push(text);
  return labels;
}

function explode(list) {
  const out = [];
  for (const raw of list || []) {
    const text = normalizeVibe(typeof raw === 'string' ? raw : '');
    if (!text) continue;
    for (const label of labelsForTag(text)) out.push({ label, raw: text });
  }
  return out;
}

/** Comma / slash / & separated names and genre phrases from the free-text soundtrack. */
export function soundtrackNames(raw) {
  return String(raw || '')
    .split(/[,/·•|]|\s+&\s+|\s+and\s+/i)
    .map((part) => normalizeVibe(part))
    .filter((part) => part.length >= 4 && part.length <= 40 && part.split(' ').length <= 4 && !NAME_STOP.has(part));
}

function interestList(g) {
  if (Array.isArray(g?.interests) && g.interests.length) return g.interests;
  return g?.vibes || [];
}

function musicList(g) {
  return [...(g?.music || []), ...soundtrackNames(g?.soundtrack)];
}

function share(aList, bList) {
  const a = explode(aList);
  const b = explode(bList);
  const seen = new Set();
  const out = [];
  for (const item of a) {
    if (seen.has(item.label)) continue;
    if (!b.some((other) => other.label === item.label)) continue;
    seen.add(item.label);
    out.push({ label: item.label, phrase: item.raw });
  }
  return out;
}

function chapterShorts(g) {
  const out = [];
  for (const id of g?.chapter || []) {
    const row = CHAPTERS.find((c) => c.id === id);
    if (row && !out.includes(row.short)) out.push(row.short);
  }
  return out;
}

function areaMeta(g) {
  if (g?.areaChip) {
    const chip = AREAS.find((a) => a.id === g.areaChip);
    if (chip) return chip;
  }
  const label = String(g?.area || '').trim().toLowerCase();
  if (!label) return null;
  return AREAS.find((a) => a.label.toLowerCase() === label) || null;
}

function haversineKm(a, b) {
  if (a?.lat == null || b?.lat == null || a?.lng == null || b?.lng == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function proximity(a, b) {
  const am = areaMeta(a);
  const bm = areaMeta(b);
  const aLabel = am?.label || (a?.area && a.area !== 'Visiting' ? a.area : null);
  const same = am && bm && am.id === bm.id && am.id !== 'visiting';
  const sameGroup = am && bm && am.group && am.group === bm.group && am.group !== 'visit';
  let points = 0;
  let phrase = null;
  let edgeLabel = null;
  if (same && aLabel) {
    points = 10;
    phrase = `both near ${aLabel}`;
    edgeLabel = aLabel;
  } else if (sameGroup) {
    points = 6;
    phrase = `both around ${AREA_GROUPS[am.group] || 'the same part of London'}`;
  }
  const km = haversineKm(a, b);
  if (km != null && km < 2.5 && points < 8) {
    points = 8;
    phrase = phrase || 'both in the same part of town';
    edgeLabel = edgeLabel || 'nearby';
  } else if (km != null && km < 5 && points < 4) {
    points = 4;
  }
  return { points, phrase, edgeLabel };
}

function complementLine(needer, giver) {
  const needs = needer?.needTags || [];
  const offers = giver?.offerTags || [];
  for (const row of COMPLEMENTS) {
    if (needs.includes(row.need) && offers.includes(row.offer)) return row;
  }
  return null;
}

function joinAnd(list) {
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

function dedupe(list) {
  const out = [];
  for (const item of list) if (item && !out.includes(item)) out.push(item);
  return out;
}

/**
 * Score a against b. `reason` is written for a ("you need…, they have…").
 * `labels` are the short edge labels the TV graph groups by.
 */
export function scorePair(a, b) {
  const interests = share(interestList(a), interestList(b));
  const music = share(musicList(a), musicList(b));
  const chapters = chapterShorts(a).filter((short) => chapterShorts(b).includes(short));
  const prox = proximity(a, b);
  const youNeed = complementLine(a, b);
  const theyNeed = complementLine(b, a);
  const complement = !!(youNeed || theyNeed);

  let score = 0;
  score += Math.min(28, interests.length * 12);
  score += Math.min(16, music.length * 10);
  if (chapters.length) score += 14;
  score += prox.points;
  if (complement) score += 18;
  score = Math.min(100, score);

  const labels = dedupe([
    ...chapters,
    ...interests.map((item) => item.label),
    ...music.map((item) => item.label),
    prox.edgeLabel,
    complement ? 'need ↔ offer' : null,
  ]).slice(0, 8);

  const into = dedupe([
    ...interests.slice(0, 2).map((item) => item.phrase),
    ...music.slice(0, 2).map((item) => item.phrase),
  ]).slice(0, 3);

  const bits = [];
  if (chapters[0]) bits.push(`both ${chapters[0]}`);
  if (into.length) bits.push(`into ${joinAnd(into)}`);
  if (prox.phrase) bits.push(prox.phrase);
  if (youNeed) bits.push(youNeed.youNeed);
  else if (theyNeed) bits.push(theyNeed.theyNeed);
  const reason = bits.join(', ');

  return { score: reason ? score : 0, labels: reason ? labels : [], reason, complement };
}

/** Stable tags for one person: interest clusters, music, soundtrack names, chapter. */
export function matchTags(g) {
  const tags = [];
  const push = (label) => { if (label && !tags.includes(label)) tags.push(label); };
  for (const item of explode(interestList(g))) push(item.label);
  for (const item of explode(musicList(g))) push(item.label);
  for (const short of chapterShorts(g)) push(short);
  return tags;
}

/**
 * Top matches for `viewer`. Checked-in people fill the list first (who to walk up to),
 * then everyone else by score. Skips zero-overlap pairs.
 */
export function rankMatches(viewer, guests, { limit = 5 } = {}) {
  const scored = [];
  for (const guest of guests) {
    if (!guest || guest.id === viewer.id) continue;
    if (guest.rsvp === 'no') continue;
    const scoredPair = scorePair(viewer, guest);
    if (!scoredPair.reason || scoredPair.score <= 0) continue;
    scored.push({
      guest,
      score: scoredPair.score,
      reason: scoredPair.reason,
      checkedIn: !!guest.checkedIn,
    });
  }
  const byScore = (x, y) => y.score - x.score || String(x.guest.name).localeCompare(String(y.guest.name));
  const here = scored.filter((row) => row.checkedIn).sort(byScore);
  const away = scored.filter((row) => !row.checkedIn).sort(byScore);
  return [...here, ...away].slice(0, limit);
}
