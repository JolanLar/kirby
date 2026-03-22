import axios from 'axios';
import { getSetting } from '../db';

let qbCookie: string | null = null;

async function authQBittorrent(url: string, user: string, pass: string): Promise<boolean> {
  try {
    const res = await axios.post(`${url}/api/v2/auth/login`, `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    const setCookie = res.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      qbCookie = setCookie[0].split(';')[0];
      return true;
    }
    return false;
  } catch (err: any) {
    console.error(`[QBittorrent] Auth failed: ${err.message}`);
    return false;
  }
}

export async function deleteFromQBittorrent(hash: string): Promise<boolean> {
  const url = getSetting('qbUrl');
  const user = getSetting('qbUser');
  const pass = getSetting('qbPass');

  if (!url) {
    console.log('[QBittorrent] Not configured.');
    return false;
  }

  // Attempt to auth if not logged in
  if (!qbCookie) {
    const ok = await authQBittorrent(url, user, pass);
    if (!ok) return false;
  }

  try {    
    console.log(`[QBittorrent] Deleting torrent ${hash}...`);
    // Delete torrent and files (deleteFiles=true)
    await axios.post(`${url}/api/v2/torrents/delete`, `hashes=${hash}&deleteFiles=true`, {
      headers: {
        'Cookie': qbCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return true;
  } catch (err: any) {
    console.error(`[QBittorrent] Error deleting torrent: ${err.message}`);
    return false;
  }
}
