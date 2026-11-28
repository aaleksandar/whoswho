// whoswho on Cloudflare: anyone can start a party at whoswho.hypermaps.world/<name>.
//
//   /                      landing page (pages/landing.html): what it is, and "create your party"
//   POST /api/parties      create one: {slug, title, password, city}
//   GET  /api/parties/:slug  {available}
//   /<slug>/…              that party: its display, phone page, admin and API
//
// Every party is its own Durable Object, named by its address: it keeps its
// guests in its own SQLite storage, holds its screens' live connections and
// its admin password (a salted hash). Static files (js, css, fonts, 3D data)
// are shared, served by Workers Static Assets before this code runs.

import { DurableObject } from 'cloudflare:workers';
import { createStore, DEFAULT_SETTINGS } from '../src/db.js';
import { createHandler } from '../src/app.js';
import { hashPassword, hashVerifier } from '../src/auth.js';
import { durableDriver } from './sqlite-driver.js';
import { cleanCity, DEFAULT_CITY } from '../public/js/city.js';
import home from '../pages/home.html';
import hi from '../pages/hi.html';
import hax0r from '../pages/hax0r.html';
import landing from '../pages/landing.html';

const PAGES = { home, hi, hax0r };

// Links from before parties had their own address go to the first party.
const LEGACY = 'until-iam-back-party';
// Renamed parties: the old link keeps working (and can't be claimed again).
const ALIASES = { 'abus-until-iam-back-party': 'until-iam-back-party' };
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set([
  'api', 'js', 'css', 'img', 'data', 'fonts', 'vendor', 'home', 'hi', 'hax0r', 'admin', 'new', 'create',
  'about', 'help', 'login', 'static', 'assets', 'www', 'app', 'party', 'parties', 'cdn-cgi', 'favicon.ico', 'robots.txt',
]);
// A real party's address, but only from the worker: never reachable from outside.
const INTERNAL = 'https://internal.party';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const html = (text, status = 200) => new Response(text, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
const checkSlug = (slug) => {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return 'Use 3–40 lowercase letters, numbers and dashes';
  if (RESERVED.has(slug) || ALIASES[slug]) return 'That address is reserved, try another';
  return null;
};

function notFound(slug) {
  return html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>No party here yet</title><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/landing.css">
<main class="ld-404"><p class="ld-kicker">whoswho.hypermaps.world/${slug}</p><h1>No party here yet.</h1>
<p>It could be yours.</p><a class="ld-btn" href="/?slug=${encodeURIComponent(slug)}#create">Create this party</a></main>`, 404);
}

export class Party extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.meta = this.readMeta(); // null until someone creates this party
    if (this.meta) this.boot();
  }

  readMeta() {
    const sql = this.ctx.storage.sql;
    const has = sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'party'").toArray().length;
    return has ? sql.exec('SELECT slug, title, salt, hash, created_at FROM party LIMIT 1').toArray()[0] || null : null;
  }

  boot() {
    this.db = createStore(durableDriver(this.ctx.storage));
    this.handler = createHandler({
      db: this.db,
      adminCheck: hashVerifier(this.meta),
      baseUrl: (req) => new URL(req.url).origin,
      rootPath: () => `/${this.meta.slug}`,
      info: (req) => ({ host: new URL(req.url).host, port: null, slug: this.meta.slug }),
      page: async (name) => PAGES[name],
      // the display's title if the host renamed it in /hax0r, else the name it was created with
      title: () => {
        const t = this.db.getSettings().title;
        return t && t !== DEFAULT_SETTINGS.title ? t : this.meta.title;
      },
    });
  }

  async create({ slug, title, password, city }) {
    if (this.meta) return json({ error: 'That address is taken, try another', field: 'slug' }, 409);
    const { salt, hash } = await hashPassword(password);
    if (this.readMeta()) return json({ error: 'That address is taken, try another', field: 'slug' }, 409); // lost a race
    const sql = this.ctx.storage.sql;
    this.ctx.storage.transactionSync(() => {
      sql.exec('CREATE TABLE IF NOT EXISTS party (slug TEXT NOT NULL, title TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT NOT NULL)');
      sql.exec('INSERT INTO party (slug, title, salt, hash, created_at) VALUES (?, ?, ?, ?, ?)', slug, title, salt, hash, new Date().toISOString());
    });
    this.meta = this.readMeta();
    this.boot();
    this.db.updateSettings({ title, city: city || DEFAULT_CITY });
    return json({ slug, title, city: this.db.getSettings().city }, 201);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.origin === INTERNAL) {
      if (url.pathname === '/exists') return json({ exists: !!this.meta });
      if (url.pathname === '/create') return this.create(await request.json());
      return json({ error: 'Not found' }, 404);
    }
    if (!this.meta) return url.pathname.startsWith('/api/') ? json({ error: 'No party here' }, 404) : notFound(request.headers.get('x-party-slug') || '');
    return (await this.handler.handle(request)) ?? json({ error: 'Not found' }, 404);
  }
}

const party = (env, slug) => env.PARTY.get(env.PARTY.idFromName(slug));

async function createParty(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const slug = String(body?.slug || '').trim().toLowerCase();
  const title = String(body?.title || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const password = String(body?.password || '');
  const bad = checkSlug(slug);
  if (bad) return json({ error: bad, field: 'slug' }, 400);
  if (!title) return json({ error: 'Give your party a name', field: 'title' }, 400);
  if (password.length < 6) return json({ error: 'Use at least 6 characters', field: 'password' }, 400);
  const city = cleanCity(body?.city);
  if (!city) return json({ error: 'Pick your city from the list', field: 'city' }, 400);
  return party(env, slug).fetch(`${INTERNAL}/create`, { method: 'POST', body: JSON.stringify({ slug, title, password, city }) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/') return html(landing.replaceAll('{{ORIGIN}}', url.origin));
    if (path === '/api/parties' && request.method === 'POST') return createParty(request, env);
    const avail = path.match(/^\/api\/parties\/([^/]+)$/);
    if (avail) {
      const slug = decodeURIComponent(avail[1]).toLowerCase();
      const bad = checkSlug(slug);
      if (bad) return json({ available: false, error: bad });
      const { exists } = await (await party(env, slug).fetch(`${INTERNAL}/exists`)).json();
      return json({ available: !exists, error: exists ? 'That address is taken, try another' : null });
    }

    // Before parties: /home, /hi, /hax0r and the API at the top level.
    if (path === '/home') return Response.redirect(`${url.origin}/${LEGACY}${url.search}`, 302);
    if (['/hi', '/hax0r'].includes(path)) return Response.redirect(`${url.origin}/${LEGACY}${path}${url.search}`, 302);
    if (path.startsWith('/api/')) return forward(request, env, LEGACY, path);

    const m = path.match(/^\/([^/]+)(\/.*)?$/);
    const slug = m ? decodeURIComponent(m[1]).toLowerCase() : '';
    if (ALIASES[slug]) return new Response(null, { status: 307, headers: { location: `${url.origin}/${ALIASES[slug]}${m[2] || ''}${url.search}` } });
    if (!m || checkSlug(slug)) return html('<!doctype html><meta charset="utf-8"><title>Not found</title><p>Not found. <a href="/">whoswho</a>', 404);
    if (m[1] !== slug) return Response.redirect(`${url.origin}/${slug}${m[2] || ''}${url.search}`, 301);
    if (m[2] === '/') return Response.redirect(`${url.origin}/${slug}${url.search}`, 301);
    return forward(request, env, slug, m[2] || '/'); // the party's own link is its display
  },
};

// The party sees its own paths (/home, /api/…), on the public origin.
function forward(request, env, slug, rest) {
  const url = new URL(request.url);
  const req = new Request(`${url.origin}${rest}${url.search}`, request);
  req.headers.set('x-party-slug', slug);
  return party(env, slug).fetch(req);
}
