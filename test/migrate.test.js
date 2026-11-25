import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../src/db.js';

function v4File(titleJson) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ww-v4-'));
  const file = path.join(dir, 'party.sqlite');
  const raw = new DatabaseSync(file);
  raw.exec(`
    CREATE TABLE guests (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      vibes TEXT NOT NULL DEFAULT '[]',
      need TEXT,
      postcode TEXT,
      area TEXT,
      lat REAL,
      lng REAL,
      created_at TEXT,
      updated_at TEXT,
      about TEXT,
      chapter TEXT NOT NULL DEFAULT '[]',
      chapter_note TEXT,
      need_tags TEXT NOT NULL DEFAULT '[]',
      offer TEXT,
      offer_tags TEXT NOT NULL DEFAULT '[]',
      music TEXT NOT NULL DEFAULT '[]',
      soundtrack TEXT,
      question TEXT,
      area_chip TEXT,
      links TEXT,
      links_consent INTEGER NOT NULL DEFAULT 0,
      bringing_kind TEXT,
      bringing_text TEXT,
      vibe_kind TEXT,
      vibe_text TEXT,
      rsvp TEXT,
      checked_in INTEGER NOT NULL DEFAULT 0,
      checked_in_at TEXT,
      token_hash TEXT,
      missing TEXT,
      hidden_side TEXT
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE rsvps (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT
    );
    INSERT INTO guests (name, avatar, vibes, rsvp) VALUES (
      'Kept', '{"animal":"fox","glasses":"none","hat":"none","bg":"sun"}', '["poetry"]', 'going'
    );
    INSERT INTO rsvps (name, status) VALUES ('Kept', 'going');
    INSERT INTO settings (key, value) VALUES ('title', '${titleJson}');
    PRAGMA user_version = 4;
  `);
  raw.close();
  return file;
}

test('a v4 database keeps its guests and gains has_card', () => {
  const db = openDb(v4File('"Bring your own vibe"'));
  const kept = db.listGuests().find((g) => g.name === 'Kept');
  assert.ok(kept);
  assert.equal(kept.hasCard, true);
  assert.equal(db.getSettings().title, "Until I'm back");
  assert.equal(db.listGuests().length, 1);
  db.close();
});

test('a custom TV title survives the upgrade', () => {
  const db = openDb(v4File('"House party"'));
  assert.equal(db.getSettings().title, 'House party');
  assert.equal(db.listGuests()[0].name, 'Kept');
  db.close();
});
