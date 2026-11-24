import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePostcode, lookupOutcode, jitter, resolveLocation } from '../src/postcode.js';
import { normalizeVibe, normalizeVibes, MAX_VIBES } from '../public/js/vibes.js';
import { buildGraph, topVibes } from '../public/js/graph-model.js';
import { normalizeAvatar, randomAvatar, renderAvatar, AVATAR_DIMENSIONS, DEFAULT_AVATAR } from '../public/js/avatar.js';
import { lanAddresses } from '../src/network.js';
import { loadEnvFile } from '../src/env.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('parsePostcode handles full, partial, spacing and case', () => {
  assert.deepEqual(parsePostcode('sw1a 1aa'), { postcode: 'SW1A 1AA', outcode: 'SW1A' });
  assert.deepEqual(parsePostcode('E81AB'), { postcode: 'E8 1AB', outcode: 'E8' });
  assert.deepEqual(parsePostcode(' e8 '), { postcode: 'E8', outcode: 'E8' });
  assert.deepEqual(parsePostcode('n1c'), { postcode: 'N1C', outcode: 'N1C' });
  assert.deepEqual(parsePostcode('SE15 4QF'), { postcode: 'SE15 4QF', outcode: 'SE15' });
  assert.equal(parsePostcode('hello'), null);
  assert.equal(parsePostcode(''), null);
  assert.equal(parsePostcode(42), null);
});

test('lookupOutcode knows London districts and not others', () => {
  assert.equal(lookupOutcode('E8').area, 'Hackney');
  assert.ok(lookupOutcode('SW11'));
  assert.equal(lookupOutcode('M1'), null); // Manchester
});

test('jitter is deterministic and bounded (150–450 m)', () => {
  const a = jitter(51.5, -0.1, 'seed');
  assert.deepEqual(a, jitter(51.5, -0.1, 'seed'));
  assert.notDeepEqual(a, jitter(51.5, -0.1, 'other'));
  for (const s of ['1', '2', '3', 'x', 'y']) {
    const p = jitter(51.5, -0.1, s);
    const dy = (p.lat - 51.5) * 111320;
    const dx = (p.lng + 0.1) * 111320 * Math.cos((51.5 * Math.PI) / 180);
    const d = Math.hypot(dx, dy);
    assert.ok(d >= 149 && d <= 451, `distance ${d}`);
  }
});

test('resolveLocation stores what was typed, places known districts only', () => {
  const known = resolveLocation('e8 3pb', 1);
  assert.equal(known.postcode, 'E8 3PB');
  assert.equal(known.area, 'Hackney');
  assert.ok(known.known && typeof known.lat === 'number');
  const unknown = resolveLocation('M1 1AE', 1);
  assert.equal(unknown.postcode, 'M1 1AE');
  assert.equal(unknown.lat, null);
  assert.equal(resolveLocation('', 1).postcode, null);
  assert.equal(resolveLocation('not a postcode', 1).lat, null);
});

test('normalizeVibe / normalizeVibes', () => {
  assert.equal(normalizeVibe('  AI   Safety '), 'ai safety');
  assert.equal(normalizeVibe('#Techno'), 'techno');
  assert.equal(normalizeVibe('x'.repeat(50)).length, 30);
  assert.deepEqual(normalizeVibes(['Art', 'art ', '', 'Jazz', 3]), ['art', 'jazz']);
  assert.equal(normalizeVibes(Array.from({ length: 20 }, (_, i) => `v${i}`)).length, MAX_VIBES);
  assert.deepEqual(normalizeVibes('nope'), []);
});

test('buildGraph links guests by shared vibes', () => {
  const { nodes, links } = buildGraph([
    { id: 1, vibes: ['art', 'techno', 'chess'] },
    { id: 2, vibes: ['art', 'techno'] },
    { id: 3, vibes: ['chess'] },
    { id: 4, vibes: [] },
  ]);
  assert.equal(nodes.length, 4);
  assert.deepEqual(
    links.map((l) => [l.source, l.target, l.shared]),
    [[1, 2, ['art', 'techno']], [1, 3, ['chess']]],
  );
  assert.deepEqual(nodes.map((n) => n.degree), [2, 1, 1, 0]);
  assert.deepEqual(topVibes([{ vibes: ['a', 'b'] }, { vibes: ['b'] }]), [
    { vibe: 'b', count: 2 },
    { vibe: 'a', count: 1 },
  ]);
});

test('normalizeAvatar whitelists ids and fills defaults', () => {
  assert.deepEqual(normalizeAvatar(null), { ...DEFAULT_AVATAR });
  const a = normalizeAvatar({ animal: 'sloth', hat: '<script>', glasses: 'round', extra: 'x' });
  assert.deepEqual(a, { animal: 'sloth', glasses: 'round', hat: DEFAULT_AVATAR.hat, bg: DEFAULT_AVATAR.bg });
  assert.equal(AVATAR_DIMENSIONS.find((d) => d.key === 'animal').options.length, 15);
});

test('pre-spirit-animal avatars map to a stable animal and keep accessories', () => {
  const old = { skin: 'honey', hair: 'buzz', hairColor: 'brown', glasses: 'shades', jewelry: 'none', piercing: 'none', hat: 'cap', bg: 'mint' };
  const a = normalizeAvatar(old);
  const animals = AVATAR_DIMENSIONS.find((d) => d.key === 'animal').options.map((o) => o.id);
  assert.ok(animals.includes(a.animal));
  assert.deepEqual(normalizeAvatar({ ...old }), a, 'same old spec -> same animal');
  assert.deepEqual({ glasses: a.glasses, hat: a.hat, bg: a.bg }, { glasses: 'shades', hat: 'cap', bg: 'mint' });
  const others = new Set(['afro', 'bob', 'locs', 'long', 'spiky', 'swept'].map((hair) => normalizeAvatar({ ...old, hair }).animal));
  assert.ok(others.size > 1, 'different old avatars spread across animals');
});

test('every animal renders with every glasses and hat', () => {
  const [animals, glasses, hats] = ['animal', 'glasses', 'hat'].map((k) => AVATAR_DIMENSIONS.find((d) => d.key === k).options);
  for (const an of animals) {
    for (const g of glasses) {
      for (const h of hats) {
        const svg = renderAvatar({ animal: an.id, glasses: g.id, hat: h.id, bg: 'teal' }, 64);
        assert.match(svg, /^<svg[^>]+viewBox="0 0 240 240"[\s\S]*<\/svg>$/);
        assert.ok(!/undefined|NaN/.test(svg), `${an.id}/${g.id}/${h.id}`);
      }
    }
  }
  const r = randomAvatar();
  assert.deepEqual(normalizeAvatar(r), r);
});

test('loadEnvFile fills process.env from a file without overriding the shell', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abu-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'ABU_TEST_FROM_FILE="file"\nABU_TEST_SHELL_WINS=file\n');
  process.env.ABU_TEST_SHELL_WINS = 'shell';
  try {
    assert.equal(loadEnvFile(file), true);
    assert.equal(process.env.ABU_TEST_FROM_FILE, 'file');
    assert.equal(process.env.ABU_TEST_SHELL_WINS, 'shell');
    assert.equal(loadEnvFile(path.join(dir, 'missing')), false);
  } finally {
    delete process.env.ABU_TEST_FROM_FILE;
    delete process.env.ABU_TEST_SHELL_WINS;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test('lanAddresses prefers private Wi-Fi/Ethernet over VPN and link-local', () => {
  const list = lanAddresses({
    lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    utun3: [{ family: 'IPv4', address: '10.8.0.2', internal: false }],
    en0: [{ family: 'IPv4', address: '192.168.1.23', internal: false }, { family: 'IPv6', address: 'fe80::1', internal: false }],
    en5: [{ family: 'IPv4', address: '169.254.10.1', internal: false }],
  });
  assert.equal(list[0].address, '192.168.1.23');
  assert.ok(!list.some((a) => a.address.startsWith('169.254')));
});
