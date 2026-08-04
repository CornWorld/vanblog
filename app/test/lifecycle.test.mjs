// ============================================================
// Pack + Theme lifecycle — end-to-end (hermetic, no Docker/PB/ports).
//
// Exercises the two "lifecycle management" surfaces of the platform
// in one deterministic suite:
//
//   A) Pack lifecycle — discovery → local override → metadata →
//      public route resolution (`/p/<name>`). Reuses the resolver.mjs
//      pipeline the Astro integration runs at build time.
//
//   B) Theme lifecycle — enumerate → load → serve → hot-switch →
//      LRU evict → PB poll → admin routing. Exercises the theme host
//      core (src/theme-host/core.mjs) directly with fixture dists.
//
//   C) Composition — the platform hands pack page patterns to themes;
//      a pack route (`/p/<name>`) is served through whichever theme is
//      active and survives a theme switch.
//
// Run: pnpm --filter vanblog-app test:lifecycle
//      (or: node --test app/test/lifecycle.test.mjs)
// ============================================================

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  discoverPacks,
  mergeLocalPacks,
  loadPackMetadata,
  resolvePublicPages,
} from '../integrations/packs/resolver.mjs';
import { createThemeHost } from '../src/theme-host/core.mjs';

// ------------------------------------------------------------
// Hermetic fixtures
// ------------------------------------------------------------

const tempDirs = [];

function fixtureRoot(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `vanblog-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; a leftover fixture dir is harmless.
    }
  }
});

// A pack: pack.json + pages/index.astro (what resolver.mjs expects).
function writePack(root, name, identity = { name, version: '1.0.0' }) {
  const dir = join(root, name);
  mkdirSync(join(dir, 'pages'), { recursive: true });
  writeFileSync(join(dir, 'pack.json'), JSON.stringify(identity));
  writeFileSync(join(dir, 'pages', 'index.astro'), '---\n---\n');
  return dir;
}

// A theme: theme.json + dist/server/entry.mjs exporting a distinguishable
// handler that echoes its marker + the request URL.
function writeTheme(root, name, marker) {
  const dir = join(root, name);
  const dist = join(dir, 'dist', 'server');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dir, 'theme.json'), JSON.stringify({ name, label: marker }));
  writeFileSync(
    join(dist, 'entry.mjs'),
    [
      'export const handler = async (req, res) => {',
      "  const url = req.url || '/';",
      '  res.statusCode = 200;',
      '  res.setHeader("Content-Type", "text/html");',
      '  res.end(`<html><body>[' + marker + ']${url}</body></html>`);',
      '};',
      '',
    ].join('\n')
  );
}

// The standalone admin SSR build (a fake one that just echoes [ADMIN]).
// `root` is the ADMIN_DIST_DIR itself (e.g. /build/app/dist), so the entry
// lives at <root>/server/entry.mjs — exactly what the theme host expects.
function writeAdminDist(root) {
  const dist = join(root, 'server');
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    join(dist, 'entry.mjs'),
    [
      'export const handler = async (req, res) => {',
      '  res.statusCode = 200;',
      '  res.setHeader("Content-Type", "text/html");',
      '  res.end(`<html><body>[ADMIN]${req.url || "/"}</body></html>`);',
      '};',
      '',
    ].join('\n')
  );
}

// A theme whose dist throws at import time — simulates a corrupt/broken build.
// The host must refuse to load it and stay on the current theme.
function writeBrokenTheme(root, name) {
  const dir = join(root, name);
  const dist = join(dir, 'dist', 'server');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dir, 'theme.json'), JSON.stringify({ name }));
  writeFileSync(join(dist, 'entry.mjs'), ['throw new Error("broken dist");', ''].join('\n'));
}

// A theme whose entry.mjs exports no handler — must be rejected on load.
function writeNoHandlerTheme(root, name) {
  const dir = join(root, name);
  const dist = join(dir, 'dist', 'server');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dir, 'theme.json'), JSON.stringify({ name }));
  writeFileSync(join(dist, 'entry.mjs'), ['export const nothing = 1;', ''].join('\n'));
}

// A standard fixture set: 3 themes (alpha/beta/gamma) + an admin build.
function themeFixtureSet() {
  const themesDir = fixtureRoot('theme');
  writeTheme(themesDir, 'alpha', 'ALPHA');
  writeTheme(themesDir, 'beta', 'BETA');
  writeTheme(themesDir, 'gamma', 'GAMMA');
  const adminDistDir = fixtureRoot('theme-admin');
  writeAdminDist(adminDistDir);
  return { themesDir, adminDistDir };
}

// Minimal IncomingMessage / ServerResponse stand-ins. The host + fixtures
// only touch url / statusCode / setHeader / end / headersSent / destroy.
function fakeReq(url) {
  return { url, headers: {} };
}

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    headersSent: false,
    destroyed: false,
    setHeader(k, v) {
      this.headers[k] = v;
      this.headersSent = true;
    },
    end(body) {
      this.body = String(body ?? '');
    },
    destroy() {
      this.destroyed = true;
    },
  };
}

// A fake PocketBase: readActiveThemeFromPB() just needs { ok, json() }.
function mockPBFetch(activeTheme) {
  return async () => ({
    ok: true,
    json: async () => ({ items: [{ activeTheme }] }),
  });
}

// ------------------------------------------------------------
// A) Pack lifecycle
// ------------------------------------------------------------

describe('pack lifecycle', () => {
  it('discovers a builtin pack and resolves its public /p/<name> route', () => {
    const root = fixtureRoot('pack');
    writePack(root, 'bookmarks');
    const packs = discoverPacks(root);
    const metadata = loadPackMetadata(packs);
    const routes = resolvePublicPages(packs.flatMap((pack) => pack.pages));
    assert.equal(metadata[0].name, 'bookmarks');
    assert.equal(metadata[0].routes[0].pattern, '/p/bookmarks');
    assert.deepEqual(routes.map((r) => r.pattern), ['/p/bookmarks']);
  });

  it('a local override replaces the builtin pack (whole-Pack replacement)', () => {
    const builtin = fixtureRoot('pack');
    const local = fixtureRoot('pack');
    writePack(builtin, 'bookmarks');
    writePack(local, 'bookmarks', { name: 'bookmarks', version: '2.0.0' });
    const resolved = mergeLocalPacks(discoverPacks(builtin), local);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].version, '2.0.0');
    assert.ok(resolved[0].directory.startsWith(local), 'override must win the directory');
  });

  it('a brand-new local pack is appended to the builtin set', () => {
    const builtin = fixtureRoot('pack');
    const local = fixtureRoot('pack');
    writePack(builtin, 'bookmarks');
    writePack(local, 'alpha');
    const resolved = mergeLocalPacks(discoverPacks(builtin), local);
    assert.deepEqual(
      resolved.map((p) => p.name),
      ['alpha', 'bookmarks']
    );
  });

  it('rejects a pack whose identity does not match its directory', () => {
    const root = fixtureRoot('pack');
    writePack(root, 'bookmarks', { name: 'other', version: '1.0.0' });
    assert.throws(() => discoverPacks(root), /declares name/);
  });
});

// ------------------------------------------------------------
// B) Theme lifecycle
// ------------------------------------------------------------

describe('theme lifecycle', () => {
  it('enumerates the installed themes', () => {
    const { themesDir } = themeFixtureSet();
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha' });
    assert.deepEqual(
      new Set(host.listAvailableThemes()),
      new Set(['alpha', 'beta', 'gamma'])
    );
  });

  it('loads the active theme and serves a request', async () => {
    const { themesDir } = themeFixtureSet();
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha' });
    const res = fakeRes();
    await host.handleRequest(fakeReq('/'), res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /\[ALPHA\]/);
  });

  it('health endpoint reports active + loaded + available', async () => {
    const { themesDir } = themeFixtureSet();
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha' });
    await host.getActiveHandler(); // ensure alpha is loaded
    const res = fakeRes();
    await host.handleRequest(fakeReq('/__theme_host_health'), res);
    const health = JSON.parse(res.body);
    assert.equal(health.ok, true);
    assert.equal(health.activeTheme, 'alpha');
    assert.ok(health.loadedThemes.includes('alpha'));
    assert.deepEqual(new Set(health.availableThemes), new Set(['alpha', 'beta', 'gamma']));
  });

  it('hot-switches the active theme and serves the new theme', async () => {
    const { themesDir } = themeFixtureSet();
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha' });
    await host.switchTheme('beta');
    const res = fakeRes();
    await host.handleRequest(fakeReq('/'), res);
    assert.match(res.body, /\[BETA\]/);
    assert.equal(host.registrySnapshot().activeTheme, 'beta');
  });

  it('refuses to switch to a missing theme — stays on the current one', async () => {
    const { themesDir } = themeFixtureSet();
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha' });
    await host.switchTheme('nope');
    assert.equal(host.registrySnapshot().activeTheme, 'alpha');
  });

  it('switching back reuses the cached handler', async () => {
    const { themesDir } = themeFixtureSet();
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha' });
    await host.getActiveHandler();
    await host.switchTheme('beta');
    await host.switchTheme('alpha');
    const res = fakeRes();
    await host.handleRequest(fakeReq('/'), res);
    assert.match(res.body, /\[ALPHA\]/);
    // alpha + beta stay cached after the round-trip.
    assert.deepEqual(new Set(host.registrySnapshot().loaded), new Set(['alpha', 'beta']));
  });

  it('LRU eviction caps the number of loaded handlers', async () => {
    const { themesDir } = themeFixtureSet();
    writeTheme(themesDir, 'delta', 'DELTA'); // 4th theme forces an eviction
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha', maxLoadedThemes: 3 });
    for (const name of ['beta', 'gamma', 'delta']) {
      await host.switchTheme(name);
    }
    const snap = host.registrySnapshot();
    assert.equal(snap.activeTheme, 'delta');
    assert.ok(snap.loaded.length <= 3, `loaded=${snap.loaded.join(',')} exceeded cap 3`);
    assert.ok(snap.loaded.includes('delta'), 'active theme must stay loaded');
  });

  it('PB poll hot-swaps the active theme', async () => {
    const { themesDir } = themeFixtureSet();
    const host = createThemeHost({
      themesDir,
      defaultThemeName: 'alpha',
      fetchImpl: mockPBFetch('gamma'),
    });
    await host.pollSiteChanges();
    assert.equal(host.registrySnapshot().activeTheme, 'gamma');
    const res = fakeRes();
    await host.handleRequest(fakeReq('/'), res);
    assert.match(res.body, /\[GAMMA\]/);
  });

  it('bootstrap adopts PB active theme and falls back to default when unavailable', async () => {
    const { themesDir } = themeFixtureSet();
    const withPB = createThemeHost({
      themesDir,
      defaultThemeName: 'alpha',
      fetchImpl: mockPBFetch('gamma'),
    });
    await withPB.bootstrapActiveTheme();
    assert.equal(withPB.registrySnapshot().activeTheme, 'gamma');

    const noPB = createThemeHost({
      themesDir,
      defaultThemeName: 'alpha',
      fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
    });
    await noPB.bootstrapActiveTheme();
    assert.equal(noPB.registrySnapshot().activeTheme, 'alpha');
  });

  it('admin paths route to the admin SSR handler', async () => {
    const { themesDir, adminDistDir } = themeFixtureSet();
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha', adminDistDir });
    for (const path of ['/admin', '/admin/site', '/login', '/setup']) {
      const res = fakeRes();
      await host.handleRequest(fakeReq(path), res);
      assert.match(res.body, /\[ADMIN\]/, `${path} should be served by the admin SSR`);
    }
  });

  it('falls through to the theme when the admin build is missing', async () => {
    const { themesDir } = themeFixtureSet();
    const host = createThemeHost({
      themesDir,
      defaultThemeName: 'alpha',
      adminDistDir: join(themesDir, 'no-such-admin'),
    });
    const res = fakeRes();
    await host.handleRequest(fakeReq('/admin'), res);
    assert.match(res.body, /\[ALPHA\]\/admin/);
  });

  it('non-admin page requests go to the active theme', async () => {
    const { themesDir, adminDistDir } = themeFixtureSet();
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha', adminDistDir });
    await host.switchTheme('beta');
    const res = fakeRes();
    await host.handleRequest(fakeReq('/posts/hello'), res);
    assert.match(res.body, /\[BETA\]\/posts\/hello/);
  });
});

// ------------------------------------------------------------
// C) Pack + theme composition
// ------------------------------------------------------------

describe('pack + theme composition', () => {
  it('a pack route is served through the active theme and survives a switch', async () => {
    const { themesDir } = themeFixtureSet();

    // Build-time: the platform resolves the pack's public route.
    const packRoot = fixtureRoot('pack');
    writePack(packRoot, 'bookmarks');
    const routes = resolvePublicPages(discoverPacks(packRoot).flatMap((pack) => pack.pages));
    assert.deepEqual(routes.map((r) => r.pattern), ['/p/bookmarks']);

    // Runtime: the active theme owns the pack route.
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha' });
    const resA = fakeRes();
    await host.handleRequest(fakeReq('/p/bookmarks'), resA);
    assert.match(resA.body, /\[ALPHA\]\/p\/bookmarks/, 'pack route served by alpha');

    // A theme switch must not break the pack route.
    await host.switchTheme('beta');
    const resB = fakeRes();
    await host.handleRequest(fakeReq('/p/bookmarks'), resB);
    assert.match(resB.body, /\[BETA\]\/p\/bookmarks/, 'pack route survives switch to beta');
  });
});

// ------------------------------------------------------------
// D) Theme degradation / edge cases
// ------------------------------------------------------------

describe('theme degradation edge cases', () => {
  it('a corrupt dist that throws at import is refused — stays on current theme', async () => {
    const { themesDir } = themeFixtureSet();
    writeBrokenTheme(themesDir, 'broken');
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha' });

    // loadTheme rejects on the broken import.
    await assert.rejects(() => host.loadTheme('broken'), /broken dist/);

    // switchTheme refuses and keeps the current theme.
    await host.switchTheme('broken');
    assert.equal(host.registrySnapshot().activeTheme, 'alpha');
    assert.ok(!host.registrySnapshot().loaded.includes('broken'));
  });

  it('a theme with no handler export is refused on switch', async () => {
    const { themesDir } = themeFixtureSet();
    writeNoHandlerTheme(themesDir, 'nohandler');
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha' });
    await host.switchTheme('nohandler');
    assert.equal(host.registrySnapshot().activeTheme, 'alpha');
  });

  it('invalid theme.json falls back to {name} metadata without blocking load', async () => {
    const { themesDir } = themeFixtureSet();
    const dir = join(themesDir, 'badjson');
    const dist = join(dir, 'dist', 'server');
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dir, 'theme.json'), '{ not valid json'); // ← malformed
    writeFileSync(
      join(dist, 'entry.mjs'),
      [
        'export const handler = async (req, res) => {',
        '  res.statusCode = 200;',
        '  res.setHeader("Content-Type", "text/html");',
        '  res.end("<html><body>[BADJSON]</body></html>");',
        '};',
        '',
      ].join('\n')
    );

    const host = createThemeHost({ themesDir, defaultThemeName: 'badjson' });
    const loaded = await host.loadTheme('badjson');
    // JSON.parse failed → metadata falls back to { name }.
    assert.deepEqual(loaded.themeJson, { name: 'badjson' });
    // The theme is still fully loadable and servable.
    const res = fakeRes();
    await host.handleRequest(fakeReq('/'), res);
    assert.match(res.body, /\[BADJSON\]/);
  });

  it('a handler that throws returns 500 and the host keeps serving afterwards', async () => {
    const { themesDir } = themeFixtureSet();
    const dir = join(themesDir, 'explode');
    const dist = join(dir, 'dist', 'server');
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dir, 'theme.json'), JSON.stringify({ name: 'explode' }));
    writeFileSync(
      join(dist, 'entry.mjs'),
      ['export const handler = async () => { throw new Error("boom"); };', ''].join('\n')
    );

    const host = createThemeHost({ themesDir, defaultThemeName: 'explode' });
    const res = fakeRes();
    await host.handleRequest(fakeReq('/'), res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body, /theme host error/);

    // Host stays alive — health still answers.
    const health = fakeRes();
    await host.handleRequest(fakeReq('/__theme_host_health'), health);
    assert.equal(JSON.parse(health.body).ok, true);
    assert.equal(JSON.parse(health.body).activeTheme, 'explode');
  });

  it('a missing theme.json still loads (metadata defaults to {name})', async () => {
    const { themesDir } = themeFixtureSet();
    const dir = join(themesDir, 'nometa');
    const dist = join(dir, 'dist', 'server');
    mkdirSync(dist, { recursive: true });
    // No theme.json written at all.
    writeFileSync(
      join(dist, 'entry.mjs'),
      [
        'export const handler = async (req, res) => {',
        '  res.statusCode = 200;',
        '  res.end("ok");',
        '};',
        '',
      ].join('\n')
    );
    const host = createThemeHost({ themesDir, defaultThemeName: 'nometa' });
    const loaded = await host.loadTheme('nometa');
    assert.deepEqual(loaded.themeJson, { name: 'nometa' });
  });

  it('throttles repeated PB poll failures to a single warn (no log spam)', async () => {
    const { themesDir } = themeFixtureSet();
    const failingFetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const host = createThemeHost({ themesDir, defaultThemeName: 'alpha', fetchImpl: failingFetch });

    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      await host.pollSiteChanges(); // 1st failure → warns immediately
      await host.pollSiteChanges(); // within the 30s window → throttled
      await host.pollSiteChanges(); // still within the window → no warn
    } finally {
      console.warn = origWarn;
    }
    assert.equal(warns.length, 1, `expected exactly 1 throttled warn, got ${warns.length}: ${warns}`);
    assert.match(warns[0], /PB poll failed/);
  });
});
