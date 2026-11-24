// abu — local-network guest board.
//   /home   rotating display (graph · map · needs) with a QR code to /hi
//   /hi     guest registration
//   /hax0r  admin

import express from 'express';
import QRCode from 'qrcode';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDb, publicGuest, ValidationError } from './src/db.js';
import { lanHost } from './src/network.js';
import { adminAuth } from './src/auth.js';
import { parsePostcode, lookupOutcode } from './src/postcode.js';
import { loadEnvFile } from './src/env.js';
import { VIBE_SUGGESTIONS } from './public/js/vibes.js';

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

  const urls = () => {
    const base = `http://${lanHost()}:${getPort()}`;
    return { base, hiUrl: `${base}/hi`, homeUrl: `${base}/home`, adminUrl: `${base}/hax0r` };
  };

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

  // ------------------------------------------------------------------ pages
  app.get('/', (_req, res) => res.redirect('/home'));
  app.get('/home', (_req, res) => res.sendFile(page('home')));
  app.get('/hi', (_req, res) => res.sendFile(page('hi')));
  app.get('/hax0r', admin, (_req, res) => res.sendFile(page('hax0r')));

  app.use(express.static(path.join(ROOT, 'public'), { index: false }));
  app.use('/vendor/d3', express.static(path.join(ROOT, 'node_modules/d3/dist')));
  app.use('/vendor/leaflet', express.static(path.join(ROOT, 'node_modules/leaflet/dist')));
  app.get('/data/london-boroughs.geojson', (_req, res) =>
    res.type('application/geo+json').sendFile(path.join(ROOT, 'data/london-boroughs.geojson')),
  );

  // ------------------------------------------------------------- public API
  const parseId = (req) => {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  app.get('/api/guests', (_req, res) => res.json(db.listGuests().map(publicGuest)));

  app.post('/api/guests', (req, res) => {
    const guest = db.createGuest(req.body);
    broadcast('guests', { type: 'created', guest: publicGuest(guest) });
    res.status(201).json(publicGuest(guest));
  });

  app.get('/api/settings', (_req, res) => res.json(db.getSettings()));

  // Suggestions for /hi: vibes guests already use (most popular first, so new
  // guests overlap with people here), then the curated list.
  app.get('/api/vibes', (_req, res) => {
    const counts = new Map();
    for (const g of db.listGuests()) for (const v of g.vibes) counts.set(v, (counts.get(v) || 0) + 1);
    const used = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const rest = VIBE_SUGGESTIONS.filter((v) => !counts.has(v)).map((v) => [v, 0]);
    res.json([...used, ...rest].map(([vibe, count]) => ({ vibe, count })));
  });

  app.get('/api/postcode/:pc', (req, res) => {
    const parsed = parsePostcode(req.params.pc);
    if (!parsed) return res.json({ valid: false, known: false });
    const hit = lookupOutcode(parsed.outcode);
    res.json({ valid: true, known: !!hit, outcode: parsed.outcode, area: hit?.area ?? null });
  });

  app.get('/api/info', (_req, res) =>
    res.json({ ...urls(), host: lanHost(), port: getPort() }),
  );

  app.get('/api/qr.svg', async (_req, res) => {
    const svg = await QRCode.toString(urls().hiUrl, {
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
  loadEnvFile(); // ./.env, before anything reads process.env
  const PORT = Number(process.env.PORT) || 3000;
  const db = openDb();
  const app = createApp({ db, getPort: () => PORT });
  const server = app.listen(PORT, '0.0.0.0', () => {
    const host = lanHost();
    const b = `http://${host}:${PORT}`;
    console.log(`\n  abu is up — open these from any device on your network:\n`);
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
