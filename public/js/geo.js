// Lat/lng -> local km around the map's centre (x east, y north). The 3D scene
// uses x for east and -y for its z axis. Paper London is centred on Charing
// Cross; a generated city on the city's own centre.
import { isLondon } from './city.js';

export const ORIGIN = { lat: 51.5074, lng: -0.1278 };
const KY = 110.57;

/** A projection for the party's city (London's by default). */
export function projector(city) {
  const o = !city || isLondon(city) ? ORIGIN : city;
  const kx = Math.cos(((o === ORIGIN ? 51.5 : o.lat) * Math.PI) / 180) * 111.32;
  return (lat, lng) => [(lng - o.lng) * kx, (lat - o.lat) * KY];
}

export const project = projector(null);
