#!/usr/bin/env node
/**
 * init-pi-config.mjs
 *
 * Runs at container startup to:
 * 1. Resolve the current best OpenCode Zen free model
 * 2. Update .pi/settings.json with the resolved model
 * 3. Create pi global trust configuration (auto-trust project in dev container)
 *
 * Called from docker/entrypoint.dev.sh after agent.env is written.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const WORKSPACE = "/workspace";
const PI_SETTINGS = join(WORKSPACE, ".pi", "settings.json");
const PI_GLOBAL_DIR = join(homedir(), ".pi", "agent");
const PI_TRUST = join(PI_GLOBAL_DIR, "trust.json");
const PI_GLOBAL_SETTINGS = join(PI_GLOBAL_DIR, "settings.json");

const RESOLVE_SCRIPT = join(WORKSPACE, "scripts", "runtime", "resolve-zen-free-models.mjs");

// Step 1: Resolve the current free model
console.log("[pi-init] resolving OpenCode Zen free models...");
let resolvedModel;
try {
  const result = execSync(`node "${RESOLVE_SCRIPT}"`, {
    encoding: "utf-8",
    timeout: 15000,
    cwd: WORKSPACE,
  });
  resolvedModel = result.trim();
} catch (err) {
  console.warn("[pi-init] model resolution failed, using fallback:", err.message);
  resolvedModel = "opencode/zen/deepseek-v4-flash-free";
}

if (!resolvedModel) {
  console.warn("[pi-init] no model resolved, using fallback");
  resolvedModel = "zen/deepseek-v4-flash-free";
}
console.log(`[pi-init] resolved model: ${resolvedModel}`);

// Step 2: Update .pi/settings.json
try {
  const settings = JSON.parse(readFileSync(PI_SETTINGS, "utf-8"));
  settings.model = resolvedModel;
  settings.defaultModel = resolvedModel;
  writeFileSync(PI_SETTINGS, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  console.log(`[pi-init] updated ${PI_SETTINGS}`);
} catch (err) {
  console.warn("[pi-init] failed to update pi settings:", err.message);
}

// Step 2.5: Write pi models.json with Zen as OpenAI-compatible custom provider.
// Zero-config: no login, no API key — just baseUrl + dummy apiKey.
const PI_MODELS = join(PI_GLOBAL_DIR, "models.json");
const modelId = resolvedModel.replace(/^opencode\/zen\//, "").replace(/^zen\//, "");
try {
  mkdirSync(PI_GLOBAL_DIR, { recursive: true }); // ensure dir exists before writing models.json
  const modelsConfig = {
    providers: {
      zen: {
        api: "openai-completions",
        baseUrl: "http://127.0.0.1:4330/zen/v1",
        apiKey: "sk-noop",
        models: [{ id: modelId }]
      }
    }
  };
  writeFileSync(PI_MODELS, JSON.stringify(modelsConfig, null, 2) + "\n", "utf-8");
  console.log(`[pi-init] models.json written: ${PI_MODELS} (model=${modelId})`);
} catch (err) {
  console.warn("[pi-init] failed to write models.json:", err.message);
}

// Step 3: Create global pi trust config
try {
  mkdirSync(PI_GLOBAL_DIR, { recursive: true });

  const trust = existsSync(PI_TRUST)
    ? JSON.parse(readFileSync(PI_TRUST, "utf-8"))
    : {};
  // Trust /workspace and its children (pi expects boolean, not string)
  trust[WORKSPACE] = true;
  trust["/workspace/"] = true;
  writeFileSync(PI_TRUST, JSON.stringify(trust, null, 2) + "\n", "utf-8");
  console.log(`[pi-init] trust written: ${PI_TRUST}`);
} catch (err) {
  console.warn("[pi-init] failed to write trust config:", err.message);
}

// Step 4: Create global pi settings (if not exists) with sane defaults
if (!existsSync(PI_GLOBAL_SETTINGS)) {
  try {
    const globalSettings = {
      defaultProjectTrust: "always",
      enableInstallTelemetry: false,
      enableUpdateCheck: false,
    };
    writeFileSync(PI_GLOBAL_SETTINGS, JSON.stringify(globalSettings, null, 2) + "\n", "utf-8");
    console.log(`[pi-init] global settings written: ${PI_GLOBAL_SETTINGS}`);
  } catch (err) {
    console.warn("[pi-init] failed to write global settings:", err.message);
  }
}

console.log("[pi-init] done.");
