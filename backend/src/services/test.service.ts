import axios from 'axios';

export async function testConnection(service: string, config: any): Promise<{ success: boolean; error?: string }> {
  try {
    if (service === 'plex') {
      const res = await axios.get(`${config.url}/library/sections`, {
        headers: {
          'X-Plex-Token': config.token,
          'X-Plex-Client-Identifier': 'Kirby-Media-Manager-Auth',
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      if (res.status === 200) return { success: true };
    }
    
    if (service === 'jellyfin') {
      const res = await axios.get(`${config.url}/System/Info`, {
        headers: {
          'Authorization': `MediaBrowser Token="${config.apiKey}"`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      if (res.status === 200) return { success: true };
    }
    
    if (service === 'sonarr' || service === 'radarr') {
      const res = await axios.get(`${config.url}/api/v3/system/status`, {
        headers: { 'X-Api-Key': config.apiKey },
        timeout: 5000
      });
      if (res.status === 200) return { success: true };
    }
    
    if (service === 'qbittorrent') {
      const res = await axios.post(`${config.url}/api/v2/auth/login`, `username=${encodeURIComponent(config.user)}&password=${encodeURIComponent(config.pass)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
        timeout: 5000,
        validateStatus: (status) => status >= 200 && status < 400
      });
      const setCookie = res.headers['set-cookie'];
      if (setCookie && setCookie.length > 0) return { success: true };
      return { success: false, error: 'Authentication failed' };
    }

    return { success: false, error: 'Unknown service' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
