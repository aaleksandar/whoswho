// SQLite persistence (node:sqlite, synchronous). One file, survives restarts.

import { DatabaseSync } from 'node:sqlite';
import { normalizeAvatar } from '../public/js/avatar.js';
import { normalizeVibes } from '../public/js/vibes.js';
import { resolveLocation } from './postcode.js';

export const LIMITS = { name: 40, need: 140, about: 500 };
export const VIEW_IDS = ['graph', 'map', 'needs'];

export const DEFAULT_SETTINGS = Object.freeze({
  title: "Who's here?",
  rotateSeconds: 20,
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
  // v2: free-form "about you" text, shown on the guest's profile
  `ALTER TABLE guests ADD COLUMN about TEXT;`,
];

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

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
    vibes: normalizeVibes(src.vibes),
    need: cleanText(src.need, LIMITS.need) || null,
    about: cleanText(src.about, LIMITS.about) || null,
    postcodeInput: typeof src.postcode === 'string' ? src.postcode : '',
  };
}

function rowToGuest(r) {
  return {
    id: r.id,
    name: r.name,
    avatar: normalizeAvatar(JSON.parse(r.avatar)), // maps pre-spirit-animal avatars too
    vibes: JSON.parse(r.vibes),
    need: r.need,
    about: r.about,
    postcode: r.postcode,
    area: r.area,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Public projection: no raw postcode on the shared screen / public API. */
export function publicGuest(g) {
  const { postcode, ...rest } = g;
  return rest;
}

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
    insert: db.prepare('INSERT INTO guests (name, avatar, vibes, need, about) VALUES (?, ?, ?, ?, ?)'),
    update: db.prepare(
      `UPDATE guests SET name = ?, avatar = ?, vibes = ?, need = ?, about = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ),
    setLoc: db.prepare('UPDATE guests SET postcode = ?, area = ?, lat = ?, lng = ? WHERE id = ?'),
    del: db.prepare('DELETE FROM guests WHERE id = ?'),
    delAll: db.prepare('DELETE FROM guests'),
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

  return {
    raw: db,
    close: () => db.close(),

    listGuests: () => q.all.all().map(rowToGuest),

    getGuest: (id) => {
      const r = q.get.get(id);
      return r ? rowToGuest(r) : null;
    },

    createGuest(input) {
      const c = cleanGuestInput(input);
      return tx(() => {
        const { lastInsertRowid } = q.insert.run(c.name, JSON.stringify(c.avatar), JSON.stringify(c.vibes), c.need, c.about);
        const id = Number(lastInsertRowid);
        applyLocation(id, c.postcodeInput);
        return rowToGuest(q.get.get(id));
      });
    },

    updateGuest(id, input) {
      const c = cleanGuestInput(input);
      return tx(() => {
        const existing = q.get.get(id);
        if (!existing) return null;
        q.update.run(c.name, JSON.stringify(c.avatar), JSON.stringify(c.vibes), c.need, c.about, id);
        applyLocation(id, c.postcodeInput);
        return rowToGuest(q.get.get(id));
      });
    },

    deleteGuest: (id) => q.del.run(id).changes > 0,

    deleteAllGuests: () => Number(q.delAll.run().changes),

    getSettings() {
      const out = { ...DEFAULT_SETTINGS };
      for (const { key, value } of q.settingsAll.all()) {
        if (key in DEFAULT_SETTINGS) out[key] = JSON.parse(value);
      }
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
