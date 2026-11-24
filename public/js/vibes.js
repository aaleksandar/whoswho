// Vibe keywords: suggestions + normalisation. Pure ESM, shared by browser and server.

export const MAX_VIBES = 10;
export const MAX_VIBE_LEN = 30;

export const VIBE_SUGGESTIONS = [
  'art', 'basketball', 'martial arts', 'scuba diving', 'techno', 'live music',
  'ai safety', 'data science', 'climbing', 'running', 'cycling', 'yoga',
  'surfing', 'skateboarding', 'wild swimming', 'football', 'tennis', 'chess',
  'board games', 'video games', 'photography', 'film', 'poetry', 'books',
  'cooking', 'baking', 'coffee', 'natural wine', 'gardening', 'travel',
  'hiking', 'dancing', 'jazz', 'hip hop', 'house music', 'djing', 'vinyl',
  'festivals', 'startups', 'open source', 'robotics', 'design', 'fashion',
  'theatre', 'stand-up comedy', 'philosophy', 'climate', 'volunteering',
  'meditation', 'languages', 'podcasts', 'anime', 'ceramics', 'knitting',
];

/** Lowercase, trim, collapse whitespace, strip leading '#', cap length. '' if empty. */
export function normalizeVibe(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFKC')
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_VIBE_LEN)
    .trim();
}

/** Normalise a list: drop empties and duplicates, cap the count. */
export function normalizeVibes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const v of list) {
    const n = normalizeVibe(v);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= MAX_VIBES) break;
  }
  return out;
}
