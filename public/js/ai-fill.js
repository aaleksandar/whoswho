// "Fill it in with your AI": one prompt to copy, and a forgiving parser for the reply.
// Client-side only. Nothing here submits the form.

import { normalizeVibe } from './vibes.js';
import {
  LEAD, LIMITS, CHAPTERS, NEEDS, OFFERS, INTERESTS, MUSIC, FOOD, BRING_VIBES, AREAS, RSVP,
} from './catalog.js';
import { allCommunities, cleanCommunities } from './communities.js';

const ALIASES = {
  name: 'name',
  missing: 'missing',
  whatsmissing: 'missing',
  whatismissing: 'missing',
  hiddenside: 'hiddenSide',
  hidden: 'hiddenSide',
  side: 'hiddenSide',
  chapter: 'chapter',
  chapternote: 'chapterNote',
  needtags: 'needTags',
  needs: 'needTags',
  need: 'need',
  offertags: 'offerTags',
  offers: 'offerTags',
  offer: 'offer',
  interests: 'interests',
  rabbitholes: 'interests',
  interest: 'interests',
  question: 'question',
  music: 'music',
  soundtrack: 'soundtrack',
  area: 'areaChip',
  areachip: 'areaChip',
  london: 'areaChip',
  neighbourhood: 'areaChip',
  neighborhood: 'areaChip',
  spot: 'spot',
  favourite: 'spot',
  favoritespot: 'spot',
  favouritespot: 'spot',
  bright: 'bright',
  thisweek: 'bright',
  positive: 'bright',
  communities: 'communities',
  communitiesin: 'communitiesIn',
  imin: 'communitiesIn',
  communitiescurious: 'communitiesCurious',
  curious: 'communitiesCurious',
  postcode: 'postcode',
  outcode: 'postcode',
  bringingkind: 'bringingKind',
  food: 'bringingKind',
  bringingtext: 'bringingText',
  bringing: 'bringingText',
  vibekind: 'vibeKind',
  vibetext: 'vibeText',
  vibe: 'vibeText',
  rsvp: 'rsvp',
  coming: 'rsvp',
  notion: 'notion',
  instagram: 'instagram',
  substack: 'substack',
  site: 'site',
  website: 'site',
};

/** The prompt a guest pastes into their own chatbot. */
export function aiPrompt() {
  const chips = [
    ['needTags', NEEDS.map((c) => c.label)],
    ['area', AREAS.map((c) => c.label)],
    ['communitiesIn or communitiesCurious', allCommunities().map((c) => c.label)],
    ['rsvp', ['going', 'maybe', 'no']],
  ];
  return [
    'Help me fill in a short card for a Friday night with friends, "Until I\'m back".',
    'Friday 27 November 2026, 7:30pm onwards, 8 Dereham Place, London EC2A 3HJ, Shoreditch.',
    'It is a warm room, not networking. Keep the answers short.',
    '',
    'Ask these, in order:',
    `1. ${LEAD.spot}`,
    `2. ${LEAD.bright}`,
    `3. ${LEAD.area} Or that I am visiting.`,
    `4. ${LEAD.need} Use the need chips. Anything that does not fit goes in "need".`,
    `5. ${LEAD.communities} "communitiesIn" means I am in it. "communitiesCurious" means I want to try it. Use the names below. A community that is not listed can still be included, in my words.`,
    '',
    'Optional, only if I offer it:',
    `- ${LEAD.missing}`,
    `- ${LEAD.hiddenSide}`,
    '- A question I would love to ask someone tonight.',
    '- A soundtrack on repeat.',
    '',
    'Interview me one question at a time, or, if you already know me, draft the answers and let me correct them. Do not invent a name I did not give you. Leave anything you are unsure about blank.',
    '',
    'When the answers are ready, reply with a single JSON object and no other commentary. Use exactly these keys. Strings or arrays are both fine. Use "" or [] when you do not know.',
    '',
    '{',
    '  "name": "",',
    '  "spot": "",',
    '  "bright": "",',
    '  "area": "",',
    '  "postcode": "",',
    '  "needTags": [],',
    '  "need": "",',
    '  "communitiesIn": [],',
    '  "communitiesCurious": [],',
    '  "missing": "",',
    '  "hiddenSide": "",',
    '  "question": "",',
    '  "soundtrack": "",',
    '  "rsvp": "going"',
    '}',
    '',
    'Allowed values for the chip fields (the closest match is fine):',
    chips.map(([key, values]) => `${key}: ${values.join(' | ')}`).join('\n'),
  ].join('\n');
}

function normKey(label) {
  const raw = String(label || '').toLowerCase().trim();
  if (/^what('?s| is) missing\b/.test(raw)) return 'missing';
  if (raw.startsWith('what side') || raw.startsWith('hidden side') || raw.startsWith('a side')) return 'hiddenSide';
  if (/favourite|favorite/.test(raw) && /walk|bar|cafe|café|spot|place/.test(raw)) return 'spot';
  if (raw === 'spot' || raw.startsWith('favourite spot') || raw.startsWith('favorite spot')) return 'spot';
  if (/positive/.test(raw) || /this week/.test(raw)) return 'bright';
  if (raw.startsWith('what do you need')) return 'needTags';
  if (raw.includes('curious')) return 'communitiesCurious';
  if (raw.startsWith('communities') || raw.startsWith("i'm in") || raw.startsWith('im in') || raw.startsWith('which communities')) return 'communitiesIn';
  if (raw.startsWith('rabbit')) return 'interests';
  if (raw.startsWith('chapter note') || raw.startsWith('in your words')) return 'chapterNote';
  const flat = raw.replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '');
  return ALIASES[flat] || null;
}

function norm(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function asList(value) {
  if (Array.isArray(value)) return value.flatMap((item) => asList(item));
  if (value == null || value === '') return [];
  return String(value).split(/[,;/|]|\band\b/i).map((part) => part.trim()).filter(Boolean);
}

function closest(item, opts) {
  const text = norm(item);
  if (!text) return null;
  let best = null;
  let score = 0;
  for (const opt of opts) {
    const label = norm(opt.label);
    const id = norm(String(opt.id));
    let next = 0;
    if (text === label || text === id) next = 1000 + label.length;
    else if (label.length >= 4 && text.includes(label)) next = 200 + label.length;
    else if (id.length >= 4 && text === id) next = 200 + id.length;
    else if (label.length >= 4 && label.includes(text) && text.length >= 4) next = 50 + text.length;
    if (next > score) { best = opt; score = next; }
  }
  return best;
}

/**
 * Match free text to chip ids. Longest label wins, so "deep house" beats "house".
 * Extra words after a chip ("Fruit — clementines") come back as leftover.
 * @returns {{ ids: string[], leftover: string[] }}
 */
export function matchOptions(value, options) {
  const opts = options.map((opt) => (typeof opt === 'string' ? { id: opt, label: opt } : opt));
  const ids = [];
  const leftover = [];
  for (const item of asList(value)) {
    const hit = closest(item, opts);
    if (!hit) {
      leftover.push(item.trim());
      continue;
    }
    if (!ids.includes(hit.id)) ids.push(hit.id);
    const rest = item
      .replace(new RegExp(hit.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
      .replace(/^[\s,.:\-–—/]+|[\s,.:\-–—/]+$/g, '')
      .trim();
    if (rest && norm(rest) !== norm(hit.id) && norm(rest) !== norm(hit.label) && !/^(music|genre|genres|song|songs|vibe)$/i.test(rest)) {
      leftover.push(rest);
    }
  }
  return { ids, leftover };
}

function matchRsvp(value) {
  const text = norm(value);
  if (!text) return null;
  if (RSVP.includes(text)) return text;
  if (text.includes("can't") || text.includes('cant') || text.includes('not coming') || text === 'no') return 'no';
  if (text.startsWith('maybe') || text.includes('possibly')) return 'maybe';
  if (text.includes('be there') || text === 'yes' || text === 'going' || text === 'in') return 'going';
  return null;
}

function clip(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : '';
}

function joinBits(parts) {
  const out = [];
  for (const part of parts) {
    const text = clip(part, 400);
    if (text && !out.includes(text)) out.push(text);
  }
  return out.join(', ');
}

function knownCount(obj) {
  return Object.keys(obj).filter((key) => normKey(key)).length;
}

function matchBrace(text, start) {
  let depth = 0;
  let quote = '';
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractObject(text) {
  const stripped = text.replace(/```[a-z]*[ \t]*\n?/gi, '').replace(/```/g, '');
  const found = [];
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] !== '{') continue;
    const end = matchBrace(stripped, i);
    if (end < 0) continue;
    try {
      const value = JSON.parse(stripped.slice(i, end + 1));
      if (value && typeof value === 'object' && !Array.isArray(value)) found.push(value);
    } catch { /* a brace in prose, or JSON the parser will not take */ }
    i = end;
  }
  found.sort((a, b) => knownCount(b) - knownCount(a));
  return found.find((obj) => knownCount(obj) > 0) || null;
}

function extractLabels(text) {
  const stripped = text.replace(/```[a-z]*[ \t]*\n?/gi, '').replace(/```/g, '');
  const out = {};
  let current = null;
  for (const line of stripped.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][^:]{0,80}?)\s*:\s*(.*)$/);
    const key = match ? normKey(match[1]) : null;
    if (key) {
      current = key;
      out[current] = match[2].trim();
    } else if (current && line.trim()) {
      out[current] = `${out[current]} ${line.trim()}`.trim();
    }
  }
  return Object.keys(out).length ? out : null;
}

function kindAndText(rawKind, rawText, options, max) {
  const fromKind = matchOptions(rawKind, options);
  const fromText = matchOptions(rawText, options);
  const id = fromKind.ids[0] || fromText.ids[0] || null;
  const text = joinBits([
    ...fromKind.leftover,
    ...(fromText.ids[0] ? fromText.leftover : (rawText ? [rawText] : [])),
  ]);
  return { id, text: clip(text, max) };
}

function normalise(src) {
  const bag = {};
  for (const [key, value] of Object.entries(src)) {
    const canon = normKey(key);
    if (!canon || value == null || value === '') continue;
    bag[canon] = value;
  }
  const out = {};
  const put = (key, max) => {
    if (bag[key] == null || Array.isArray(bag[key])) return;
    const value = clip(bag[key], max);
    if (value) out[key] = value;
  };
  put('name', 40);
  put('spot', LIMITS.spot);
  put('bright', LIMITS.bright);
  put('missing', 220);
  put('hiddenSide', 220);
  put('question', 180);
  put('postcode', 10);

  const chapter = matchOptions(bag.chapter, CHAPTERS);
  if (chapter.ids.length) out.chapter = chapter.ids.slice(0, 3);
  const chapterNote = clip(joinBits([bag.chapterNote, ...chapter.leftover]), 80);
  if (chapterNote) out.chapterNote = chapterNote;

  const needs = matchOptions(bag.needTags, NEEDS);
  if (needs.ids.length) out.needTags = needs.ids.slice(0, 5);
  const need = clip(joinBits([bag.need, ...needs.leftover]), 140);
  if (need) out.need = need;

  const offers = matchOptions(bag.offerTags, OFFERS);
  if (offers.ids.length) out.offerTags = offers.ids.slice(0, 4);
  const offer = clip(joinBits([bag.offer, ...offers.leftover]), 140);
  if (offer) out.offer = offer;

  const interests = matchOptions(bag.interests, INTERESTS);
  const custom = interests.leftover.map((item) => normalizeVibe(item)).filter(Boolean);
  const interestIds = [...interests.ids, ...custom].filter((item, i, all) => all.indexOf(item) === i).slice(0, 12);
  if (interestIds.length) out.interests = interestIds;

  const music = matchOptions(bag.music, MUSIC);
  if (music.ids.length) out.music = music.ids.slice(0, 6);
  const soundtrack = clip(joinBits([bag.soundtrack, ...music.leftover]), 160);
  if (soundtrack) out.soundtrack = soundtrack;

  const communities = { ...cleanCommunities(bag.communities) };
  const inn = matchOptions(bag.communitiesIn, allCommunities());
  const curious = matchOptions(bag.communitiesCurious, allCommunities());
  for (const id of inn.ids) if (!communities[id]) communities[id] = 'in';
  for (const extra of inn.leftover) {
    const custom = cleanCommunities({ [extra]: 'in' });
    for (const [id, state] of Object.entries(custom)) if (!communities[id]) communities[id] = state;
  }
  for (const id of curious.ids) if (!communities[id]) communities[id] = 'curious';
  for (const extra of curious.leftover) {
    const custom = cleanCommunities({ [extra]: 'curious' });
    for (const [id, state] of Object.entries(custom)) if (!communities[id]) communities[id] = state;
  }
  const capped = Object.fromEntries(Object.entries(communities).slice(0, 12));
  if (Object.keys(capped).length) out.communities = capped;

  const area = matchOptions(bag.areaChip, AREAS);
  if (area.ids[0]) out.areaChip = area.ids[0];
  else if (area.leftover[0] && /^[A-Z]{1,2}\d/i.test(area.leftover[0].trim())) {
    out.postcode = out.postcode || area.leftover[0].trim().toUpperCase();
  }

  const food = kindAndText(bag.bringingKind, bag.bringingText, FOOD, 80);
  if (food.id) out.bringingKind = food.id;
  if (food.text) out.bringingText = food.text;

  const vibe = kindAndText(bag.vibeKind, bag.vibeText, BRING_VIBES, 80);
  if (vibe.id) out.vibeKind = vibe.id;
  if (vibe.text) out.vibeText = vibe.text;

  const rsvp = matchRsvp(bag.rsvp);
  if (rsvp) out.rsvp = rsvp;

  const links = {};
  for (const key of ['notion', 'instagram', 'substack', 'site']) {
    if (typeof bag[key] === 'string' && bag[key].trim()) links[key] = clip(bag[key], 200);
  }
  if (Object.keys(links).length) out.links = links;
  return out;
}

/**
 * Parse a chatbot reply into a partial guest. Missing fields are omitted.
 * Tolerates code fences, surrounding prose, JSON, or `Key: value` lines.
 * @param {string} raw
 */
export function parseAiAnswers(raw) {
  const text = String(raw || '').trim();
  if (!text) return {};
  const obj = extractObject(text) || extractLabels(text);
  if (!obj) return {};
  return normalise(obj);
}
