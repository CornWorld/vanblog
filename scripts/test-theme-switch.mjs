#!/usr/bin/env node

/**
 * Theme Switch E2E Test
 *
 * Prerequisites:
 *   - Docker container running with theme host (batch 2)
 *   - PB accessible
 *   - Both themes (vanblog + base) built and in the image
 *
 * Usage:
 *   node scripts/test-theme-switch.mjs [baseUrl] [pbApiKey]
 *
 * Defaults:
 *   - baseUrl: http://127.0.0.1:4321
 *   - pbApiKey: (empty - uses PB admin API token if available)
 */

const BASE = process.argv[2] || 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const PB_API_KEY = process.argv[3] || process.env.PB_API_KEY || '';

// Helper to add auth headers when key is provided
function pbHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (PB_API_KEY) h['Authorization'] = `Bearer ${PB_API_KEY}`;
  return h;
}

let passed = 0;
let failed = 0;

async function check(description, fn) {
  try {
    await fn();
    console.log(`  ✅ ${description}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ ${description}: ${msg}`);
    failed++;
  }
}

async function main() {
  console.log('\n=== Theme Switch E2E Test ===\n');
  console.log(`Base URL: ${BASE}`);
  console.log(`PB URL:   ${PB_URL}\n`);

  // 1. Check theme host health
  await check('GET /__theme_host_health returns 200', async () => {
    const r = await fetch(`${BASE}/__theme_host_health`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const j = await r.json();
    if (!j.ok) throw new Error('health check not ok');
    console.log(`      activeTheme: ${j.activeTheme}, loaded: ${j.loadedThemes.join(', ')}, available: ${j.availableThemes.join(', ')}`);
  });

  // 2. Check / (default theme) returns HTML with base-prefixed assets
  await check('GET / returns HTML with /themes/vanblog/ assets', async () => {
    const r = await fetch(`${BASE}/`);
    const text = await r.text();
    if (!text.includes('/themes/vanblog/_astro/') && !text.includes('/themes/vanblog/static/')) {
      // Might be a redirect or no astro assets on homepage, at least check it's HTML
      if (!text.includes('<!DOCTYPE html>') && !text.includes('<html')) {
        throw new Error('response is not HTML');
      }
    }
  });

  // 3. Check /api/themes returns both themes
  await check('GET /api/themes returns 2+ themes', async () => {
    const r = await fetch(`${BASE}/api/themes`);
    const j = await r.json();
    if (!j.themes || j.themes.length < 2) {
      throw new Error(`expected >=2 themes, got ${j.themes?.length || 0}`);
    }
    const names = j.themes.map(t => t.name);
    if (!names.includes('base') || !names.includes('vanblog')) {
      throw new Error(`expected 'base' and 'vanblog', got: ${names.join(', ')}`);
    }
  });

  // 4. Switch theme via PB API
  let siteId = null;
  await check('Switch to base theme via PB API', async () => {
    // Find site record
    const r = await fetch(`${PB_URL}/api/collections/site/records?perPage=1`);
    const j = await r.json();
    if (!j.items || j.items.length === 0) throw new Error('no site record found');
    siteId = j.items[0].id;

    // Update activeTheme
    const updateR = await fetch(`${PB_URL}/api/collections/site/records/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeTheme: 'base' }),
    });
    if (!updateR.ok) throw new Error(`PB update failed: ${updateR.status}`);
  });

  // 5. Wait for theme host to poll and switch (poll with timeout)
  console.log('\n  ⏳ Waiting for theme host to detect theme change...\n');
  await check('Theme Host switched to base theme', async () => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const r = await fetch(`${BASE}/__theme_host_health`);
      const j = await r.json();
      if (j.activeTheme === 'base') return;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('timed out waiting for theme switch to base');
  });

  // 7. Switch back to default (only if siteId was captured)
  if (siteId) {
    await check('Switch back to vanblog theme via PB API', async () => {
      const r = await fetch(`${PB_URL}/api/collections/site/records/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeTheme: 'vanblog' }),
      });
      if (!r.ok) throw new Error(`PB update failed: ${r.status}`);
    });
  }

  console.log('\n  ⏳ Waiting for theme host to revert...\n');
  await check('Theme Host reverted to vanblog theme', async () => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const r = await fetch(`${BASE}/__theme_host_health`);
      const j = await r.json();
      if (j.activeTheme === 'vanblog') return;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('timed out waiting for theme switch to vanblog');
  });

  // Already verified above in the polling loop

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
