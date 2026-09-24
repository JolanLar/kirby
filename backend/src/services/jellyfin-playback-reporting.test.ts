import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePlaybackActivityResponse } from './jellyfin-playback-reporting';

test('parses Playback Reporting custom query rows and normalizes item IDs', () => {
  const result = parsePlaybackActivityResponse({
    colums: ['ItemId', 'LastPlayedDate'],
    results: [
      ['ABC-123', '2026-09-14T20:18:30.772Z'],
      ['abc123', '2026-09-15T06:00:00.000Z'],
    ],
  });

  assert.equal(result.size, 1);
  assert.equal(result.get('abc123'), Date.parse('2026-09-15T06:00:00Z'));
});

test('ignores malformed Playback Reporting responses', () => {
  assert.equal(parsePlaybackActivityResponse({}).size, 0);
  assert.equal(parsePlaybackActivityResponse({ colums: ['ItemId'], results: [['abc']] }).size, 0);
  assert.equal(parsePlaybackActivityResponse({
    columns: ['ItemId', 'LastPlayedDate'],
    results: [['abc', 'not-a-date']],
  }).size, 0);
  assert.equal(parsePlaybackActivityResponse({
    colums: ['ItemId', 'LastPlayedDate'],
    results: [['abc', '2026-09-15 08:00:00']],
  }).size, 0);
});

