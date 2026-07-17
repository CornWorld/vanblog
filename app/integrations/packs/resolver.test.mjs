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

// --- Frontend Contribution tests ---

function writeFrontendPack(root, name, frontend) {
  const dir = writePack(root, name);
  mkdirSync(join(dir, 'frontend'), { recursive: true });
  writeFileSync(join(dir, 'frontend', 'style.css'), 'body{}');
  writeFileSync(join(dir, 'frontend', 'script.js'), 'console.log(1)');
  const metadata = { frontend };
  writeFileSync(join(dir, 'pack.ts'), `export default ${JSON.stringify(metadata, null, 2)};\n`);
  return dir;
}

test('loads valid frontend contribution', () => {
  const root = fixtureRoot();
  writeFrontendPack(root, 'alpha', {
    scope: 'public',
    styles: ['style.css'],
    scripts: ['script.js'],
  });
  const [metadata] = loadPackMetadata(discoverPacks(root));
  assert.deepEqual(metadata.frontend, {
    scope: 'public',
    styles: ['style.css'],
    scripts: ['script.js'],
  });
});

test('omits frontend when not declared', () => {
  const root = fixtureRoot();
  writePack(root, 'alpha');
  const [metadata] = loadPackMetadata(discoverPacks(root));
  assert.equal('frontend' in metadata, false);
});

test('rejects frontend with non-public scope', () => {
  const root = fixtureRoot();
  writeFrontendPack(root, 'alpha', {
    scope: 'admin',
    styles: ['style.css'],
    scripts: ['script.js'],
  });
  assert.throws(() => loadPackMetadata(discoverPacks(root)), /scope must be public/);
});

test('rejects frontend contribution that is not an object', () => {
  const root = fixtureRoot();
  writeFrontendPack(root, 'alpha', 'not-an-object');
  assert.throws(() => loadPackMetadata(discoverPacks(root)), /frontend contribution must be an object/);
});

test('rejects frontend with path traversal', () => {
  const root = fixtureRoot();
  writeFrontendPack(root, 'alpha', {
    scope: 'public',
    styles: ['../pack.json'],
    scripts: [],
  });
  assert.throws(() => loadPackMetadata(discoverPacks(root)), /existing file under frontend/);
});

test('rejects frontend with absolute path', () => {
  const root = fixtureRoot();
  writeFrontendPack(root, 'alpha', {
    scope: 'public',
    styles: ['/etc/passwd'],
    scripts: [],
  });
  assert.throws(() => loadPackMetadata(discoverPacks(root)), /invalid path/);
});

test('rejects frontend with non-existent file', () => {
  const root = fixtureRoot();
  writeFrontendPack(root, 'alpha', {
    scope: 'public',
    styles: ['missing.css'],
    scripts: [],
  });
  assert.throws(() => loadPackMetadata(discoverPacks(root)), /existing file under frontend/);
});

test('rejects frontend with duplicate paths', () => {
  const root = fixtureRoot();
  writeFrontendPack(root, 'alpha', {
    scope: 'public',
    styles: ['style.css', 'style.css'],
    scripts: [],
  });
  assert.throws(() => loadPackMetadata(discoverPacks(root)), /duplicate path/);
});

test('rejects frontend with empty styles and scripts', () => {
  const root = fixtureRoot();
  writeFrontendPack(root, 'alpha', {
    scope: 'public',
    styles: [],
    scripts: [],
  });
  assert.throws(() => loadPackMetadata(discoverPacks(root)), /frontend contribution is empty/);
});

test('rejects frontend styles that is not an array', () => {
  const root = fixtureRoot();
  writeFrontendPack(root, 'alpha', {
    scope: 'public',
    styles: 'style.css',
    scripts: [],
  });
  assert.throws(() => loadPackMetadata(discoverPacks(root)), /frontend styles must be an array/);
});
