import express from 'express';
import cors from 'cors';
import path from 'path';
import { getSettings, setSetting, getExclusions, addExclusion, removeExclusion, getStorages } from './db';
import { getDiskStatus } from './services/disk.service';
import { testConnection } from './services/test.service';
import { getMappingPaths as getRadarrMappingPaths } from './services/radarr.service';
import { getMappingPaths as getSonarrMappingPaths } from './services/sonarr.service';
import { getMappingPaths as getJellyfinMappingPaths } from './services/jellyfin.service';
import { getPlexPin, getPlexToken, getPlexResources, getMappingPaths as getPlexMappingPaths } from './services/plex.service';
import { startDeletionJob, deletionQueue, removeFromQueue, refreshQueue, deleteItem } from './jobs/deletion.job';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// --- Status API ---
app.get('/api/status', async (req, res) => {
  const storages = getStorages();
  const diskStatuses = await Promise.all(storages.map(s => getDiskStatus(s)));
  res.json({ storages: diskStatuses });
});

// --- Settings API ---
app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', (req, res) => {
  const settings = req.body;
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === 'string') {
      setSetting(key, value);
    }
  }
  res.json({ success: true });
});

app.get('/api/paths/plex', async (req, res) => {
  res.json(await getPlexMappingPaths(req.query.url as string, req.query.token as string));
});

app.get('/api/paths/jellyfin', async (req, res) => {
  res.json(await getJellyfinMappingPaths(req.query.url as string, req.query.apiKey as string));
});

app.get('/api/paths/radarr', async (req, res) => {
  res.json(await getRadarrMappingPaths(req.query.url as string, req.query.apiKey as string));
});

app.get('/api/paths/sonarr', async (req, res) => {
  res.json(await getSonarrMappingPaths(req.query.url as string, req.query.apiKey as string));
});

app.get('/api/plex/auth/pin', async (req, res) => {
  try {
    const pin = await getPlexPin();
    res.json(pin);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/plex/auth/token/:pinId', async (req, res) => {
  try {
    const token = await getPlexToken(parseInt(req.params.pinId));
    res.json({ token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/plex/auth/resources', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const resources = await getPlexResources(token);
    res.json(resources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Exclusions API ---
app.get('/api/exclusions', (req, res) => {
  res.json(getExclusions());
});

// --- Testing API ---
app.post('/api/test-connection', async (req, res) => {
  const { service, config } = req.body;
  const result = await testConnection(service, config);
  res.json(result);
});

app.post('/api/exclusions', (req, res) => {
  const { tmdbId, title, type, posterUrl, lastSeenAt } = req.body;
  if (!tmdbId || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  addExclusion(tmdbId, title, type, posterUrl || null, lastSeenAt || 0, 0);
  removeFromQueue(tmdbId); 
  res.json({ success: true });
});

app.delete('/api/exclusions/:tmdbId', (req, res) => {
  const { tmdbId } = req.params;
  removeExclusion(tmdbId);
  res.json({ success: true });
});

// --- Deletion Queue API ---
app.get('/api/deletion-queue', (req, res) => {
  res.json(deletionQueue);
});

app.post('/api/refresh', async (req, res) => {
  try {
    await refreshQueue();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  startDeletionJob();
});

// --- Manual Deletion API ---
app.post('/api/delete', async (req, res) => {
  const { plexId, jellyfinId, tmdbId, title, type, lastSeenAt, posterUrl, sizeOnDisk } = req.body;
  if (!tmdbId || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const deleted = await deleteItem({ plexId, jellyfinId, tmdbId, title, type, lastSeenAt, posterUrl, sizeOnDisk });
  if (deleted) {
    removeFromQueue(tmdbId);
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Catch-all route to serve the React app for any other requests
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});