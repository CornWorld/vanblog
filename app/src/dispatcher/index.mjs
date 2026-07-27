#!/usr/bin/env node

// ============================================================
// Theme Dispatcher — Single Node.js HTTP server that loads
// and routes requests to the active Astro theme handler.
// ============================================================

import { createServer } from 'node:http';
import { readdirSync, existsSync, readFileSync, createReadStream, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

// --- Configuration ---
const THEMES_DIR = process.env.VANBLOG_THEMES_DIR || '/var/lib/vanblog/themes';
const DEFAULT_THEME = process.env.VANBLOG_DEFAULT_THEME || 'default';
const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_LOADED_THEMES = 3;
const POLL_INTERVAL_MS = 5000;

// --- Types (JSDoc for clarity) ---
/** @typedef {{ handler: Function, themeJson: object, loadedAt: number, refCount: number }} LoadedTheme */

// --- State ---
/** @type {Map<string, LoadedTheme>} */
const registry = new Map();
let activeThemeName = DEFAULT_THEME;
const startTime = Date.now();

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
};

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
    console.log(`[dispatcher] loading theme: ${activeThemeName}`);
    t = await loadTheme(activeThemeName);
    registry.set(activeThemeName, t);
    evictLRU();
  }
  return t;
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
    console.log(`[dispatcher] LRU evicting theme: ${oldest}`);
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
    console.error(`[dispatcher] theme '${newName}' not available (available: ${available.join(', ')})`);
    return;
  }

  console.log(`[dispatcher] switching theme: ${activeThemeName} → ${newName}`);
  try {
    // Pre-load the new theme if not in registry
    if (!registry.has(newName)) {
      const t = await loadTheme(newName);
      registry.set(newName, t);
      evictLRU();
    }
    activeThemeName = newName;
    console.log(`[dispatcher] theme switched to: ${newName}`);
  } catch (err) {
    console.error(`[dispatcher] FAILED to switch to '${newName}', staying on '${activeThemeName}':`, err);
    // Don't change activeThemeName, continue with the old one
  }
}

// ============================================================
// Static File Serving
// ============================================================

/**
 * Serve a static file from theme dist/client/ directory.
 * @param {string} themeName
 * @param {string} subPath
 * @param {import('node:http').ServerResponse} res
 */
function serveStaticFile(themeName, subPath, res) {
  // Decode URI and prevent directory traversal
  const decodedPath = decodeURIComponent(subPath);
  const clientDir = join(THEMES_DIR, themeName, 'dist', 'client');
  const filePath = join(clientDir, decodedPath);

  // Security: ensure the resolved path is within clientDir
  if (!filePath.startsWith(clientDir)) {
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  createReadStream(filePath).pipe(res);
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
  console.log(`[dispatcher] starting PB polling (every ${POLL_INTERVAL_MS}ms)`);
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
    if (url === '/__dispatcher_health') {
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

    // --- Theme static assets ---
    // /themes/<name>/static/<path> → serve from themes/<name>/dist/client/<path>
    const staticMatch = url.match(/^\/themes\/([^/]+)\/static\/(.+)$/);
    if (staticMatch) {
      const [, themeName, subPath] = staticMatch;
      serveStaticFile(themeName, subPath, res);
      return;
    }

    // Also handle /themes/<name>/_astro/<path> directly
    // (Astro renders assets at /themes/<name>/_astro/ when base is set)
    const astroStaticMatch = url.match(/^\/themes\/([^/]+)\/_astro\/(.+)$/);
    if (astroStaticMatch) {
      const [, themeName, subPath] = astroStaticMatch;
      serveStaticFile(themeName, '_astro/' + subPath, res);
      return;
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
    console.error('[dispatcher] unhandled error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('dispatcher error');
    }
  }
});

// ============================================================
// Graceful Shutdown (B4)
// ============================================================

/** @type {Set<Function>} */
const inFlightRequests = new Set();

// Track in-flight requests for graceful shutdown
server.on('request', (req, res) => {
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
  console.log(`[dispatcher] received ${signal}, shutting down gracefully...`);
  stopPolling();

  // Stop accepting new connections
  server.close(() => {
    console.log('[dispatcher] server closed');
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
    console.log(`[dispatcher] force exiting with ${inFlightRequests.size} in-flight requests`);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// Global Error Handlers
// ============================================================

process.on('unhandledRejection', (reason) => {
  console.error('[dispatcher] unhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[dispatcher] uncaughtException:', err);
  // Do NOT exit — this is intentional for production resilience.
  // The supervisor (entrypoint monitor) will restart the container if needed.
});

// ============================================================
// Bootstrap
// ============================================================

async function bootstrap() {
  const available = listAvailableThemes();
  console.log(`[dispatcher] themes dir: ${THEMES_DIR}`);
  console.log(`[dispatcher] available themes: ${available.length > 0 ? available.join(', ') : '(none)'}`);
  console.log(`[dispatcher] default theme: ${DEFAULT_THEME}`);

  // Try to fetch active theme from PB
  try {
    const r = await fetch(`${PB_URL}/api/collections/site/records?perPage=1`);
    if (r.ok) {
      const j = await r.json();
      const pbTheme = j?.items?.[0]?.activeTheme;
      if (typeof pbTheme === 'string' && pbTheme && available.includes(pbTheme)) {
        activeThemeName = pbTheme;
        console.log(`[dispatcher] PB reports active theme: ${activeThemeName}`);
      }
    }
  } catch {
    console.log(`[dispatcher] PB not reachable, using default theme: ${activeThemeName}`);
  }

  // Start PB polling for runtime theme changes
  startPolling();

  server.listen(PORT, HOST, () => {
    console.log(`[dispatcher] listening on ${HOST}:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('[dispatcher] fatal bootstrap error:', err);
  process.exit(1);
});
