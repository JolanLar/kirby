import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJellyfinAuthorization } from './jellyfin-auth';

test('uses Jellyfin 12 Authorization header format', () => {
  assert.equal(
    buildJellyfinAuthorization('abc123'),
    'MediaBrowser Client="Kirby", Device="Server", DeviceId="kirby-server", Version="1.0.0", Token="abc123"',
  );
});

test('rejects empty and newline-containing API keys', () => {
  assert.throws(() => buildJellyfinAuthorization('  '), /required/);
  assert.throws(() => buildJellyfinAuthorization('abc\r\ndef'), /Invalid/);
  assert.throws(() => buildJellyfinAuthorization('abc123\n'), /Invalid/);
});
