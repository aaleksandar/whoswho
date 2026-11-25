// Vibe keywords: suggestions + normalisation. Pure ESM, shared by browser and server.

export const MAX_VIBES = 10;
export const MAX_VIBE_LEN = 30;

export { INTERESTS as VIBE_SUGGESTIONS } from './catalog.js';

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
export function normalizeVibes(list, max = MAX_VIBES) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const v of list) {
    const n = normalizeVibe(v);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= max) break;
  }
  return out;
}
