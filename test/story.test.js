// The storyteller, with a stand-in for the Anthropic client (no network).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { openDb } from '../src/db.js';
import { createApp } from '../server.js';

function fakeClient(reply) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        create: async (req) => {
          calls.push(req);
          return typeof reply === 'function' ? reply(req, calls.length) : reply;
        },
      },
    },
  };
}
const told = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

async function start(opts) {
  const db = openDb(':memory:');
  let port = 0;
  const app = createApp({ db, getPort: () => port, adminPassword: '', ...opts });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  port = server.address().port;
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, json };
  };
  const stop = () => new Promise((r) => { app.locals.closeClients(); server.close(() => { db.close(); r(); }); });
  return { db, call, stop };
}

const join = (s, body) => s.call('POST', '/api/guests', { postcode: 'E8', avatar: { animal: 'fox', color: 'pink' }, ...body }).then((r) => r.json);

async function settled(s, token) {
  for (let i = 0; i < 50; i++) {
    const me = (await s.call('GET', '/api/me', undefined, { 'x-guest-token': token })).json;
    if (!me.storyPending) return me;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('story never settled');
}

describe('storyteller on', () => {
  let s;
  let client;
  before(async () => {
    client = fakeClient((_req, n) => told(`Story number ${n}.\n\nThe end.`));
    s = await start({ storyClient: client });
  });
  after(() => s.stop());

  test('joining with a life answer tells a story', async () => {
    const r = await join(s, { name: 'Maya', life: 'raid bins in Broadway Market and nap on car bonnets' });
    assert.equal(r.guest.life, 'raid bins in Broadway Market and nap on car bonnets');
    assert.equal(r.guest.storiesOn, true);
    const me = await settled(s, r.token);
    assert.match(me.story, /^Story number \d+\.\n\nThe end\.$/);
    const pub = (await s.call('GET', '/api/guests')).json.find((g) => g.id === r.guest.id);
    assert.equal(pub.story, me.story);
    assert.equal(pub.life, me.life);

    const req = client.calls.at(-1);
    assert.equal(req.model, 'claude-opus-5-5');
    assert.equal(req.fallbacks, 'default');
    assert.match(req.system, /storyteller/);
    const prompt = req.messages[0].content;
    assert.match(prompt, /name: Maya/);
    assert.match(prompt, /spirit animal: Fox/);
    assert.match(prompt, /Hackney/);
    assert.match(prompt, /raid bins in Broadway Market/);
    assert.match(prompt, /Wildcard ingredient: \S/);
  });

  test('a retelling includes their wish and what they said about themselves, not friends’ secrets', async () => {
    const a = await join(s, { name: 'Ana', life: 'collect maps and hoard shiny buttons' });
    const b = await join(s, { name: 'Ben', life: 'swim in the lido every morning' });
    await settled(s, a.token);
    await s.call('PUT', '/api/me', { need: 'a sabbatical' }, { 'x-guest-token': a.token });
    await s.call('POST', '/api/secrets', { text: 'once ate a whole wheel of brie', about: 'me' }, { 'x-guest-token': a.token });
    await s.call('POST', '/api/secrets', { text: 'snores like a walrus', about: a.guest.id }, { 'x-guest-token': b.token });
    const r = await s.call('POST', '/api/me/story', undefined, { 'x-guest-token': a.token });
    assert.equal(r.status, 202);
    await settled(s, a.token);
    const prompt = client.calls.at(-1).messages[0].content;
    assert.match(prompt, /name: Ana/);
    assert.match(prompt, /a sabbatical/);
    assert.match(prompt, /whole wheel of brie/);
    assert.doesNotMatch(prompt, /walrus/);
  });

  test('changing what you wrote retells; retellings run out', async () => {
    const r = await join(s, { name: 'Rosa', life: 'graze on Clapham Common' });
    await settled(s, r.token);
    const put = await s.call('PUT', '/api/me', { life: 'ride trams all day' }, { 'x-guest-token': r.token });
    assert.equal(put.status, 200);
    assert.equal(put.json.life, 'ride trams all day');
    let me = await settled(s, r.token);
    assert.match(client.calls.at(-1).messages[0].content, /ride trams all day/);
    while (me.tellsLeft > 0) {
      assert.equal((await s.call('POST', '/api/me/story', undefined, { 'x-guest-token': r.token })).status, 202);
      me = await settled(s, r.token);
    }
    assert.equal((await s.call('POST', '/api/me/story', undefined, { 'x-guest-token': r.token })).status, 429);
    // admins can still ask for one
    const before = client.calls.length;
    assert.equal((await s.call('POST', `/api/admin/guests/${r.guest.id}/story`)).status, 202);
    await settled(s, r.token);
    assert.equal(client.calls.length, before + 1);
    assert.equal((await s.call('PUT', '/api/me', { life: 'x' }, { 'x-guest-token': r.token })).status, 400);
    assert.equal((await s.call('POST', '/api/me/story')).status, 401);
  });

  test('admin can edit or clear a story; other edits leave it alone', async () => {
    const r = await join(s, { name: 'Oli', life: 'waddle along the South Bank' });
    await settled(s, r.token);
    const id = r.guest.id;
    const keep = await s.call('PUT', `/api/admin/guests/${id}`, { name: 'Oliver', postcode: 'E8', avatar: { animal: 'penguin', color: 'blue' } });
    assert.match(keep.json.story, /^Story number/);
    assert.equal(keep.json.life, 'waddle along the South Bank');
    const edited = await s.call('PUT', `/api/admin/guests/${id}`, { name: 'Oliver', story: 'A  kinder\n\n\n\nstory. ' });
    assert.equal(edited.json.story, 'A kinder\n\nstory.');
    const cleared = await s.call('PUT', `/api/admin/guests/${id}`, { name: 'Oliver', story: '' });
    assert.equal(cleared.json.story, null);
  });
});

describe('storyteller trouble', () => {
  test('a refusal or an API error leaves their own words and no story', async (t) => {
    const client = fakeClient((_req, n) => {
      if (n === 1) return { stop_reason: 'refusal', stop_details: { category: null }, content: [] };
      throw new Anthropic.InternalServerError(500, { type: 'error' }, 'boom', new Headers());
    });
    // the storyteller logs both; keep the test output clean
    const { warn, error } = console;
    console.warn = console.error = () => {};
    t.after(() => { console.warn = warn; console.error = error; });
    const s = await start({ storyClient: client });
    t.after(() => s.stop());
    const r = await join(s, { name: 'Kofi', life: 'truffle hunting in Peckham' });
    let me = await settled(s, r.token);
    assert.equal(me.story, null);
    assert.equal(me.life, 'truffle hunting in Peckham');
    await s.call('POST', '/api/me/story', undefined, { 'x-guest-token': r.token });
    me = await settled(s, r.token);
    assert.equal(me.story, null);
    assert.equal(me.tellsLeft, 4, 'a failed telling is not counted');
  });

  test('with no credentials the party still works, without stories', async (t) => {
    const prev = process.env.STORIES;
    process.env.STORIES = 'off';
    const s = await start({});
    t.after(async () => { process.env.STORIES = prev ?? ''; if (prev == null) delete process.env.STORIES; await s.stop(); });
    const r = await join(s, { name: 'Dev', life: 'write novels in a hedge' });
    assert.equal(r.guest.storiesOn, false);
    assert.equal(r.guest.storyPending, false);
    assert.equal((await s.call('POST', '/api/me/story', undefined, { 'x-guest-token': r.token })).status, 503);
    assert.equal((await s.call('POST', `/api/admin/guests/${r.guest.id}/story`)).status, 503);
  });
});
