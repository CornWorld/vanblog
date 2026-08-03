#!/usr/bin/env node

// ============================================================
// Theme Host — resolves the active render target (theme or admin
// control plane) and forwards dynamic requests to it. Static assets are
// served by Caddy file_server (see vault/internal/caddy/static_routes.go).
// ============================================================

import { createServer } from 'node:http';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// --- Configuration ---
const THEMES_DIR = process.env.VANBLOG_THEMES_DIR || '/var/lib/vanblog/themes';
const DEFAULT_THEME = process.env.VANBLOG_DEFAULT_THEME || 'vanblog';
const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_LOADED_THEMES = 3;
const POLL_INTERVAL_MS = 5000;

// Directory of the standalone admin SSR build (the control plane, built from
// app/ as vanblog-app). It is served independently of the active theme for
// /admin, /login and /setup, and its hashed assets live at the root /_astro/.
const ADMIN_DIST_DIR = process.env.VANBLOG_ADMIN_DIST_DIR || '/build/app/dist';

// --- Types (JSDoc for clarity) ---
/** @typedef {{ handler: Function, themeJson: object, loadedAt: number, refCount: number }} LoadedTheme */

// --- State ---
/** @type {Map<string, LoadedTheme>} */
const registry = new Map();
let activeThemeName = DEFAULT_THEME;
const startTime = Date.now();

// ============================================================
// Theme Loading & Registry
// ============================================================

/**
 * List available themes that have built dist directories.
 * @returns {string[]}
 */
function listAvailableThemes() {
  try {
    return readdirSync(THEMES_DIR).filter(name => {
      return existsSync(join(THEMES_DIR, name, 'dist', 'server', 'entry.mjs'));
    });
  } catch {
    return [];
  }
}

/**
 * Load a theme's handler by dynamic import.
 * @param {string} name
 * @returns {Promise<LoadedTheme>}
 */
async function loadTheme(name) {
  const distDir = join(THEMES_DIR, name, 'dist');
  const entryPath = pathToFileURL(join(distDir, 'server', 'entry.mjs')).href;

  if (!existsSync(join(distDir, 'server', 'entry.mjs'))) {
    throw new Error(`theme '${name}' entry.mjs not found`);
  }

  // Read theme.json metadata
  const themeJsonPath = join(THEMES_DIR, name, 'theme.json');
  /** @type {object} */
  let themeJson = { name };
  if (existsSync(themeJsonPath)) {
    try {
      themeJson = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
    } catch { /* ignore */ }
  }

  // ASTRO_NODE_AUTOSTART=disabled prevents the theme from starting its own server
  process.env.ASTRO_NODE_AUTOSTART = 'disabled';

  const mod = await import(entryPath);
  const handler = mod.handler || (mod.default && mod.default.handler);

  if (!handler) {
    throw new Error(`theme '${name}' entry.mjs does not export a handler`);
  }

  return {
    handler,
    themeJson,
    loadedAt: Date.now(),
    refCount: 0,
  };
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

let adminHandler = null;

/**
 * Load the standalone admin SSR handler (built from app/ as vanblog-app).
 * Returns null when the build is missing so callers can fall through to the
 * active theme handler (preserves legacy behaviour for partial installs).
 */
async function getAdminHandler() {
  if (adminHandler) return adminHandler;
  const entryPath = pathToFileURL(join(ADMIN_DIST_DIR, 'server', 'entry.mjs')).href;
  if (!existsSync(join(ADMIN_DIST_DIR, 'server', 'entry.mjs'))) {
    console.warn(`[theme-host] admin SSR entry not found at ${ADMIN_DIST_DIR}/server/entry.mjs`);
    return null;
  }
  process.env.ASTRO_NODE_AUTOSTART = 'disabled';
  const mod = await import(entryPath);
  adminHandler = mod.handler || (mod.default && mod.default.handler);
  if (!adminHandler) {
    console.error('[theme-host] admin SSR entry does not export a handler');
    return null;
  }
  console.log(`[theme-host] admin SSR loaded from ${ADMIN_DIST_DIR}`);
  return adminHandler;
}

/**
 * Evict the least recently used cached theme (refCount=0, not active).
 */
function evictLRU() {
  if (registry.size <= MAX_LOADED_THEMES) return;

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
 * Switch the active theme.
 * Pre-loads the target theme before switching.
 * @param {string} newName
 */
async function switchTheme(newName) {
  if (newName === activeThemeName) return;
  if (!newName) return;

  // Validate: check the theme is available
  const available = listAvailableThemes();
  if (!available.includes(newName)) {
    console.error(`[theme-host] theme '${newName}' not available (available: ${available.join(', ')})`);
    return;
  }

  console.log(`[theme-host] switching theme: ${activeThemeName} → ${newName}`);
  try {
    // Pre-load the new theme if not in registry
    if (!registry.has(newName)) {
      const t = await loadTheme(newName);
      registry.set(newName, t);
      evictLRU();
    }
    activeThemeName = newName;
    console.log(`[theme-host] theme switched to: ${newName}`);
  } catch (err) {
    console.error(`[theme-host] FAILED to switch to '${newName}', staying on '${activeThemeName}':`, err);
    // Don't change activeThemeName, continue with the old one
  }
}

// ============================================================
// PB Realtime Polling (B3)
// ============================================================

let pollTimer = null;

/**
 * Poll PB for site.activeTheme changes.
 * Simpler than SSE — no extra dependency needed.
 */
async function pollSiteChanges() {
  try {
    const r = await fetch(`${PB_URL}/api/collections/site/records?perPage=1`);
    if (!r.ok) return;
    const j = await r.json();
    const newTheme = j?.items?.[0]?.activeTheme;
    if (typeof newTheme === 'string' && newTheme && newTheme !== activeThemeName) {
      await switchTheme(newTheme);
    }
  } catch {
    // PB temporarily unreachable, skip this round
  }
}

function startPolling() {
  console.log(`[theme-host] starting PB polling (every ${POLL_INTERVAL_MS}ms)`);
  pollTimer = setInterval(pollSiteChanges, POLL_INTERVAL_MS);
  pollTimer.unref();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ============================================================
// HTTP Server
// ============================================================

const server = createServer(async (req, res) => {
  const url = req.url || '/';

  try {
    // --- Health check (B4) ---
    if (url === '/__theme_host_health') {
      res.setHeader('Content-Type', 'application/json');
      const loaded = [...registry.keys()];
      res.end(JSON.stringify({
        ok: true,
        activeTheme: activeThemeName,
        loadedThemes: loaded,
        availableThemes: listAvailableThemes(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
      }));
      return;
    }

    // Static assets (/themes/*, /_astro/*, root files) are served by Caddy's
    // file_server routes (vault/internal/caddy/static_routes.go) — the
    // theme host only routes dynamic requests.

    // --- Control plane → standalone admin SSR app ---
    // /admin, /login, /setup are platform-owned (never themed). The admin app
    // is built with base "/", so its hashed assets are served at the root
    // /_astro/ path below.
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
      // Admin build missing → fall through to the active theme handler, which
      // returns its own 404 for /admin (legacy behaviour).
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
});

// ============================================================
// Graceful Shutdown (B4)
// ============================================================

/** @type {Set<Function>} */
const inFlightRequests = new Set();

// Track in-flight requests for graceful shutdown
server.on('request', (_req, res) => {
  if (res.writableEnded) return;
  const done = () => { inFlightRequests.delete(done); };
  inFlightRequests.add(done);
  res.on('finish', done);
  res.on('close', done);
  res.on('error', done);
});

/**
 * Graceful shutdown handler.
 */
async function shutdown(signal) {
  console.log(`[theme-host] received ${signal}, shutting down gracefully...`);
  stopPolling();

  // Stop accepting new connections
  server.close(() => {
    console.log('[theme-host] server closed');
    process.exit(0);
  });

  // Wait for in-flight requests to complete (max 10s)
  const maxWait = 10000;
  const checkInterval = 200;
  let waited = 0;
  while (inFlightRequests.size > 0 && waited < maxWait) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    waited += checkInterval;
  }

  if (inFlightRequests.size > 0) {
    console.log(`[theme-host] force exiting with ${inFlightRequests.size} in-flight requests`);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// Global Error Handlers
// ============================================================

process.on('unhandledRejection', (reason) => {
  console.error('[theme-host] unhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[theme-host] uncaughtException:', err);
  // Do NOT exit — this is intentional for production resilience.
  // The supervisor (entrypoint monitor) will restart the container if needed.
});

// ============================================================
// Bootstrap
// ============================================================

async function bootstrap() {
  const available = listAvailableThemes();
  console.log(`[theme-host] themes dir: ${THEMES_DIR}`);
  console.log(`[theme-host] available themes: ${available.length > 0 ? available.join(', ') : '(none)'}`);
  console.log(`[theme-host] default theme: ${DEFAULT_THEME}`);

  // Try to fetch active theme from PB
  try {
    const r = await fetch(`${PB_URL}/api/collections/site/records?perPage=1`);
    if (r.ok) {
      const j = await r.json();
      const pbTheme = j?.items?.[0]?.activeTheme;
      if (typeof pbTheme === 'string' && pbTheme && available.includes(pbTheme)) {
        activeThemeName = pbTheme;
        console.log(`[theme-host] PB reports active theme: ${activeThemeName}`);
      }
    }
  } catch {
    console.log(`[theme-host] PB not reachable, using default theme: ${activeThemeName}`);
  }

  // Start PB polling for runtime theme changes
  startPolling();

  server.on('error', (err) => {
    console.error(`[theme-host] failed to listen on ${HOST}:${PORT}:`, err);
    process.exit(1);
  });
  server.listen(PORT, HOST, () => {
    console.log(`[theme-host] listening on ${HOST}:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('[theme-host] fatal bootstrap error:', err);
  process.exit(1);
});
