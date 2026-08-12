// ============================================================
// Theme Host — core logic (testable, no process side-effects).
//
// Holds the theme registry + lifecycle (list / load / switch /
// evict / PB-poll) and the request router. The entrypoint
// (index.mjs) wires this to an HTTP server, signal handlers and
// the PB polling loop.
//
// Separating the two means the whole theme lifecycle can be
// exercised hermetically with fixture dists — no Docker, no real
// PocketBase, no ports. This mirrors the "thin handler / testable
// core" convention used across the Go side (e.g. reloadThemes in
// vault/internal/caddy/routes_admin.go).
// ============================================================

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// themeNamePattern is the accepted theme identifier shape — the same contract
// the pack CLI (vault/internal/packcli/theme.go) and the Go theme resolver
// (vault/internal/theme/routes.go) enforce. Names are joined onto the themes
// roots and their entry.mjs is executed via import(), so this guard prevents a
// name with path separators / ".." from escaping the roots (defense in depth —
// HTTP callers already gate through listAvailableThemes()).
const themeNamePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * @typedef {object} ThemeHostOptions
 * @property {string} [themesDir]          Directory holding one subdir per theme.
 * @property {string} [defaultThemeName]   Fallback active theme name.
 * @property {string} [pbUrl]              PocketBase base URL for site.activeTheme.
 * @property {number} [maxLoadedThemes] LRU cap for cached handlers.
 * @property {string} [adminDistDir]    Standalone admin SSR build dir.
 * @property {typeof fetch} [fetchImpl] Injectable fetch (tests inject a fake PB).
 */

/**
 * @typedef {{handler: Function, themeJson: object, loadedAt: number, refCount: number}} LoadedTheme
 */

/**
 * Create an isolated theme host instance.
 * All options default to the same env vars / constants the entrypoint uses,
 * so production behavior is byte-for-byte preserved.
 * @param {ThemeHostOptions} [options]
 */
export function createThemeHost(options = {}) {
  const themesDir =
    options.themesDir ?? process.env.VANBLOG_THEMES_DIR ?? '/var/lib/vanblog/themes';
  // Builtin themes baked into the image (read-only). Consumers merge both roots;
  // the user themes dir (themesDir) wins on a name collision.
  const builtinThemesDir =
    options.builtinThemesDir ?? process.env.VANBLOG_THEMES_BUILTIN_DIR ?? '/build/themes';
  const defaultThemeName =
    options.defaultThemeName ?? process.env.VANBLOG_DEFAULT_THEME ?? 'vanblog';
  const pbUrl = options.pbUrl ?? process.env.PB_URL ?? 'http://127.0.0.1:8090';
  const maxLoadedThemes = options.maxLoadedThemes ?? 3;
  const adminDistDir =
    options.adminDistDir ?? process.env.VANBLOG_ADMIN_DIST_DIR ?? '/build/app/dist';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  /** @type {Map<string, LoadedTheme>} */
  const registry = new Map();
  let activeThemeName = defaultThemeName;
  let adminHandler = null;
  const startTime = Date.now();

  // --- Diagnostics (throttled warn) ---
  // Some failure paths fire on every poll / request (e.g. PB down every 5s).
  // A plain warn would spam logs, but a silent swallow hides real outages.
  // Throttle: first failure warns immediately, then at most once per window.
  /** @type {Map<string, number>} */
  const lastWarnAt = new Map();
  function throttledWarn(key, intervalMs, msg, ...rest) {
    const now = Date.now();
    if ((lastWarnAt.get(key) || 0) + intervalMs <= now) {
      lastWarnAt.set(key, now);
      console.warn(`[theme-host] ${msg}`, ...rest);
    }
  }

  // --- Theme loading & registry ---

  /**
   * Resolve the root dir holding a built theme: the user themes dir first
   * (wins on collision), then the image's builtin dir. Null when absent.
   * @param {string} name
   * @returns {string|null}
   */
  function resolveThemeDir(name) {
    if (!themeNamePattern.test(name)) return null;
    if (existsSync(join(themesDir, name, 'dist', 'server', 'entry.mjs'))) return themesDir;
    if (existsSync(join(builtinThemesDir, name, 'dist', 'server', 'entry.mjs'))) return builtinThemesDir;
    return null;
  }

  /**
   * List themes that have a built dist/server/entry.mjs, merged from the user
   * (volume) and builtin (image) roots. User dir is scanned first so it wins
   * dedup on a name collision.
   * @returns {string[]}
   */
  function listAvailableThemes() {
    const seen = new Set();
    const names = [];
    for (const root of [themesDir, builtinThemesDir]) {
      let entries;
      try {
        entries = readdirSync(root);
      } catch (err) {
        // Per-root key so an outage in one source surfaces even when the other
        // root already warned within the same window.
        throttledWarn(`listThemes:${root}`, 30_000, `cannot list themes dir ${root}:`, err?.message ?? err);
        continue;
      }
      for (const name of entries) {
        if (seen.has(name)) continue;
        if (!themeNamePattern.test(name)) continue;
        if (!existsSync(join(root, name, 'dist', 'server', 'entry.mjs'))) continue;
        seen.add(name);
        names.push(name);
      }
    }
    return names;
  }

  /**
   * Load a theme's handler by dynamic import.
   * @param {string} name
   * @returns {Promise<LoadedTheme>}
   */
  async function loadTheme(name) {
    const themeDir = resolveThemeDir(name);
    if (!themeDir) {
      throw new Error(`theme '${name}' entry.mjs not found`);
    }
    const distDir = join(themeDir, name, 'dist');
    const entryPath = pathToFileURL(join(distDir, 'server', 'entry.mjs')).href;

    let themeJson = { name };
    const themeJsonPath = join(themeDir, name, 'theme.json');
    if (existsSync(themeJsonPath)) {
      try {
        themeJson = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
      } catch (err) {
        throttledWarn(
          'themeJson',
          30_000,
          `theme '${name}' theme.json invalid, falling back to {name}:`,
          err?.message ?? err
        );
      }
    }

    // ASTRO_NODE_AUTOSTART=disabled prevents the theme from starting its own server.
    process.env.ASTRO_NODE_AUTOSTART = 'disabled';

    const mod = await import(entryPath);
    const handler = mod.handler || (mod.default && mod.default.handler);

    if (!handler) {
      throw new Error(`theme '${name}' entry.mjs does not export a handler`);
    }

    return { handler, themeJson, loadedAt: Date.now(), refCount: 0 };
  }

  /**
   * Load the standalone admin SSR handler (built from app/ as vanblog-app).
   * Returns null when the build is missing so callers fall through to the
   * active theme handler (legacy behaviour for partial installs).
   * @returns {Promise<Function|null>}
   */
  async function getAdminHandler() {
    if (adminHandler) return adminHandler;
    const entryPath = pathToFileURL(join(adminDistDir, 'server', 'entry.mjs')).href;
    if (!existsSync(join(adminDistDir, 'server', 'entry.mjs'))) {
      console.warn(`[theme-host] admin SSR entry not found at ${adminDistDir}/server/entry.mjs`);
      return null;
    }
    process.env.ASTRO_NODE_AUTOSTART = 'disabled';
    const mod = await import(entryPath);
    adminHandler = mod.handler || (mod.default && mod.default.handler);
    if (!adminHandler) {
      console.error('[theme-host] admin SSR entry does not export a handler');
      return null;
    }
    console.log(`[theme-host] admin SSR loaded from ${adminDistDir}`);
    return adminHandler;
  }

  /**
   * Get or load the active theme handler.
   * @returns {Promise<LoadedTheme>}
   */
  async function getActiveHandler() {
    let t = registry.get(activeThemeName);
    if (!t) {
      console.log(`[theme-host] loading theme: ${activeThemeName}`);
      t = await loadTheme(activeThemeName);
      registry.set(activeThemeName, t);
      evictLRU();
    }
    return t;
  }

  /**
   * Evict the least recently used cached theme (refCount=0, not active)
   * when the registry exceeds maxLoadedThemes.
   */
  function evictLRU() {
    if (registry.size <= maxLoadedThemes) return;
    let oldest = null;
    let oldestTime = Infinity;
    for (const [name, t] of registry) {
      if (name === activeThemeName) continue;
      if (t.refCount === 0 && t.loadedAt < oldestTime) {
        oldest = name;
        oldestTime = t.loadedAt;
      }
    }
    if (oldest) {
      console.log(`[theme-host] LRU evicting theme: ${oldest}`);
      registry.delete(oldest);
    }
  }

  /**
   * Switch the active theme. Pre-loads the target before switching; on any
   * failure (missing on disk, broken dist) it stays on the current theme.
   * @param {string} newName
   */
  async function switchTheme(newName) {
    if (newName === activeThemeName) return;
    if (!newName) return;

    const available = listAvailableThemes();
    if (!available.includes(newName)) {
      console.error(
        `[theme-host] theme '${newName}' not available (available: ${available.join(', ')})`
      );
      return;
    }

    console.log(`[theme-host] switching theme: ${activeThemeName} → ${newName}`);
    try {
      if (!registry.has(newName)) {
        const t = await loadTheme(newName);
        registry.set(newName, t);
        evictLRU();
      }
      activeThemeName = newName;
      console.log(`[theme-host] theme switched to: ${newName}`);
    } catch (err) {
      console.error(
        `[theme-host] FAILED to switch to '${newName}', staying on '${activeThemeName}':`,
        err
      );
      // Don't change activeThemeName, continue with the old one.
    }
  }

  // --- PocketBase activeTheme read / poll ---

  /**
   * Read site.activeTheme from PB. Returns null when unreachable/empty.
   * @returns {Promise<string|null>}
   */
  async function readActiveThemeFromPB() {
    const r = await fetchImpl(`${pbUrl}/api/collections/site/records?perPage=1`);
    if (!r.ok) {
      throttledWarn('pbRead', 30_000, `PB responded ${r.status} for site record, keeping current theme`);
      return null;
    }
    const j = await r.json();
    const name = j?.items?.[0]?.activeTheme;
    return typeof name === 'string' && name ? name : null;
  }

  /**
   * Startup: adopt PB's active theme if it's available; otherwise fall back
   * to the default theme. Returns the resolved active theme name.
   * @returns {Promise<string>}
   */
  async function bootstrapActiveTheme() {
    const available = listAvailableThemes();
    try {
      const pbTheme = await readActiveThemeFromPB();
      if (pbTheme && available.includes(pbTheme)) {
        activeThemeName = pbTheme;
        console.log(`[theme-host] PB reports active theme: ${activeThemeName}`);
        return activeThemeName;
      }
    } catch (err) {
      console.warn(
        `[theme-host] PB not reachable at bootstrap, using default theme '${activeThemeName}':`,
        err?.message ?? err
      );
    }
    return activeThemeName;
  }

  /**
   * One poll round: read PB and switch if the active theme changed.
   * Errors are swallowed — PB being briefly down must never crash the host.
   */
  async function pollSiteChanges() {
    try {
      const newTheme = await readActiveThemeFromPB();
      if (newTheme && newTheme !== activeThemeName) {
        await switchTheme(newTheme);
      }
    } catch (err) {
      // PB temporarily unreachable — throttled so a long outage surfaces
      // without spamming one line per 5s poll.
      throttledWarn('pbPoll', 30_000, 'PB poll failed (will keep retrying):', err?.message ?? err);
    }
  }

  // --- Request router ---

  /**
   * Route one request. Static assets are served by Caddy file_server routes
   * (vault/internal/caddy/static_routes.go) — this host only routes dynamic
   * requests: health → admin SSR (/admin /login /setup) → active theme.
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  async function handleRequest(req, res) {
    const url = req.url || '/';
    try {
      // --- Health check ---
      if (url === '/__theme_host_health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: true,
            activeTheme: activeThemeName,
            loadedThemes: [...registry.keys()],
            availableThemes: listAvailableThemes(),
            uptime: Math.floor((Date.now() - startTime) / 1000),
          })
        );
        return;
      }

      // --- Control plane → standalone admin SSR app ---
      const pathname = url.split('?')[0];
      if (
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        pathname === '/login' ||
        pathname === '/setup'
      ) {
        const admin = await getAdminHandler();
        if (admin) {
          await admin(req, res);
          return;
        }
        // Admin build missing → fall through to the active theme handler,
        // which returns its own 404 for /admin (legacy behaviour).
      }

      // --- All other requests → active theme handler ---
      const theme = await getActiveHandler();
      theme.refCount++;
      try {
        await theme.handler(req, res);
      } finally {
        theme.refCount--;
      }
    } catch (err) {
      console.error('[theme-host] unhandled error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('theme host error');
      } else {
        res.destroy();
      }
    }
  }

  // --- Introspection (health + tests) ---

  /** @returns {{ok: boolean, activeTheme: string, loadedThemes: string[], availableThemes: string[], uptime: number}} */
  function getHealth() {
    return {
      ok: true,
      activeTheme: activeThemeName,
      loadedThemes: [...registry.keys()],
      availableThemes: listAvailableThemes(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
  }

  /** @returns {{activeTheme: string, loaded: string[], available: string[]}} */
  function registrySnapshot() {
    return {
      activeTheme: activeThemeName,
      loaded: [...registry.keys()],
      available: listAvailableThemes(),
    };
  }

  /** @returns {{themesDir: string, defaultThemeName: string, pbUrl: string, adminDistDir: string, maxLoadedThemes: number}} */
  function getConfig() {
    return { themesDir, defaultThemeName, pbUrl, adminDistDir, maxLoadedThemes };
  }

  return {
    listAvailableThemes,
    loadTheme,
    getAdminHandler,
    getActiveHandler,
    switchTheme,
    evictLRU,
    bootstrapActiveTheme,
    pollSiteChanges,
    handleRequest,
    getHealth,
    registrySnapshot,
    getConfig,
  };
}
