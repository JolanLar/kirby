import { getDiskStatus } from '../services/disk.service';
import { getPlexItems, deletePlexItem, getPlexFavorites, getPlexMachineId } from '../services/plex.service';
import { getJellyfinItems, deleteJellyfinItem, getJellyfinFavorites } from '../services/jellyfin.service';
import { deleteMovieFromRadarr, getMoviesFromRadarr, searchRadarrMovie, getDownloadIdsFromRadarr } from '../services/radarr.service';
import { deleteShowFromSonarr, getShowsFromSonarr, searchSonarrSerie, getDownloadIdsFromSonarr } from '../services/sonarr.service';
import { deleteManyFromQBittorrent, findLinkedTorrentHashes } from '../services/qbittorrent.service';
import { isExcluded, getStorages, recordDeletion, getDeleteHistoryCounts, getSetting, addExclusion, isFavoritedAndNotIgnored, upsertFavorite, removeStaleFavorites, updateFavoriteLastSeen } from '../db';
import { MediaItem } from '../models';
import { logger } from '../logger';

export let deletionQueue: Record<string, MediaItem[]> = {};

let refreshPromise: Promise<Record<string, MediaItem[]>> | null = null;
let deletionTimer: NodeJS.Timeout | null = null;
let schedulerRunning = false;
let lastRunStartedAt: number | null = null;
let lastRunCompletedAt: number | null = null;
let nextRunAt: number | null = null;

const DEFAULT_DELETION_INTERVAL_MINUTES = 5;
const MIN_DELETION_INTERVAL_MINUTES = 1;

function getDeletionIntervalMinutes(): number {
  const parsed = parseInt(getSetting('deletionIntervalMinutes', String(DEFAULT_DELETION_INTERVAL_MINUTES)), 10);
  if (Number.isNaN(parsed)) return DEFAULT_DELETION_INTERVAL_MINUTES;
  return Math.max(MIN_DELETION_INTERVAL_MINUTES, parsed);
}

function scheduleNextDeletionRun(delayMs = getDeletionIntervalMinutes() * 60 * 1000) {
  if (deletionTimer) clearTimeout(deletionTimer);
  nextRunAt = Date.now() + delayMs;
  deletionTimer = setTimeout(() => {
    runDeletionCycle().catch(err => {
      logger.error('[Job] Unhandled deletion cycle error:', err);
      scheduleNextDeletionRun();
    });
  }, delayMs);
  deletionTimer.unref?.();
}

async function runDeletionCycle() {
  schedulerRunning = true;
  nextRunAt = null;
  lastRunStartedAt = Date.now();
  try {
    await processDeletion();
  } finally {
    schedulerRunning = false;
    lastRunCompletedAt = Date.now();
    scheduleNextDeletionRun();
  }
}

function isDryRunEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.DRY_RUN || '').toLowerCase());
}

export function getDeletionJobStatus() {
  return {
    intervalMinutes: getDeletionIntervalMinutes(),
    nextRunAt,
    lastRunStartedAt,
    lastRunCompletedAt,
    running: schedulerRunning,
    dryRun: isDryRunEnabled(),
  };
}

export function restartDeletionJob() {
  if (deletionTimer) {
    clearTimeout(deletionTimer);
    deletionTimer = null;
  }
  if (!schedulerRunning) {
    scheduleNextDeletionRun();
  }
}

export function isQueueRefreshing(): boolean {
  return refreshPromise !== null;
}

export function removeFromQueue(tmdbId: string, type: string) {
  for (const key of Object.keys(deletionQueue)) {
    deletionQueue[key] = deletionQueue[key].filter(i => !(i.tmdbId === tmdbId && i.type === type));
  }
}

async function syncFavorites(): Promise<void> {
  const excludeFavorites = getSetting('excludeFavorites', 'false') === 'true';
  if (!excludeFavorites) return;

  const allUsersMode = getSetting('excludeFavoritesAllUsers', 'true') === 'true';
  let includeUsers: string[] | undefined;
  if (!allUsersMode) {
    const raw = getSetting('excludeFavoritesUsers', '[]');
    try { includeUsers = JSON.parse(raw); } catch { includeUsers = []; }
  }

  const [plexFavs, jellyfinFavs] = await Promise.all([
    getPlexFavorites(includeUsers),
    getJellyfinFavorites(includeUsers),
  ]);

  // Merge by composite key (type + tmdbId) — a movie and show can share the same tmdbId
  const merged = new Map<string, { tmdbId: string; title: string; type: string; posterUrl: string; favoritedBy: string[]; lastSeenAt: number; sources: string[] }>();
  for (const [source, favs] of [['plex', plexFavs], ['jellyfin', jellyfinFavs]] as const) {
    for (const f of favs) {
      const key = f.type + '-' + f.tmdbId;
      const existing = merged.get(key);
      if (existing) {
        for (const u of f.favoritedBy) {
          if (!existing.favoritedBy.includes(u)) existing.favoritedBy.push(u);
        }
        if (!existing.sources.includes(source)) existing.sources.push(source);
      } else {
        merged.set(key, { ...f, lastSeenAt: 0, sources: [source] });
      }
    }
  }

  // Persist to DB — we'll get lastSeenAt from the queue items lookup
  const currentKeys: string[] = [];
  for (const fav of merged.values()) {
    upsertFavorite(fav.tmdbId, fav.title, fav.type, fav.posterUrl, fav.favoritedBy, fav.lastSeenAt, fav.sources);
    currentKeys.push(fav.type + '-' + fav.tmdbId);
  }
  removeStaleFavorites(currentKeys);
}

async function fetchAndRankItems(): Promise<MediaItem[]> {
  const plexItems = await getPlexItems();
  const jellyfinItems = await getJellyfinItems();

  const allItems = [...plexItems, ...jellyfinItems];

  // Merge by TMDB ID (providerId) & Type, keeping the latest lastSeenAt
  const uniqueItems: Record<string, MediaItem> = {};
  for (const item of allItems) {
    const key = item.type + "-" + item.tmdbId;
    if (!uniqueItems[key]) {
      uniqueItems[key] = { ...item };
    } else {
      if (item.lastSeenAt > uniqueItems[key].lastSeenAt) {
        uniqueItems[key].lastSeenAt = item.lastSeenAt;
      }
      if (item.posterUrl) uniqueItems[key].posterUrl = item.posterUrl;
      if (item.plexId) uniqueItems[key].plexId = item.plexId;
      if (item.jellyfinId) uniqueItems[key].jellyfinId = item.jellyfinId;
      if (item.plexPath) uniqueItems[key].plexPath = item.plexPath;
      if (item.jellyfinPath) uniqueItems[key].jellyfinPath = item.jellyfinPath;
    }
  }

  // Get sizes from Sonarr and Radarr
  const sonarrSeries = await getShowsFromSonarr();
  const radarrMovies = await getMoviesFromRadarr();

  for (const serie of sonarrSeries) {
    const key = "show-" + serie.tmdbId;
    if (uniqueItems[key]) {
      uniqueItems[key].sizeOnDisk = serie.statistics.sizeOnDisk;
      uniqueItems[key].sonarrId = serie.titleSlug;
    }
  }
  for (const movie of radarrMovies) {
    const key = "movie-" + movie.tmdbId;
    if (uniqueItems[key]) {
      uniqueItems[key].sizeOnDisk = movie.statistics.sizeOnDisk;
      uniqueItems[key].radarrId = movie.tmdbId;
    }
  }

  // Back-fill lastSeenAt for any item that appears in the favorites table.
  // Favorited items are excluded from the queue so their lastSeenAt is never updated otherwise.
  for (const item of Object.values(uniqueItems)) {
    if (item.lastSeenAt > 0) updateFavoriteLastSeen(item.tmdbId, item.type, item.lastSeenAt);
  }

  const threshold = parseInt(getSetting('autoExcludeThreshold', '0'), 10);
  const deleteDeltaDays = parseInt(getSetting('deletionDeltaDays', '0'), 10);
  const excludeFavorites = getSetting('excludeFavorites', 'false') === 'true';
  const deleteCounts = (threshold > 0 || deleteDeltaDays > 0) ? getDeleteHistoryCounts() : {};

  const filtered = Object.values(uniqueItems).filter(item => {
    if (isExcluded(item.type, item.tmdbId)) return false;

    if (threshold > 0) {
      const count = deleteCounts[item.type + '-' + item.tmdbId] || 0;
      if (count >= threshold) {
        addExclusion(item.tmdbId, item.title, item.type, item.posterUrl, item.lastSeenAt, 1);
        return false;
      }
    }

    if (excludeFavorites && isFavoritedAndNotIgnored(item.tmdbId, item.type)) return false;

    return true;
  });

  // Apply deletion delta to sort: effectiveDate = lastSeenAt + count * deltaDays * ms_per_day
  const MS_PER_DAY = 86_400_000;
  const sorted = filtered
    .map(item => {
      const count = deleteCounts[item.type + '-' + item.tmdbId] || 0;
      const deltaMs = count * deleteDeltaDays * MS_PER_DAY;
      return { ...item, deletionCount: count, deltaDays: deleteDeltaDays, _effectiveDate: item.lastSeenAt + deltaMs };
    })
    .sort((a, b) => a._effectiveDate - b._effectiveDate);

  return sorted;
}

async function doRefreshQueue(): Promise<Record<string, MediaItem[]>> {
  await syncFavorites();
  getPlexMachineId().catch(() => {}); // Keep plexMachineId setting current for frontend links
  const sortedItems = await fetchAndRankItems();
  const storages = getStorages();
  
  const newQueue: Record<string, MediaItem[]> = {};
  for (const storage of storages) {
    newQueue[storage.id] = [];
  }
  
  const sortedStorages = [...storages].sort((a, b) => b.plexPath.length - a.plexPath.length);

  for (const item of sortedItems) {
    if (!item.plexPath && !item.jellyfinPath) continue;
    
    const matchedStorage = sortedStorages.find(s => {
      let matched = false;
      if (item.jellyfinPath && s.jellyfinPath) {
        matched = item.jellyfinPath!.startsWith(s.jellyfinPath);
      }
      if (item.plexPath && s.plexPath) {
        matched = item.plexPath!.startsWith(s.plexPath) || matched;
      }
      return matched;
    });
    if (matchedStorage) {
      newQueue[matchedStorage.id].push(item);
    }
  }

  deletionQueue = newQueue;
  return newQueue;
}

export function refreshQueue(): Promise<Record<string, MediaItem[]>> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefreshQueue().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function processDeletion() {
  logger.info('[Job] Running deletion evaluation...');
  try {
    const queueMap = await refreshQueue();
    const storages = getStorages();
    
    for (const storage of storages) {
      const targetFreeSpaceStr = storage.targetFreeSpace;
      const targetFreeSpace = typeof targetFreeSpaceStr === 'number' ? targetFreeSpaceStr : parseFloat(targetFreeSpaceStr);
      
      if (isNaN(targetFreeSpace)) continue;

      const disk = await getDiskStatus(storage);
      
      if (disk.error) {
         logger.error(`[Job] Cannot process deletion for ${storage.name} because disk check failed: ${disk.error}`);
         continue;
      }

      logger.debug(`[Job] [${storage.name}] Disk Free Space: ${disk.freeBytes.toFixed(2)}GB. Target: ${targetFreeSpace}GB`);

      if (disk.freeBytes < targetFreeSpace) {
        const queue = queueMap[storage.id] || [];
        if (queue.length > 0) {
          const oldestItem = queue[0];
          logger.info(`[Job] [${storage.name}] Target saturation exceeded. Attempting to delete: ${oldestItem.title} (Seen: ${new Date(oldestItem.lastSeenAt).toISOString()})`);
          
          const deleted = await deleteItem(oldestItem);

          if (deleted) {
            deletionQueue[storage.id] = deletionQueue[storage.id].filter(i => !(i.tmdbId === oldestItem.tmdbId && i.type === oldestItem.type));
          } else {
            logger.warn(`[Job] [${storage.name}] Could not delete item: ${oldestItem.title}. Skipping until next run or exclusion...`);
          }
        } else {
          logger.info(`[Job] [${storage.name}] Target saturation exceeded, but no eligible media found to delete.`);
        }
      }
    }
  } catch (err: any) {
    logger.error(`[Job] Error in deletion process: ${err.message}`);
  }
}

export async function deleteItem(item: MediaItem) {
      if (isDryRunEnabled()) {
        logger.info(`[Dry Run] Would delete ${item.type}: ${item.title}`);
        recordDeletion(item);
        return true;
      }

      logger.info(`[Delete] Starting deletion for ${item.type}: ${item.title} (tmdbId: ${item.tmdbId})`);
      if (item.type === 'show') {
        const serie = await searchSonarrSerie(item);
        if (serie) {
          const hashes = await getDownloadIdsFromSonarr(serie);
          logger.debug(`[Delete] Sonarr download hashes for ${item.title}: ${hashes.join(', ') || 'none'}`);
          const linkedHashes = await findLinkedTorrentHashes(hashes);
          logger.info(`[Delete] qBittorrent hashes selected for ${item.title}: ${[...hashes, ...linkedHashes].join(', ') || 'none'}`);
          await deleteManyFromQBittorrent([...hashes, ...linkedHashes]);
          await deleteShowFromSonarr(serie);
        }
      } else {
        const movie = await searchRadarrMovie(item);
        if (movie) {
          const hashes = await getDownloadIdsFromRadarr(movie);
          logger.debug(`[Delete] Radarr download hashes for ${item.title}: ${hashes.join(', ') || 'none'}`);
          const linkedHashes = await findLinkedTorrentHashes(hashes);
          logger.info(`[Delete] qBittorrent hashes selected for ${item.title}: ${[...hashes, ...linkedHashes].join(', ') || 'none'}`);
          await deleteManyFromQBittorrent([...hashes, ...linkedHashes]);
          await deleteMovieFromRadarr(movie);
        }
      }

      if (item.jellyfinId) {
        await deleteJellyfinItem(item.jellyfinId);
      }
      if (item.plexId) {
        await deletePlexItem(item.plexId);
      }

      recordDeletion(item);

      return true;
}

export function startDeletionJob() {
  runDeletionCycle().catch(err => {
    logger.error('[Job] Failed to start deletion job:', err);
    scheduleNextDeletionRun();
  });
}
