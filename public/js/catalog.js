// Heart-first chips and copy for the party. Shared by the browser and the server.
// Night-quest prompts can reuse these ids and labels later; nothing here is work-flavoured.

export const LEAD = Object.freeze({
  spot: "Where's your favourite walk, bar, or café in London?",
  bright: "What's the most positive thing that happened to you this week?",
  area: 'Which area of London do you live in?',
  need: 'What do you need in life right now?',
  communities: 'Which communities are you in, or want to explore?',
  missing: "What's missing in your life right now?",
  hiddenSide: "What side of you haven't you got to show in a while?",
});

export const LIMITS = {
  name: 40,
  spot: 80,
  bright: 140,
  need: 140,
  offer: 140,
  about: 500,
  question: 180,
  missing: 220,
  hiddenSide: 220,
  soundtrack: 160,
  chapterNote: 80,
  bringing: 80,
  link: 200,
};

export const CHAPTERS = [
  { id: 'between', label: 'Between chapters', short: 'between chapters' },
  { id: 'moving', label: 'Moving / new home', short: 'mid-move' },
  { id: 'pivot', label: 'Creative or career pivot', short: 'in a pivot' },
  { id: 'heart', label: 'Heart / relationship shift', short: 'in a heart shift' },
  { id: 'grounded', label: 'Grounded & steady', short: 'feeling grounded' },
  { id: 'exploring', label: 'Exploring / restless', short: 'feeling restless' },
];

export const NEEDS = [
  { id: 'environment', label: 'A change of environment' },
  { id: 'inspiration', label: 'Inspiration' },
  { id: 'job', label: 'A job' },
  { id: 'community', label: 'A community' },
  { id: 'housemate', label: 'A housemate / flat' },
  { id: 'love', label: 'Love' },
  { id: 'rest', label: 'Rest' },
  { id: 'clarity', label: 'Clarity' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'collaborators', label: 'Creative collaborators' },
  { id: 'support', label: 'Emotional support' },
];

/** Older cards used these ids. Reading them still means the same thing. */
export const NEED_ALIAS = {
  home: 'housemate',
  partner: 'love',
};

export function mapNeedIds(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const id of list) {
    if (typeof id !== 'string') continue;
    const next = NEED_ALIAS[id] || id;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

export const OFFERS = [
  { id: 'spare-room', label: 'A spare room or sofa' },
  { id: 'ear', label: 'A listening ear' },
  { id: 'intro', label: 'Introductions' },
  { id: 'collab', label: 'Making something together' },
  { id: 'accountability', label: 'Accountability' },
  { id: 'meal', label: 'Cooking / a meal' },
  { id: 'local', label: 'Local knowledge' },
  { id: 'walk', label: 'A walk and a talk' },
  { id: 'questions', label: 'Good questions' },
];

/** need id -> offer id. Directional copy is from the person who has the need. */
export const COMPLEMENTS = [
  { need: 'housemate', offer: 'spare-room', youNeed: 'you need a place, they have a spare room or sofa', theyNeed: 'they need a place, you have a spare room or sofa' },
  { need: 'housemate', offer: 'local', youNeed: 'you need a place, they know the neighbourhood', theyNeed: 'they need a place, you know the neighbourhood' },
  { need: 'clarity', offer: 'ear', youNeed: 'you want clarity, they can listen', theyNeed: 'they want clarity, you can listen' },
  { need: 'clarity', offer: 'questions', youNeed: 'you want clarity, they have good questions', theyNeed: 'they want clarity, you have good questions' },
  { need: 'clarity', offer: 'walk', youNeed: 'you want clarity, they will walk with you', theyNeed: 'they want clarity, you will walk with them' },
  { need: 'support', offer: 'ear', youNeed: 'you could use support, they can listen', theyNeed: 'they could use support, you can listen' },
  { need: 'support', offer: 'walk', youNeed: 'you could use support, they will walk with you', theyNeed: 'they could use support, you will walk with them' },
  { need: 'collaborators', offer: 'collab', youNeed: 'you want collaborators, they want to make something', theyNeed: 'they want collaborators, you want to make something' },
  { need: 'inspiration', offer: 'questions', youNeed: 'you want inspiration, they have good questions', theyNeed: 'they want inspiration, you have good questions' },
  { need: 'inspiration', offer: 'collab', youNeed: 'you want inspiration, they want to make something', theyNeed: 'they want inspiration, you want to make something' },
  { need: 'rest', offer: 'walk', youNeed: 'you want rest, they will walk with you', theyNeed: 'they want rest, you will walk with them' },
  { need: 'environment', offer: 'walk', youNeed: 'you want a change of scene, they will walk with you', theyNeed: 'they want a change of scene, you will walk with them' },
  { need: 'environment', offer: 'local', youNeed: 'you want a change of scene, they know the neighbourhood', theyNeed: 'they want a change of scene, you know the neighbourhood' },
  { need: 'adventure', offer: 'walk', youNeed: 'you want adventure, they will walk with you', theyNeed: 'they want adventure, you will walk with them' },
  { need: 'job', offer: 'intro', youNeed: 'you want a job, they can introduce you', theyNeed: 'they want a job, you can introduce them' },
  { need: 'community', offer: 'intro', youNeed: 'you want a community, they can introduce you', theyNeed: 'they want a community, you can introduce them' },
  { need: 'love', offer: 'ear', youNeed: 'you want love, they can listen', theyNeed: 'they want love, you can listen' },
];

export const INTERESTS = [
  'philosophy', 'futurism', 'consciousness', 'psychology', 'history', 'urbanism',
  'third places', 'spirituality', 'art', 'poetry', 'love & relationships', 'music',
  'film', 'books', 'travel', 'nature', 'meditation',
];

export const MUSIC = [
  'deep house', 'house', 'techno', 'jazz', 'soul', 'hip hop', 'ambient',
  'classical', 'folk', 'indie', 'disco', 'funk', 'drum & bass', 'singer-songwriter',
];

export const FOOD = [
  { id: 'drink', label: 'A drink' },
  { id: 'snack', label: 'A snack' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'sweet', label: 'Something sweet' },
  { id: 'savoury', label: 'Something savoury' },
  { id: 'other', label: 'Something else' },
];

export const BRING_VIBES = [
  { id: 'music', label: 'Music / DJ' },
  { id: 'cards', label: 'Cards / tarot' },
  { id: 'questions', label: 'Questions / a game' },
  { id: 'ritual', label: 'A small ritual' },
  { id: 'other', label: 'Something else' },
];

// Approximate neighbourhood centroids (public, coarse). Postcodes still win for the pin
// when a guest types one; these are the fallback when they only tap an area.
export const AREAS = [
  { id: 'hackney', label: 'Hackney', lat: 51.545, lng: -0.055, group: 'east' },
  { id: 'dalston', label: 'Dalston', lat: 51.547, lng: -0.075, group: 'east' },
  { id: 'stoke-newington', label: 'Stoke Newington', lat: 51.562, lng: -0.073, group: 'east' },
  { id: 'shoreditch', label: 'Shoreditch', lat: 51.526, lng: -0.08, group: 'east' },
  { id: 'bethnal-green', label: 'Bethnal Green', lat: 51.527, lng: -0.055, group: 'east' },
  { id: 'whitechapel', label: 'Whitechapel', lat: 51.519, lng: -0.059, group: 'east' },
  { id: 'islington', label: 'Islington', lat: 51.536, lng: -0.103, group: 'north' },
  { id: 'camden', label: 'Camden', lat: 51.539, lng: -0.143, group: 'north' },
  { id: 'kentish-town', label: 'Kentish Town', lat: 51.55, lng: -0.14, group: 'north' },
  { id: 'hampstead', label: 'Hampstead', lat: 51.556, lng: -0.178, group: 'north' },
  { id: 'stratford', label: 'Stratford', lat: 51.543, lng: 0.0, group: 'northeast' },
  { id: 'walthamstow', label: 'Walthamstow', lat: 51.583, lng: -0.02, group: 'northeast' },
  { id: 'tottenham', label: 'Tottenham', lat: 51.588, lng: -0.068, group: 'northeast' },
  { id: 'notting-hill', label: 'Notting Hill', lat: 51.511, lng: -0.196, group: 'west' },
  { id: 'hammersmith', label: 'Hammersmith', lat: 51.492, lng: -0.224, group: 'west' },
  { id: 'brixton', label: 'Brixton', lat: 51.462, lng: -0.115, group: 'south' },
  { id: 'peckham', label: 'Peckham', lat: 51.474, lng: -0.069, group: 'south' },
  { id: 'camberwell', label: 'Camberwell', lat: 51.474, lng: -0.093, group: 'south' },
  { id: 'clapham', label: 'Clapham', lat: 51.462, lng: -0.138, group: 'south' },
  { id: 'greenwich', label: 'Greenwich', lat: 51.482, lng: -0.009, group: 'southeast' },
  { id: 'lewisham', label: 'Lewisham', lat: 51.445, lng: -0.014, group: 'southeast' },
  { id: 'deptford', label: 'Deptford', lat: 51.478, lng: -0.026, group: 'southeast' },
  { id: 'visiting', label: 'Visiting', lat: 51.52369, lng: -0.08548, group: 'visit' },
];

export const AREA_GROUPS = {
  east: 'east London',
  north: 'north London',
  northeast: 'north-east London',
  west: 'west London',
  south: 'south London',
  southeast: 'south-east London',
};

export const RSVP = ['going', 'maybe', 'no'];

export function byId(list, id) {
  return list.find((item) => item.id === id) || null;
}

export function labelsFor(list, ids) {
  const map = new Map(list.map((item) => [item.id, item.label]));
  return (ids || []).map((id) => map.get(id)).filter(Boolean);
}

export function chapterSummary(g) {
  const parts = (g?.chapter || []).map((id) => byId(CHAPTERS, id)?.label).filter(Boolean);
  if (g?.chapterNote) parts.push(g.chapterNote);
  return parts.join(' · ');
}

export function needSummary(g) {
  const parts = labelsFor(NEEDS, g?.needTags);
  if (g?.need) parts.push(g.need);
  return parts.join(' · ');
}

/** The needs board shows the life-need chips, then a written need, then the older "what's missing" line. */
export function missingLine(g) {
  const chips = labelsFor(NEEDS, g?.needTags);
  if (chips.length) return chips.join(' · ');
  if (g?.need) return g.need;
  if (g?.missing) return g.missing;
  return '';
}

export function offerSummary(g) {
  const parts = labelsFor(OFFERS, g?.offerTags);
  if (g?.offer) parts.push(g.offer);
  return parts.join(' · ');
}

export function bringingSummary(g) {
  const food = byId(FOOD, g?.bringingKind);
  const vibe = byId(BRING_VIBES, g?.vibeKind);
  return {
    food: [food?.label, g?.bringingText].filter(Boolean).join(' · '),
    vibe: [vibe?.label, g?.vibeText].filter(Boolean).join(' · '),
  };
}

export function cleanIds(list, allowed, max) {
  if (!Array.isArray(list)) return [];
  const ok = new Set(allowed.map((item) => (typeof item === 'string' ? item : item.id)));
  const out = [];
  for (const id of list) {
    if (typeof id !== 'string' || !ok.has(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
