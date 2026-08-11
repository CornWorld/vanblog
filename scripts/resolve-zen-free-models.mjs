#!/usr/bin/env node
/**
 * resolve-zen-free-models.mjs
 *
 * Fetches the live OpenCode Zen free model catalog and outputs the recommended
 * free model ID for pi's default model config.
 *
 * Usage:
 *   node scripts/resolve-zen-free-models.mjs              # prints best model ID
 *   node scripts/resolve-zen-free-models.mjs --json        # prints full list as JSON
 *   node scripts/resolve-zen-free-models.mjs --list        # prints all free model IDs
 *
 * Model IDs rotate — never hardcode model names outside this script.
 *
 * Zen API: https://opencode.ai/zen/v1/models (OpenAI-compatible, no auth needed)
 */

const ZEN_MODELS_URL = "https://opencode.ai/zen/v1/models";

// Preferred free models for coding tasks (priority order).
// Models not in this list still work; they just sort later in the default pick.
const CODING_PRIORITY = new Set([
  "deepseek-v4-flash-free",
  "mimo-v2.5-free",
  "north-mini-code-free",
  "ling-3.0-tiny-free",
  "nemotron-3-ultra-free",
]);

async function fetchZenModels() {
  try {
    const res = await fetch(ZEN_MODELS_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    // OpenAI-compatible list: { object: "list", data: [...] }
    return body.data ?? [];
  } catch (err) {
    console.error("[zen-models] fetch failed:", err.message);
    return [];
  }
}

function isFreeModel(model) {
  // Free models have `-free` suffix, OR are the known `big-pickle` model.
  return typeof model.id === "string" && (
    model.id.endsWith("-free") || model.id === "big-pickle"
  );
}

function sortByCodingPriority(models) {
  return [...models].sort((a, b) => {
    const aPrio = CODING_PRIORITY.has(a.id) ? 0 : 1;
    const bPrio = CODING_PRIORITY.has(b.id) ? 0 : 1;
    return aPrio - bPrio;
  });
}

async function main() {
  const allModels = await fetchZenModels();
  const freeModels = allModels.filter(isFreeModel);
  const sorted = sortByCodingPriority(freeModels);

  if (sorted.length === 0) {
    console.error("[zen-models] no free models found — falling back to default");
    process.exit(0); // pi will use the placeholder from settings.json
  }

  const mode = process.argv[2];
  if (mode === "--json") {
    console.log(JSON.stringify(sorted, null, 2));
  } else if (mode === "--list") {
    sorted.forEach((m) => console.log(m.id));
  } else {
    // Default: print the recommended model ID for pi config
    // Use pi's provider/model format: opencode/zen/<model-id>
    console.log(`opencode/zen/${sorted[0].id}`);
  }
}

main().catch((err) => {
  console.error("[zen-models] unexpected error:", err.message);
  process.exit(0); // fail-open: pi uses the hardcoded fallback
});
