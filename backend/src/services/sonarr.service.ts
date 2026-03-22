import axios from 'axios';
import { getSetting } from '../db';
import { MediaItem, SonarrSeries, RootFolder } from '../models';

export async function getShowsFromSonarr(): Promise<SonarrSeries[]> {
  const url = getSetting('sonarrUrl');
  const apiKey = getSetting('sonarrApiKey');

  if (!url || !apiKey) {
    console.log('[Sonarr] Not configured.');
    return [];
  }

  try {
    const client = axios.create({
      baseURL: url,
      headers: { 'X-Api-Key': apiKey }
    });

    // Fetch all series to find the matching one
    const res = await client.get('/api/v3/series');
    const series = res.data || [];

    return series;
  } catch (err: any) {
    console.error(`[Sonarr] Error fetching series: ${err.message}`);
    return [];
  }
}

export async function deleteShowFromSonarr(item: MediaItem): Promise<boolean> {
  try {
    const series = await getShowsFromSonarr();

    // Find by tmdbid
    let foundSeries = series.find((s: any) => s.tmdbId === Number(item.tmdbId));

    if (!foundSeries) {
      console.log(`[Sonarr] Series not found: ${item.title}`);
      return false;
    }

    console.log(`[Sonarr] Found series ${foundSeries.title} (ID: ${foundSeries.id}). Deleting...`);
    // Delete series and its files
    const url = getSetting('sonarrUrl');
    const apiKey = getSetting('sonarrApiKey');
    const client = axios.create({
      baseURL: url,
      headers: { 'X-Api-Key': apiKey }
    });
    await client.delete(`/api/v3/series/${foundSeries.id}?deleteFiles=true`);
    return true;
  } catch (err: any) {
    console.error(`[Sonarr] Error deleting series: ${err.message}`);
    return false;
  }
}

// Get downloads IDs from history
export async function getDownloadIdsFromSonarr(item: MediaItem): Promise<string[]> {
  try {
    const series = await getShowsFromSonarr();
    let foundSeries = series.find((s: any) => s.tmdbId === Number(item.tmdbId));
    if (!foundSeries) {
      console.log(`[Sonarr] Series not found: ${item.title}`);
      return [];
    }
    const url = getSetting('sonarrUrl');
    const apiKey = getSetting('sonarrApiKey');
    if (!url || !apiKey) {
      console.log('[Sonarr] Not configured.');
      return [];
    }
    const client = axios.create({
      baseURL: url,
      headers: { 'X-Api-Key': apiKey }
    });
    const res = await client.get(`/api/v3/history/series?seriesId=${foundSeries.id}`);
    const episodes = res.data.episodes;
    return [...new Set(episodes.map((e: any) => e.downloadId).filter((id: string) => id))] as string[];
  } catch (err: any) {
    console.error(`[Sonarr] Error getting download ID: ${err.message}`);
    return [];
  }
}

export async function getRootFolders(url: string = getSetting('sonarrUrl'), apiKey: string = getSetting('sonarrApiKey')): Promise<RootFolder[]> {
  if (!url || !apiKey || !url.startsWith('http')) {
    return [];
  }
  try {
    const client = axios.create({
      baseURL: url,
      headers: { 'X-Api-Key': apiKey },
      timeout: 5000
    });
    const res = await client.get(`/api/v3/rootfolder`);
    return res.data || [];
  } catch (err: any) {
    if (err.response?.status !== 404) {
      console.error(`[Sonarr] Error getting root folders: ${err.message}`);
    }
    return [];
  }
}

// Get all possible mapping paths (e.g. /media/raid/movies -> ["/media/raid/movies", "/media/raid", "/media"])
export async function getMappingPaths(url: string = getSetting('sonarrUrl'), apiKey: string = getSetting('sonarrApiKey')): Promise<string[]> {
  const rootFolders = await getRootFolders(url, apiKey);
  const mappingPaths: string[] = [];
  for (const folder of rootFolders) {
    const path = folder.path;
    const pathSegments = path.split('/');
    for (let i = 1; i < pathSegments.length; i++) {
      mappingPaths.push(pathSegments.slice(0, i).join('/') || '/');
    }
    mappingPaths.push(path);
  }
  return [...new Set(mappingPaths)];
}