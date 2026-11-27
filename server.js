// whoswho — local-network guest board.
//   /home   rotating display (3D map · the cloud · wishes) with a QR code to /hi
//   /hi     join, then drop secrets and wishes from your phone
//   /hax0r  admin

import express from 'express';
import QRCode from 'qrcode';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDb, publicGuest, ValidationError, AuthError } from './src/db.js';
import { lanHost } from './src/network.js';
import { adminAuth } from './src/auth.js';
import { parsePostcode, lookupOutcode } from './src/postcode.js';
import { loadEnvFile } from './src/env.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const page = (name) => path.join(ROOT, 'pages', `${name}.html`);

/**
 * @param {{db: ReturnType<typeof openDb>, getPort: () => number, adminPassword?: string}} opts
 */
export function createApp({ db, getPort, adminPassword = process.env.ADMIN_PASSWORD }) {
  const app = express();
  const admin = adminAuth(adminPassword);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  // Where other devices should go. PUBLIC_URL wins; otherwise, a request that
  // came through a tunnel or proxy (Cloudflare, ngrok…) uses that public
  // address, so the QR works from outside the network; else the LAN address.
  const urls = (req) => {
    let base = process.env.PUBLIC_URL?.replace(/\/+$/, '');
    const host = req?.get('x-forwarded-host') || req?.get('host');
    const proto = req?.get('x-forwarded-proto')?.split(',')[0].trim();
    if (!base && host && /^https?$/.test(proto || '') && !/^(localhost|\[|\d+\.\d+\.\d+\.\d+)/.test(host)) base = `${proto}://${host}`;
    base ||= `http://${lanHost()}:${getPort()}`;
    return { base, hiUrl: `${base}/hi`, homeUrl: `${base}/home`, adminUrl: `${base}/hax0r` };
  };

  // ------------------------------------------------------------- live (SSE)
  // Every event gets a sequence number and is kept briefly, so a page behind
  // a proxy that buffers SSE (e.g. a Cloudflare quick tunnel) can poll
  // /api/poll instead and still see every event, in order.
  const clients = new Set();
  const recent = [];
  let seq = 0;
  const broadcast = (event, data) => {
    seq++;
    recent.push({ seq, event, data });
    if (recent.length > 500) recent.shift();
    const msg = `id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(msg);
  };
  // A real event (not a comment), so pages can tell the stream is alive.
  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(`event: ping\ndata: ${seq}\n\n`);
  }, 15_000);
  heartbeat.unref();
  app.locals.closeClients = () => {
    clearInterval(heartbeat);
    for (const res of clients) res.end();
    clients.clear();
  };

  app.get('/api/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(`retry: 3000\nevent: hello\ndata: ${seq}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
  });

  // Polling fallback: events after `since`. reset=true means the page missed
  // some (or the server restarted) and should reload everything.
  app.get('/api/poll', (req, res) => {
    const since = Number(req.query.since);
    const oldest = recent.length ? recent[0].seq : seq + 1;
    const known = Number.isInteger(since) && since >= 0 && since <= seq;
    res.set('Cache-Control', 'no-store').json({
      seq,
      reset: !known || since < oldest - 1,
      events: known ? recent.filter((e) => e.seq > since) : [],
    });
  });

  // ------------------------------------------------------------------ pages
  app.get('/', (_req, res) => res.redirect('/home'));
  app.get('/home', (_req, res) => res.sendFile(page('home')));
  app.get('/hi', (_req, res) => res.sendFile(page('hi')));
  app.get('/hax0r', admin, (_req, res) => res.sendFile(page('hax0r')));

  app.use(express.static(path.join(ROOT, 'public'), { index: false }));
  app.get('/vendor/three.min.js', (_req, res) => res.sendFile(path.join(ROOT, 'node_modules/three/build/three.min.js')));

  // ------------------------------------------------------------- public API
  const parseId = (req) => {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  app.get('/api/guests', (_req, res) => res.json(db.listGuests().map(publicGuest)));

  app.post('/api/guests', (req, res) => {
    const { guest, token } = db.createGuest(req.body);
    broadcast('guests', { type: 'created', guest: publicGuest(guest) });
    res.status(201).json({ guest: publicGuest(guest), token });
  });

  // The phone's own identity: a token handed out once, on join.
  const tokenOf = (req) => req.get('x-guest-token') || '';

  app.get('/api/me', (req, res) => {
    const me = db.guestByToken(tokenOf(req));
    if (!me) return res.status(401).json({ error: 'Unknown phone, join first' });
    res.json(publicGuest(me));
  });

  app.put('/api/me', (req, res) => {
    const me = db.setWish(tokenOf(req), req.body?.need);
    broadcast('guests', { type: 'updated', guest: publicGuest(me), wish: true });
    res.json(publicGuest(me));
  });

  // Secrets are anonymous: the author is stored (so moderation can trace
  // abuse from /hax0r) but never sent to the display or the public API.
  app.get('/api/secrets', (_req, res) => res.json(db.listSecrets()));

  app.post('/api/secrets', (req, res) => {
    const secret = db.createSecret(tokenOf(req), req.body);
    broadcast('secrets', { type: 'created', secret });
    res.status(201).json(secret);
  });

  app.get('/api/settings', (_req, res) => res.json(db.getSettings()));

  app.get('/api/postcode/:pc', (req, res) => {
    const parsed = parsePostcode(req.params.pc);
    if (!parsed) return res.json({ valid: false, known: false });
    const hit = lookupOutcode(parsed.outcode);
    res.json({ valid: true, known: !!hit, outcode: parsed.outcode, area: hit?.area ?? null });
  });

  app.get('/api/info', (req, res) =>
    res.json({ ...urls(req), host: lanHost(), port: getPort() }),
  );

  app.get('/api/qr.svg', async (req, res) => {
    const svg = await QRCode.toString(urls(req).hiUrl, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    });
    res.set('Cache-Control', 'no-store').type('image/svg+xml').send(svg);
  });

  // -------------------------------------------------------------- admin API
  app.get('/api/admin/guests', admin, (_req, res) => res.json(db.listGuests()));

  app.put('/api/admin/guests/:id', admin, (req, res) => {
    const id = parseId(req);
    const guest = id && db.updateGuest(id, req.body);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });
    broadcast('guests', { type: 'updated', guest: publicGuest(guest) });
    res.json(guest);
  });

  app.delete('/api/admin/guests/:id', admin, (req, res) => {
    const id = parseId(req);
    if (!id || !db.deleteGuest(id)) return res.status(404).json({ error: 'Guest not found' });
    broadcast('guests', { type: 'deleted', id });
    broadcast('secrets', { type: 'reset' }); // secrets about them went too
    res.status(204).end();
  });

  app.get('/api/admin/secrets', admin, (_req, res) => res.json(db.listSecretsAdmin()));

  app.delete('/api/admin/secrets/:id', admin, (req, res) => {
    const id = parseId(req);
    if (!id || !db.deleteSecret(id)) return res.status(404).json({ error: 'Secret not found' });
    broadcast('secrets', { type: 'deleted', id });
    res.status(204).end();
  });

  app.delete('/api/admin/guests', admin, (req, res) => {
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({ error: 'Send {"confirm":"DELETE"} to remove every guest' });
    }
    const deleted = db.deleteAllGuests();
    broadcast('guests', { type: 'reset' });
    broadcast('secrets', { type: 'reset' });
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
    if (err instanceof AuthError) return res.status(401).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}

// ------------------------------------------------------------------- main
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnvFile(); // ./.env, before anything reads process.env
  const PORT = Number(process.env.PORT) || 3000;
  const db = openDb();
  const app = createApp({ db, getPort: () => PORT });
  const server = app.listen(PORT, '0.0.0.0', () => {
    const host = lanHost();
    const b = `http://${host}:${PORT}`;
    console.log(`\n  whoswho is up — open these from any device on your network:\n`);
    console.log(`    Display   ${b}/home`);
    console.log(`    Register  ${b}/hi`);
    console.log(`    Admin     ${b}/hax0r${process.env.ADMIN_PASSWORD ? '  (password protected)' : ''}\n`);
    if (host === 'localhost') console.log('  ⚠ No LAN address found — set PUBLIC_HOST if other devices cannot connect.\n');
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
