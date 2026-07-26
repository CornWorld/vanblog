// Vanblog themes integration (Spike 3 model).
//
// Each theme is an independent Astro project that imports builtin files via
// the `@vanblog/builtin/*` alias. This integration resolves the alias to:
//   1. `themes/<active>/src/builtin-overrides/<rel>` when the theme ships an
//      override (for customising builtin layouts/components/styles), or
//   2. `app/src/<rel>` (the canonical builtin source) as a fallback.
//
// The integration also enforces a small set of contract paths that themes
// are not allowed to override (admin pages, API endpoints, the markdown
// pipeline, live.config.ts, middleware.ts). Those remain owned by the
// vanblog maintainers and are required for the data layer to keep working.
//
// Verified by Spike 3 (2026-07-26):
//   - Astro 6 accepts a Vite plugin `resolveId` hook intercepting `.astro`.
//   - The override / fallback lookup runs on every module resolution, so
//     HMR picks up new override files without restarting the dev server.
//   - No `injectRoute` is needed: themes use Astro's standard file routing.

import { existsSync } from 'node:fs';
import { join, normalize, relative, sep } from 'node:path';

const BUILTIN_PREFIX = '@vanblog/builtin/';

// Paths under app/src/ that themes are forbidden from overriding via
// `src/builtin-overrides/`. Each entry is a POSIX-style regex tested
// against the alias suffix (e.g. `pages/admin/index.astro`).
//
// Why these paths are locked:
//   - pages/admin/   : admin is a control plane, themes cannot change it
//   - pages/api/     : API endpoints are part of the data layer
//   - lib/           : markdown pipeline + helpers used by builtin pages
//   - loaders/       : Live Collection loaders feed built-in pages
//   - live.config.ts : Live Collection registration
//   - middleware.ts  : auth / pb client injection
const FORBIDDEN_OVERRIDE_PATTERNS = [
  /^pages\/admin\//,
  /^pages\/api\//,
  /^lib\//,
  /^loaders\//,
  /^live\.config\.[a-z]+$/i,
  /^middleware\.[a-z]+$/i,
];

function containsPath(parentDir, candidate) {
  const rel = relative(parentDir, candidate);
  return rel !== '' && !rel.startsWith('..' + sep) && !rel.startsWith('../');
}

export default function themesIntegration(options) {
  if (!options || !options.themeSrcDir || !options.mainAppSrcDir) {
    throw new Error(
      "vanblog-themes requires { themeSrcDir, mainAppSrcDir } options pointing at the theme's src/ and the main app/src/.",
    );
  }

  const themeSrcDir = options.themeSrcDir;
  const mainAppSrcDir = options.mainAppSrcDir;
  const overridesDir = join(themeSrcDir, 'builtin-overrides');

  function resolveBuiltinAlias(id) {
    if (!id.startsWith(BUILTIN_PREFIX)) return null;
    const rel = id.slice(BUILTIN_PREFIX.length);
    // Always normalise to POSIX-style for the regex tests below.
    const relPosix = rel.split(sep).join('/');

    const overridePath = normalize(join(overridesDir, rel));
    const overrideExists = containsPath(overridesDir, overridePath) && existsSync(overridePath);

    if (FORBIDDEN_OVERRIDE_PATTERNS.some((re) => re.test(relPosix))) {
      // Fail closed: a theme that ships an override for a locked path
      // indicates a contract violation and must not silently fall back.
      if (overrideExists) {
        throw new Error(
          `[vanblog-themes] FORBIDDEN override: ${relPosix} is a locked builtin path ` +
            '(admin / api / lib / loaders / live.config / middleware). ' +
            'Themes cannot override this file. Remove it from src/builtin-overrides/.',
        );
      }
      // No override present → fall through to builtin lookup so the alias
      // still resolves to the canonical file under app/src/.
    }

    if (overrideExists) return overridePath;

    const builtinPath = normalize(join(mainAppSrcDir, rel));
    if (containsPath(mainAppSrcDir, builtinPath) && existsSync(builtinPath)) {
      return builtinPath;
    }

    // Returning null lets Vite/Astro surface the "module not found" error
    // with the original alias intact, which is much easier to debug than
    // throwing here.
    return null;
  }

  return {
    name: 'vanblog-themes',
    hooks: {
      'astro:config:setup': ({ updateConfig, logger }) => {
        logger.info(
          `vanblog-themes: theme src=${themeSrcDir}, builtin src=${mainAppSrcDir}, overrides=${overridesDir}`,
        );
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'vanblog-builtin-resolver',
                resolveId(id) {
                  return resolveBuiltinAlias(id);
                },
              },
            ],
          },
        });
      },
      // HMR is handled by Astro's standard file watcher because both the
      // theme's `src/` and `src/builtin-overrides/` live inside the project
      // root, and the main repo's `app/src/` is reachable via the alias
      // which Vite already watches for dependent modules.
    },
  };
}
