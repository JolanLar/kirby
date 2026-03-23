import axios from 'axios';
import { getSetting } from '../db';
import { MediaItem, RadarrMovie, RootFolder } from '../models';

export async function getMoviesFromRadarr(): Promise<RadarrMovie[]> {
  const url = getSetting('radarrUrl');
  const apiKey = getSetting('radarrApiKey');

  if (!url || !apiKey) {
    console.log('[Radarr] Not configured.');
    return [];
  }

  try {
    const client = axios.create({
      baseURL: url,
      headers: { 'X-Api-Key': apiKey }
    });

    // Fetch all movies
    const res = await client.get('/api/v3/movie');
    const movies = res.data || [];

    return movies;
  } catch (err: any) {
    console.error(`[Radarr] Error fetching movies: ${err.message}`);
    return [];
  }
}

export async function searchRadarrMovie(item: MediaItem): Promise<RadarrMovie|undefined> {
  try {
    const movies = await getMoviesFromRadarr();
    const foundMovie = movies.find((m: RadarrMovie) => m.tmdbId == item.tmdbId)
    if (!foundMovie)
      console.error(`[Radarr] Error finding serie (tmdbId: ${item.tmdbId}): missing from radarr instance`);
    return foundMovie
  } catch (err: any) {
    console.error(`[Radarr] Error finding movie (tmdbId: ${item.tmdbId}): ${err.message}`);
    return undefined
  }
}

export async function deleteMovieFromRadarr(movie: RadarrMovie): Promise<boolean> {
  try {
    // Delete movie and its files
    const url = getSetting('radarrUrl');
    const apiKey = getSetting('radarrApiKey');
    const client = axios.create({
      baseURL: url,
      headers: { 'X-Api-Key': apiKey }
    });
    await client.delete(`/api/v3/movie/${movie.id}?deleteFiles=true`);
    console.log(`[Radarr] Movie ${movie.title} (ID: ${movie.id}) deleted.`);
    return true;
  } catch (err: any) {
    console.error(`[Radarr] Error deleting movie: ${err.message}`);
    return false;
  }
}

export async function getDownloadIdsFromRadarr(movie: RadarrMovie): Promise<string[]> {
  const url = getSetting('radarrUrl');
  const apiKey = getSetting('radarrApiKey');

  if (!url || !apiKey) {
    console.log('[Radarr] Not configured.');
    return [];
  }

  try {
    const client = axios.create({
      baseURL: url,
      headers: { 'X-Api-Key': apiKey }
    });
    const res = await client.get(`/api/v3/history/movie?movieId=${movie.id}`);
    const history = res.data;
    return [...new Set(history.map((h: any) => h.downloadId).filter((id: string) => id))] as string[];
  } catch (err: any) {
    console.error(`[Radarr] Error getting download ID: ${err.message}`);
    return [];
  }
}

export async function getRootFolders(url: string = getSetting('radarrUrl'), apiKey: string = getSetting('radarrApiKey')): Promise<RootFolder[]> {
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
      console.error(`[Radarr] Error getting root folders: ${err.message}`);
    }
    return [];
  }
}

// Get all possible mapping paths (e.g. /media/raid/movies -> ["/media/raid/movies", "/media/raid", "/media"])
export async function getMappingPaths(url: string = getSetting('radarrUrl'), apiKey: string = getSetting('radarrApiKey')): Promise<string[]> {
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