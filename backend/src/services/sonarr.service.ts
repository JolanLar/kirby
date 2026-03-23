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

export async function deleteShowFromSonarr(serie: SonarrSeries): Promise<boolean> {
  try {
    // Delete series and its files
    const url = getSetting('sonarrUrl');
    const apiKey = getSetting('sonarrApiKey');
    const client = axios.create({
      baseURL: url,
      headers: { 'X-Api-Key': apiKey }
    });
    await client.delete(`/api/v3/series/${serie.id}?deleteFiles=true`);
    console.log(`[Sonarr] Serie ${serie.title} (ID: ${serie.id}) deleted.`);
    return true;
  } catch (err: any) {
    console.error(`[Sonarr] Error deleting serie ${serie.title} (tmdbId: ${serie.tmdbId}): ${err.message}`);
    return false;
  }
}

export async function searchSonarrSerie(item: MediaItem): Promise<SonarrSeries|undefined> {
  try {
    const series = await getShowsFromSonarr();
    let foundSeries = series.find((s: any) => s.tmdbId === Number(item.tmdbId));
    if (!foundSeries)
      console.error(`[Sonarr] Error finding serie (tmdbId: ${item.tmdbId}): missing from sonarr instance`);
    return foundSeries
  } catch (err: any) {
    console.error(`[Sonarr] Error finding serie (tmdbId: ${item.tmdbId}): ${err.message}`);
    return undefined
  }
}

// Get downloads IDs from history
export async function getDownloadIdsFromSonarr(serie: SonarrSeries): Promise<string[]> {
  try {
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
    const res = await client.get(`/api/v3/history/series?seriesId=${serie.id}`);
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