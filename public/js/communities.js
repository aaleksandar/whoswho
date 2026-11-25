// Communities a guest is in, or curious about. Shared by the form, the matcher, and the server.
// Names are real London scenes and clubs, written so anyone can tap one without a caveat.

import { normalizeVibe } from './vibes.js';

export const COMMUNITY_GROUPS = [
  {
    id: 'move',
    label: 'Move',
    items: [
      { id: 'running', label: 'Running clubs' },
      { id: 'parkrun', label: 'Parkrun' },
      { id: 'raving-bike', label: 'Raving Bike Riders' },
      { id: 'cycling', label: 'Cycling' },
      { id: 'critical-mass', label: 'Critical Mass' },
      { id: 'paddle', label: 'Paddle' },
      { id: 'skate', label: 'Skateboarding' },
      { id: 'climbing', label: 'Climbing / bouldering' },
      { id: 'lido', label: 'Lido swimming' },
      { id: 'ponds', label: 'Pond swimming' },
      { id: 'football', label: 'Football / 5-a-side' },
      { id: 'netball', label: 'Netball' },
      { id: 'tennis', label: 'Tennis' },
      { id: 'rowing', label: 'Rowing' },
      { id: 'yoga', label: 'Yoga' },
      { id: 'hiking', label: 'Hiking / ramblers' },
      { id: 'sauna', label: 'Sauna' },
      { id: 'good-gym', label: 'Good Gym' },
    ],
  },
  {
    id: 'dance',
    label: 'Dance & music',
    items: [
      { id: 'raving', label: 'Raving' },
      { id: 'techno', label: 'Techno' },
      { id: 'forest-ravers', label: 'Forest Ravers' },
      { id: 'jazz', label: 'Jazz' },
      { id: 'dnb', label: 'Drum & bass' },
      { id: 'belly-dance', label: 'Belly dance' },
      { id: 'ecstatic', label: 'Ecstatic dance' },
      { id: 'salsa', label: 'Salsa' },
      { id: 'tango', label: 'Tango' },
      { id: 'swing', label: 'Swing' },
      { id: 'choir', label: 'Choirs' },
    ],
  },
  {
    id: 'mind',
    label: 'Mind & spirit',
    items: [
      { id: 'meditation', label: 'Meditation' },
      { id: 'buddhist', label: 'Buddhist centres' },
      { id: 'reiki', label: 'Reiki' },
      { id: 'sound-baths', label: 'Sound baths' },
      { id: 'psychedelic', label: 'Psychedelic Society' },
      { id: 'faith', label: 'Faith communities' },
      { id: 'quaker', label: 'Quakers' },
      { id: 'sober', label: 'Sober curious' },
      { id: 'sober-raving', label: 'Sober raving' },
    ],
  },
  {
    id: 'make',
    label: 'Make & create',
    items: [
      { id: 'improv', label: 'Improv' },
      { id: 'comedy', label: 'Comedy' },
      { id: 'pottery', label: 'Pottery / ceramics' },
      { id: 'life-drawing', label: 'Life drawing' },
      { id: 'poetry', label: 'Poetry / open mic' },
      { id: 'photography', label: 'Photography' },
      { id: 'film', label: 'Film clubs' },
      { id: 'crafts', label: 'Crafts / knitting' },
      { id: 'supper-clubs', label: 'Supper clubs' },
      { id: 'natural-wine', label: 'Natural wine' },
    ],
  },
  {
    id: 'talk',
    label: 'Talk & think',
    items: [
      { id: 'founders', label: 'Founders' },
      { id: 'long-now', label: 'Long Now / futurists' },
      { id: 'encode', label: 'Encode Club' },
      { id: 'book-clubs', label: 'Book clubs' },
      { id: 'chess', label: 'Chess' },
      { id: 'board-games', label: 'Board games' },
      { id: 'dnd', label: 'D&D' },
      { id: 'gaming', label: 'Gaming' },
      { id: 'language', label: 'Language exchange' },
      { id: 'tech-meetups', label: 'Tech meetups' },
      { id: 'philosophy', label: 'Philosophy' },
    ],
  },
  {
    id: 'care',
    label: 'Care & cause',
    items: [
      { id: 'mutual-aid', label: 'Mutual aid' },
      { id: 'volunteering', label: 'Volunteering' },
      { id: 'gardens', label: 'Community gardens / allotments' },
      { id: 'climate', label: 'Climate action' },
      { id: 'parents', label: 'Parents' },
    ],
  },
  {
    id: 'belong',
    label: 'Identity & belonging',
    items: [
      { id: 'queer', label: 'Queer' },
      { id: 'black-poc', label: 'Black / POC collectives' },
      { id: 'neurodivergent', label: 'Neurodivergent' },
      { id: 'disability-arts', label: 'Disability arts' },
      { id: 'womens-circles', label: "Women's circles" },
      { id: 'mens-circles', label: "Men's circles" },
    ],
  },
  {
    id: 'wild',
    label: 'Wild side',
    items: [
      { id: 'shibari', label: 'Shibari' },
      { id: 'sex-positive', label: 'Sex positive' },
      { id: 'burning-man', label: 'Burning Man' },
    ],
  },
];

const ALL = COMMUNITY_GROUPS.flatMap((group) => group.items);

export function allCommunities() {
  return ALL;
}

export function communityLabel(id) {
  return ALL.find((item) => item.id === id)?.label || id;
}

/** Map a typed name onto a catalog id, or keep it as the guest's own words. */
export function canonCommunityId(raw) {
  const text = String(raw || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  const byId = ALL.find((item) => item.id === lower);
  if (byId) return byId.id;
  const byLabel = ALL.find((item) => item.label.toLowerCase() === lower);
  if (byLabel) return byLabel.id;
  const vibe = normalizeVibe(text);
  if (!vibe || vibe.length < 2) return '';
  const byVibe = ALL.find((item) => item.id === vibe || normalizeVibe(item.label) === vibe);
  return byVibe ? byVibe.id : vibe;
}

/**
 * { id: 'in'|'curious' } or { in: [], curious: [] }.
 * Unknown names are kept. Bad states are dropped. Capped at 12.
 */
export function cleanCommunities(src) {
  const out = {};
  const add = (raw, state) => {
    if (state !== 'in' && state !== 'curious') return;
    const id = canonCommunityId(raw);
    if (!id || out[id]) return;
    if (Object.keys(out).length >= 12) return;
    out[id] = state;
  };
  if (!src || typeof src !== 'object') return out;
  if (Array.isArray(src)) {
    for (const id of src) add(id, 'in');
    return out;
  }
  if (Array.isArray(src.in) || Array.isArray(src.curious)) {
    for (const id of src.in || []) add(id, 'in');
    for (const id of src.curious || []) add(id, 'curious');
    return out;
  }
  for (const [id, state] of Object.entries(src)) add(id, state);
  return out;
}

export function communityLine(g) {
  const inn = [];
  const curious = [];
  for (const [id, state] of Object.entries(g?.communities || {})) {
    const label = communityLabel(id);
    if (state === 'curious') curious.push(label);
    else if (state === 'in') inn.push(label);
  }
  const bits = [];
  if (inn.length) bits.push(inn.join(', '));
  if (curious.length) bits.push(`curious about ${curious.join(', ')}`);
  return bits.join(' · ');
}
