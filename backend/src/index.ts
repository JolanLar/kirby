import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import axios from 'axios';
import { getSettings, setSetting, getSetting, getExclusions, addExclusion, removeExclusion, getStorages, getFavorites, setIgnoreFavorite, seedDeletionHistory } from './db';
import { getDiskStatus } from './services/disk.service';
import { testConnection } from './services/test.service';
import { getMappingPaths as getRadarrMappingPaths } from './services/radarr.service';
import { getMappingPaths as getSonarrMappingPaths } from './services/sonarr.service';
import { getMappingPaths as getJellyfinMappingPaths, getJellyfinUsers } from './services/jellyfin.service';
import { getPlexPin, getPlexToken, getPlexResources, getMappingPaths as getPlexMappingPaths, getPlexUsers } from './services/plex.service';
import { getDiscovery, testDiscovery, invalidateDiscoveryCache, generateCodeVerifier, generateCodeChallenge, createState, consumeState, isOAuthEnabled, extractUsername } from './services/oauth.service';
import { startDeletionJob, deletionQueue, removeFromQueue, refreshQueue, deleteItem, isQueueRefreshing } from './jobs/deletion.job';
import { requireAuth, signToken, verifyToken, hashPassword, checkPassword } from './auth';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// --- Auth routes (public — no requireAuth) ---

app.get('/api/auth/check', (req, res) => {
  const token = req.cookies?.auth_token;
  const isFirstRun = !getSetting('authPasswordHash', '');
  const oauthEnabled = isOAuthEnabled();
  if (!token) return res.json({ authenticated: false, isFirstRun, oauthEnabled });
  try {
    const user = verifyToken(token);
    res.json({ authenticated: true, username: user.username, isFirstRun: false, oauthEnabled });
  } catch {
    res.json({ authenticated: false, isFirstRun, oauthEnabled });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const storedHash = getSetting('authPasswordHash', '');

  if (!storedHash) {
    // First run: accept any credentials and set them as the admin account
    setSetting('authUsername', username);
    setSetting('authPasswordHash', hashPassword(password));
  } else {
    const storedUsername = getSetting('authUsername', '');
    if (username !== storedUsername || !checkPassword(password, storedHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  }

  const jwt = signToken(username);
  res.cookie('auth_token', jwt, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, username });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

function deriveRedirectUri(req: express.Request): string {
  const override = getSetting('oauthRedirectUri', '');
  if (override) return override;
  // Trust X-Forwarded-Proto/Host headers set by reverse proxies
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost';
  return `${proto}://${host}/api/auth/oauth/callback`;
}

app.get('/api/auth/oauth/test', async (req, res) => {
  const issuerUrl = (req.query.issuerUrl as string) || getSetting('oauthIssuerUrl', '');
  const clientId = (req.query.clientId as string) || getSetting('oauthClientId', '');
  if (!issuerUrl || !clientId) {
    return res.json({ ok: false, error: 'Missing Issuer URL or Client ID' });
  }
  try {
    const discovery = await testDiscovery(issuerUrl);
    const redirectUri = deriveRedirectUri(req);
    res.json({ ok: true, issuer: discovery.issuer, redirectUri });
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/auth/oauth/start', async (req, res) => {
  try {
    const discovery = await getDiscovery();
    const clientId = getSetting('oauthClientId', '');
    const scopes = getSetting('oauthScopes', 'openid profile email');
    const redirectUri = deriveRedirectUri(req);

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = createState(codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(`${discovery.authorization_endpoint}?${params}`);
  } catch (err: any) {
    console.error('[OAuth] Failed to start OAuth flow:', err.message);
    res.redirect('/login?error=' + encodeURIComponent(err.message || 'OAuth start failed'));
  }
});

app.get('/api/auth/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect('/login?error=' + encodeURIComponent(error as string));
  if (!code || !state) return res.redirect('/login?error=Invalid+callback+parameters');

  const codeVerifier = consumeState(state as string);
  if (!codeVerifier) return res.redirect('/login?error=Invalid+or+expired+state');

  try {
    const discovery = await getDiscovery();
    const clientId = getSetting('oauthClientId', '');
    const clientSecret = getSetting('oauthClientSecret', '');
    const redirectUri = deriveRedirectUri(req);

    const tokenRes = await axios.post(
      discovery.token_endpoint,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { id_token, access_token } = tokenRes.data;

    let claims: Record<string, any> = {};
    if (id_token) {
      claims = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString());
    } else if (access_token) {
      const userRes = await axios.get(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      claims = userRes.data;
    }

    const username = extractUsername(claims);
    const jwt = signToken(username);
    res.cookie('auth_token', jwt, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (err: any) {
    console.error('[OAuth] Callback error:', err.message);
    res.redirect('/login?error=' + encodeURIComponent(err.response?.data?.error_description || err.message || 'Authentication failed'));
  }
});

// Plex OAuth PIN endpoints (also public — needed before auth is set up)
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

// --- Protect all remaining /api routes ---
app.use('/api', requireAuth);

// --- Status API ---
app.get('/api/status', async (_req, res) => {
  const storages = getStorages();
  const diskStatuses = await Promise.all(storages.map(s => getDiskStatus(s)));
  res.json({ storages: diskStatuses, syncing: isQueueRefreshing() });
});

// --- Settings API ---
app.get('/api/settings', (_req, res) => {
  const settings = getSettings();
  // Strip sensitive auth internals from the response
  const { jwtSecret, authPasswordHash, ...safe } = settings;
  res.json(safe);
});

app.post('/api/settings', (req, res) => {
  const settings = req.body;
  let oauthChanged = false;
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === 'string') {
      setSetting(key, value);
      if (key.startsWith('oauth')) oauthChanged = true;
    }
  }
  if (oauthChanged) invalidateDiscoveryCache();
  res.json({ success: true });
});

// Change admin credentials
app.post('/api/auth/credentials', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  setSetting('authUsername', username);
  setSetting('authPasswordHash', hashPassword(password));
  // Re-issue cookie with new username in case it changed
  const jwt = signToken(username);
  res.cookie('auth_token', jwt, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
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
app.get('/api/exclusions', (_req, res) => {
  res.json(getExclusions());
});

// --- Favorites API ---
app.get('/api/favorites', (_req, res) => {
  res.json(getFavorites());
});

app.get('/api/favorites/users', async (_req, res) => {
  try {
    const [plexUsers, jellyfinUsers] = await Promise.all([getPlexUsers(), getJellyfinUsers()]);
    const all = [...new Set([...plexUsers, ...jellyfinUsers])];
    res.json(all);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/favorites/:type/:tmdbId/ignore', async (req, res) => {
  const { tmdbId, type } = req.params;
  const { ignore } = req.body;
  setIgnoreFavorite(tmdbId, type, !!ignore);
  refreshQueue().catch(console.error);
  res.json({ success: true });
});

// --- Dev / Testing ---
app.post('/api/dev/seed-history', (req, res) => {
  const allItems = Object.values(deletionQueue).flat().slice(0, 8);
  if (allItems.length === 0) return res.json({ seeded: 0, message: 'No items in queue yet' });
  const counts = [1, 2, 3, 4, 1, 2, 3, 4];
  allItems.forEach((item, i) => {
    seedDeletionHistory(item.tmdbId, item.title, item.type, counts[i] || 1, item.lastSeenAt);
  });
  refreshQueue().catch(console.error);
  res.json({ seeded: allItems.length, items: allItems.map(i => ({ title: i.title, count: counts[allItems.indexOf(i)] || 1 })) });
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
  removeFromQueue(tmdbId, type);
  res.json({ success: true });
});

app.delete('/api/exclusions/:type/:tmdbId', (req, res) => {
  const { tmdbId, type } = req.params;
  removeExclusion(tmdbId, type);
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

// --- Manual Deletion API ---
app.post('/api/delete', async (req, res) => {
  const { plexId, jellyfinId, tmdbId, title, type, lastSeenAt, posterUrl, sizeOnDisk } = req.body;
  if (!tmdbId || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const deleted = await deleteItem({ plexId, jellyfinId, tmdbId, title, type, lastSeenAt, posterUrl, sizeOnDisk });
  if (deleted) {
    removeFromQueue(tmdbId, type);
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  startDeletionJob();
});

// Catch-all route to serve the React app
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
