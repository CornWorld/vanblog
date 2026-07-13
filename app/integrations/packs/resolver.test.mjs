import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePublicPages } from './resolver.mjs';

const bookmark = { pack: 'bookmarks', page: 'index', entrypoint: '/tmp/bookmarks/index.astro' };

test('resolves the controlled bookmarks index route', () => {
  assert.deepEqual(resolvePublicPages([bookmark]), [{ ...bookmark, pattern: '/p/bookmarks' }]);
});

test('rejects duplicate Pack routes', () => {
  assert.throws(() => resolvePublicPages([bookmark, bookmark]), /Duplicate/);
});

test('rejects invalid Pack names', () => {
  assert.throws(() => resolvePublicPages([{ ...bookmark, pack: 'Bookmarks' }]), /Invalid Pack name/);
  assert.throws(() => resolvePublicPages([{ ...bookmark, pack: 'bookmarks-' }]), /Invalid Pack name/);
  assert.throws(() => resolvePublicPages([{ ...bookmark, pack: 'bookmarks--extra' }]), /Invalid Pack name/);
  assert.throws(() => resolvePublicPages([{ ...bookmark, pack: 'Bookmarks' }]), /Invalid Pack name/);
});

test('only accepts the controlled index page', () => {
  assert.throws(() => resolvePublicPages([{ ...bookmark, page: 'admin' }]), /Unsupported public page/);
});

test('requires a usable entrypoint', () => {
  assert.throws(() => resolvePublicPages([{ ...bookmark, entrypoint: '' }]), /Missing entrypoint/);
});
