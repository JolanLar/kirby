import axios from 'axios';
import { getSetting } from '../db';
import { MediaItem } from '../models';

const PLEX_HEADERS = {
  'X-Plex-Product': 'Kirby',
  'X-Plex-Client-Identifier': 'Kirby-Media-Manager-Auth',
  'Accept': 'application/json'
};

export async function getPlexItems(): Promise<MediaItem[]> {
  const url = getSetting('plexUrl');
  const token = getSetting('plexToken');
  const publicUrl = getSetting('plexPublicUrl');

  if (!url || !token) {
    console.log('[Plex] Not configured.');
    return [];
  }

  try {
    const items: MediaItem[] = [];
    const client = axios.create({
      baseURL: url,
      headers: {
        ...PLEX_HEADERS,
        'X-Plex-Token': token
      }
    });

    // Get libraries
    const libsRes = await client.get('/library/sections');
    const sections = libsRes.data?.MediaContainer?.Directory || [];

    for (const section of sections) {
      // Fetch movies sorted by last viewed
      const res = await client.get(`/library/sections/${section.key}/all?sort=lastViewedAt:asc&includeGuids=1&include=metadata`);
      const metadata = res.data?.MediaContainer?.Metadata || [];
      for (const meta of metadata) {
        let tmdbId = meta.ratingKey; // fallback
        if (meta.Guid && Array.isArray(meta.Guid)) {
          const tmdbGuid = meta.Guid.find((g: any) => g?.id?.startsWith('tmdb://'));
          if (tmdbGuid) {
            tmdbId = tmdbGuid.id.replace('tmdb://', '');
          }
        }
        items.push({
          plexId: meta.ratingKey,
          tmdbId: tmdbId,
          title: meta.title,
          type: section.type,
          lastSeenAt: meta.lastViewedAt > meta.addedAt ? meta.lastViewedAt * 1000 : meta.addedAt * 1000,
          posterUrl: `${publicUrl || url}${meta.thumb}?X-Plex-Token=${token}`,
          sizeOnDisk: 0,
          plexPath: meta.Media?.[0]?.Part?.[0]?.file,
          source: 'plex',
        });
      }
    }

    return items;
  } catch (err: any) {
    console.error(`[Plex] Failed to fetch items: ${err.message}`);
    return [];
  }
}

export async function deletePlexItem(plexId: string): Promise<boolean> {
  const url = getSetting('plexUrl');
  const token = getSetting('plexToken');

  if (!url || !token) {
    console.error(`[Plex] Not configured.`);
    return false;
  }

  try {
    const client = axios.create({
      baseURL: url,
      headers: {
        ...PLEX_HEADERS,
        'X-Plex-Token': token
      }
    });

    await client.delete(`/library/metadata/${plexId}`);
    return true;
  } catch (err: any) {
    console.error(`[Plex] Failed to delete item ${plexId}: ${err.message}`);
    return false;
  }
}

export async function getPlexPaths(url: string = getSetting('plexUrl'), token: string = getSetting('plexToken')): Promise<string[]> {
  if (!url || !token) {
    console.log('[Plex] Not configured.');
    return [];
  }

  try {
    const client = axios.create({
      baseURL: url,
      headers: {
        ...PLEX_HEADERS,
        'X-Plex-Token': token
      }
    });

    const libsRes = await client.get('/library/sections/all');
    return libsRes.data?.MediaContainer?.Directory?.flatMap((d: any) => d.Location?.flatMap((l: any) => l.path)) || [];
  } catch (err: any) {
    console.error(`[Plex] Failed to fetch sections: ${err.message}`);
    return [];
  }
}


export async function getPlexPin(): Promise<{ id: number; code: string }> {
  try {
    const res = await axios.post('https://plex.tv/api/v2/pins', {
      strong: true
    }, {
      headers: PLEX_HEADERS
    });
    return { id: res.data.id, code: res.data.code };
  } catch (err: any) {
    console.error(`[Plex] Failed to get PIN: ${err.message}`);
    throw err;
  }
}

export async function getPlexToken(pinId: number): Promise<string | null> {
  try {
    const res = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
      headers: PLEX_HEADERS
    });
    const token = res.data.authToken || null;
    if (token) {
      console.log(`[Plex] Token retrieved for PIN ${pinId}`);
    }
    return token;
  } catch (err: any) {
    console.error(`[Plex] Failed to get token for PIN ${pinId}: ${err.message}`);
    return null;
  }
}

export async function getPlexResources(token: string): Promise<any[]> {
  try {
    const res = await axios.get('https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1', {
      headers: {
        ...PLEX_HEADERS,
        'X-Plex-Token': token
      }
    });
    // Filter only for servers
    return (res.data || []).filter((r: any) => r.provides?.includes('server'));
  } catch (err: any) {
    console.error(`[Plex] Failed to get resources: ${err.message}`);
    return [];
  }
}

// Get all possible mapping paths (e.g. /media/raid/movies -> ["/media/raid/movies", "/media/raid", "/media"])
export async function getMappingPaths(url: string = getSetting('plexUrl'), token: string = getSetting('plexToken')): Promise<string[]> {
  const paths = await getPlexPaths(url, token);
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