// The party's city: which map the display draws and where guests are placed.
// Shared by the browser and the server. London is special: it has the
// hand-made paper model and a bundled postcode table; any other city gets a
// paper city generated from its name, and guests are found with a geocoder.

export const DEFAULT_CITY = Object.freeze({
  name: 'London', region: 'England', country: 'United Kingdom', cc: 'GB', lat: 51.5074, lng: -0.1278,
});

// Where guests can live and still land on the map, from the city centre.
export const CITY_RADIUS_KM = 30;

const rad = (d) => (d * Math.PI) / 180;
/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Greater London (anything picked within the M25 counts, e.g. Croydon). */
export const isLondon = (city) => !!city && city.cc === 'GB' && distanceKm(city, DEFAULT_CITY) < 25;

const text = (v, max) => (typeof v === 'string' ? v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Validate a city from a form or the API; null if it isn't one. */
export function cleanCity(input) {
  if (!input || typeof input !== 'object') return null;
  const name = text(input.name, 80);
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) return null;
  const cc = text(input.cc, 2).toUpperCase();
  return {
    name,
    region: text(input.region, 80),
    country: text(input.country, 80),
    cc: /^[A-Z]{2}$/.test(cc) ? cc : '',
    lat: Math.round(lat * 1e4) / 1e4,
    lng: Math.round(lng * 1e4) / 1e4,
  };
}

/** 'Springfield, Illinois, United States'; parts that repeat the name are left out. */
export function cityLabel(c) {
  return [c.name, c.region, c.country].filter((p, i, a) => p && (i === 0 || (p !== c.name && p !== a[i - 1]))).join(', ');
}
