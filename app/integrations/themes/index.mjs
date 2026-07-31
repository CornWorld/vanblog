// Vanblog themes integration (Spike 3 model).
//
// Each theme is an independent Astro project that imports base/platform files via
// the `@vanblog/base/*` alias. This integration resolves the alias to:
//   1. `themes/<active>/src/base-overrides/<rel>` when the theme ships an
//      override (for customising base layouts/components/styles), or
//   2. `app/src/<rel>` (the canonical platform (base) source) as a fallback.
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

const BASE_PREFIX = '@vanblog/base/';

// Paths under app/src/ that themes are forbidden from overriding via
// `src/base-overrides/`. Each entry is a POSIX-style regex tested
// against the alias suffix (e.g. `pages/admin/index.astro`).
//
// Why these paths are locked:
//   - pages/admin/   : admin is a control plane, themes cannot change it
//   - pages/api/     : API endpoints are part of the data layer
//   - lib/           : markdown pipeline + helpers used by platform pages
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

// Extensions tried when an alias target has no explicit extension, e.g.
// `@vanblog/base/lib/markdown/renderer` → renderer.ts. The override/base
// lookup returns the file path directly to Vite, so we must resolve the
// extension ourselves (Vite does not re-resolve plugin-returned ids).
const RESOLVE_EXTS = ['', '.ts', '.tsx', '.js', '.mjs', '.astro', '.css'];

function resolveWithExtension(base) {
  for (const ext of RESOLVE_EXTS) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

// Extracted as a named export so the themes integration can be unit-tested
// directly (see index.test.mjs) without spinning up a full Astro/Vite server.
export function resolveBaseAlias(id, overridesDir, mainAppSrcDir, logger) {
  if (!id.startsWith(BASE_PREFIX)) return null;
  const rel = id.slice(BASE_PREFIX.length);
  // Always normalise to POSIX-style, then lowercase, before the regex tests.
  // Lowercasing closes a case-sensitivity bypass on case-insensitive
  // filesystems (macOS/Windows default): a theme importing
  // `@vanblog/base/Pages/Admin/index.astro` would otherwise slip past the
  // all-lowercase FORBIDDEN_OVERRIDE_PATTERNS. The on-disk lookup keeps the
  // original case so legitimate mixed-case overrides still resolve on
  // case-sensitive filesystems.
  const relPosix = rel.split(sep).join('/');
  const relLower = relPosix.toLowerCase();

  const overridePath = normalize(join(overridesDir, rel));
  const resolvedOverride =
    containsPath(overridesDir, overridePath) ? resolveWithExtension(overridePath) : null;

  if (FORBIDDEN_OVERRIDE_PATTERNS.some((re) => re.test(relLower))) {
    // Fail closed: a theme that ships an override for a locked path
    // indicates a contract violation and must not silently fall back.
    if (resolvedOverride) {
      const msg =
        `[vanblog-themes] FORBIDDEN override: ${relPosix} is a locked base path ` +
        '(admin / api / lib / loaders / live.config / middleware). ' +
        'Themes cannot override this file. Remove it from src/base-overrides/.';
      if (logger && typeof logger.error === 'function') logger.error(msg);
      throw new Error(msg);
    }
    // No override present → fall through to base lookup so the alias
    // still resolves to the canonical file under app/src/.
  }

  if (resolvedOverride) return resolvedOverride;

  const basePath = normalize(join(mainAppSrcDir, rel));
  if (containsPath(mainAppSrcDir, basePath)) {
    const resolvedBase = resolveWithExtension(basePath);
    if (resolvedBase) return resolvedBase;
  }

  // Returning null lets Vite/Astro surface the "module not found" error
  // with the original alias intact, which is much easier to debug than
  // throwing here.
  return null;
}

export default function themesIntegration(options) {
  if (!options || !options.themeSrcDir || !options.mainAppSrcDir) {
    throw new Error(
      "vanblog-themes requires { themeSrcDir, mainAppSrcDir } options pointing at the theme's src/ and the main app/src/.",
    );
  }

  const themeSrcDir = options.themeSrcDir;
  const mainAppSrcDir = options.mainAppSrcDir;
  const overridesDir = join(themeSrcDir, 'base-overrides');

  return {
    name: 'vanblog-themes',
    hooks: {
      'astro:config:setup': ({ updateConfig, logger }) => {
        logger.info(
          `vanblog-themes: theme src=${themeSrcDir}, base src=${mainAppSrcDir}, overrides=${overridesDir}`,
        );
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'vanblog-base-resolver',
                resolveId(id) {
                  return resolveBaseAlias(id, overridesDir, mainAppSrcDir, logger);
                },
              },
            ],
          },
        });
      },
      // HMR is handled by Astro's standard file watcher because both the
      // theme's `src/` and `src/base-overrides/` live inside the project
      // root, and the main repo's `app/src/` is reachable via the alias
      // which Vite already watches for dependent modules.
    },
  };
}
