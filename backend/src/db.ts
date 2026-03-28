import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { StorageConfig, MediaItem } from './models';

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'kirby.db');

// Ensure directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(dbPath);

// Migrate tables from single tmdbId PK to composite (tmdbId, type) PK
function migrateSchemaToV2() {
  const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='exclusions'").get() as { sql: string } | undefined;
  if (!info) return; // Fresh install, tables not created yet
  if (/PRIMARY KEY\s*\(\s*tmdbId\s*,\s*type\s*\)/i.test(info.sql)) return; // Already migrated

  console.log('[DB] Migrating schema to v2 (composite primary keys)...');

  try {
    db.exec(`
      CREATE TABLE exclusions_v2 (
        tmdbId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        posterUrl TEXT,
        isAuto INTEGER DEFAULT 0,
        lastSeenAt INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT NULL,
        PRIMARY KEY (tmdbId, type)
      );
      INSERT OR IGNORE INTO exclusions_v2 (tmdbId, type, title, posterUrl, isAuto, lastSeenAt, createdAt)
        SELECT tmdbId, type, title, posterUrl, COALESCE(isAuto, 0), COALESCE(lastSeenAt, 0), createdAt FROM exclusions;
      DROP TABLE exclusions;
      ALTER TABLE exclusions_v2 RENAME TO exclusions;
    `);
  } catch(e) { console.error('[DB] Failed to migrate exclusions table:', e); }

  try {
    db.exec(`
      CREATE TABLE delete_history_v2 (
        tmdbId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        lastSeenAt INTEGER DEFAULT 0,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (tmdbId, type)
      );
      INSERT OR IGNORE INTO delete_history_v2 (tmdbId, type, title, lastSeenAt, count)
        SELECT tmdbId, type, title, COALESCE(lastSeenAt, 0), COALESCE(count, 0) FROM delete_history;
      DROP TABLE delete_history;
      ALTER TABLE delete_history_v2 RENAME TO delete_history;
    `);
  } catch(e) { console.error('[DB] Failed to migrate delete_history table:', e); }

  try {
    db.exec(`
      CREATE TABLE favorites_v2 (
        tmdbId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        posterUrl TEXT,
        favoritedBy TEXT DEFAULT '[]',
        ignoreFavorite INTEGER DEFAULT 0,
        lastSeenAt INTEGER DEFAULT 0,
        sources TEXT DEFAULT '[]',
        PRIMARY KEY (tmdbId, type)
      );
      INSERT OR IGNORE INTO favorites_v2 (tmdbId, type, title, posterUrl, favoritedBy, ignoreFavorite, lastSeenAt, sources)
        SELECT tmdbId, type, title, posterUrl, COALESCE(favoritedBy, '[]'), COALESCE(ignoreFavorite, 0), COALESCE(lastSeenAt, 0), COALESCE(sources, '[]') FROM favorites;
      DROP TABLE favorites;
      ALTER TABLE favorites_v2 RENAME TO favorites;
    `);
  } catch(e) { console.error('[DB] Failed to migrate favorites table:', e); }

  console.log('[DB] Schema migration to v2 complete.');
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exclusions (
      tmdbId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      posterUrl TEXT,
      isAuto INTEGER DEFAULT 0,
      lastSeenAt INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT NULL,
      PRIMARY KEY (tmdbId, type)
    );

    CREATE TABLE IF NOT EXISTS delete_history (
      tmdbId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      lastSeenAt INTEGER DEFAULT 0,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (tmdbId, type)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      tmdbId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      posterUrl TEXT,
      favoritedBy TEXT DEFAULT '[]',
      ignoreFavorite INTEGER DEFAULT 0,
      lastSeenAt INTEGER DEFAULT 0,
      sources TEXT DEFAULT '[]',
      PRIMARY KEY (tmdbId, type)
    );
  `);

  // Column additions for old installs (before composite PK migration)
  try { db.exec('ALTER TABLE exclusions ADD COLUMN isAuto INTEGER DEFAULT 0;'); } catch(e) {}
  try { db.exec('ALTER TABLE exclusions ADD COLUMN lastSeenAt INTEGER DEFAULT 0;'); } catch(e) {}
  try { db.exec('ALTER TABLE exclusions ADD COLUMN createdAt DATETIME DEFAULT NULL;'); } catch(e) {}
  try { db.exec("ALTER TABLE favorites ADD COLUMN lastSeenAt INTEGER DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE favorites ADD COLUMN sources TEXT DEFAULT '[]';"); } catch (_) {}
  try { db.exec("ALTER TABLE delete_history DROP COLUMN posterUrl;"); } catch (_) {}

  // Migrate to composite primary keys if needed (must run after column additions)
  migrateSchemaToV2();
}

export function getSetting(key: string, defaultValueRef: string = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : defaultValueRef;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string, value: string }[];
  return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Record<string, string>);
}

export function getStorages(): StorageConfig[] {
  const raw = getSetting('storages', '[]');
  try {
    return JSON.parse(raw) as StorageConfig[];
  } catch (err) {
    return [];
  }
}

export function saveStorages(storages: StorageConfig[]) {
  setSetting('storages', JSON.stringify(storages));
}

export function getExclusions() {
  return db.prepare('SELECT * FROM exclusions').all();
}

export function addExclusion(tmdbId: string, title: string, type: string, posterUrl: string | null, lastSeenAt: number = 0, isAuto: number = 0) {
  db.prepare(`
    INSERT INTO exclusions (tmdbId, type, title, posterUrl, isAuto, lastSeenAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM exclusions WHERE tmdbId = ? AND type = ?), CURRENT_TIMESTAMP))
    ON CONFLICT(tmdbId, type) DO UPDATE SET
      isAuto = excluded.isAuto,
      lastSeenAt = excluded.lastSeenAt,
      title = excluded.title,
      posterUrl = excluded.posterUrl
  `).run(tmdbId, type, title, posterUrl, isAuto, lastSeenAt, tmdbId, type);
}

export function removeExclusion(tmdbId: string, type: string) {
  db.prepare('DELETE FROM exclusions WHERE tmdbId = ? AND type = ?').run(tmdbId, type);
  db.prepare('DELETE FROM delete_history WHERE tmdbId = ? AND type = ?').run(tmdbId, type);
}

export function isExcluded(type: string, tmdbId: string): boolean {
  const row = db.prepare('SELECT 1 FROM exclusions WHERE type = ? AND tmdbId = ?').get(type, tmdbId);
  return !!row;
}

export function recordDeletion(item: MediaItem) {
  db.prepare(`
    INSERT INTO delete_history (tmdbId, type, title, lastSeenAt, count)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(tmdbId, type) DO UPDATE SET
      count = count + 1,
      lastSeenAt = excluded.lastSeenAt,
      title = excluded.title
  `).run(item.tmdbId, item.type, item.title, item.lastSeenAt);
}

export function seedDeletionHistory(tmdbId: string, title: string, type: string, count: number, lastSeenAt: number = 0) {
  db.prepare(`
    INSERT INTO delete_history (tmdbId, type, title, lastSeenAt, count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(tmdbId, type) DO UPDATE SET count = ?, lastSeenAt = ?, title = ?
  `).run(tmdbId, type, title, lastSeenAt, count, count, lastSeenAt, title);
}

// Returns counts keyed by "type-tmdbId" to disambiguate movies and shows with the same tmdbId
export function getDeleteHistoryCounts(): Record<string, number> {
  const rows = db.prepare('SELECT tmdbId, type, count FROM delete_history').all() as { tmdbId: string, type: string, count: number }[];
  return rows.reduce((acc, row) => ({ ...acc, [row.type + '-' + row.tmdbId]: row.count }), {} as Record<string, number>);
}

export interface FavoriteItem {
  tmdbId: string;
  title: string;
  type: string;
  posterUrl: string | null;
  favoritedBy: string[];
  ignoreFavorite: number;
  lastSeenAt: number;
  sources: string[];
}

export function getFavorites(): FavoriteItem[] {
  const rows = db.prepare('SELECT * FROM favorites').all() as any[];
  return rows.map(r => ({ ...r, favoritedBy: JSON.parse(r.favoritedBy || '[]'), sources: JSON.parse(r.sources || '[]') }));
}

export function upsertFavorite(tmdbId: string, title: string, type: string, posterUrl: string | null, favoritedBy: string[], lastSeenAt: number = 0, sources: string[] = []) {
  db.prepare(`
    INSERT INTO favorites (tmdbId, type, title, posterUrl, favoritedBy, lastSeenAt, sources)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tmdbId, type) DO UPDATE SET
      title = excluded.title,
      posterUrl = excluded.posterUrl,
      favoritedBy = excluded.favoritedBy,
      lastSeenAt = excluded.lastSeenAt,
      sources = excluded.sources
  `).run(tmdbId, type, title, posterUrl, JSON.stringify(favoritedBy), lastSeenAt, JSON.stringify(sources));
}

// currentKeys is an array of "type-tmdbId" composite keys
export function removeStaleFavorites(currentKeys: string[]) {
  const all = db.prepare('SELECT tmdbId, type FROM favorites').all() as { tmdbId: string, type: string }[];
  for (const row of all) {
    if (!currentKeys.includes(row.type + '-' + row.tmdbId)) {
      db.prepare('DELETE FROM favorites WHERE tmdbId = ? AND type = ?').run(row.tmdbId, row.type);
    }
  }
}

export function updateFavoriteLastSeen(tmdbId: string, type: string, lastSeenAt: number) {
  db.prepare('UPDATE favorites SET lastSeenAt = ? WHERE tmdbId = ? AND type = ? AND lastSeenAt < ?').run(lastSeenAt, tmdbId, type, lastSeenAt);
}

export function setIgnoreFavorite(tmdbId: string, type: string, ignore: boolean) {
  db.prepare('UPDATE favorites SET ignoreFavorite = ? WHERE tmdbId = ? AND type = ?').run(ignore ? 1 : 0, tmdbId, type);
}

export function isFavoritedAndNotIgnored(tmdbId: string, type: string): boolean {
  const row = db.prepare('SELECT ignoreFavorite FROM favorites WHERE tmdbId = ? AND type = ?').get(tmdbId, type) as { ignoreFavorite: number } | undefined;
  if (!row) return false;
  return row.ignoreFavorite === 0;
}

initDb();
