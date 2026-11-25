import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelsForTag, rankMatches, scorePair } from '../public/js/match.js';
import { buildGraph } from '../public/js/graph-model.js';
import { assertSafeToListen, deploymentMode, isPrivateHost, resolvePublicBase } from '../src/deploy.js';

test('clusters connect near-matches and leave exact tags alone', () => {
  assert.deepEqual(labelsForTag('philosophical'), ['philosophy']);
  assert.deepEqual(labelsForTag('philosophy'), ['philosophy']);
  assert.deepEqual(labelsForTag('jungian psychology'), ['psychology']);
  assert.deepEqual(labelsForTag('deep house'), ['deep house']);
  assert.deepEqual(labelsForTag('house music'), ['deep house']);
  assert.deepEqual(labelsForTag('house'), ['deep house']);
  assert.ok(!labelsForTag('house music').includes('music'));
  assert.deepEqual(labelsForTag('ceramics'), ['ceramics']);

  const a = { id: 1, interests: ['philosophical'], music: ['deep house'], chapter: ['moving'], area: 'Hackney', areaChip: 'hackney' };
  const b = { id: 2, interests: ['philosophy', 'psychology'], music: ['house music'], chapter: ['moving'], area: 'Dalston', areaChip: 'dalston' };
  const scored = scorePair(a, b);
  assert.ok(scored.labels.includes('philosophy'));
  assert.ok(scored.labels.includes('deep house'));
  assert.ok(scored.labels.includes('mid-move'));
  assert.match(scored.reason, /both mid-move/);
  assert.match(scored.reason, /philosophical/);
  assert.match(scored.reason, /deep house/);
  assert.match(scored.reason, /east London/);

  const fit = scorePair(
    { id: 1, needTags: ['home'], offerTags: [] },
    { id: 2, needTags: [], offerTags: ['spare-room'] },
  );
  assert.match(fit.reason, /spare room/);
  assert.ok(fit.labels.includes('need ↔ offer'));
});

test('a long missing answer still reaches an offer past thirty characters', () => {
  const scored = scorePair(
    { id: 1, missing: 'I have been circling it for months and what I actually need is someone who will listen' },
    { id: 2, offerTags: ['ear'], offer: 'I can sit with it and not fix it' },
  );
  assert.match(scored.reason, /listening ear/);
  assert.ok(scored.labels.includes('missing ↔ offer'));
});

test('what is missing lines up with what someone offers', () => {
  const scored = scorePair(
    { id: 1, missing: 'a spare room, and someone who will actually listen' },
    { id: 2, offerTags: ['spare-room', 'ear'], offer: 'a sofa for a few weeks' },
  );
  assert.match(scored.reason, /missing for you lines up/);
  assert.match(scored.reason, /spare room/);
  assert.ok(scored.labels.includes('missing ↔ offer'));
});

test('a hidden side is a reason when it meets theirs', () => {
  const scored = scorePair(
    { id: 1, hiddenSide: 'I have not painted in years' },
    { id: 2, interests: ['art'], hiddenSide: 'the part of me that still paints' },
  );
  assert.match(scored.reason, /art/);
  assert.ok(scored.labels.includes('hidden side'));
});

test('checked-in people are offered first', () => {
  const viewer = { id: 1, interests: ['poetry'], music: ['jazz'] };
  const guests = [
    viewer,
    { id: 2, name: 'Far', interests: ['poetry', 'books', 'film'], music: ['jazz'], checkedIn: false },
    { id: 3, name: 'Here', interests: ['poetry'], checkedIn: true },
    { id: 4, name: 'None', interests: ['origami'], checkedIn: true },
  ];
  const ranked = rankMatches(viewer, guests);
  assert.equal(ranked[0].guest.name, 'Here');
  assert.ok(ranked.some((row) => row.guest.name === 'Far'));
  assert.ok(!ranked.some((row) => row.guest.name === 'None'));
});

test('a full room keeps the strongest threads on the graph', () => {
  const guests = Array.from({ length: 12 }, (_, n) => ({
    id: n + 1,
    interests: ['poetry', 'music'],
    chapter: ['between'],
    music: ['jazz'],
  }));
  const { links } = buildGraph(guests);
  assert.ok(links.length >= 12);
  assert.ok(links.length <= 30, `too many edges: ${links.length}`);
  assert.ok(links.length < (guests.length * (guests.length - 1)) / 2);
  assert.ok(links.every((link) => link.shared.includes('poetry')));
});

test('old vibe-only guests still link the graph', () => {
  const { links } = buildGraph([
    { id: 1, vibes: ['art', 'techno', 'chess'] },
    { id: 2, vibes: ['art', 'techno'] },
    { id: 3, vibes: ['chess'] },
    { id: 4, vibes: [] },
  ]);
  assert.deepEqual(links.map((l) => [l.source, l.target, l.shared]), [
    [1, 2, ['art', 'techno']],
    [1, 3, ['chess']],
  ]);
});

test('public deploys require an admin password; LAN does not', () => {
  assert.equal(isPrivateHost('192.168.1.23'), true);
  assert.equal(isPrivateHost('10.1.2.3'), true);
  assert.equal(isPrivateHost('party.example.com'), false);
  assert.equal(deploymentMode({ publicBaseUrl: 'http://192.168.0.8:3000' }), 'lan');
  assert.equal(deploymentMode({ publicBaseUrl: 'https://party.example.com' }), 'public');
  assert.equal(deploymentMode({}), 'lan');
  assert.throws(() => assertSafeToListen({ PUBLIC_BASE_URL: 'https://party.example.com', ADMIN_PASSWORD: '' }), /ADMIN_PASSWORD/);
  assert.equal(assertSafeToListen({ PUBLIC_BASE_URL: 'https://party.example.com', ADMIN_PASSWORD: 'x' }), 'public');
  assert.equal(assertSafeToListen({ PUBLIC_HOST: '192.168.1.4' }), 'lan');
  assert.equal(resolvePublicBase({ publicBaseUrl: 'https://party.example.com/', port: 3000, lan: '10.0.0.1' }), 'https://party.example.com');
  assert.equal(resolvePublicBase({ port: 3000, lan: '10.0.0.1' }), 'http://10.0.0.1:3000');
});
