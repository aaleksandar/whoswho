// Deterministic, offline matching. No network.
// Scores shared communities (in + in, or in + curious), a need against what
// someone offers or is already in, favourite spots that name the same place,
// neighbourhood, and the older chapter / interest / music clusters.
//
// Night quests (not built yet) can reuse matchTags(guest): stable labels for
// "find someone who's into X" without redoing this grouping.

import { normalizeVibe } from './vibes.js';
import {
  AREAS, AREA_GROUPS, CHAPTERS, COMPLEMENTS, NEEDS,
} from './catalog.js';
import { communityLabel } from './communities.js';

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
  { id: 'art', label: 'art', aliases: ['art', 'painting', 'drawing', 'illustration', 'paint'] },
  { id: 'poetry', label: 'poetry', aliases: ['poetry', 'poems', 'poem'] },
  { id: 'love', label: 'love & relationships', aliases: ['love & relationships', 'love and relationships', 'relationships', 'intimacy'] },
  { id: 'music', label: 'music', aliases: ['music', 'sing', 'dance'] },
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

const WORD_STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'been', 'being', 'your', 'you',
  'yours', 'mine', 'myself', 'someone', 'something', 'someone', 'right', 'now', 'life', 'just',
  'really', 'very', 'into', 'want', 'wanted', 'need', 'needs', 'missing', 'side', 'shown',
  'show', 'while', 'again', 'lately', 'years', 'year', 'people', 'person', 'thing', 'things',
  'about', 'would', 'could', 'should', 'there', 'their', 'them', 'they', 'what', 'when',
  'where', 'which', 'who', 'whom', 'whose', 'been', 'more', 'some', 'than', 'then', 'also',
  'still', 'much', 'like', 'feel', 'feeling', 'room', 'night', 'tonight', 'will',
  'actually', 'without', 'first', 'good', 'long', 'kind', 'week', 'weeks', 'going',
]);

/** Offer cues a free-text "what's missing" answer can hit. */
const OFFER_CUES = [
  { id: 'spare-room', label: 'a spare room or sofa', needles: ['spare room', 'sofa', 'housemate', 'flatmate', 'somewhere to live', 'place to live', 'a room', 'apartment'] },
  { id: 'ear', label: 'a listening ear', needles: ['listen', 'listening', 'someone to talk', 'be heard', 'emotional support', 'a friend'] },
  { id: 'intro', label: 'introductions', needles: ['introduction', 'introduce me', 'people to meet'] },
  { id: 'collab', label: 'making something together', needles: ['collaborat', 'make something', 'make things', 'create with'] },
  { id: 'accountability', label: 'accountability', needles: ['accountability', 'check in on me', 'notice if i'] },
  { id: 'meal', label: 'a meal', needles: ['someone to cook', 'eat together', 'a meal', 'dinner with'] },
  { id: 'local', label: 'local knowledge', needles: ['local knowledge', 'new to the area', 'know the area', 'know the neighbourhood', 'know the neighborhood'] },
  { id: 'walk', label: 'a walk', needles: ['a walk', 'someone to walk', 'walk with'] },
  { id: 'questions', label: 'good questions', needles: ['good questions', 'someone to ask'] },
];

function phraseMatch(text, alias) {
  if (text === alias) return true;
  if (alias.length < 6) return false;
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${esc}(?:\\s|$)`).test(text);
}

/** Lowercase a sentence without the 30-character vibe cap. */
function plain(raw) {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function wordExtends(word, alias) {
  if (word === alias) return true;
  if (alias.length < 4 || !word.startsWith(alias)) return false;
  return ['s', 'es', 'ed', 'ing', 'er', 'ers'].includes(word.slice(alias.length));
}

/** Cluster labels found inside a sentence. No raw-text fallback. */
function textClusters(raw) {
  const text = plain(raw);
  if (!text) return [];
  const words = text.split(/[^a-z0-9&+]+/).filter(Boolean);
  const labels = [];
  for (const cluster of CLUSTERS) {
    const hit = cluster.aliases.some((alias) => phraseMatch(text, alias) || words.some((word) => wordExtends(word, alias)));
    if (hit && !labels.includes(cluster.label)) labels.push(cluster.label);
  }
  return labels;
}

function contentWords(raw) {
  return plain(raw)
    .split(/[^a-z0-9&+]+/)
    .filter((word) => word.length >= 4 && !WORD_STOP.has(word));
}

function missingFit(needer, giver) {
  const text = plain(needer?.missing);
  if (!text) return null;
  const offerTags = giver?.offerTags || [];
  const offerText = plain(giver?.offer);
  const hits = [];
  for (const cue of OFFER_CUES) {
    const asked = cue.needles.some((needle) => text.includes(needle));
    const offered = offerTags.includes(cue.id) || cue.needles.some((needle) => offerText.includes(needle));
    if (asked && offered) hits.push(cue);
  }
  if (hits.length) {
    return {
      offerIds: hits.map((cue) => cue.id),
      phrase: `what's missing for you lines up with what they offer: ${joinAnd(hits.slice(0, 2).map((cue) => cue.label))}`,
    };
  }
  const shared = contentWords(text).filter((word) => contentWords(offerText).includes(word));
  if (!shared.length) return null;
  return {
    offerIds: [],
    phrase: `what's missing for you lines up with what they offer (${shared.slice(0, 2).join(', ')})`,
  };
}

function sideLink(a, b) {
  const aSide = textClusters(a?.hiddenSide);
  const bSide = textClusters(b?.hiddenSide);
  const both = aSide.filter((label) => bSide.includes(label));
  if (both.length) return `you both have a side that wants ${joinAnd(both.slice(0, 2))}`;
  const theirs = explode(interestList(b)).map((item) => item.label);
  const meet = aSide.filter((label) => theirs.includes(label));
  if (meet.length) return `the side you haven't shown is into ${joinAnd(meet.slice(0, 2))}, and so are they`;
  const shared = contentWords(a?.hiddenSide).filter((word) => contentWords(b?.hiddenSide).includes(word));
  if (shared.length) return `you both named ${shared.slice(0, 2).join(' and ')} as a side that's been quiet`;
  return null;
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

function membership(g) {
  const inn = [];
  const curious = [];
  const map = g?.communities;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return { inn, curious };
  for (const [id, state] of Object.entries(map)) {
    if (state === 'in') inn.push(id);
    else if (state === 'curious') curious.push(id);
  }
  return { inn, curious };
}

function communityLink(a, b) {
  const A = membership(a);
  const B = membership(b);
  const both = A.inn.filter((id) => B.inn.includes(id));
  if (both.length) {
    const labels = both.slice(0, 2).map(communityLabel);
    return { kind: 'both', phrase: `you're both in ${joinAnd(labels)}`, labels, id: both[0] };
  }
  const intro = A.curious.find((id) => B.inn.includes(id));
  if (intro) {
    const label = communityLabel(intro);
    const who = b?.name ? `${b.name} is` : "they're";
    return { kind: 'curious', phrase: `${who} in ${label}, you're curious`, labels: [label], id: intro };
  }
  const host = A.inn.find((id) => B.curious.includes(id));
  if (host) {
    const label = communityLabel(host);
    return { kind: 'curious', phrase: `you're in ${label}, they're curious`, labels: [label], id: host };
  }
  return null;
}

/** need id -> community ids that are a warm way in. */
const NEED_COMMUNITIES = {
  environment: ['hiking', 'gardens', 'lido', 'ponds', 'climate', 'sauna'],
  inspiration: ['life-drawing', 'poetry', 'film', 'improv', 'photography', 'choir'],
  job: ['founders', 'encode', 'tech-meetups'],
  housemate: [],
  love: [],
  rest: ['yoga', 'meditation', 'sound-baths', 'reiki', 'sauna', 'sober'],
  clarity: ['meditation', 'buddhist', 'long-now', 'philosophy'],
  adventure: ['burning-man', 'hiking', 'raving', 'forest-ravers', 'psychedelic'],
  collaborators: ['founders', 'encode', 'improv', 'tech-meetups', 'choir'],
  support: ['reiki', 'womens-circles', 'mens-circles', 'neurodivergent', 'queer'],
};

function needWord(id) {
  const label = NEEDS.find((item) => item.id === id)?.label || id;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function needCommunity(needer, giver, skipId) {
  const needs = needer?.needTags || [];
  const inn = membership(giver).inn;
  for (const need of needs) {
    if (need === 'community') continue;
    const hit = (NEED_COMMUNITIES[need] || []).find((id) => inn.includes(id) && id !== skipId);
    if (hit) return { phrase: `you want ${needWord(need)}, they're in ${communityLabel(hit)}`, id: hit };
  }
  return null;
}

const SPOT_STOP = new Set(['the', 'and', 'with', 'near', 'around', 'from', 'that', 'this', 'your', 'for', 'favourite', 'favorite', 'walk', 'walks', 'walking', 'coffee', 'little', 'best', 'just', 'very', 'into', 'of', 'in', 'on', 'to', 'my', 'at', 'its', 'a']);
const SPOT_WEAK = new Set(['london', 'street', 'green', 'house', 'place', 'night', 'water', 'club', 'clubs', 'park', 'road', 'lane', 'hill', 'fields', 'cafe', 'bar']);

function spotPhrases(text) {
  const words = plain(text).split(/[^a-z0-9]+/).filter((word) => word && !SPOT_STOP.has(word));
  const out = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].length >= 5 && !SPOT_WEAK.has(words[i])) out.push(words[i]);
    if (i + 1 < words.length) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      const bothWeak = SPOT_WEAK.has(words[i]) && SPOT_WEAK.has(words[i + 1]);
      if (phrase.length >= 12 || (phrase.length >= 10 && !bothWeak)) out.push(phrase);
    }
  }
  return out;
}

function spotLink(a, b) {
  const shared = spotPhrases(a?.spot).filter((phrase) => spotPhrases(b?.spot).includes(phrase));
  shared.sort((left, right) => right.length - left.length);
  if (shared[0]) return { phrase: `you both love ${shared[0]}`, label: 'favourite spot' };
  const areas = AREAS.filter((area) => area.id !== 'visiting');
  const mentioned = areas.find((area) => {
    const label = area.label.toLowerCase();
    return plain(a?.spot).includes(label) && plain(b?.spot).includes(label);
  });
  if (mentioned) return { phrase: `your spots both sit around ${mentioned.label}`, label: 'favourite spot' };
  const home = areas.find((area) => area.id === b?.areaChip && plain(a?.spot).includes(area.label.toLowerCase()));
  if (home) return { phrase: `your spot is in their part of London`, label: 'favourite spot' };
  return null;
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
  const community = communityLink(a, b);
  const needComm = needCommunity(a, b, community?.id);
  const spot = spotLink(a, b);
  const youNeed = complementLine(a, b);
  const theyNeed = complementLine(b, a);
  const complement = !!(youNeed || theyNeed);
  const miss = missingFit(a, b);
  const side = sideLink(a, b);
  const missCovered = miss && youNeed && miss.offerIds.includes(youNeed.offer);

  let score = 0;
  if (community?.kind === 'both') score += 20;
  else if (community) score += 16;
  if (needComm) score += 14;
  if (spot) score += 12;
  score += Math.min(28, interests.length * 12);
  score += Math.min(16, music.length * 10);
  if (chapters.length) score += 14;
  score += prox.points;
  if (complement) score += 18;
  if (miss && !missCovered) score += 16;
  if (side) score += 12;
  score = Math.min(100, score);

  const labels = dedupe([
    ...(community?.labels || []),
    needComm ? 'need ↔ community' : null,
    spot ? spot.label : null,
    ...chapters,
    ...interests.map((item) => item.label),
    ...music.map((item) => item.label),
    prox.edgeLabel,
    complement ? 'need ↔ offer' : null,
    miss && !missCovered ? 'missing ↔ offer' : null,
    side ? 'hidden side' : null,
  ]).slice(0, 8);

  const into = dedupe([
    ...interests.slice(0, 2).map((item) => item.phrase),
    ...music.slice(0, 2).map((item) => item.phrase),
  ]).slice(0, 3);

  const bits = [];
  if (community) bits.push(community.phrase);
  if (needComm) bits.push(needComm.phrase);
  if (spot) bits.push(spot.phrase);
  if (chapters[0]) bits.push(`both ${chapters[0]}`);
  if (into.length) bits.push(`into ${joinAnd(into)}`);
  if (prox.phrase) bits.push(prox.phrase);
  if (youNeed) bits.push(youNeed.youNeed);
  else if (theyNeed) bits.push(theyNeed.theyNeed);
  if (miss && !missCovered) bits.push(miss.phrase);
  if (side) bits.push(side);
  // A community, a need, or a shared spot is the sentence. One extra clause is enough.
  const reason = (community || needComm || spot ? bits.slice(0, 2) : bits).join(', ');

  return { score: reason ? score : 0, labels: reason ? labels : [], reason, complement };
}

/** Stable tags for one person: interest clusters, music, soundtrack names, chapter. */
export function matchTags(g) {
  const tags = [];
  const push = (label) => { if (label && !tags.includes(label)) tags.push(label); };
  for (const item of explode(interestList(g))) push(item.label);
  for (const item of explode(musicList(g))) push(item.label);
  for (const short of chapterShorts(g)) push(short);
  for (const id of [...membership(g).inn, ...membership(g).curious]) push(communityLabel(id));
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
    if (guest.rsvp === 'no' || guest.hasCard === false) continue;
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
