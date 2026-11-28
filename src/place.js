// Where a guest lives, from what they typed, in the party's city.
//
// London: postcodes resolve offline from the bundled district table (see
// postcode.js); anything else ("Hackney", or any city's neighbourhoods and
// postcodes) goes to a geocoder, Photon (photon.komoot.io, OpenStreetMap data),
// biased to the party's city. Only the typed text is sent, never who typed it.
//
// Privacy is the same everywhere: a guest is placed at their area, not their
// address. A geocoded street or house is snapped to a ~500 m grid and shown
// by its district's name; the store adds the usual 150–450 m jitter.

import { parsePostcode, lookupOutcode } from './postcode.js';
import { isLondon, distanceKm, CITY_RADIUS_KM } from '../public/js/city.js';

const PHOTON = 'https://photon.komoot.io/api/';
const TIMEOUT_MS = 4000;
const MAX_TYPED = 60;
// Photon result types that are an area already; anything else is a point.
const AREAS = new Set(['city', 'district', 'locality', 'county', 'state']);
const PLACE_KEYS = new Set(['place', 'highway', 'boundary']);

const cache = new Map();
const remember = (k, v) => {
  cache.set(k, v);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
};

/**
 * Look a place up near the city. {area, lat, lng} or null.
 * @param {string} q
 * @param {{lat:number, lng:number}} city
 * @param {typeof fetch} [fetchFn]
 */
export async function geocode(q, city, fetchFn = globalThis.fetch) {
  const key = `${city.lat},${city.lng}:${q.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);
  const url = `${PHOTON}?${new URLSearchParams({ q, lat: city.lat, lon: city.lng, limit: '8', lang: 'en' })}`;
  let res;
  try {
    res = await fetchFn(url, { headers: { 'user-agent': 'whoswho party board' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return null; // offline or slow: don't remember, try again next time
  }
  if (!res.ok) return null;
  const { features = [] } = await res.json().catch(() => ({}));
  for (const f of features) {
    const [lng, lat] = f.geometry?.coordinates || [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || distanceKm(city, { lat, lng }) > CITY_RADIUS_KM) continue;
    const p = f.properties || {};
    // places, streets, addresses and postcodes; not shops, pubs or artworks
    // that happen to share the name
    if (!PLACE_KEYS.has(p.osm_key) && !p.housenumber && p.osm_value !== 'postcode') continue;
    const area = AREAS.has(p.type) || p.osm_value === 'postcode'
      ? p.name
      : p.district || p.locality || p.city || p.name;
    if (!area) continue;
    // a point (a street, a house): only keep roughly where it is
    const snap = AREAS.has(p.type) ? (n) => n : (n) => Math.round(n * 200) / 200;
    return remember(key, { area: String(area).slice(0, 60), lat: snap(lat), lng: snap(lng) });
  }
  return remember(key, null);
}

/**
 * What to store for what a guest typed: {postcode, area, lat, lng, key, known}.
 * `postcode` is the typed text (only /hax0r sees it); lat/lng are the area's
 * centre, before jitter; `key` seeds the jitter.
 */
export async function locate(raw, city, fetchFn) {
  const empty = { postcode: null, area: null, lat: null, lng: null, key: null, known: false };
  const typed = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TYPED) : '';
  if (!typed) return empty;
  if (isLondon(city)) {
    const parsed = parsePostcode(typed);
    if (parsed) {
      const hit = lookupOutcode(parsed.outcode);
      return hit
        ? { postcode: parsed.postcode, area: hit.area, lat: hit.lat, lng: hit.lng, key: parsed.outcode, known: true }
        : { ...empty, postcode: parsed.postcode };
    }
  }
  const hit = await geocode(typed, city, fetchFn);
  return hit ? { postcode: typed, ...hit, key: hit.area, known: true } : { ...empty, postcode: typed };
}
