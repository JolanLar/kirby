export interface MediaItem {
  plexId?: string;
  jellyfinId?: string;
  tmdbId: string;
  title: string;
  type: 'movie' | 'show';
  lastSeenAt: number;  // timestamp
  posterUrl: string;   // resolved URL to poster image
  sizeOnDisk: number;
  plexPath?: string;
  jellyfinPath?: string;
  source?: 'plex' | 'jellyfin';
}

export interface SonarrSeries {
  id: number;
  tmdbId: string;
  title: string;
  statistics: {
    sizeOnDisk: number;
  }
  path?: string;
}

export interface RootFolder {
  path: string;
  freeSpace: number;
}

export interface RadarrMovie {
  id: number;
  tmdbId: string;
  title: string;
  statistics: {
    sizeOnDisk: number;
  }
  path?: string;
}

export interface StorageConfig {
  id: string;
  name: string;
  plexPath: string;     // Path as seen by Plex
  jellyfinPath?: string; // Path as seen by Jellyfin
  sonarrPath?: string;  // Path as seen by Sonarr
  radarrPath?: string;  // Path as seen by Radarr
  targetFreeSpace: number; // GB
}