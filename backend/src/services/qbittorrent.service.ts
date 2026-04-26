import axios from 'axios';
import { getSetting } from '../db';
import { logger } from '../logger';

let qbCookie: string | null = null;

interface QBittorrentTorrent {
  hash: string;
  name: string;
  size: number;
  total_size: number;
  category?: string;
  tags?: string;
  tracker?: string;
  content_path?: string;
  root_path?: string;
  save_path?: string;
}

interface QBittorrentFile {
  name: string;
  size: number;
}

interface QBittorrentConfig {
  url: string;
  user: string;
  pass: string;
}

async function authQBittorrent(url: string, user: string, pass: string): Promise<boolean> {
  try {
    const res = await axios.post(`${url}/api/v2/auth/login`, `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    const setCookie = res.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      qbCookie = setCookie[0].split(';')[0];
      return true;
    }
    return false;
  } catch (err: any) {
    logger.error(`[QBittorrent] Auth failed: ${err.message}`);
    return false;
  }
}

function getQBittorrentConfig(): QBittorrentConfig | null {
  const url = getSetting('qbUrl');
  const user = getSetting('qbUser');
  const pass = getSetting('qbPass');

  if (!url) {
    logger.debug('[QBittorrent] Not configured.');
    return null;
  }

  return { url, user, pass };
}

async function ensureQBittorrentAuth(config: QBittorrentConfig): Promise<boolean> {
  if (!qbCookie) {
    const ok = await authQBittorrent(config.url, config.user, config.pass);
    if (!ok) return false;
  }
  return true;
}

async function getQBittorrent<T>(config: QBittorrentConfig, path: string): Promise<T | null> {
  if (!await ensureQBittorrentAuth(config)) return null;

  try {
    const res = await axios.get<T>(`${config.url}${path}`, {
      headers: { 'Cookie': qbCookie }
    });
    return res.data;
  } catch (err: any) {
    logger.error(`[QBittorrent] Error fetching ${path}: ${err.message}`);
    return null;
  }
}

function normalizeTorrentFiles(files: QBittorrentFile[]): string | null {
  if (files.length === 0) return null;

  const paths = files.map(file => String(file.name || '').replace(/\\/g, '/').replace(/^\/+/, ''));
  const partsList = paths.map(path => path.split('/').filter(Boolean));
  const firstTopFolder = partsList[0]?.[0];
  const dropTopFolder = !!firstTopFolder && partsList.every(parts => parts.length > 1 && parts[0] === firstTopFolder);

  return files
    .map((file, index) => {
      const parts = partsList[index];
      const relativePath = (dropTopFolder ? parts.slice(1) : parts).join('/');
      return `${relativePath}\t${file.size}`;
    })
    .sort()
    .join('\n');
}

async function getTorrentManifest(config: QBittorrentConfig, hash: string): Promise<string | null> {
  const files = await getQBittorrent<QBittorrentFile[]>(config, `/api/v2/torrents/files?hash=${encodeURIComponent(hash)}`);
  if (!files) return null;
  return normalizeTorrentFiles(files);
}

async function getTorrents(config: QBittorrentConfig): Promise<QBittorrentTorrent[]> {
  return await getQBittorrent<QBittorrentTorrent[]>(config, '/api/v2/torrents/info') || [];
}

function summarizeTorrent(torrent: QBittorrentTorrent) {
  return {
    name: torrent.name,
    hash: torrent.hash,
    size: torrent.size,
    total_size: torrent.total_size,
    category: torrent.category,
    tags: torrent.tags,
    tracker: torrent.tracker,
    content_path: torrent.content_path,
    root_path: torrent.root_path,
    save_path: torrent.save_path,
  };
}

export async function findLinkedTorrentHashes(hashes: string[]): Promise<string[]> {
  const config = getQBittorrentConfig();
  if (!config) return [];

  const originalHashes = [...new Set(hashes.filter(Boolean))];
  if (originalHashes.length === 0) return [];

  try {
    logger.debug(`[QBittorrent] Looking for linked cross-seeds for hashes: ${originalHashes.join(', ')}`);
    const torrents = await getTorrents(config);
    if (torrents.length === 0) return [];
    logger.debug(`[QBittorrent] Loaded ${torrents.length} torrents for cross-seed matching.`);

    const torrentsByHash = new Map(torrents.map(torrent => [torrent.hash.toLowerCase(), torrent]));
    const originalHashSet = new Set(originalHashes.map(hash => hash.toLowerCase()));
    const linkedHashes = new Set<string>();
    const linkedTorrents: QBittorrentTorrent[] = [];

    for (const hash of originalHashes) {
      const original = torrentsByHash.get(hash.toLowerCase());
      if (!original) {
        logger.warn(`[QBittorrent] Torrent ${hash} not found while looking for linked cross-seeds.`);
        continue;
      }

      const originalManifest = await getTorrentManifest(config, original.hash);
      if (!originalManifest) continue;
      logger.debug(`[QBittorrent] Matching manifest for ${original.name} (${original.hash}, ${original.total_size} bytes).`);
      logger.debug(`[QBittorrent] Original torrent entry: ${JSON.stringify(summarizeTorrent(original), null, 2)}`);

      for (const candidate of torrents) {
        if (originalHashSet.has(candidate.hash.toLowerCase())) continue;
        if (candidate.total_size !== original.total_size) continue;

        const candidateManifest = await getTorrentManifest(config, candidate.hash);
        if (candidateManifest === originalManifest) {
          linkedHashes.add(candidate.hash);
          linkedTorrents.push(candidate);
          logger.debug(`[QBittorrent] Linked cross-seed match: ${candidate.name} (${candidate.hash}).`);
          logger.debug(`[QBittorrent] Linked torrent entry: ${JSON.stringify(summarizeTorrent(candidate), null, 2)}`);
        }
      }
    }

    const result = [...linkedHashes];
    if (result.length > 0) {
      logger.info(`[QBittorrent] Found linked cross-seed torrents: ${result.join(', ')}`);
      logger.debug(`[QBittorrent] Linked torrent entries: ${JSON.stringify(linkedTorrents.map(summarizeTorrent), null, 2)}`);
    }
    return result;
  } catch (err: any) {
    logger.error(`[QBittorrent] Error finding linked torrents: ${err.message}`);
    return [];
  }
}

export async function deleteManyFromQBittorrent(hashes: string[]): Promise<boolean> {
  const config = getQBittorrentConfig();
  if (!config) return false;

  const uniqueHashes = [...new Set(hashes.filter(hash => hash && hash !== 'all'))];
  if (uniqueHashes.length === 0) return false;

  if (!await ensureQBittorrentAuth(config)) return false;

  try {    
    logger.info(`[QBittorrent] Deleting torrents ${uniqueHashes.join(', ')}...`);
    // Delete torrent and files (deleteFiles=true)
    await axios.post(`${config.url}/api/v2/torrents/delete`, `hashes=${uniqueHashes.map(encodeURIComponent).join('|')}&deleteFiles=true`, {
      headers: {
        'Cookie': qbCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return true;
  } catch (err: any) {
    logger.error(`[QBittorrent] Error deleting torrent: ${err.message}`);
    return false;
  }
}

export async function deleteFromQBittorrent(hash: string): Promise<boolean> {
  return deleteManyFromQBittorrent([hash]);
}
