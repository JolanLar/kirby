import { getDiskStatus } from '../services/disk.service';
import { getPlexItems, deletePlexItem } from '../services/plex.service';
import { getJellyfinItems, deleteJellyfinItem } from '../services/jellyfin.service';
import { deleteMovieFromRadarr, getMoviesFromRadarr, getDownloadIdsFromRadarr } from '../services/radarr.service';
import { deleteShowFromSonarr, getShowsFromSonarr, getDownloadIdsFromSonarr } from '../services/sonarr.service';
import { deleteFromQBittorrent } from '../services/qbittorrent.service';
import { isExcluded, getStorages, recordDeletion, getDeleteHistoryCounts, getSetting, addExclusion } from '../db';
import { MediaItem } from '../models';

export let deletionQueue: Record<string, MediaItem[]> = {};

export function removeFromQueue(tmdbId: string) {
  for (const key of Object.keys(deletionQueue)) {
    deletionQueue[key] = deletionQueue[key].filter(i => i.tmdbId !== tmdbId);
  }
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
      if (item.posterUrl) {
        uniqueItems[key].posterUrl = item.posterUrl;
      }
      if (item.plexId) {
        uniqueItems[key].plexId = item.plexId;
      }
      if (item.jellyfinId) {
        uniqueItems[key].jellyfinId = item.jellyfinId;
      }
      if (item.plexPath) {
        uniqueItems[key].plexPath = item.plexPath;
      }
      if (item.jellyfinPath) {
        uniqueItems[key].jellyfinPath = item.jellyfinPath;
      }
    }
  }

  // Get sizes from Sonarr and Radarr
  const sonarrSeries = await getShowsFromSonarr();
  const radarrMovies = await getMoviesFromRadarr();

  // Merge sizes into uniqueItems
  for (const serie of sonarrSeries) {
    const type = "show";
    const key = serie.tmdbId;
    if (uniqueItems[type + "-" + key]) {
      uniqueItems[type + "-" + key].sizeOnDisk = serie.statistics.sizeOnDisk;
    }
  }
  for (const movie of radarrMovies) {
    const type = "movie";
    const key = movie.tmdbId;
    if (uniqueItems[type + "-" + key]) {
      uniqueItems[type + "-" + key].sizeOnDisk = movie.statistics.sizeOnDisk;
    }
  }

  const threshold = parseInt(getSetting('autoExcludeThreshold', '0'), 10);
  const deleteCounts = threshold > 0 ? getDeleteHistoryCounts() : {};

  const sorted = Object.values(uniqueItems)
    .filter(item => {
      if (isExcluded(item.type, item.tmdbId)) return false;
      
      if (threshold > 0) {
        const count = deleteCounts[item.tmdbId] || 0;
        if (count >= threshold) {
          addExclusion(item.tmdbId, item.title, item.type, item.posterUrl, item.lastSeenAt, 1);
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => a.lastSeenAt - b.lastSeenAt);

  return sorted;
}

export async function refreshQueue(): Promise<Record<string, MediaItem[]>> {
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

export async function processDeletion() {
  console.log('[Job] Running deletion evaluation...');
  try {
    const queueMap = await refreshQueue();
    const storages = getStorages();
    
    for (const storage of storages) {
      const targetFreeSpaceStr = storage.targetFreeSpace;
      const targetFreeSpace = typeof targetFreeSpaceStr === 'number' ? targetFreeSpaceStr : parseFloat(targetFreeSpaceStr);
      
      if (isNaN(targetFreeSpace)) continue;

      const disk = await getDiskStatus(storage);
      
      if (disk.error) {
         console.error(`[Job] Cannot process deletion for ${storage.name} because disk check failed: ${disk.error}`);
         continue;
      }

      console.log(`[Job] [${storage.name}] Disk Free Space: ${disk.freeBytes.toFixed(2)}GB. Target: ${targetFreeSpace}GB`);

      if (disk.freeBytes < targetFreeSpace) {
        const queue = queueMap[storage.id] || [];
        if (queue.length > 0) {
          const oldestItem = queue[0];
          console.log(`[Job] [${storage.name}] Target saturation exceeded! Attempting to delete: ${oldestItem.title} (Seen: ${new Date(oldestItem.lastSeenAt).toISOString()})`);
          
          const deleted = await deleteItem(oldestItem);

          if (deleted) {
            deletionQueue[storage.id] = deletionQueue[storage.id].filter(i => i.tmdbId !== oldestItem.tmdbId);
          } else {
            console.log(`[Job] [${storage.name}] Could not delete item: ${oldestItem.title}. Skipping until next run or exclusion...`);
          }
        } else {
          console.log(`[Job] [${storage.name}] Target saturation exceeded, but no eligible media found to delete.`);
        }
      }
    }
  } catch (err: any) {
    console.error(`[Job] Error in deletion process: ${err.message}`);
  }
}

export async function deleteItem(item: MediaItem) {
      let deleted = false;
      
      const hashes = item.type === 'show' ? await getDownloadIdsFromSonarr(item) : await getDownloadIdsFromRadarr(item);
      for (const hash of hashes) {
        await deleteFromQBittorrent(hash);
      }

      if (item.type === 'show') {
         deleted = await deleteShowFromSonarr(item);
      } else {
         deleted = await deleteMovieFromRadarr(item);
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
  // Run immediately then every 5 minutes
  processDeletion();
  setInterval(processDeletion, 5 * 60 * 1000);
}
