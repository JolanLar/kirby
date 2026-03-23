import axios from 'axios';
import { getSetting } from '../db';
import { MediaItem } from '../models';

async function getAllUsersItems(client: any): Promise<MediaItem[]> {
  const publicUrl = getSetting('jellyfinPublicUrl');
  const url = getSetting('jellyfinUrl');
  const usersRes = await client.get('/Users');
  const users = usersRes.data || [];
  if (users.length === 0) return [];

  // preferentially pick an admin user as the base to fetch the entire library
  const adminUser = users.find((u: any) => u.Policy?.IsAdministrator) || users[0];
  const itemsMap = new Map<string, MediaItem>();

  // 0. Fetch all Series to quickly map SeriesId -> Series TMDB ID
  const baseItemsRes = await client.get(`/Items?IncludeItemTypes=Series,Movie&Fields=ProviderIds,Path,DateCreated&Recursive=true&UserId=${adminUser.Id}`);
  const seriesMap = new Map<string, string>();
  for (const item of baseItemsRes.data.Items || []) {
    if (!item.ProviderIds?.Tmdb) continue;
    if (item.Type === 'Series') {
      seriesMap.set(item.Id, item.ProviderIds.Tmdb);
    }
    itemsMap.set(item.ProviderIds.Tmdb, {
      jellyfinId: item.Id,
      tmdbId: item.ProviderIds.Tmdb,
      title: item.Name,
      type: item.Type === 'Series' ? 'show' : 'movie',
      lastSeenAt: new Date(item.DateCreated).getTime(),
      posterUrl: `${publicUrl || url}/Items/${item.Id}/Images/Primary`,
      sizeOnDisk: 0,
      jellyfinPath: item.Path,
      source: 'jellyfin',
    });
  }

  // 1. Fetch only played items for all other users concurrently
  await Promise.all(users.map(async (user: any) => {
    try {
      // Filters=IsPlayed heavily reduces the payload size
      const playedRes = await client.get(`/Items?IncludeItemTypes=Movie,Episode&Fields=UserData,ProviderIds,SeriesId&Filters=IsPlayed&Recursive=true&UserId=${user.Id}`);
      for (const item of playedRes.data.Items || []) {
        const lastPlayed = item.UserData?.LastPlayedDate 
          ? new Date(item.UserData.LastPlayedDate).getTime() 
          : 0;
        const tmdbId = item.Type === 'Episode' ? seriesMap.get(item.SeriesId) : item.ProviderIds?.Tmdb || '';

        const existing = itemsMap.get(tmdbId);
        if (existing && lastPlayed > existing.lastSeenAt) {
          existing.lastSeenAt = lastPlayed;
        }
      }
    } catch (e: any) {
      console.error(`[Jellyfin] Failed to fetch played items for user ${user.Id}: ${e.message}`);
    }
  }));

  return Array.from(itemsMap.values()).sort((a, b) => a.lastSeenAt - b.lastSeenAt);
}

export async function getJellyfinItems(): Promise<MediaItem[]> {
  const url = getSetting('jellyfinUrl');
  const apiKey = getSetting('jellyfinApiKey');

  if (!url || !apiKey) {
    console.log('[Jellyfin] Not configured.');
    return [];
  }

  try {
    const client = axios.create({
      baseURL: url,
      headers: {
        'Authorization': `MediaBrowser Token="${apiKey}"`,
        'Accept': 'application/json'
      }
    });

    return await getAllUsersItems(client);
  } catch (err: any) {
    console.error(`[Jellyfin] Failed to fetch items: ${err.message}`);
    return [];
  }
}

export async function deleteJellyfinItem(itemId: string): Promise<boolean> {
  const url = getSetting('jellyfinUrl');
  const apiKey = getSetting('jellyfinApiKey');

  if (!url || !apiKey) {
    console.error(`[Jellyfin] Not configured.`);
    return false;
  }

  try {
    const client = axios.create({
      baseURL: url,
      headers: {
        'Authorization': `MediaBrowser Token="${apiKey}"`,
        'Accept': 'application/json'
      }
    });

    console.log(`[Jellyfin] Deleting item (ID: ${itemId})...`);
    await client.delete(`/Items/${itemId}`);
    return true;
  } catch (err: any) {
    console.error(`[Jellyfin] Failed to delete item ${itemId}: ${err.message}`);
    return false;
  }
}

export async function getJellyfinPaths(url: string = getSetting('jellyfinUrl'), apiKey: string = getSetting('jellyfinApiKey')): Promise<string[]> {
  if (!url || !apiKey) {
    return [];
  }

  try {
    const client = axios.create({
      baseURL: url,
      headers: {
        'Authorization': `MediaBrowser Token="${apiKey}"`,
        'Accept': 'application/json'
      }
    });

    const res = await client.get('/Library/VirtualFolders');
    const folders = res.data || [];
    return folders.flatMap((f: any) => f.Locations || []);
  } catch (err: any) {
    console.error(`[Jellyfin] Failed to fetch paths: ${err.message}`);
    return [];
  }
}

export async function getMappingPaths(url: string = getSetting('jellyfinUrl'), apiKey: string = getSetting('jellyfinApiKey')): Promise<string[]> {
  const paths = await getJellyfinPaths(url, apiKey);
  return [...new Set(paths.flatMap((path: string) => {
    const parts = path.split('/');
    const mappingPaths: string[] = [];
    for (let i = 1; i < parts.length; i++) {
      mappingPaths.push(parts.slice(0, i).join('/') || '/');
    }
    mappingPaths.push(path);
    return mappingPaths;
  }))];
}
