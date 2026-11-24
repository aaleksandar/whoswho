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

  test('pages are served and / redirects to /home', async () => {
    for (const p of ['/home', '/hi', '/hax0r']) assert.equal((await s.call('GET', p)).status, 200, p);
    const res = await fetch(s.base + '/', { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/home');
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
    assert.ok(vibes.some((v) => v.vibe === 'scuba diving'));

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
