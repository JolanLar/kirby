const JELLYFIN_CLIENT = 'Kirby';
const JELLYFIN_DEVICE = 'Server';
const JELLYFIN_DEVICE_ID = 'kirby-server';
const JELLYFIN_CLIENT_VERSION = '1.0.0';

function quoteAuthorizationValue(value: string): string {
  if (/\r|\n/.test(value)) {
    throw new Error('Invalid Jellyfin API key');
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Jellyfin 12-compatible authorization header (legacy auth is disabled). */
export function buildJellyfinAuthorization(apiKey: string): string {
  if (/\r|\n/.test(apiKey)) throw new Error('Invalid Jellyfin API key');

  const token = quoteAuthorizationValue(apiKey.trim());
  if (!token) throw new Error('Jellyfin API key is required');

  return [
    `MediaBrowser Client="${JELLYFIN_CLIENT}"`,
    `Device="${JELLYFIN_DEVICE}"`,
    `DeviceId="${JELLYFIN_DEVICE_ID}"`,
    `Version="${JELLYFIN_CLIENT_VERSION}"`,
    `Token="${token}"`,
  ].join(', ');
}
