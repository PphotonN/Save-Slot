import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedLibraryOrigin, libraryCorsHeaders } from '../scripts/library-cache-policy.mjs';

test('local browser origins are allowed', () => {
  for (const origin of [
    'http://localhost:5173',
    'https://localhost:5173',
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
  ]) {
    assert.equal(isAllowedLibraryOrigin(origin), true, origin);
    assert.equal(libraryCorsHeaders(origin)['Access-Control-Allow-Origin'], origin);
  }
});

test('public, LAN and malformed origins are rejected', () => {
  for (const origin of [
    'https://save-slot.example',
    'http://192.168.1.20:5173',
    'https://localhost.example',
    'file://localhost',
    'null',
    '',
  ]) {
    assert.equal(isAllowedLibraryOrigin(origin), false, origin);
    assert.equal(libraryCorsHeaders(origin)['Access-Control-Allow-Origin'], undefined);
  }
});

test('requests without an Origin header remain usable by local diagnostics', () => {
  assert.equal(isAllowedLibraryOrigin(undefined), false);
  assert.deepEqual(libraryCorsHeaders(undefined), { Vary: 'Origin' });
});
