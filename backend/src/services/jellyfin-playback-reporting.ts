import { logger } from '../logger';

type CustomQueryResponse = {
  colums?: string[];
  columns?: string[];
  results?: unknown[][];
};

function normalizeItemId(value: unknown): string {
  return String(value || '').replace(/-/g, '').toLowerCase();
}

function parsePlaybackDate(value: unknown): number {
  if (typeof value !== 'string' || !value.trim()) return 0;
  const trimmed = value.trim();
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) return 0;
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function parsePlaybackActivityResponse(data: CustomQueryResponse): Map<string, number> {
  const columns = data.colums || data.columns || [];
  const itemIdIndex = columns.indexOf('ItemId');
  const lastPlayedIndex = columns.indexOf('LastPlayedDate');
  const dates = new Map<string, number>();

  if (itemIdIndex < 0 || lastPlayedIndex < 0 || !Array.isArray(data.results)) return dates;

  for (const row of data.results) {
    if (!Array.isArray(row)) continue;
    const itemId = normalizeItemId(row[itemIdIndex]);
    const lastPlayedAt = parsePlaybackDate(row[lastPlayedIndex]);
    if (!itemId || !lastPlayedAt) continue;
    dates.set(itemId, Math.max(dates.get(itemId) || 0, lastPlayedAt));
  }

  return dates;
}

export async function getPlaybackActivityDates(client: any): Promise<Map<string, number>> {
  try {
    const response = await client.post('/user_usage_stats/submit_custom_query', {
      CustomQueryString: `
        SELECT
          ItemId,
          strftime('%Y-%m-%dT%H:%M:%fZ', MAX(DateCreated), 'utc') AS LastPlayedDate
        FROM PlaybackActivity
        GROUP BY ItemId
      `,
      ReplaceUserId: false,
    });
    return parsePlaybackActivityResponse(response.data || {});
  } catch (err: any) {
    const status = err?.response?.status;
    logger.debug(`[Jellyfin] Playback Reporting unavailable${status ? ` (HTTP ${status})` : ''}; using UserData.LastPlayedDate only.`);
    return new Map();
  }
}

