#!/usr/bin/env node
// One-off generator for the bundled geo data. Output is committed, so the app
// itself never needs internet to resolve postcodes or draw borough outlines.
//
//   data/outcodes.json            {OUTCODE: [lat, lng, areaLabel]}
//     Source: postcodes.io (Contains OS data © Crown copyright, Royal Mail data
//     © Royal Mail copyright, ONS data © Crown copyright — OGL v3).
//   data/london-boroughs.geojson  33 London boroughs (LAD codes E09*)
//     Source: ONS Open Geography Portal, Local Authority Districts (May 2024)
//     Boundaries UK BGC — OGL v3.
//
// Usage: npm run build:data

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

// Generous box around the M25 so every district inside the motorway is covered.
const BBOX = { south: 51.25, north: 51.72, west: -0.56, east: 0.35 };
const GRID_KM = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, init, attempt = 1) {
  const res = await fetch(url, init);
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 5) throw new Error(`${res.status} for ${url}`);
    await sleep(500 * attempt);
    return getJson(url, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

const round = (n, dp = 5) => Math.round(n * 10 ** dp) / 10 ** dp;

async function buildOutcodes() {
  const latStep = GRID_KM / 111;
  const lngStep = GRID_KM / (111 * Math.cos((51.5 * Math.PI) / 180));
  const points = [];
  for (let lat = BBOX.south; lat <= BBOX.north + 1e-9; lat += latStep) {
    for (let lng = BBOX.west; lng <= BBOX.east + 1e-9; lng += lngStep) points.push([lat, lng]);
  }
  console.log(`outcodes: querying ${points.length} grid points…`);

  const found = new Map();
  let done = 0;
  await pool(points, 6, async ([lat, lng]) => {
    const url = `https://api.postcodes.io/outcodes?lat=${lat}&lon=${lng}&radius=${GRID_KM * 1000 * 1.5}&limit=100`;
    const { result } = await getJson(url);
    for (const o of result || []) found.set(o.outcode, o);
    if (++done % 50 === 0) console.log(`  ${done}/${points.length} (${found.size} outcodes)`);
  });

  const inBox = [...found.values()].filter(
    (o) =>
      o.latitude >= BBOX.south && o.latitude <= BBOX.north &&
      o.longitude >= BBOX.west && o.longitude <= BBOX.east,
  );

  // Pick a single human label per district: the borough of the postcode
  // nearest the district centroid (bulk reverse geocode, 100 per request).
  const nearest = new Map();
  for (let i = 0; i < inBox.length; i += 100) {
    const chunk = inBox.slice(i, i + 100);
    const body = {
      geolocations: chunk.map((o) => ({ latitude: o.latitude, longitude: o.longitude, limit: 1, radius: 2000 })),
    };
    const { result } = await getJson('https://api.postcodes.io/postcodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    result.forEach((r, j) => {
      const district = r.result?.[0]?.admin_district;
      if (district) nearest.set(chunk[j].outcode, district);
    });
  }

  const out = {};
  for (const o of inBox.sort((a, b) => a.outcode.localeCompare(b.outcode, 'en', { numeric: true }))) {
    const districts = o.admin_district || [];
    const near = nearest.get(o.outcode);
    const label = near && (districts.length === 0 || districts.includes(near)) ? near : districts[0] || near || o.outcode;
    out[o.outcode] = [round(o.latitude), round(o.longitude), label];
  }
  await writeFile(path.join(DATA_DIR, 'outcodes.json'), JSON.stringify(out));
  console.log(`outcodes: wrote ${Object.keys(out).length} districts`);
}

async function buildBoroughs() {
  const url =
    'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/' +
    'Local_Authority_Districts_May_2024_Boundaries_UK_BGC/FeatureServer/0/query' +
    "?where=LAD24CD%20LIKE%20'E09%25'&outFields=LAD24CD,LAD24NM&outSR=4326&f=geojson";
  const gj = await getJson(url);
  const roundCoords = (c) => (typeof c[0] === 'number' ? [round(c[0], 4), round(c[1], 4)] : c.map(roundCoords));
  const features = gj.features.map((f) => ({
    type: 'Feature',
    properties: { code: f.properties.LAD24CD, name: f.properties.LAD24NM },
    geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
  }));
  if (features.length !== 33) throw new Error(`expected 33 boroughs, got ${features.length}`);
  await writeFile(
    path.join(DATA_DIR, 'london-boroughs.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features }),
  );
  console.log(`boroughs: wrote ${features.length} features`);
}

await mkdir(DATA_DIR, { recursive: true });
await buildBoroughs();
await buildOutcodes();
