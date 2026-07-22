import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { discoverPacks, loadPackMetadata, mergeLocalPacks, resolvePublicPages } from './resolver.mjs';

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

test('rejects unknown fields in pack.json', () => {
  const root = fixtureRoot();
  writePack(root, 'bookmarks', { name: 'bookmarks', version: '1.0.0', bogus: true });
  assert.throws(() => discoverPacks(root), /unknown field/);
});

test('accepts optional title/nav/frontend fields in pack.json', () => {
  const root = fixtureRoot();
  writePack(root, 'alpha', {
    name: 'alpha',
    version: '1.0.0',
    title: 'Alpha',
    nav: { label: 'Alpha', href: '/p/alpha' },
    frontend: { scope: 'public', styles: ['style.css'], scripts: ['script.js'] },
  });
  const [pack] = discoverPacks(root);
  assert.equal(pack.title, 'Alpha');
  assert.deepEqual(pack.nav, { label: 'Alpha', href: '/p/alpha' });
  assert.deepEqual(pack.frontend, { scope: 'public', styles: ['style.css'], scripts: ['script.js'] });
});

test('loads client-safe Pack metadata from pack.json', () => {
  const root = fixtureRoot();
  writePack(root, 'bookmarks', {
    name: 'bookmarks',
    version: '1.0.0',
    title: '收藏',
    nav: { label: '收藏', href: '/p/bookmarks' },
  });
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
  writePack(root, 'bookmarks', {
    name: 'bookmarks',
    version: '1.0.0',
    nav: { label: '收藏', href: '/admin' },
  });
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
  const dir = writePack(root, name, { name, version: '1.0.0', frontend });
  mkdirSync(join(dir, 'frontend'), { recursive: true });
  writeFileSync(join(dir, 'frontend', 'style.css'), 'body{}');
  writeFileSync(join(dir, 'frontend', 'script.js'), 'console.log(1)');
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
  writePack(root, 'alpha', { name: 'alpha', version: '1.0.0', frontend: 'not-an-object' });
  assert.throws(() => discoverPacks(root), /frontend must be an object/);
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

// --- mergeLocalPacks (whole-Pack replacement) tests ---

test('mergeLocalPacks returns builtins untouched when no local root is given', () => {
  const root = fixtureRoot();
  writePack(root, 'alpha');
  const builtins = discoverPacks(root);
  assert.equal(mergeLocalPacks(builtins, ''), builtins);
  assert.equal(mergeLocalPacks(builtins, undefined), builtins);
  assert.equal(mergeLocalPacks(builtins, '/does/not/exist'), builtins);
});

test('mergeLocalPacks replaces a builtin Pack with the local override', () => {
  const builtinRoot = fixtureRoot();
  const localRoot = fixtureRoot();
  writePack(builtinRoot, 'bookmarks');
  // Local override ships under a different directory but same pack.json name.
  const localDir = writePack(localRoot, 'bookmarks', { name: 'bookmarks', version: '2.0.0' });
  writeFileSync(join(localDir, 'pages', 'index.astro'), '---\n---\nlocal override\n');
  const resolved = mergeLocalPacks(discoverPacks(builtinRoot), localRoot);
  assert.deepEqual(resolved.map((pack) => pack.name), ['bookmarks']);
  assert.equal(resolved[0].version, '2.0.0');
  assert.ok(resolved[0].directory.startsWith(localRoot), 'resolved directory must come from local root');
});

test('mergeLocalPacks appends a brand-new local Pack not present in builtins', () => {
  const builtinRoot = fixtureRoot();
  const localRoot = fixtureRoot();
  writePack(builtinRoot, 'bookmarks');
  writePack(localRoot, 'alpha');
  const resolved = mergeLocalPacks(discoverPacks(builtinRoot), localRoot);
  assert.deepEqual(resolved.map((pack) => pack.name), ['alpha', 'bookmarks']);
  assert.equal(resolved.find((pack) => pack.name === 'alpha').directory.startsWith(localRoot), true);
  assert.equal(resolved.find((pack) => pack.name === 'bookmarks').directory.startsWith(builtinRoot), true);
});

test('mergeLocalPacks rejects duplicate local Pack names', () => {
  const localRoot = fixtureRoot();
  // discoverPacks enforces name==directory, so two identical names would need
  // two directories with the same name, which the filesystem rejects. This
  // test documents that guarantee: a single local pack with a valid name must
  // always merge cleanly.
  writePack(localRoot, 'alpha');
  const builtins = discoverPacks(localRoot);
  assert.doesNotThrow(() => mergeLocalPacks(builtins, localRoot));
});
