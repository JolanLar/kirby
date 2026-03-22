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

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exclusions (
      tmdbId TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      posterUrl TEXT
    );
  `);

  try { db.exec('ALTER TABLE exclusions ADD COLUMN isAuto INTEGER DEFAULT 0;'); } catch(e) {}
  try { db.exec('ALTER TABLE exclusions ADD COLUMN lastSeenAt INTEGER DEFAULT 0;'); } catch(e) {}
  try { db.exec('ALTER TABLE exclusions ADD COLUMN createdAt DATETIME DEFAULT NULL;'); } catch(e) {}
  try { db.exec('UPDATE TABLE exclusions SET createdAt = CURRENT_TIMESTAMP WHERE createdAt IS NULL;'); } catch(e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS delete_history (
      tmdbId TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      posterUrl TEXT,
      lastSeenAt INTEGER DEFAULT 0,
      count INTEGER DEFAULT 0
    );
  `);
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
    INSERT INTO exclusions (tmdbId, title, type, posterUrl, isAuto, lastSeenAt, createdAt) 
    VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM exclusions WHERE tmdbId = ?), CURRENT_TIMESTAMP))
    ON CONFLICT(tmdbId) DO UPDATE SET 
      isAuto = excluded.isAuto,
      lastSeenAt = excluded.lastSeenAt,
      title = excluded.title,
      posterUrl = excluded.posterUrl
  `).run(tmdbId, title, type, posterUrl, isAuto, lastSeenAt, tmdbId);
}

export function removeExclusion(tmdbId: string) {
  db.prepare('DELETE FROM exclusions WHERE tmdbId = ?').run(tmdbId);
  db.prepare('DELETE FROM delete_history WHERE tmdbId = ?').run(tmdbId);
}

export function isExcluded(type: string, tmdbId: string): boolean {
  const row = db.prepare('SELECT 1 FROM exclusions WHERE type = ? AND tmdbId = ?').get(type, tmdbId);
  return !!row;
}

export function recordDeletion(item: MediaItem) {
  db.prepare(`
    INSERT INTO delete_history (tmdbId, title, type, posterUrl, lastSeenAt, count) 
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(tmdbId) DO UPDATE SET 
      count = count + 1,
      lastSeenAt = excluded.lastSeenAt,
      title = excluded.title,
      posterUrl = excluded.posterUrl
  `).run(item.tmdbId, item.title, item.type, item.posterUrl, item.lastSeenAt);
}

export function getDeleteHistoryCounts(): Record<string, number> {
  const rows = db.prepare('SELECT tmdbId, count FROM delete_history').all() as { tmdbId: string, count: number }[];
  return rows.reduce((acc, row) => ({ ...acc, [row.tmdbId]: row.count }), {} as Record<string, number>);
}

initDb();
