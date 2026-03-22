import { StorageConfig } from '../models';
import { getRootFolders as getSonarrFolders } from './sonarr.service';
import { getRootFolders as getRadarrFolders } from './radarr.service';

export async function getDiskStatus(storage: StorageConfig) {
  try {
    let freeBytes = 0;
    let found = false;

    // Try Sonarr first if a path is provided
    if (storage.sonarrPath) {
      const folders = await getSonarrFolders();
      // Match folder by path
      const folder = folders.find(f => f.path.startsWith(storage.sonarrPath!) || storage.sonarrPath!.startsWith(f.path));
      if (folder) {
        freeBytes = folder.freeSpace / 1024 / 1024 / 1024 || 0;
        found = true;
      }
    }

    // Try Radarr if not found or no sonarrPath
    if (!found && storage.radarrPath) {
      const folders = await getRadarrFolders();
      const folder = folders.find(f => f.path.startsWith(storage.radarrPath!) || storage.radarrPath!.startsWith(f.path));
      if (folder) {
        freeBytes = folder.freeSpace / 1024 / 1024 / 1024 || 0;
        found = true;
      }
    }

    if (!found) {
      throw new Error(`Could not find root folder in Sonarr/Radarr for paths: Sonarr(${storage.sonarrPath}), Radarr(${storage.radarrPath})`);
    }
    
    return {
      storageId: storage.id,
      name: storage.name,
      freeBytes,
    };
  } catch (err: any) {
    console.error(`Failed to get disk status for storage ${storage.name}:`, err.message);
    return {
      storageId: storage.id,
      name: storage.name,
      freeBytes: 0,
      error: err.message
    };
  }
}