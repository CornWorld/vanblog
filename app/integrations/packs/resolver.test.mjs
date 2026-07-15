import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { discoverPacks, loadPackMetadata, resolvePublicPages } from './resolver.mjs';

const bookmark = { pack: 'bookmarks', page: 'index', entrypoint: '/tmp/bookmarks/index.astro' };

function fixtureRoot() {
  return mkdtempSync(join(tmpdir(), 'vanblog-packs-'));
}

function writePack(root, name, identity = { name, version: '1.0.0' }) {
  const dir = join(root, name);
  mkdirSync(join(dir, 'pages'), { recursive: true });
  writeFileSync(join(dir, 'pack.json'), JSON.stringify(identity));
  writeFileSync(join(dir, 'pages', 'index.astro'), '---\n---\n');
  return dir;
}

test('discovers Pack pages from the packs directory', () => {
  const root = fixtureRoot();
  writePack(root, 'zulu');
  writePack(root, 'bookmarks');
  const packs = discoverPacks(root);
  assert.deepEqual(packs.map((pack) => pack.name), ['bookmarks', 'zulu']);
  assert.deepEqual(resolvePublicPages(packs.flatMap((pack) => pack.pages)).map((page) => page.pattern), ['/p/bookmarks', '/p/zulu']);
});

test('rejects Pack identity that does not match the directory', () => {
  const root = fixtureRoot();
  writePack(root, 'bookmarks', { name: 'other', version: '1.0.0' });
  assert.throws(() => discoverPacks(root), /declares name/);
});

test('rejects fat pack.json metadata', () => {
  const root = fixtureRoot();
  writePack(root, 'bookmarks', { name: 'bookmarks', version: '1.0.0', title: 'no' });
  assert.throws(() => discoverPacks(root), /only name and version/);
});

test('loads client-safe Pack metadata', () => {
  const root = fixtureRoot();
  const dir = writePack(root, 'bookmarks');
  writeFileSync(join(dir, 'pack.ts'), "export default { title: '收藏', nav: { label: '收藏', href: '/p/bookmarks' } };\n");
  const metadata = loadPackMetadata(discoverPacks(root));
  assert.deepEqual(metadata, [{
    name: 'bookmarks',
    version: '1.0.0',
    title: '收藏',
    nav: { label: '收藏', href: '/p/bookmarks' },
    routes: [{ pattern: '/p/bookmarks', page: 'index' }],
  }]);
});

test('normalizes Pack nav href to its public namespace', () => {
  const root = fixtureRoot();
  const dir = writePack(root, 'bookmarks');
  writeFileSync(join(dir, 'pack.ts'), "export default { title: '收藏', nav: { label: '收藏', href: '/admin' } };\n");
  const metadata = loadPackMetadata(discoverPacks(root));
  assert.equal(metadata[0].nav.href, '/p/bookmarks');
});

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
});

test('only accepts the controlled index page', () => {
  assert.throws(() => resolvePublicPages([{ ...bookmark, page: 'admin' }]), /Unsupported public page/);
});

test('requires a usable entrypoint', () => {
  assert.throws(() => resolvePublicPages([{ ...bookmark, entrypoint: '' }]), /Missing entrypoint/);
});
