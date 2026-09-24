import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaItem } from '../models';
import { mergePlaybackActivityItems } from './jellyfin.service';

test('merges the latest Playback Reporting dates into movies and episode series', () => {
  const items = new Map<string, MediaItem>([
    ['show-1063', { tmdbId: '1063', type: 'show', title: 'Samurai Champloo', lastSeenAt: 100 } as MediaItem],
    ['movie-123', { tmdbId: '123', type: 'movie', title: 'Movie', lastSeenAt: 300 } as MediaItem],
  ]);
  const series = new Map([['series-id', '1063']]);
  const dates = new Map([
    ['episodeid', 500],
    ['movieid', 200],
  ]);

  mergePlaybackActivityItems(items, series, dates, [
    { Id: 'EPISODE-ID', Type: 'Episode', SeriesId: 'series-id' },
    { Id: 'MOVIE-ID', Type: 'Movie', ProviderIds: { Tmdb: '123' } },
    { Id: 'deleted-id', Type: 'Episode', SeriesId: 'missing-series' },
  ]);

  assert.equal(items.get('show-1063')?.lastSeenAt, 500);
  assert.equal(items.get('movie-123')?.lastSeenAt, 300);
});

