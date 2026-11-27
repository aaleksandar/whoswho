// SQLite persistence (node:sqlite, synchronous). One file, survives restarts.

import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { normalizeAvatar } from '../public/js/animals.js';
import { classify } from '../public/js/weather.js';
import { resolveLocation } from './postcode.js';

export const LIMITS = { name: 40, need: 140, secret: 140 };
export const VIEW_IDS = ['map', 'cloud', 'wishes'];

export const DEFAULT_SETTINGS = Object.freeze({
  title: "Who's here?",
  rotateSeconds: 40,
  views: VIEW_IDS,
});

const MIGRATIONS = [
  `CREATE TABLE guests (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     avatar TEXT NOT NULL,
     vibes TEXT NOT NULL DEFAULT '[]',
     need TEXT,
     postcode TEXT,
     area TEXT,
     lat REAL,
     lng REAL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     updated_at TEXT
   );
   CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  // v2: free-form "about you" text (no longer used since v3)
  `ALTER TABLE guests ADD COLUMN about TEXT;`,
  // v3: phones get a token; secrets about guests feed the Cloud and the Map
  `ALTER TABLE guests ADD COLUMN token TEXT;
   CREATE UNIQUE INDEX guests_token ON guests(token);
   CREATE TABLE secrets (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     text TEXT NOT NULL,
     about_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
     author_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
     by TEXT NOT NULL CHECK (by IN ('self', 'friend')),
     vibe TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );
   CREATE INDEX secrets_about ON secrets(about_id);`,
];

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

export class AuthError extends Error {}

const cleanText = (v, max) =>
  typeof v === 'string' ? v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Validate + normalise user input. Throws ValidationError. */
export function cleanGuestInput(input) {
  const src = input && typeof input === 'object' ? input : {};
  const name = cleanText(src.name, LIMITS.name);
  if (!name) throw new ValidationError('Name is required', 'name');
  return {
    name,
    avatar: normalizeAvatar(src.avatar),
    need: cleanText(src.need, LIMITS.need) || null,
    postcodeInput: typeof src.postcode === 'string' ? src.postcode : '',
  };
}

function rowToGuest(r) {
  return {
    id: r.id,
    name: r.name,
    avatar: normalizeAvatar(JSON.parse(r.avatar)), // maps old 2D avatars too
    need: r.need,
    postcode: r.postcode,
    area: r.area,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Public projection: only the district (E8), never the full postcode. */
export function publicGuest(g) {
  const { postcode, ...rest } = g;
  return { ...rest, outcode: g.area && postcode ? postcode.split(' ')[0] : null };
}

const rowToSecret = (r) => ({ id: r.id, text: r.text, vibe: r.vibe, by: r.by, aboutId: r.about_id, createdAt: r.created_at });

export function openDb(file = process.env.DB_PATH || 'whoswho.sqlite') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');

  const version = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  const q = {
    all: db.prepare('SELECT * FROM guests ORDER BY id'),
    get: db.prepare('SELECT * FROM guests WHERE id = ?'),
    byToken: db.prepare('SELECT * FROM guests WHERE token = ?'),
    insert: db.prepare('INSERT INTO guests (name, avatar, need, token) VALUES (?, ?, ?, ?)'),
    update: db.prepare(
      `UPDATE guests SET name = ?, avatar = ?, need = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ),
    setNeed: db.prepare(`UPDATE guests SET need = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`),
    setLoc: db.prepare('UPDATE guests SET postcode = ?, area = ?, lat = ?, lng = ? WHERE id = ?'),
    del: db.prepare('DELETE FROM guests WHERE id = ?'),
    delAll: db.prepare('DELETE FROM guests'),
    secretsAll: db.prepare('SELECT * FROM secrets ORDER BY id'),
    secretsAdmin: db.prepare(
      `SELECT s.*, a.name AS about_name, w.name AS author_name FROM secrets s
         JOIN guests a ON a.id = s.about_id LEFT JOIN guests w ON w.id = s.author_id ORDER BY s.id`,
    ),
    secretGet: db.prepare('SELECT * FROM secrets WHERE id = ?'),
    secretInsert: db.prepare('INSERT INTO secrets (text, about_id, author_id, by, vibe) VALUES (?, ?, ?, ?, ?)'),
    secretDel: db.prepare('DELETE FROM secrets WHERE id = ?'),
    secretsDelAll: db.prepare('DELETE FROM secrets'),
    settingsAll: db.prepare('SELECT key, value FROM settings'),
    settingsPut: db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ),
  };

  const tx = (fn) => {
    db.exec('BEGIN');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };

  const applyLocation = (id, postcodeInput) => {
    const loc = resolveLocation(postcodeInput, id);
    q.setLoc.run(loc.postcode, loc.area, loc.lat, loc.lng, id);
  };

  const authorFor = (token) => {
    const r = typeof token === 'string' && token ? q.byToken.get(token) : null;
    if (!r) throw new AuthError('Join first, then try again');
    return r;
  };

  return {
    raw: db,
    close: () => db.close(),

    listGuests: () => q.all.all().map(rowToGuest),

    getGuest: (id) => {
      const r = q.get.get(id);
      return r ? rowToGuest(r) : null;
    },

    guestByToken: (token) => {
      const r = typeof token === 'string' && token ? q.byToken.get(token) : null;
      return r ? rowToGuest(r) : null;
    },

    /** Returns {guest, token}; the token is the phone's identity from then on. */
    createGuest(input) {
      const c = cleanGuestInput(input);
      const token = randomBytes(18).toString('base64url');
      return tx(() => {
        const { lastInsertRowid } = q.insert.run(c.name, JSON.stringify(c.avatar), c.need, token);
        const id = Number(lastInsertRowid);
        applyLocation(id, c.postcodeInput);
        return { guest: rowToGuest(q.get.get(id)), token };
      });
    },

    updateGuest(id, input) {
      const c = cleanGuestInput(input);
      return tx(() => {
        const existing = q.get.get(id);
        if (!existing) return null;
        q.update.run(c.name, JSON.stringify(c.avatar), c.need, id);
        applyLocation(id, c.postcodeInput);
        return rowToGuest(q.get.get(id));
      });
    },

    /** The phone's wish ("what do you need in life?"). Throws AuthError. */
    setWish(token, need) {
      const me = authorFor(token);
      const clean = cleanText(need, LIMITS.need);
      if (clean.length < 2) throw new ValidationError('Write a few words first', 'need');
      q.setNeed.run(clean, me.id);
      return rowToGuest(q.get.get(me.id));
    },

    deleteGuest: (id) => q.del.run(id).changes > 0,

    deleteAllGuests: () =>
      tx(() => {
        q.secretsDelAll.run();
        return Number(q.delAll.run().changes);
      }),

    // ---------------------------------------------------------------- secrets
    listSecrets: () => q.secretsAll.all().map(rowToSecret),

    listSecretsAdmin: () =>
      q.secretsAdmin.all().map((r) => ({ ...rowToSecret(r), aboutName: r.about_name, authorId: r.author_id, authorName: r.author_name })),

    /** {text, about: 'me' | guestId}. Throws AuthError / ValidationError. */
    createSecret(token, input) {
      const me = authorFor(token);
      const src = input && typeof input === 'object' ? input : {};
      const text = cleanText(src.text, LIMITS.secret);
      if (text.length < 3) throw new ValidationError('Write a few words first', 'text');
      const aboutId = src.about === 'me' || src.about == null ? me.id : Number(src.about);
      if (!Number.isInteger(aboutId) || !q.get.get(aboutId)) throw new ValidationError('That person isn’t here (any more)', 'about');
      const by = aboutId === me.id ? 'self' : 'friend';
      const { lastInsertRowid } = q.secretInsert.run(text, aboutId, me.id, by, classify(text));
      return rowToSecret(q.secretGet.get(Number(lastInsertRowid)));
    },

    /** For seeding and tests: add a secret without a phone token. */
    addSecret({ text, aboutId, by = 'friend', authorId = null }) {
      const clean = cleanText(text, LIMITS.secret);
      const { lastInsertRowid } = q.secretInsert.run(clean, aboutId, authorId, by, classify(clean));
      return rowToSecret(q.secretGet.get(Number(lastInsertRowid)));
    },

    deleteSecret: (id) => q.secretDel.run(id).changes > 0,

    // --------------------------------------------------------------- settings
    getSettings() {
      const out = { ...DEFAULT_SETTINGS };
      for (const { key, value } of q.settingsAll.all()) {
        if (key in DEFAULT_SETTINGS) out[key] = JSON.parse(value);
      }
      // Views from older versions (graph, needs) no longer exist.
      const views = Array.isArray(out.views) ? VIEW_IDS.filter((v) => out.views.includes(v)) : [];
      out.views = views.length ? views : [...VIEW_IDS];
      return out;
    },

    /** Partial update; validates each known key. Returns the merged settings. */
    updateSettings(patch) {
      const src = patch && typeof patch === 'object' ? patch : {};
      const clean = {};
      if ('title' in src) {
        const t = cleanText(src.title, 60);
        clean.title = t || DEFAULT_SETTINGS.title;
      }
      if ('rotateSeconds' in src) {
        const n = Math.round(Number(src.rotateSeconds));
        if (!Number.isFinite(n) || n < 3 || n > 600) {
          throw new ValidationError('Rotation must be between 3 and 600 seconds', 'rotateSeconds');
        }
        clean.rotateSeconds = n;
      }
      if ('views' in src) {
        const views = Array.isArray(src.views) ? VIEW_IDS.filter((v) => src.views.includes(v)) : [];
        if (!views.length) throw new ValidationError('Enable at least one view', 'views');
        clean.views = views;
      }
      tx(() => {
        for (const [k, v] of Object.entries(clean)) q.settingsPut.run(k, JSON.stringify(v));
      });
      return this.getSettings();
    },
  };
}
