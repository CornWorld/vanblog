import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import themesIntegration, { resolveBuiltinAlias } from './index.mjs';

const tempDirs = [];

function fixtureRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'vanblog-themes-'));
  tempDirs.push(dir);
  return dir;
}

// Clean up temp fixtures created during the suite so repeated CI runs do not
// accumulate disk usage under the OS temp directory.
test.after(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; a leftover fixture dir is harmless.
    }
  }
});

// Writes a fixture file under `root` at `rel` (POSIX-style segments), creating
// parent directories as needed, and returns the absolute path.
function touch(root, rel) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, '---\n---\n');
  return target;
}

function fixtureContext() {
  const themeSrc = fixtureRoot();
  const mainAppSrc = fixtureRoot();
  const overridesDir = join(themeSrc, 'builtin-overrides');
  return { themeSrc, mainAppSrc, overridesDir };
}

test('returns null for ids outside the builtin alias', () => {
  const { overridesDir, mainAppSrc } = fixtureContext();
  assert.equal(resolveBuiltinAlias('/abs/path.astro', overridesDir, mainAppSrc), null);
  assert.equal(resolveBuiltinAlias('virtual:module', overridesDir, mainAppSrc), null);
  assert.equal(resolveBuiltinAlias('@vanblog/other/x.astro', overridesDir, mainAppSrc), null);
  assert.equal(resolveBuiltinAlias('@vanblog/builtin', overridesDir, mainAppSrc), null);
});

test('resolves a non-forbidden override file from the theme', () => {
  const { themeSrc, mainAppSrc, overridesDir } = fixtureContext();
  touch(themeSrc, 'builtin-overrides/components/Header.astro');
  const resolved = resolveBuiltinAlias('@vanblog/builtin/components/Header.astro', overridesDir, mainAppSrc);
  assert.equal(resolved, normalize(join(overridesDir, 'components', 'Header.astro')));
});

test('falls back to the builtin file when no override exists', () => {
  const { mainAppSrc, overridesDir } = fixtureContext();
  touch(mainAppSrc, 'components/Footer.astro');
  const resolved = resolveBuiltinAlias('@vanblog/builtin/components/Footer.astro', overridesDir, mainAppSrc);
  assert.equal(resolved, normalize(join(mainAppSrc, 'components', 'Footer.astro')));
});

test('returns null when neither override nor builtin exists', () => {
  const { mainAppSrc, overridesDir } = fixtureContext();
  assert.equal(resolveBuiltinAlias('@vanblog/builtin/does/not/exist.astro', overridesDir, mainAppSrc), null);
});

test('throws when a forbidden override file exists', () => {
  const { themeSrc, mainAppSrc, overridesDir } = fixtureContext();
  touch(themeSrc, 'builtin-overrides/pages/admin/index.astro');
  assert.throws(
    () => resolveBuiltinAlias('@vanblog/builtin/pages/admin/index.astro', overridesDir, mainAppSrc),
    /FORBIDDEN override/,
  );
});

test('throws for forbidden override paths with case variation', () => {
  // Regression test for the case-sensitivity bypass on case-insensitive
  // filesystems (macOS/Windows default): importing a locked path with
  // different casing must still be rejected.
  const { themeSrc, mainAppSrc, overridesDir } = fixtureContext();
  touch(themeSrc, 'builtin-overrides/Pages/Admin/index.astro');
  assert.throws(
    () => resolveBuiltinAlias('@vanblog/builtin/Pages/Admin/index.astro', overridesDir, mainAppSrc),
    /FORBIDDEN override/,
  );
});

test('falls back to builtin when a forbidden path has no override file', () => {
  const { mainAppSrc, overridesDir } = fixtureContext();
  touch(mainAppSrc, 'pages/api/comments.ts');
  const resolved = resolveBuiltinAlias('@vanblog/builtin/pages/api/comments.ts', overridesDir, mainAppSrc);
  assert.equal(resolved, normalize(join(mainAppSrc, 'pages', 'api', 'comments.ts')));
});

test('blocks directory traversal via .. segments', () => {
  const { themeSrc, mainAppSrc, overridesDir } = fixtureContext();
  const secret = touch(themeSrc, 'secret.astro');
  const resolved = resolveBuiltinAlias('@vanblog/builtin/../secret.astro', overridesDir, mainAppSrc);
  assert.equal(resolved, null);
  assert.notEqual(resolved, normalize(secret));
});

test('blocks traversal into the main app source via the builtin fallback', () => {
  const { mainAppSrc, overridesDir } = fixtureContext();
  const secret = touch(mainAppSrc, 'secret.astro');
  const resolved = resolveBuiltinAlias('@vanblog/builtin/../secret.astro', overridesDir, mainAppSrc);
  assert.equal(resolved, null);
  assert.notEqual(resolved, normalize(secret));
});

test('themesIntegration throws when required options are missing', () => {
  assert.throws(() => themesIntegration(), /requires \{ themeSrcDir, mainAppSrcDir \}/);
  assert.throws(() => themesIntegration({ themeSrcDir: '/x' }), /requires \{ themeSrcDir, mainAppSrcDir \}/);
  assert.throws(() => themesIntegration({ mainAppSrcDir: '/x' }), /requires \{ themeSrcDir, mainAppSrcDir \}/);
});

test('themesIntegration wires the resolver into a vite plugin and logs forbidden overrides', () => {
  const { themeSrc, mainAppSrc } = fixtureContext();
  const integration = themesIntegration({ themeSrcDir: themeSrc, mainAppSrcDir: mainAppSrc });
  assert.equal(integration.name, 'vanblog-themes');

  let vitePlugin;
  const errors = [];
  const logger = { info: () => {}, error: (msg) => errors.push(msg) };
  integration.hooks['astro:config:setup']({
    logger,
    updateConfig: (cfg) => {
      vitePlugin = cfg.vite.plugins[0];
    },
  });
  assert.equal(vitePlugin.name, 'vanblog-builtin-resolver');

  // Non-forbidden override resolves through the wired plugin.
  touch(themeSrc, 'builtin-overrides/components/Header.astro');
  const resolved = vitePlugin.resolveId('@vanblog/builtin/components/Header.astro');
  assert.equal(resolved, normalize(join(themeSrc, 'builtin-overrides', 'components', 'Header.astro')));

  // Forbidden override is rejected and logged through Astro's logger.
  touch(themeSrc, 'builtin-overrides/pages/admin/index.astro');
  assert.throws(() => vitePlugin.resolveId('@vanblog/builtin/pages/admin/index.astro'), /FORBIDDEN override/);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /FORBIDDEN override/);
});
