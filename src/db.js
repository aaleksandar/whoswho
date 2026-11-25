// SQLite persistence (node:sqlite, synchronous). One file, survives restarts.

import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { normalizeAvatar, randomAvatar } from '../public/js/avatar.js';
import { normalizeVibes } from '../public/js/vibes.js';
import { resolveLocation, jitter } from './postcode.js';
import { EVENT } from './event.js';
import {
  LIMITS, CHAPTERS, NEEDS, OFFERS, FOOD, BRING_VIBES, AREAS, RSVP, cleanIds,
} from '../public/js/catalog.js';

export { LIMITS };
export const VIEW_IDS = ['graph', 'map', 'needs', 'bringing'];

export const DEFAULT_SETTINGS = Object.freeze({
  title: EVENT.title,
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
  `ALTER TABLE guests ADD COLUMN about TEXT;`,
  // v3: heart-first profile, co-creation, check-in, self-edit token, RSVPs
  `ALTER TABLE guests ADD COLUMN chapter TEXT NOT NULL DEFAULT '[]';
   ALTER TABLE guests ADD COLUMN chapter_note TEXT;
   ALTER TABLE guests ADD COLUMN need_tags TEXT NOT NULL DEFAULT '[]';
   ALTER TABLE guests ADD COLUMN offer TEXT;
   ALTER TABLE guests ADD COLUMN offer_tags TEXT NOT NULL DEFAULT '[]';
   ALTER TABLE guests ADD COLUMN music TEXT NOT NULL DEFAULT '[]';
   ALTER TABLE guests ADD COLUMN soundtrack TEXT;
   ALTER TABLE guests ADD COLUMN question TEXT;
   ALTER TABLE guests ADD COLUMN area_chip TEXT;
   ALTER TABLE guests ADD COLUMN links TEXT;
   ALTER TABLE guests ADD COLUMN links_consent INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE guests ADD COLUMN bringing_kind TEXT;
   ALTER TABLE guests ADD COLUMN bringing_text TEXT;
   ALTER TABLE guests ADD COLUMN vibe_kind TEXT;
   ALTER TABLE guests ADD COLUMN vibe_text TEXT;
   ALTER TABLE guests ADD COLUMN rsvp TEXT;
   ALTER TABLE guests ADD COLUMN checked_in INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE guests ADD COLUMN checked_in_at TEXT;
   ALTER TABLE guests ADD COLUMN token_hash TEXT;
   CREATE UNIQUE INDEX IF NOT EXISTS guests_token_hash ON guests(token_hash);
   CREATE TABLE IF NOT EXISTS rsvps (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     status TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );`,
  // v4: the two lead questions. Also retitle a board still using the old default.
  `ALTER TABLE guests ADD COLUMN missing TEXT;
   ALTER TABLE guests ADD COLUMN hidden_side TEXT;
   UPDATE settings SET value = '"Bring your own vibe"'
     WHERE key = 'title' AND value = '"Aleksandar''s send-off"';`,
  // v5: RSVP can exist without a profile. Existing rows are already cards.
  `ALTER TABLE guests ADD COLUMN has_card INTEGER NOT NULL DEFAULT 1;
   UPDATE settings SET value = '"Until I''m back"'
     WHERE key = 'title' AND value IN ('"Bring your own vibe"', '"Aleksandar''s send-off"');`,
];

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

export const cleanText = (v, max) =>
  typeof v === 'string' ? v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function newEditToken() {
  return randomBytes(24).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function cleanUrl(raw, { instagram = false } = {}) {
  const s = cleanText(raw, LIMITS.link);
  if (!s) return null;
  if (instagram && /^@?[A-Za-z0-9._]{2,30}$/.test(s)) {
    return `https://instagram.com/${s.replace(/^@/, '')}`;
  }
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  return url.href.slice(0, LIMITS.link);
}

function cleanLinks(src) {
  const box = src.links && typeof src.links === 'object' ? src.links : {};
  const links = {
    notion: cleanUrl(box.notion),
    instagram: cleanUrl(box.instagram, { instagram: true }),
    substack: cleanUrl(box.substack),
    site: cleanUrl(box.site),
  };
  const any = Object.values(links).some(Boolean);
  const consent = src.linksConsent === true || src.linksConsent === 1 || src.linksConsent === 'true';
  if (!any || !consent) return { links: null, linksConsent: false };
  return { links, linksConsent: true };
}

/** Validate + normalise user input. Throws ValidationError. */
export function cleanGuestInput(input) {
  const src = input && typeof input === 'object' ? input : {};
  const name = cleanText(src.name, LIMITS.name);
  if (!name) throw new ValidationError('Name is required', 'name');
  let rsvp = 'going';
  if (src.rsvp != null && src.rsvp !== '') {
    if (!RSVP.includes(src.rsvp)) throw new ValidationError('RSVP must be going, maybe, or no', 'rsvp');
    rsvp = src.rsvp;
  }
  const areaChip = typeof src.areaChip === 'string' && AREAS.some((a) => a.id === src.areaChip) ? src.areaChip : null;
  const bringingKind = typeof src.bringingKind === 'string' && FOOD.some((f) => f.id === src.bringingKind) ? src.bringingKind : null;
  const vibeKind = typeof src.vibeKind === 'string' && BRING_VIBES.some((v) => v.id === src.vibeKind) ? src.vibeKind : null;
  const { links, linksConsent } = cleanLinks(src);
  return {
    name,
    avatar: normalizeAvatar(src.avatar),
    vibes: normalizeVibes(src.interests ?? src.vibes, 12),
    need: cleanText(src.need, LIMITS.need) || null,
    about: src.about === undefined ? undefined : (cleanText(src.about, LIMITS.about) || null),
    postcodeInput: areaChip === 'visiting' ? '' : (typeof src.postcode === 'string' ? src.postcode : ''),
    chapter: cleanIds(src.chapter, CHAPTERS, 3),
    chapterNote: cleanText(src.chapterNote, LIMITS.chapterNote) || null,
    needTags: cleanIds(src.needTags, NEEDS, 4),
    offer: cleanText(src.offer, LIMITS.offer) || null,
    offerTags: cleanIds(src.offerTags, OFFERS, 4),
    music: normalizeVibes(src.music, 8),
    soundtrack: cleanText(src.soundtrack, LIMITS.soundtrack) || null,
    question: cleanText(src.question, LIMITS.question) || null,
    missing: cleanText(src.missing, LIMITS.missing) || null,
    hiddenSide: cleanText(src.hiddenSide, LIMITS.hiddenSide) || null,
    areaChip,
    links,
    linksConsent,
    bringingKind,
    bringingText: cleanText(src.bringingText, LIMITS.bringing) || null,
    vibeKind,
    vibeText: cleanText(src.vibeText, LIMITS.bringing) || null,
    rsvp,
  };
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function rowToGuest(r) {
  const vibes = parseJson(r.vibes, []);
  const links = parseJson(r.links, null);
  return {
    id: r.id,
    name: r.name,
    avatar: normalizeAvatar(JSON.parse(r.avatar)),
    vibes,
    interests: vibes,
    need: r.need,
    about: r.about,
    postcode: r.postcode,
    area: r.area,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    chapter: parseJson(r.chapter, []),
    chapterNote: r.chapter_note,
    needTags: parseJson(r.need_tags, []),
    offer: r.offer,
    offerTags: parseJson(r.offer_tags, []),
    music: parseJson(r.music, []),
    soundtrack: r.soundtrack,
    question: r.question,
    missing: r.missing,
    hiddenSide: r.hidden_side,
    areaChip: r.area_chip,
    links: links && typeof links === 'object' ? links : null,
    linksConsent: !!r.links_consent,
    bringingKind: r.bringing_kind,
    bringingText: r.bringing_text,
    vibeKind: r.vibe_kind,
    vibeText: r.vibe_text,
    rsvp: r.rsvp,
    hasCard: r.has_card == null ? true : !!r.has_card,
    checkedIn: !!r.checked_in,
    checkedInAt: r.checked_in_at,
  };
}

/** Public projection: no raw postcode, no edit token. Links only with consent. */
export function publicGuest(g) {
  const { postcode, editToken, links, linksConsent, ...rest } = g;
  return { ...rest, links: linksConsent ? links : null };
}

/** The guest editing themselves can see the postcode they typed. */
export function ownerGuest(g) {
  return { ...publicGuest(g), postcode: g.postcode || null, links: g.links || null, linksConsent: !!g.linksConsent };
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
    byToken: db.prepare('SELECT * FROM guests WHERE token_hash = ?'),
    insert: db.prepare(
      `INSERT INTO guests (
         name, avatar, vibes, need, about, chapter, chapter_note, need_tags, offer, offer_tags,
         music, soundtrack, question, missing, hidden_side, links, links_consent,
         bringing_kind, bringing_text, vibe_kind, vibe_text, rsvp, has_card, token_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    update: db.prepare(
      `UPDATE guests SET name = ?, avatar = ?, vibes = ?, need = ?, about = ?, chapter = ?, chapter_note = ?,
         need_tags = ?, offer = ?, offer_tags = ?, music = ?, soundtrack = ?, question = ?,
         missing = ?, hidden_side = ?, links = ?,
         links_consent = ?, bringing_kind = ?, bringing_text = ?, vibe_kind = ?, vibe_text = ?, rsvp = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ),
    setLoc: db.prepare('UPDATE guests SET postcode = ?, area = ?, lat = ?, lng = ?, area_chip = ? WHERE id = ?'),
    check: db.prepare(
      `UPDATE guests SET checked_in = ?, checked_in_at = CASE WHEN ? = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE NULL END WHERE id = ?`,
    ),
    del: db.prepare('DELETE FROM guests WHERE id = ?'),
    delAll: db.prepare('DELETE FROM guests'),
    settingsAll: db.prepare('SELECT key, value FROM settings'),
    settingsPut: db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ),
    byName: db.prepare('SELECT * FROM guests WHERE lower(name) = lower(?) ORDER BY id'),
    setToken: db.prepare('UPDATE guests SET token_hash = ? WHERE id = ?'),
    setCard: db.prepare('UPDATE guests SET has_card = ? WHERE id = ?'),
    setComing: db.prepare(
      `UPDATE guests SET name = ?, rsvp = ?, bringing_kind = ?, bringing_text = ?, vibe_kind = ?, vibe_text = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ),
    setStatus: db.prepare(
      `UPDATE guests SET name = ?, rsvp = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ),
    rsvpDel: db.prepare('DELETE FROM rsvps WHERE lower(name) = lower(?)'),
    rsvpIns: db.prepare('INSERT INTO rsvps (name, status) VALUES (?, ?)'),
    rsvpCounts: db.prepare('SELECT status, COUNT(*) AS n FROM rsvps GROUP BY status'),
    rsvpAll: db.prepare('SELECT id, name, status, created_at FROM rsvps ORDER BY id'),
  };

  const rememberRsvp = (name, status) => {
    if (!name || !RSVP.includes(status)) return;
    q.rsvpDel.run(name);
    q.rsvpIns.run(name, status);
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

  const applyLocation = (id, postcodeInput, areaChip) => {
    const chip = AREAS.find((a) => a.id === areaChip);
    if (areaChip === 'visiting') {
      const p = jitter(EVENT.lat, EVENT.lng, `visit:${id}`);
      q.setLoc.run(null, 'Visiting', p.lat, p.lng, 'visiting', id);
      return;
    }
    const loc = resolveLocation(postcodeInput, id);
    if (loc.known) {
      q.setLoc.run(loc.postcode, chip ? chip.label : loc.area, loc.lat, loc.lng, chip ? chip.id : null, id);
      return;
    }
    if (chip) {
      const p = jitter(chip.lat, chip.lng, `area:${id}:${chip.id}`);
      q.setLoc.run(loc.postcode, chip.label, p.lat, p.lng, chip.id, id);
      return;
    }
    q.setLoc.run(loc.postcode, loc.area, loc.lat, loc.lng, null, id);
  };

  const pack = (c) => [
    c.name,
    JSON.stringify(c.avatar),
    JSON.stringify(c.vibes),
    c.need,
    c.about ?? null,
    JSON.stringify(c.chapter),
    c.chapterNote,
    JSON.stringify(c.needTags),
    c.offer,
    JSON.stringify(c.offerTags),
    JSON.stringify(c.music),
    c.soundtrack,
    c.question,
    c.missing,
    c.hiddenSide,
    c.links ? JSON.stringify(c.links) : null,
    c.linksConsent ? 1 : 0,
    c.bringingKind,
    c.bringingText,
    c.vibeKind,
    c.vibeText,
    c.rsvp,
  ];

  return {
    raw: db,
    close: () => db.close(),

    listGuests: () => q.all.all().map(rowToGuest),

    getGuest: (id) => {
      const r = q.get.get(id);
      return r ? rowToGuest(r) : null;
    },

    getByToken(token) {
      if (!token || typeof token !== 'string' || token.length > 200) return null;
      const r = q.byToken.get(hashToken(token));
      return r ? rowToGuest(r) : null;
    },

    createGuest(input, opts = {}) {
      const c = cleanGuestInput(input);
      const editToken = opts.token || newEditToken();
      return tx(() => {
        const about = c.about ?? null;
        const stub = q.byName.all(c.name).map(rowToGuest).find((g) => !g.hasCard);
        if (stub) {
          q.update.run(...pack({ ...c, about }), stub.id);
          q.setCard.run(1, stub.id);
          q.setToken.run(hashToken(editToken), stub.id);
          applyLocation(stub.id, c.postcodeInput, c.areaChip);
          rememberRsvp(c.name, c.rsvp);
          return { ...rowToGuest(q.get.get(stub.id)), editToken };
        }
        const named = q.byName.all(c.name).map(rowToGuest).find((g) => g.hasCard);
        if (named) throw new ValidationError('That name already has a card. Use the phone that made it.', 'name');
        const { lastInsertRowid } = q.insert.run(...pack({ ...c, about }), 1, hashToken(editToken));
        const id = Number(lastInsertRowid);
        applyLocation(id, c.postcodeInput, c.areaChip);
        rememberRsvp(c.name, c.rsvp);
        return { ...rowToGuest(q.get.get(id)), editToken };
      });
    },

    updateGuest(id, input) {
      const c = cleanGuestInput(input);
      return tx(() => {
        const existing = q.get.get(id);
        if (!existing) return null;
        const about = c.about === undefined ? existing.about : c.about;
        q.update.run(...pack({ ...c, about }), id);
        q.setCard.run(1, id);
        applyLocation(id, c.postcodeInput, c.areaChip);
        if (existing.name && existing.name.toLowerCase() !== c.name.toLowerCase()) q.rsvpDel.run(existing.name);
        rememberRsvp(c.name, c.rsvp);
        return rowToGuest(q.get.get(id));
      });
    },

    setCheckedIn(id, on) {
      const existing = q.get.get(id);
      if (!existing) return null;
      q.check.run(on ? 1 : 0, on ? 1 : 0, id);
      return rowToGuest(q.get.get(id));
    },

    deleteGuest: (id) => q.del.run(id).changes > 0,

    deleteAllGuests() {
      return tx(() => {
        const n = Number(q.delAll.run().changes);
        db.exec('DELETE FROM rsvps');
        return n;
      });
    },

    addRsvp(input) {
      return this.upsertRsvp(input);
    },

    /**
     * RSVP without a profile. Same name updates the existing person.
     * A new name gets a cardless guest and a one-time edit token for this phone.
     */
    upsertRsvp(input) {
      const src = input && typeof input === 'object' ? input : {};
      const status = src.status || src.rsvp;
      if (!RSVP.includes(status)) throw new ValidationError('Pick going, maybe, or can\'t make it', 'status');
      const c = cleanGuestInput({
        name: src.name,
        rsvp: src.status || src.rsvp,
        bringingKind: src.bringingKind,
        bringingText: src.bringingText,
        vibeKind: src.vibeKind,
        vibeText: src.vibeText,
      });
      const bringingTouched = [src.bringingKind, src.bringingText, src.vibeKind, src.vibeText]
        .some((v) => typeof v === 'string' && v.trim());
      return tx(() => {
        const rows = q.byName.all(c.name).map(rowToGuest);
        const existing = rows.find((g) => g.hasCard) || rows.find((g) => !g.hasCard);
        if (existing) {
          if (bringingTouched) q.setComing.run(c.name, c.rsvp, c.bringingKind, c.bringingText, c.vibeKind, c.vibeText, existing.id);
          else q.setStatus.run(c.name, c.rsvp, existing.id);
          rememberRsvp(c.name, c.rsvp);
          return { name: c.name, status: c.rsvp, counts: this.rsvpCounts(), guestId: existing.id, hasCard: existing.hasCard };
        }
        const editToken = newEditToken();
        const avatar = randomAvatar();
        const { lastInsertRowid } = q.insert.run(...pack({ ...c, about: null, avatar }), 0, hashToken(editToken));
        const id = Number(lastInsertRowid);
        rememberRsvp(c.name, c.rsvp);
        return { name: c.name, status: c.rsvp, counts: this.rsvpCounts(), guestId: id, hasCard: false, editToken };
      });
    },

    openRsvps() {
      return this.listGuests()
        .filter((g) => !g.hasCard && g.rsvp !== 'no')
        .map((g) => ({ id: g.id, name: g.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    claimGuest(id) {
      const existing = q.get.get(id);
      if (!existing) return null;
      const guest = rowToGuest(existing);
      if (guest.hasCard) return null;
      const editToken = newEditToken();
      q.setToken.run(hashToken(editToken), id);
      return { ...rowToGuest(q.get.get(id)), editToken };
    },

    rsvpCounts() {
      const out = { going: 0, maybe: 0, no: 0 };
      for (const row of q.rsvpCounts.all()) if (row.status in out) out[row.status] = row.n;
      return out;
    },

    listRsvps() {
      return q.rsvpAll.all().map((r) => ({ id: r.id, name: r.name, status: r.status, createdAt: r.created_at }));
    },

    bringingTally() {
      const food = new Map(FOOD.map((f) => [f.id, { kind: f.id, label: f.label, count: 0, items: [] }]));
      const vibe = new Map(BRING_VIBES.map((v) => [v.id, { kind: v.id, label: v.label, count: 0, items: [] }]));
      for (const g of this.listGuests()) {
        if (g.rsvp === 'no') continue;
        if (g.bringingKind && food.has(g.bringingKind)) {
          const row = food.get(g.bringingKind);
          row.count += 1;
          if (g.bringingText && row.items.length < 12) row.items.push(g.bringingText);
        }
        if (g.vibeKind && vibe.has(g.vibeKind)) {
          const row = vibe.get(g.vibeKind);
          row.count += 1;
          if (g.vibeText && row.items.length < 12) row.items.push(g.vibeText);
        }
      }
      return {
        food: [...food.values()].filter((row) => row.count),
        vibe: [...vibe.values()].filter((row) => row.count),
      };
    },

    getSettings() {
      const out = { ...DEFAULT_SETTINGS, views: [...DEFAULT_SETTINGS.views] };
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
