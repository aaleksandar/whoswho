#!/usr/bin/env node
// One-off generator for public/data/cities.json: the world's towns and cities
// (50,000+ people, plus every capital), so a host can pick their party's city
// without any lookup service. The output is committed.
//
//   {countries: {GB: 'United Kingdom', …},
//    cities: [[name, region, countryCode, lat, lng, population], …]}  biggest first
//
// Source: GeoNames (cities15000, admin1CodesASCII, countryInfo), CC BY 4.0,
// https://www.geonames.org. Downloads them into a temporary folder.
//
// Usage: npm run build:cities

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data', 'cities.json');
const BASE = 'https://download.geonames.org/export/dump/';
const MIN_POP = 50_000;

const dir = mkdtempSync(path.join(tmpdir(), 'geonames-'));
try {
  const get = async (name) => {
    const res = await fetch(BASE + name);
    if (!res.ok) throw new Error(`${res.status} for ${name}`);
    const file = path.join(dir, name);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return file;
  };
  const zip = await get('cities15000.zip');
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
  const lines = (file) => readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));

  const countries = {};
  for (const c of lines(await get('countryInfo.txt'))) countries[c[0]] = c[4];
  const regions = {};
  for (const a of lines(await get('admin1CodesASCII.txt'))) regions[a[0]] = a[1];

  const round = (n) => Math.round(Number(n) * 1000) / 1000;
  const cities = lines(path.join(dir, 'cities15000.txt'))
    // PPLX are parts of a city (neighbourhoods), not cities of their own
    .filter((c) => c[7] !== 'PPLX' && (Number(c[14]) >= MIN_POP || c[7] === 'PPLC'))
    .map((c) => [c[2] || c[1], regions[`${c[8]}.${c[10]}`] || '', c[8], round(c[4]), round(c[5]), Number(c[14])])
    .sort((a, b) => b[5] - a[5]);

  const used = Object.fromEntries([...new Set(cities.map((c) => c[2]))].sort().map((cc) => [cc, countries[cc] || cc]));
  writeFileSync(OUT, JSON.stringify({ source: 'GeoNames, CC BY 4.0', countries: used, cities }));
  console.log(`Wrote ${cities.length} cities to ${path.relative(ROOT, OUT)}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
