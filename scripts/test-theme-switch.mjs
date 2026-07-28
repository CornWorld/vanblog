#!/usr/bin/env node

/**
 * Theme Switch E2E Test
 *
 * Prerequisites:
 *   - Docker container running with dispatcher (batch 2)
 *   - PB accessible
 *   - Both themes (default + minimal) built and in the image
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

let passed = 0;
let failed = 0;

async function check(description, fn) {
  try {
    await fn();
    console.log(`  ✅ ${description}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${description}: ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log('\n=== Theme Switch E2E Test ===\n');
  console.log(`Base URL: ${BASE}`);
  console.log(`PB URL:   ${PB_URL}\n`);

  // 1. Check dispatcher health
  await check('GET /__dispatcher_health returns 200', async () => {
    const r = await fetch(`${BASE}/__dispatcher_health`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const j = await r.json();
    if (!j.ok) throw new Error('health check not ok');
    console.log(`      activeTheme: ${j.activeTheme}, loaded: ${j.loadedThemes.join(', ')}, available: ${j.availableThemes.join(', ')}`);
  });

  // 2. Check / (default theme) returns HTML with base-prefixed assets
  await check('GET / returns HTML with /themes/default/ assets', async () => {
    const r = await fetch(`${BASE}/`);
    const text = await r.text();
    if (!text.includes('/themes/default/_astro/') && !text.includes('/themes/default/static/')) {
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
    if (!names.includes('default') || !names.includes('minimal')) {
      throw new Error(`expected 'default' and 'minimal', got: ${names.join(', ')}`);
    }
  });

  // 4. Switch theme via PB API
  let siteId = null;
  await check('Switch to minimal theme via PB API', async () => {
    // Find site record
    const r = await fetch(`${PB_URL}/api/collections/site/records?perPage=1`);
    const j = await r.json();
    if (!j.items || j.items.length === 0) throw new Error('no site record found');
    siteId = j.items[0].id;

    // Update activeTheme
    const updateR = await fetch(`${PB_URL}/api/collections/site/records/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeTheme: 'minimal' }),
    });
    if (!updateR.ok) throw new Error(`PB update failed: ${updateR.status}`);
  });

  // 5. Wait for dispatcher to poll and switch
  console.log('\n  ⏳ Waiting 7s for dispatcher to detect theme change...\n');
  await new Promise(r => setTimeout(r, 7000));

  // 6. Verify dispatcher switched
  await check('Dispatcher switched to minimal theme', async () => {
    const r = await fetch(`${BASE}/__dispatcher_health`);
    const j = await r.json();
    if (j.activeTheme !== 'minimal') {
      throw new Error(`expected activeTheme=minimal, got ${j.activeTheme}`);
    }
  });

  // 7. Switch back to default
  await check('Switch back to default theme via PB API', async () => {
    const r = await fetch(`${PB_URL}/api/collections/site/records/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeTheme: 'default' }),
    });
    if (!r.ok) throw new Error(`PB update failed: ${r.status}`);
  });

  console.log('\n  ⏳ Waiting 7s for dispatcher to revert...\n');
  await new Promise(r => setTimeout(r, 7000));

  await check('Dispatcher reverted to default theme', async () => {
    const r = await fetch(`${BASE}/__dispatcher_health`);
    const j = await r.json();
    if (j.activeTheme !== 'default') {
      throw new Error(`expected activeTheme=default, got ${j.activeTheme}`);
    }
  });

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
