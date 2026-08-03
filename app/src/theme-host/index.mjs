#!/usr/bin/env node

// ============================================================
// Theme Host — entrypoint.
//
// Wires the testable core (core.mjs) to the OS: HTTP server on
// 127.0.0.1:4321, graceful shutdown, global error guards, and the
// 5s PB polling loop that hot-swaps the active theme.
//
// Resolves the active render target (theme or admin control plane)
// and forwards dynamic requests to it. Static assets are served by
// Caddy file_server (vault/internal/caddy/static_routes.go).
// ============================================================

import { createServer } from 'node:http';
import { createThemeHost } from './core.mjs';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4321);
const POLL_INTERVAL_MS = Number(process.env.VANBLOG_THEME_POLL_MS || 5000);

const host = createThemeHost();

// ============================================================
// Graceful Shutdown
// ============================================================

/** @type {Set<Function>} */
const inFlightRequests = new Set();

const server = createServer(host.handleRequest);

// Track in-flight requests for graceful shutdown.
server.on('request', (_req, res) => {
  if (res.writableEnded) return;
  const done = () => {
    inFlightRequests.delete(done);
  };
  inFlightRequests.add(done);
  res.on('finish', done);
  res.on('close', done);
  res.on('error', done);
});

/**
 * @param {string} signal
 */
async function shutdown(signal) {
  console.log(`[theme-host] received ${signal}, shutting down gracefully...`);
  stopPolling();
  server.close(() => {
    console.log('[theme-host] server closed');
    process.exit(0);
  });
  // Wait for in-flight requests to complete (max 10s).
  const maxWait = 10000;
  const checkInterval = 200;
  let waited = 0;
  while (inFlightRequests.size > 0 && waited < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
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
// Global Error Handlers — never let one theme crash the host.
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
// PB Polling (hot theme switch)
// ============================================================

let pollTimer = null;

function startPolling() {
  console.log(`[theme-host] starting PB polling (every ${POLL_INTERVAL_MS}ms)`);
  pollTimer = setInterval(() => {
    host.pollSiteChanges().catch((err) => console.error('[theme-host] poll error:', err));
  }, POLL_INTERVAL_MS);
  pollTimer.unref();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ============================================================
// Bootstrap
// ============================================================

async function bootstrap() {
  const config = host.getConfig();
  const available = host.listAvailableThemes();
  console.log(`[theme-host] themes dir: ${config.themesDir}`);
  console.log(`[theme-host] available themes: ${available.length > 0 ? available.join(', ') : '(none)'}`);
  console.log(`[theme-host] default theme: ${config.defaultTheme}`);

  // Adopt PB's active theme when reachable, else fall back to the default.
  await host.bootstrapActiveTheme();

  startPolling();

  server.on('error', (err) => {
    console.error(`[theme-host] failed to listen on ${HOST}:${PORT}:`, err);
    process.exit(1);
  });
  server.listen(PORT, HOST, () => {
    console.log(`[theme-host] listening on ${HOST}:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[theme-host] fatal bootstrap error:', err);
  process.exit(1);
});
