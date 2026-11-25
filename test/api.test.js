import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../server.js';

async function start(opts = {}) {
  const db = openDb(':memory:');
  let port = 0;
  const app = createApp({ db, getPort: () => port, ...opts });
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, json, text, headers: res.headers };
  };
  const stop = () => new Promise((r) => { app.locals.closeClients(); server.close(() => { db.close(); r(); }); });
  return { db, base, call, stop };
}

describe('API (open admin)', () => {
  let s;
  before(async () => { s = await start({ adminPassword: '' }); });
  after(() => s.stop());

  test('pages are served, / is the invite, robots noindex', async () => {
    for (const p of ['/', '/home', '/hi', '/night', '/me', '/hax0r']) assert.equal((await s.call('GET', p)).status, 200, p);
    const home = await s.call('GET', '/');
    assert.match(home.text, /landing\.js/);
    assert.match(home.text, /noindex/);
    assert.match(home.headers.get('x-robots-tag'), /noindex/);
    const robots = await s.call('GET', '/robots.txt');
    assert.match(robots.text, /Disallow: \//);
    assert.equal((await s.call('GET', '/vendor/d3/d3.min.js')).status, 200);
    assert.equal((await s.call('GET', '/vendor/leaflet/leaflet.js')).status, 200);
    assert.equal((await s.call('GET', '/data/london-boroughs.geojson')).status, 200);
  });

  test('register a guest; public list hides the postcode', async () => {
    const r = await s.call('POST', '/api/guests', {
      name: '  Robin  ', avatar: { animal: 'koala', hat: 'evil' }, vibes: ['Techno', 'techno', 'AI Safety'],
      need: 'a climbing buddy', postcode: 'e8 3pb', about: '  Alignment  researcher, see linkedin.com/in/robin ',
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.name, 'Robin');
    assert.deepEqual(r.json.vibes, ['techno', 'ai safety']);
    assert.equal(r.json.avatar.animal, 'koala');
    assert.equal(r.json.avatar.hat, 'none');
    assert.equal(r.json.about, 'Alignment researcher, see linkedin.com/in/robin');
    assert.equal(r.json.area, 'Hackney');
    assert.ok(!('postcode' in r.json));

    const list = await s.call('GET', '/api/guests');
    assert.equal(list.json.length, 1);
    assert.ok(!('postcode' in list.json[0]));
    const adminList = await s.call('GET', '/api/admin/guests');
    assert.equal(adminList.json[0].postcode, 'E8 3PB');
  });

  test('validation errors are 400s', async () => {
    assert.equal((await s.call('POST', '/api/guests', { name: '   ' })).status, 400);
    assert.equal((await s.call('POST', '/api/guests', {})).status, 400);
    const bad = await fetch(s.base + '/api/guests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
    assert.equal(bad.status, 400);
    assert.equal((await s.call('PUT', '/api/settings', { rotateSeconds: 1 })).status, 400);
    assert.equal((await s.call('PUT', '/api/settings', { views: [] })).status, 400);
  });

  test('edit, delete, reset', async () => {
    const { json: g } = await s.call('POST', '/api/guests', { name: 'Sam', postcode: 'SW11' });
    const upd = await s.call('PUT', `/api/admin/guests/${g.id}`, { name: 'Sam B', postcode: 'N1', vibes: ['jazz'] });
    assert.equal(upd.status, 200);
    assert.equal(upd.json.name, 'Sam B');
    assert.equal(upd.json.area, 'Islington');
    assert.ok(upd.json.updatedAt);
    assert.equal((await s.call('PUT', '/api/admin/guests/9999', { name: 'x' })).status, 404);
    assert.equal((await s.call('DELETE', `/api/admin/guests/${g.id}`)).status, 204);
    assert.equal((await s.call('DELETE', `/api/admin/guests/${g.id}`)).status, 404);
    assert.equal((await s.call('DELETE', '/api/admin/guests', {})).status, 400);
    const reset = await s.call('DELETE', '/api/admin/guests', { confirm: 'DELETE' });
    assert.equal(reset.status, 200);
    assert.equal((await s.call('GET', '/api/guests')).json.length, 0);
  });

  test('settings round-trip', async () => {
    const def = await s.call('GET', '/api/settings');
    assert.equal(def.json.rotateSeconds, 20);
    const r = await s.call('PUT', '/api/settings', { rotateSeconds: 7, views: ['needs', 'graph', 'bogus'], title: 'Party' });
    assert.deepEqual(r.json, { title: 'Party', rotateSeconds: 7, views: ['graph', 'needs'] });
    assert.deepEqual((await s.call('GET', '/api/settings')).json, r.json);
  });

  test('vibes, postcode check, info and QR', async () => {
    await s.call('POST', '/api/guests', { name: 'A', vibes: ['underwater hockey'] });
    const vibes = (await s.call('GET', '/api/vibes')).json;
    assert.deepEqual(vibes[0], { vibe: 'underwater hockey', count: 1 });
    assert.ok(vibes.some((v) => v.vibe === 'philosophy'));
    assert.ok(!vibes.some((v) => ['startups', 'ai safety', 'data science', 'open source', 'robotics', 'scuba diving'].includes(v.vibe)));

    assert.deepEqual((await s.call('GET', '/api/postcode/se15%204qf')).json, { valid: true, known: true, outcode: 'SE15', area: 'Southwark' });
    assert.equal((await s.call('GET', '/api/postcode/zzz')).json.valid, false);

    const info = (await s.call('GET', '/api/info')).json;
    assert.match(info.hiUrl, /^http:\/\/[^/]+:\d+\/hi$/);
    const qr = await s.call('GET', '/api/qr.svg');
    assert.equal(qr.status, 200);
    assert.match(qr.headers.get('content-type'), /image\/svg\+xml/);
    assert.match(qr.text, /<svg/);
    assert.equal((await s.call('GET', '/api/nope')).status, 404);
  });

  test('SSE stream announces new guests', async () => {
    const ctrl = new AbortController();
    const res = await fetch(s.base + '/api/events', { signal: ctrl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    await s.call('POST', '/api/guests', { name: 'Live' });
    while (!buf.includes('"type":"created"')) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
    }
    ctrl.abort();
    assert.match(buf, /event: guests\ndata: .*"name":"Live"/);
  });
});

describe('API (password-protected admin)', () => {
  let s;
  before(async () => { s = await start({ adminPassword: 's3cret' }); });
  after(() => s.stop());

  test('admin routes need Basic auth; public routes do not', async () => {
    const auth = { authorization: 'Basic ' + Buffer.from('admin:s3cret').toString('base64') };
    const wrong = { authorization: 'Basic ' + Buffer.from('admin:nope').toString('base64') };
    assert.equal((await s.call('GET', '/hax0r')).status, 401);
    assert.equal((await s.call('GET', '/api/admin/guests')).status, 401);
    assert.equal((await s.call('GET', '/api/admin/guests', undefined, wrong)).status, 401);
    assert.equal((await s.call('PUT', '/api/settings', { title: 'x' })).status, 401);
    assert.equal((await s.call('GET', '/hax0r', undefined, auth)).status, 200);
    assert.equal((await s.call('GET', '/api/admin/guests', undefined, auth)).status, 200);
    assert.equal((await s.call('POST', '/api/guests', { name: 'Pub' })).status, 201);
    assert.equal((await s.call('GET', '/api/settings')).status, 200);
  });
});

describe('party board', () => {
  let s;
  before(async () => { s = await start({ adminPassword: '', publicBaseUrl: 'https://party.example.com', playlistUrl: 'https://example.com/playlist' }); });
  after(() => s.stop());

  test('public base URL is used for links', async () => {
    const info = (await s.call('GET', '/api/info')).json;
    assert.equal(info.joinUrl, 'https://party.example.com/');
    assert.equal(info.hiUrl, 'https://party.example.com/hi');
    assert.equal(info.nightUrl, 'https://party.example.com/night');
    assert.equal(info.doorUrl, 'https://party.example.com/night?door=1');
    const event = (await s.call('GET', '/api/event')).json;
    assert.equal(event.title, 'Bring your own vibe');
    assert.match(event.hook, /vibe/i);
    assert.doesNotMatch(event.hook, /Aleksandar/);
    assert.match(event.footnote, /Vietnam/);
    assert.ok(event.themes.some((theme) => /missing/i.test(theme.q)));
    assert.ok(event.themes.some((theme) => /side of you/i.test(theme.q)));
    assert.equal(event.place, '8 Dereham Place, London EC2A 3HJ');
    assert.equal(event.playlistUrl, 'https://example.com/playlist');
    assert.equal(event.gated, false);
  });

  test('RSVP, self-edit token, check-in, matches, bringing, postcode privacy', async () => {
    const rsvp = await s.call('POST', '/api/rsvp', { name: 'Ada', status: 'going' });
    assert.equal(rsvp.status, 201);
    assert.equal(rsvp.json.counts.going, 1);

    const a = await s.call('POST', '/api/guests', {
      name: 'Maya',
      chapter: ['moving', 'nope'],
      needTags: ['clarity', 'support'],
      offerTags: ['ear'],
      interests: ['jungian psychology', 'poetry'],
      music: ['deep house'],
      soundtrack: 'Khruangbin',
      question: 'How do you stay soft while starting over?',
      missing: 'someone who will listen without fixing it',
      hiddenSide: 'the part of me that still wants to paint',
      areaChip: 'dalston',
      bringingKind: 'fruit',
      bringingText: 'clementines',
      vibeKind: 'cards',
      vibeText: 'a short tarot pull',
      links: { instagram: '@maya.writes', site: 'javascript:alert(1)' },
      linksConsent: true,
    });
    assert.equal(a.status, 201);
    assert.equal((await s.call('GET', '/api/event')).json.counts.going, 2);
    assert.equal(a.json.area, 'Dalston');
    assert.ok(a.json.editToken);
    assert.deepEqual(a.json.chapter, ['moving']);
    assert.equal(a.json.missing, 'someone who will listen without fixing it');
    assert.equal(a.json.hiddenSide, 'the part of me that still wants to paint');
    assert.equal(a.json.links.instagram, 'https://instagram.com/maya.writes');
    assert.equal(a.json.links.site, null);
    assert.ok(!('postcode' in a.json));

    const hidden = await s.call('POST', '/api/guests', {
      name: 'Secret',
      links: { site: 'https://example.com/secret' },
    });
    assert.equal(hidden.json.links, null);

    const b = await s.call('POST', '/api/guests', {
      name: 'Theo',
      chapter: ['between'],
      needTags: ['clarity'],
      offerTags: ['questions', 'ear'],
      interests: ['philosophy', 'psychology'],
      music: ['house music'],
      question: 'What are you not saying in rooms like this?',
      postcode: 'E8',
      areaChip: 'hackney',
    });
    assert.equal(b.json.area, 'Hackney');
    assert.ok(!('postcode' in (await s.call('GET', '/api/guests')).json.find((g) => g.name === 'Theo')));
    assert.equal((await s.call('GET', '/api/admin/guests')).json.find((g) => g.name === 'Theo').postcode, 'E8');

    const token = a.json.editToken;
    const me = await s.call('GET', '/api/me', undefined, { 'x-guest-token': token });
    assert.equal(me.json.name, 'Maya');
    const renamed = await s.call('PUT', '/api/me', {
      name: 'Maya B', chapter: ['moving'], interests: ['poetry'], music: ['deep house'], areaChip: 'dalston',
      bringingKind: 'fruit', bringingText: 'clementines', vibeKind: 'cards', vibeText: 'a short tarot pull',
    }, { 'x-guest-token': token });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.json.name, 'Maya B');
    const afterRename = (await s.call('GET', '/api/event')).json.counts.going;
    assert.equal(afterRename, 4);
    assert.equal((await s.call('GET', '/api/rsvp')).json.going, afterRename);
    assert.ok(!renamed.json.editToken);

    const here = await s.call('POST', '/api/me/checkin', { here: true }, { 'x-guest-token': token });
    assert.equal(here.json.checkedIn, true);

    const matches = await s.call('GET', '/api/matches', undefined, { 'x-guest-token': b.json.editToken });
    assert.equal(matches.status, 200);
    const maya = matches.json.matches.find((row) => row.guest.name === 'Maya B');
    assert.ok(maya, 'Theo should match Maya');
    assert.match(maya.reason, /psychology|poetry|house|Hackney|east London|clarity|listen/i);
    assert.equal(maya.checkedIn, true);

    const tally = (await s.call('GET', '/api/bringing')).json;
    assert.ok(tally.food.some((row) => row.kind === 'fruit' && row.items.includes('clementines')));
    assert.ok(tally.vibe.some((row) => row.kind === 'cards'));

    const visiting = await s.call('POST', '/api/guests', { name: 'Aisha', areaChip: 'visiting', postcode: 'SW1A 1AA' });
    assert.equal(visiting.json.area, 'Visiting');
    assert.equal(visiting.json.postcode, undefined);
    assert.equal((await s.call('GET', '/api/admin/guests')).json.find((g) => g.name === 'Aisha').postcode, null);

    const gone = await s.call('DELETE', '/api/me', undefined, { 'x-guest-token': token });
    assert.equal(gone.status, 204);
    assert.equal((await s.call('GET', '/api/guests')).json.some((g) => g.name === 'Maya B'), false);
    assert.equal((await s.call('GET', '/api/me', undefined, { 'x-guest-token': token })).status, 401);
  });
});

describe('invite gate', () => {
  let s;
  before(async () => { s = await start({ adminPassword: 's3cret', inviteCode: 'letmein' }); });
  after(() => s.stop());

  test('strangers cannot read guests; the secret link sets a cookie', async () => {
    assert.equal((await s.call('GET', '/api/guests')).status, 401);
    assert.equal((await s.call('GET', '/api/bringing')).status, 401);
    assert.equal((await s.call('GET', '/api/qr.svg')).status, 401);
    assert.equal((await s.call('GET', '/api/event')).status, 200);
    assert.equal((await s.call('POST', '/api/rsvp', { name: 'Jo', status: 'maybe' })).status, 201);
    const page = await fetch(s.base + '/home', { redirect: 'manual' });
    assert.equal(page.status, 303);
    assert.match(page.headers.get('location'), /^\/\?next=/);

    const bad = await fetch(s.base + '/?invite=nope', { redirect: 'manual' });
    assert.equal(bad.status, 303);
    assert.equal(bad.headers.get('location'), '/?bad=1');

    const ok = await fetch(s.base + '/night?door=1&invite=letmein', { redirect: 'manual' });
    assert.equal(ok.status, 303);
    assert.equal(ok.headers.get('location'), '/night?door=1');
    const cookie = ok.headers.get('set-cookie');
    assert.match(cookie, /ww_invite=/);
    assert.doesNotMatch(cookie, /letmein/);
    const guests = await s.call('GET', '/api/guests', undefined, { cookie: cookie.split(';')[0] });
    assert.equal(guests.status, 200);

    const header = await s.call('GET', '/api/vibes', undefined, { 'x-invite-code': 'letmein' });
    assert.equal(header.status, 200);

    const auth = { authorization: 'Basic ' + Buffer.from('host:s3cret').toString('base64') };
    assert.equal((await s.call('GET', '/hax0r', undefined, auth)).status, 200);
    assert.equal((await s.call('GET', '/api/admin/guests')).status, 401);
  });
});

test('data survives reopening the database file', async (t) => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'whoswho-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'test.sqlite');
  let db = openDb(file);
  db.createGuest({ name: 'Persist', vibes: ['art'], postcode: 'E8' });
  db.updateSettings({ rotateSeconds: 9 });
  db.close();
  db = openDb(file);
  assert.equal(db.listGuests()[0].name, 'Persist');
  assert.equal(db.getSettings().rotateSeconds, 9);
  db.close();
});
