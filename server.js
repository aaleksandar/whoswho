// whoswho — party board for a room of people.
//   /        invite + intent + RSVP
//   /hi      heart-first registration
//   /night   the phone page for the night (matches, directory, check-in)
//   /me      edit or delete your own card
//   /home    TV: graph, map, needs, bringing
//   /hax0r   admin

import express from 'express';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDb, publicGuest, ownerGuest, ValidationError } from './src/db.js';
import { lanHost } from './src/network.js';
import { adminAuth, checkAdmin } from './src/auth.js';
import { parsePostcode, lookupOutcode } from './src/postcode.js';
import { loadEnvFile } from './src/env.js';
import { INTERESTS } from './public/js/catalog.js';
import { rankMatches } from './public/js/match.js';
import { publicEvent } from './src/event.js';
import { assertSafeToListen, resolvePublicBase } from './src/deploy.js';
import { codeMatches, destinationWithoutInvite, hasInvite, inviteCookie } from './src/invite.js';
import { maybeRewriteReasons } from './src/llm.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const page = (name) => path.join(ROOT, 'pages', `${name}.html`);

/**
 * @param {{db: ReturnType<typeof openDb>, getPort: () => number, adminPassword?: string, publicBaseUrl?: string, inviteCode?: string, playlistUrl?: string}} opts
 */
export function createApp({
  db,
  getPort,
  adminPassword = process.env.ADMIN_PASSWORD,
  publicBaseUrl = process.env.PUBLIC_BASE_URL || '',
  inviteCode = process.env.INVITE_CODE || '',
  playlistUrl = process.env.PLAYLIST_URL || '',
}) {
  const app = express();
  const password = String(adminPassword || '');
  const invite = String(inviteCode || '').trim();
  const playlist = String(playlistUrl || '').trim();
  const admin = adminAuth(password);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use((_req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  const baseUrl = () => resolvePublicBase({
    publicBaseUrl,
    publicHost: process.env.PUBLIC_HOST,
    port: getPort(),
    lan: lanHost(),
  });
  const secureCookies = () => baseUrl().startsWith('https://');

  const urls = () => {
    const base = baseUrl();
    return {
      base,
      joinUrl: `${base}/`,
      hiUrl: `${base}/hi`,
      nightUrl: `${base}/night`,
      doorUrl: `${base}/night?door=1`,
      homeUrl: `${base}/home`,
      adminUrl: `${base}/hax0r`,
      meUrl: `${base}/me`,
    };
  };

  const sendPage = (res, name) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(page(name));
  };

  const tokenOf = (req) => {
    const header = req.get('x-guest-token');
    if (header) return header.trim();
    const auth = req.get('authorization') || '';
    if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
    return '';
  };
  const guestFromToken = (req) => db.getByToken(tokenOf(req));

  const visibleGuest = (g) => g.rsvp !== 'no';
  const cardedGuest = (g) => visibleGuest(g) && g.hasCard;
  const publicList = () => db.listGuests().filter(cardedGuest).map(publicGuest);

  // ------------------------------------------------------------- live (SSE)
  const clients = new Set();
  const broadcast = (event, data) => {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(msg);
  };
  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, 25_000);
  heartbeat.unref();
  app.locals.closeClients = () => {
    clearInterval(heartbeat);
    for (const res of clients) res.end();
    clients.clear();
  };

  // A secret link (?invite=CODE) sets the cookie and strips the code from the URL.
  app.use((req, res, next) => {
    if (!invite || typeof req.query.invite !== 'string') return next();
    if (!codeMatches(req.query.invite, invite)) return res.redirect(303, '/?bad=1');
    res.setHeader('Set-Cookie', inviteCookie(invite, { secure: secureCookies() }));
    return res.redirect(303, destinationWithoutInvite(req.originalUrl));
  });

  const selfPath = (req) => req.path === '/me' || req.path === '/api/me' || req.path === '/api/me/checkin';
  const adminSurface = (req) => req.path === '/hax0r'
    || req.path.startsWith('/api/admin')
    || (req.path === '/api/settings' && req.method !== 'GET');
  // Shell, event copy and assets stay public. Guest answers do not.
  const publicPath = (req) => {
    const p = req.path;
    if (p === '/' || p === '/robots.txt' || p === '/api/event' || p === '/api/rsvp' || p === '/api/info') return true;
    if (p.startsWith('/api/postcode/')) return true;
    if (/^\/(css|js|fonts|vendor|data)\//.test(p)) return true;
    return false;
  };

  app.use((req, res, next) => {
    if (!invite || publicPath(req) || hasInvite(req, invite) || selfPath(req)) return next();
    if (password && (adminSurface(req) || checkAdmin(req, password))) {
      if (checkAdmin(req, password)) res.append('Set-Cookie', inviteCookie(invite, { secure: secureCookies() }));
      return next();
    }
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'This party is invite-only', code: 'invite' });
    }
    const nextPath = encodeURIComponent(req.originalUrl || '/');
    return res.redirect(303, `/?next=${nextPath}`);
  });

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  app.get('/api/event', (req, res) => {
    res.json({
      ...publicEvent({ playlistUrl: playlist }),
      gated: !!invite,
      invited: hasInvite(req, invite),
      counts: db.rsvpCounts(),
      bringing: slimBringing(db.bringingTally()),
    });
  });

  function slimBringing(tally) {
    const slim = (rows) => (rows || []).map(({ label, count }) => ({ label, count }));
    return { food: slim(tally.food), vibe: slim(tally.vibe) };
  }

  app.get('/api/rsvp', (_req, res) => res.json(db.rsvpCounts()));
  app.post('/api/rsvp', (req, res) => {
    const saved = db.addRsvp(req.body);
    broadcast('rsvp', saved.counts);
    res.status(201).json(saved);
  });

  app.get('/', (_req, res) => sendPage(res, 'landing'));

  app.get('/api/postcode/:pc', (req, res) => {
    const parsed = parsePostcode(req.params.pc);
    if (!parsed) return res.json({ valid: false, known: false });
    const hit = lookupOutcode(parsed.outcode);
    res.json({ valid: true, known: !!hit, outcode: parsed.outcode, area: hit?.area ?? null });
  });

  app.get('/api/info', (_req, res) => res.json({
    ...urls(),
    host: lanHost(),
    port: getPort(),
    gated: !!invite,
  }));

  app.use(express.static(path.join(ROOT, 'public'), { index: false }));
  app.use('/vendor/d3', express.static(path.join(ROOT, 'node_modules/d3/dist')));
  app.use('/vendor/leaflet', express.static(path.join(ROOT, 'node_modules/leaflet/dist')));
  app.get('/data/london-boroughs.geojson', (_req, res) =>
    res.type('application/geo+json').sendFile(path.join(ROOT, 'data/london-boroughs.geojson')),
  );

  // ------------------------------------------------------------- public-but-gated API
  app.get('/api/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  });

  const parseId = (req) => {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  app.get('/api/guests', (req, res) => {
    const list = db.listGuests().filter(visibleGuest);
    const rows = req.query.all === '1' ? list : list.filter((g) => g.hasCard);
    res.json(rows.map(publicGuest));
  });

  app.get('/api/open', (_req, res) => res.json(db.openRsvps()));

  app.post('/api/claim', (req, res) => {
    const id = Number(req.body?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Pick a name' });
    const guest = db.claimGuest(id);
    if (!guest) return res.status(404).json({ error: 'That name already has a card' });
    res.json({ ...ownerGuest(guest), editToken: guest.editToken });
  });

  app.post('/api/guests', (req, res) => {
    const created = db.createGuest(req.body);
    const guest = publicGuest(created);
    if (created.hasCard && created.rsvp !== 'no') broadcast('guests', { type: 'created', guest });
    res.status(201).json({ ...guest, editToken: created.editToken });
  });

  app.get('/api/me', (req, res) => {
    const me = guestFromToken(req);
    if (!me) return res.status(401).json({ error: 'Open your personal link on this phone', code: 'token' });
    res.json(ownerGuest(me));
  });

  app.put('/api/me', (req, res) => {
    const me = guestFromToken(req);
    if (!me) return res.status(401).json({ error: 'Open your personal link on this phone', code: 'token' });
    const guest = db.updateGuest(me.id, req.body);
    const pub = publicGuest(guest);
    const type = !me.hasCard && guest.hasCard ? 'created' : 'updated';
    if (guest.rsvp !== 'no' && guest.hasCard) broadcast('guests', { type, guest: pub });
    res.json(ownerGuest(guest));
  });

  app.delete('/api/me', (req, res) => {
    const me = guestFromToken(req);
    if (!me) return res.status(401).json({ error: 'Open your personal link on this phone', code: 'token' });
    db.deleteGuest(me.id);
    broadcast('guests', { type: 'deleted', id: me.id });
    res.status(204).end();
  });

  app.post('/api/me/checkin', (req, res) => {
    const me = guestFromToken(req);
    if (!me) return res.status(401).json({ error: 'Open your personal link on this phone', code: 'token' });
    const on = req.body?.here !== false;
    const guest = db.setCheckedIn(me.id, on);
    broadcast('guests', { type: 'updated', guest: publicGuest(guest) });
    res.json(publicGuest(guest));
  });

  app.get('/api/matches', async (req, res) => {
    const me = guestFromToken(req);
    if (!me) return res.status(401).json({ error: 'Open your personal link on this phone', code: 'token' });
    if (!me.hasCard) return res.json({ matches: [] });
    const matches = await maybeRewriteReasons(me.name, rankMatches(publicGuest(me), publicList()));
    res.json({ matches });
  });

  app.get('/api/settings', (_req, res) => res.json(db.getSettings()));

  app.get('/api/vibes', (_req, res) => {
    const counts = new Map();
    for (const g of db.listGuests()) {
      if (!visibleGuest(g)) continue;
      for (const v of g.interests || []) counts.set(v, (counts.get(v) || 0) + 1);
    }
    const used = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const rest = INTERESTS.filter((v) => !counts.has(v)).map((v) => [v, 0]);
    res.json([...used, ...rest].map(([vibe, count]) => ({ vibe, count })));
  });

  app.get('/api/bringing', (_req, res) => res.json(db.bringingTally()));

  app.get('/api/qr.svg', async (req, res) => {
    const target = req.query.target;
    const u = urls();
    let dest = target === 'door' ? u.doorUrl : target === 'hi' ? u.hiUrl : target === 'join' ? u.joinUrl : u.nightUrl;
    if (invite) {
      dest += `${dest.includes('?') ? '&' : '?'}invite=${encodeURIComponent(invite)}`;
    }
    const svg = await QRCode.toString(dest, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    });
    res.set('Cache-Control', 'no-store').type('image/svg+xml').send(svg);
  });

  app.get('/home', (_req, res) => sendPage(res, 'home'));
  app.get('/hi', (_req, res) => sendPage(res, 'hi'));
  app.get('/night', (_req, res) => sendPage(res, 'night'));
  app.get('/me', (_req, res) => sendPage(res, 'me'));
  app.get('/hax0r', admin, (_req, res) => sendPage(res, 'hax0r'));

  // -------------------------------------------------------------- admin API
  app.get('/api/admin/guests', admin, (_req, res) => res.json(db.listGuests()));
  app.get('/api/admin/rsvps', admin, (_req, res) => res.json(db.listRsvps()));

  app.put('/api/admin/guests/:id', admin, (req, res) => {
    const id = parseId(req);
    const guest = id && db.updateGuest(id, req.body);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });
    if (guest.rsvp) db.addRsvp({ name: guest.name, status: guest.rsvp });
    broadcast('guests', { type: 'updated', guest: publicGuest(guest) });
    res.json(guest);
  });

  app.post('/api/admin/guests/:id/checkin', admin, (req, res) => {
    const id = parseId(req);
    const guest = id && db.setCheckedIn(id, req.body?.here !== false);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });
    broadcast('guests', { type: 'updated', guest: publicGuest(guest) });
    res.json(guest);
  });

  app.delete('/api/admin/guests/:id', admin, (req, res) => {
    const id = parseId(req);
    if (!id || !db.deleteGuest(id)) return res.status(404).json({ error: 'Guest not found' });
    broadcast('guests', { type: 'deleted', id });
    res.status(204).end();
  });

  app.delete('/api/admin/guests', admin, (req, res) => {
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({ error: 'Send {"confirm":"DELETE"} to remove every guest' });
    }
    const deleted = db.deleteAllGuests();
    broadcast('guests', { type: 'reset' });
    res.json({ deleted });
  });

  app.put('/api/settings', admin, (req, res) => {
    const settings = db.updateSettings(req.body);
    broadcast('settings', settings);
    res.json(settings);
  });

  // ----------------------------------------------------------------- errors
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, _req, res, _next) => {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message, field: err.field });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}

// ------------------------------------------------------------------- main
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnvFile();
  let mode;
  try {
    mode = assertSafeToListen();
  } catch (err) {
    console.error(`\n  ${err.message}\n`);
    process.exit(1);
  }
  const PORT = Number(process.env.PORT) || 3000;
  const dbFile = process.env.DB_PATH || path.join(ROOT, 'whoswho.sqlite');
  if (dbFile !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });
  const db = openDb(dbFile);
  const app = createApp({ db, getPort: () => PORT });
  const server = app.listen(PORT, '0.0.0.0', () => {
    const base = resolvePublicBase({
      publicBaseUrl: process.env.PUBLIC_BASE_URL,
      publicHost: process.env.PUBLIC_HOST,
      port: PORT,
      lan: lanHost(),
    });
    const locked = process.env.ADMIN_PASSWORD ? 'password protected' : 'open on this network';
    const gate = process.env.INVITE_CODE ? 'invite gate on' : 'no invite gate';
    console.log(`\n  whoswho is up (${mode}, ${gate})\n`);
    console.log(`    Join      ${base}/`);
    console.log(`    Register  ${base}/hi`);
    console.log(`    Tonight   ${base}/night`);
    console.log(`    Display   ${base}/home`);
    console.log(`    Admin     ${base}/hax0r  (${locked})\n`);
    if (mode === 'lan' && lanHost() === 'localhost') {
      console.log('  No LAN address found. Set PUBLIC_HOST, or PUBLIC_BASE_URL if this is the public deploy.\n');
    }
  });
  const shutdown = () => {
    app.locals.closeClients();
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
