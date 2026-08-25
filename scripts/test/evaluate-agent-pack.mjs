#!/usr/bin/env node
/**
 * evaluate-agent-pack.mjs
 *
 * Independent deterministic evaluator for pi-generated agent pack artifacts.
 *
 * Two-layer evaluation:
 *   Layer 1 (static) — file existence, JSON schema, content heuristics, PoW logic.
 *   Layer 2 (runtime) — Docker container with fresh PB, checks challenge/verify
 *                       endpoints, PoW solve, +/− samples, homepage injection.
 *
 * Usage:
 *   node scripts/test/evaluate-agent-pack.mjs \
 *     --artifact-dir <dir> \
 *     --image <tag> \
 *     --port <port> \
 *     --report-dir <dir> \
 *     [--timeout <sec>] \
 *     [--skip-docker] \
 *     [--verbose]
 *
 * The evaluator NEVER crashes on incomplete artifact data — it writes a
 * score.json report describing what was found (or not found) and exits 0.
 * Use --exit-code to get a non-zero exit when status != "passed".
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, readdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { join, basename, resolve } from "node:path";
import { execSync } from "node:child_process";

// ── Config defaults ──────────────────────────────────────────────────────
const DEFAULTS = {
  port: 0,          // 0 = ephemeral (auto-detect free port)
  timeout: 300,     // seconds for container readiness + PoW solve
  skipDocker: false,
  verbose: false,
  exitCode: false,
};

// ── CLI parsing ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--artifact-dir":  args.artifactDir = argv[++i]; break;
      case "--image":         args.image = argv[++i]; break;
      case "--port":          args.port = parseInt(argv[++i], 10) || 0; break;
      case "--report-dir":    args.reportDir = argv[++i]; break;
      case "--timeout":       args.timeout = parseInt(argv[++i], 10) || DEFAULTS.timeout; break;
      case "--skip-docker":   args.skipDocker = true; break;
      case "--verbose":       args.verbose = true; break;
      case "--exit-code":     args.exitCode = true; break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }
  if (!args.artifactDir) {
    console.error("--artifact-dir is required");
    process.exit(1);
  }
  args.artifactDir = resolve(args.artifactDir);
  args.reportDir = args.reportDir ? resolve(args.reportDir) : args.artifactDir;
  return args;
}

// ── Logging ──────────────────────────────────────────────────────────────
const LOG = {
  info: (msg) => console.log(`  [INFO] ${msg}`),
  ok:   (msg) => console.log(`  [OK]   ${msg}`),
  warn: (msg) => console.log(`  [WARN] ${msg}`),
  fail: (msg) => console.log(`  [FAIL] ${msg}`),
  verbose: (msg) => {}, // replaced by --verbose
};

// ── Helpers ──────────────────────────────────────────────────────────────

/** Find a free TCP port on localhost. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

/** Read a file if it exists, else return null. */
function tryRead(path) {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/** Parse JSON if valid, else return null. */
function tryParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Heuristic: check if text contains a keyword (case-insensitive). */
function mentions(text, keyword) {
  if (!text) return false;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/** Heuristic: check if text matches a regex pattern. */
function matches(text, pattern) {
  if (!text) return false;
  return pattern.test(text);
}

/** SHA-256 PoW solver: find nonce such that hash(challenge+nonce) starts with '0'*difficulty. */
function solvePoW(challenge, difficulty, maxAttempts = 500_000) {
  const prefix = "0".repeat(difficulty);
  for (let nonce = 0; nonce < maxAttempts; nonce++) {
    const hash = createHash("sha256").update(`${challenge}${nonce}`).digest("hex");
    if (hash.startsWith(prefix)) return nonce;
  }
  return null;
}

/** SHA-256 PoW verifier: returns true if hash(challenge+nonce) starts with '0'*difficulty. */
function verifyPoW(challenge, nonce, difficulty) {
  const hash = createHash("sha256").update(`${challenge}${nonce}`).digest("hex");
  return hash.startsWith("0".repeat(difficulty));
}

// ── Static checks ────────────────────────────────────────────────────────

async function runStaticChecks(artifactDir) {
  const passed = [];
  const failed = [];
  const skipped = [];

  const addResult = (check, ok, detail) => {
    const entry = detail ? `${check}: ${detail}` : check;
    if (ok) passed.push(entry);
    else failed.push(entry);
  };

  // 1. Artifact directory exists
  const artifactExists = existsSync(artifactDir);
  addResult("artifact-dir-exists", artifactExists, artifactExists ? artifactDir : "not found");
  if (!artifactExists) {
    // No point continuing — nothing to evaluate
    return { passed, failed, skipped, findings: { incomplete: true } };
  }

  // 2. Find pack directory
  let packDir = null;
  let packName = "";
  const entries = await readdir(artifactDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const pj = join(artifactDir, entry.name, "pack.json");
      if (existsSync(pj)) {
        packDir = join(artifactDir, entry.name);
        packName = entry.name;
        break;
      }
    }
  }
  addResult("pack-dir-found", packDir !== null, packDir ? `${packName}/` : "no directory with pack.json found");

  if (!packDir) {
    return { passed, failed, skipped, findings: { incomplete: true } };
  }

  // 3. pack.json exists and is valid JSON
  const packJsonRaw = tryRead(join(packDir, "pack.json"));
  const packJson = packJsonRaw ? tryParse(packJsonRaw) : null;
  addResult("pack-json-valid", !!packJson, packJson ? "valid JSON" : "missing or invalid JSON");

  if (packJson) {
    // 4. pack.json name matches
    const nameOk = packJson.name === packName || packJson.name === "pow-guard";
    addResult("pack-name-match", nameOk, packJson.name || "(missing)");

    // 5. version present and semver-like
    const versionOk = !!packJson.version && /^\d+\.\d+\.\d+/.test(packJson.version);
    addResult("pack-version-valid", versionOk, packJson.version || "(missing)");

    // 6. frontend scope is "public"
    const frontend = packJson.frontend || {};
    const scopePublic = frontend.scope === "public";
    addResult("frontend-scope-public", scopePublic, frontend.scope || "(missing)");

    // 7. frontend scripts includes pow-guard.js
    const scripts = frontend.scripts || [];
    const hasScript = scripts.includes("pow-guard.js");
    addResult("frontend-script-pow-guard-js", hasScript, hasScript ? "pow-guard.js in scripts" : "pow-guard.js not found in scripts");
  }

  // 8. hooks/pow-guard.pb.js exists
  const hookFile = findFileRecursive(packDir, "hooks", ".pb.js");
  addResult("hook-file-exists", !!hookFile, hookFile ? basename(hookFile) : "no .pb.js found in hooks/");

  // 9. frontend/pow-guard.js exists
  const frontendFile = findFileInDir(packDir, "frontend", "pow-guard.js");
  addResult("frontend-file-exists", !!frontendFile, frontendFile ? "frontend/pow-guard.js" : "not found");

  // Content heuristics
  if (hookFile) {
    const hookContent = tryRead(hookFile) || "";
    const hasChallengeRoute = matches(hookContent, /\/api\/vanblog\/pow-guard\/challenge/);
    const hasVerifyRoute = matches(hookContent, /\/api\/vanblog\/pow-guard\/verify/);
    const hasCryptoRef = mentions(hashContent(hookContent, "sha256"), "sha256") ||
                          matches(hookContent, /sha256|sha-256|sha ?256/i);
    const hasLeadingZeroRef = matches(hookContent, /startsWith|leading.*zero|substring|slice.*0,.*difficulty|repeat.*0/i);

    addResult("hook-has-challenge-route", hasChallengeRoute, hasChallengeRoute ? "found" : "missing /api/vanblog/pow-guard/challenge");
    addResult("hook-has-verify-route", hasVerifyRoute, hasVerifyRoute ? "found" : "missing /api/vanblog/pow-guard/verify");
    addResult("hook-has-crypto-ref", hasCryptoRef, hasCryptoRef ? "mentions sha256" : "no SHA-256 reference found");
    addResult("hook-has-pow-validation", hasLeadingZeroRef, hasLeadingZeroRef ? "has leading-zero check" : "no leading-zero validation found");
  } else {
    skipped.push("hook-content-checks: no hook file");
  }

  if (frontendFile) {
    const frontendContent = tryRead(frontendFile) || "";
    const hasLocalStorage = mentions(frontendContent, "localStorage");
    const hasOverlay = mentions(frontendContent, "overlay") ||
                       matches(frontendContent, /full.?screen|blocker|cover/i);
    const hasCacheDuration = mentions(frontendContent, "hour") ||
                             matches(frontendContent, /3600|60\s*\*\s*60|expir/i);

    addResult("frontend-uses-localStorage", hasLocalStorage, hasLocalStorage ? "found localStorage" : "no localStorage reference");
    addResult("frontend-has-overlay", hasOverlay, hasOverlay ? "overlay UI found" : "no overlay/fullscreen reference");
    addResult("frontend-has-cache-duration", hasCacheDuration, hasCacheDuration ? "cache duration found" : "no 1-hour / 3600 cache duration");
  } else {
    skipped.push("frontend-content-checks: no frontend file");
  }

  return { passed, failed, skipped, findings: { packName, packDir, packJson } };
}

/** Find a file by extension in a subdirectory (recursive). */
function findFileRecursive(baseDir, subDir, suffix) {
  const dir = join(baseDir, subDir);
  if (!existsSync(dir)) return null;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(suffix)) {
        return join(dir, entry.name);
      }
    }
  } catch { /* ignore */ }
  return null;
}

/** Find a specific file in a subdirectory. */
function findFileInDir(baseDir, subDir, fileName) {
  const filePath = join(baseDir, subDir, fileName);
  return existsSync(filePath) ? filePath : null;
}

/** Compute a hash from text for heuristic matching. */
function hashContent(text, algo) {
  // This is a simplified heuristic: just return the text lowercased
  // The actual check uses text.toLowerCase() already
  return text.toLowerCase();
}

// ── Runtime checks (Docker) ─────────────────────────────────────────────

async function runRuntimeChecks(artifactDir, image, port, timeout, verbose) {
  const passed = [];
  const failed = [];
  const blocked = [];
  const details = {};

  // Check Docker availability
  try {
    execSync("docker info", { stdio: "ignore", timeout: 10000 });
  } catch {
    blocked.push({ check: "docker-available", reason: "Docker daemon not reachable" });
    return { passed, failed, blocked, details };
  }

  // Check image exists
  try {
    execSync(`docker image inspect "${image}"`, { stdio: "ignore", timeout: 10000 });
  } catch {
    blocked.push({ check: "image-exists", reason: `Image "${image}" not found` });
    return { passed, failed, blocked, details };
  }

  // Find the pack directory inside artifactDir
  let packDir = null;
  let packName = "";
  try {
    const entries = await readdir(artifactDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pj = join(artifactDir, entry.name, "pack.json");
        if (existsSync(pj)) {
          packDir = join(artifactDir, entry.name);
          packName = entry.name;
          break;
        }
      }
    }
  } catch { /* ignore */ }

  if (!packDir) {
    blocked.push({ check: "pack-dir", reason: "No pack directory with pack.json found in artifact" });
    return { passed, failed, blocked, details };
  }

  // Determine port
  const hostPort = port || await findFreePort();

  // Start a temporary container with the artifact mounted
  const containerName = `vanblog-eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const evalUserPacks = `/tmp/vanblog-eval-packs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const containerUserPacks = "/workspace/user-packs";

  LOG.info(`Starting eval container: ${containerName}`);
  LOG.info(`  Mounting ${packDir} → ${containerUserPacks}/${packName}`);

  try {
    // Prepare the eval packs dir: create the pack structure
    mkdirSync(evalUserPacks, { recursive: true });
    const targetPackDir = join(evalUserPacks, packName);
    // Copy the artifact pack to the eval dir
    cpSync(packDir, targetPackDir, { recursive: true });

    // Start container
    const runArgs = [
      "run", "-d",
      "--name", containerName,
      "-p", `${hostPort}:80`,
      "-e", "VANBLOG_HTTP_ONLY=1",
      "-e", `VANBLOG_PACKS_DIR=${containerUserPacks}`,
      "-v", `${evalUserPacks}:${containerUserPacks}`,
      image,
    ];

    execSync(`docker ${runArgs.join(" ")}`, { stdio: verbose ? "inherit" : "ignore", timeout: 60000 });
    LOG.ok(`Container started on port ${hostPort}`);

    // Wait for health
    const healthUrl = `http://127.0.0.1:${hostPort}/api/health`;
    const deadline = Date.now() + timeout * 1000;
    let healthy = false;

    while (Date.now() < deadline) {
      try {
        const resp = await fetch(healthUrl);
        if (resp.ok) {
          healthy = true;
          break;
        }
      } catch { /* container not ready yet */ }
      await sleep(2000);
    }

    if (!healthy) {
      blocked.push({ check: "container-healthy", reason: "PB did not become healthy within timeout" });
      // Capture container logs
      details.containerLog = await captureContainerLog(containerName);
      // Cleanup
      stopContainer(containerName, evalUserPacks);
      return { passed, failed, blocked, details };
    }

    LOG.ok("PocketBase healthy");

    // Check challenge endpoint
    const baseUrl = `http://127.0.0.1:${hostPort}`;
    const challengeUrl = `${baseUrl}/api/vanblog/pow-guard/challenge`;

    let challengeData = null;
    try {
      const challengeResp = await fetch(challengeUrl);
      const challengeRespStatus = challengeResp.status;
      if (challengeResp.ok) {
        challengeData = await challengeResp.json();
        const hasChallenge = challengeData && typeof challengeData.challenge === "string" && challengeData.challenge.length > 0;
        const hasDifficulty = challengeData && typeof challengeData.difficulty === "number" && challengeData.difficulty > 0;

        passed.push("challenge-returns-200");
        if (hasChallenge) passed.push("challenge-has-nonce");
        else failed.push("challenge-has-nonce: missing or empty challenge string");
        if (hasDifficulty) passed.push("challenge-has-difficulty");
        else failed.push("challenge-has-difficulty: missing or non-positive difficulty");

        details.challenge = { status: challengeRespStatus, data: challengeData };
        LOG.ok(`Challenge endpoint returned difficulty=${challengeData?.difficulty}`);
      } else {
        failed.push(`challenge-returns-200: got ${challengeRespStatus}`);
        details.challenge = { status: challengeRespStatus };
      }
    } catch (err) {
      failed.push(`challenge-endpoint: ${err.message}`);
      details.challenge = { error: err.message };
    }

    // If challenge data available, test PoW
    if (challengeData && challengeData.challenge && challengeData.difficulty > 0) {
      const challenge = challengeData.challenge;
      const difficulty = challengeData.difficulty;

      // Solve PoW
      LOG.info(`Solving PoW difficulty=${difficulty}...`);
      const nonce = solvePoW(challenge, difficulty, 500_000);

      if (nonce !== null) {
        LOG.ok(`PoW solved: nonce=${nonce}`);
        passed.push("pow-solved");

        // Verify positive sample
        const verifyUrl = `${baseUrl}/api/vanblog/pow-guard/verify`;
        try {
          const verifyResp = await fetch(verifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ challenge, nonce, difficulty }),
          });
          const verifyStatus = verifyResp.status;
          let verifyData = null;
          try { verifyData = await verifyResp.json(); } catch { /* ignore */ }

          const hasToken = verifyData && typeof verifyData.token === "string" && verifyData.token.length > 0;
          const hasExpiry = verifyData && typeof verifyData.expiresAt === "number" && verifyData.expiresAt > 0;

          if (verifyResp.ok && hasToken) {
            passed.push("verify-positive: valid token returned");
            LOG.ok("Verify positive: token received");
          } else {
            failed.push(`verify-positive: ${verifyStatus} ${hasToken ? "missing token" : ""}`);
          }

          details.verifyPositive = {
            status: verifyStatus,
            hasToken,
            hasExpiry,
            nonce,
          };
        } catch (err) {
          failed.push(`verify-positive: ${err.message}`);
          details.verifyPositive = { error: err.message };
        }

        // Verify negative sample (wrong nonce)
        const wrongNonce = nonce + 1; // Definitely wrong
        try {
          const negResp = await fetch(verifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ challenge, nonce: wrongNonce, difficulty }),
          });
          const negStatus = negResp.status;
          let negData = null;
          try { negData = await negResp.json(); } catch { /* ignore */ }

          const negHasToken = negData && typeof negData.token === "string" && negData.token.length > 0;

          // Expectation: either 4xx OR no token in the response
          const rejected = !negResp.ok || !negHasToken;
          if (rejected) {
            passed.push("verify-negative: wrong nonce rejected");
            LOG.ok("Verify negative: wrong nonce correctly rejected");
          } else {
            failed.push("verify-negative: wrong nonce unexpectedly accepted (got token)");
          }

          details.verifyNegative = {
            status: negStatus,
            rejected,
            hasToken: negHasToken,
            wrongNonce,
          };
        } catch (err) {
          failed.push(`verify-negative: ${err.message}`);
          details.verifyNegative = { error: err.message };
        }
      } else {
        failed.push("pow-solve: could not find nonce within 500K attempts");
        details.powSolve = { solved: false, difficulty, maxAttempts: 500_000 };
      }
    } else {
      failed.push("pow-solve: challenge data unavailable");
    }

    // Check homepage injection
    try {
      const homeResp = await fetch(baseUrl);
      const homeHtml = await homeResp.text();
      const hasScriptTag = homeHtml.includes("pow-guard.js");
      const hasScriptSrc = matches(homeHtml, /<script[^>]*src=["'][^"']*pow-guard\.js["'][^>]*>/i);

      if (hasScriptTag || hasScriptSrc) {
        passed.push("homepage-injection: pow-guard.js script tag found");
        LOG.ok("Homepage injection confirmed");
      } else {
        failed.push("homepage-injection: pow-guard.js not found in page HTML");
      }

      details.injection = { hasScriptTag, hasScriptSrc };
    } catch (err) {
      failed.push(`homepage-injection: ${err.message}`);
      details.injection = { error: err.message };
    }

    // Check frontend asset served
    if (packName) {
      const scriptUrl = `${baseUrl}/static/packs/${packName}/pow-guard.js`;
      try {
        const assetResp = await fetch(scriptUrl);
        if (assetResp.ok) {
          passed.push("frontend-asset-served: pow-guard.js returns 200");
          LOG.ok("Frontend asset served");
        } else {
          failed.push(`frontend-asset-served: got ${assetResp.status}`);
        }
        details.frontendAsset = { status: assetResp.status };
      } catch (err) {
        failed.push(`frontend-asset-served: ${err.message}`);
        details.frontendAsset = { error: err.message };
      }
    }

    // Capture container logs
    details.containerLog = await captureContainerLog(containerName);

  } finally {
    // Cleanup: stop container and remove temp dir
    stopContainer(containerName, evalUserPacks);
  }

  return { passed, failed, blocked, details };
}

/** Stop and remove a container, and clean up temp dir. */
function stopContainer(containerName, tempDir) {
  try {
    execSync(`docker rm -f "${containerName}" 2>/dev/null || true`, { stdio: "ignore" });
  } catch { /* ignore */ }
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

/** Capture docker logs for a container. */
async function captureContainerLog(containerName) {
  try {
    return execSync(`docker logs "${containerName}" 2>&1`, { encoding: "utf-8", maxBuffer: 1024 * 1024 }).slice(0, 50_000);
  } catch {
    return "(log capture failed)";
  }
}

/** Promise-based sleep. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Minimal fetch polyfill (Node 18+ has global fetch, fallback for older). */
async function fetch(url, options = {}) {
  const { request } = await import("node:http");
  const { request: httpsRequest } = await import("node:https");

  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https:");
    const req = (isHttps ? httpsRequest : request)(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: 15000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async () => body,
          json: async () => JSON.parse(body),
        });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("request timeout")); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ── Report generation ────────────────────────────────────────────────────

function generateReport(args, staticChecks, runtimeChecks) {
  const totalStatic = staticChecks.passed.length + staticChecks.failed.length + staticChecks.skipped.length;
  const totalRuntime = runtimeChecks.passed.length + runtimeChecks.failed.length + runtimeChecks.blocked.length;
  const total = totalStatic + totalRuntime;
  const passed = staticChecks.passed.length + runtimeChecks.passed.length;
  const failed = staticChecks.failed.length + runtimeChecks.failed.length;
  const skipped = staticChecks.skipped.length + runtimeChecks.blocked.length;

  // Determine status
  let status = "passed";
  if (staticChecks.findings?.incomplete) {
    status = "incomplete";
  } else if (runtimeChecks.blocked.length > 0 && runtimeChecks.failed.length === 0) {
    status = "blocked";
  } else if (failed > 0) {
    status = "failed";
  }

  const score = {
    total,
    passed,
    failed,
    skipped,
    pct: total > 0 ? Math.round((passed / total) * 10000) / 100 : 0,
  };

  return {
    schemaVersion: 1,
    runId: args.runId || basename(args.artifactDir),
    evaluatedAt: new Date().toISOString(),
    image: args.image || "(not provided)",
    status,
    static: {
      passed: staticChecks.passed,
      failed: staticChecks.failed,
      skipped: staticChecks.skipped,
    },
    runtime: {
      passed: runtimeChecks.passed,
      failed: runtimeChecks.failed,
      blocked: runtimeChecks.blocked,
    },
    score,
    summary: status === "passed"
      ? `All ${total} checks passed (${score.pct}%)`
      : status === "incomplete"
        ? "Artifact incomplete — no pack directory found"
        : status === "blocked"
          ? `Static checks passed (${staticChecks.passed.length}), runtime blocked (${runtimeChecks.blocked.map(b => b.reason).join("; ")})`
          : `${passed}/${total} checks passed (${score.pct}%) — ${failed} failed`,
    details: runtimeChecks.details || {},
  };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  if (args.verbose) LOG.verbose = (msg) => console.log(`  [VERB] ${msg}`);

  const runId = basename(args.artifactDir);
  args.runId = runId;

  LOG.info(`Evaluator: artifact-dir=${args.artifactDir} image=${args.image || "(none)"} report-dir=${args.reportDir}`);

  // ── Static checks (always run) ──────────────────────────────────
  LOG.info("Running static checks...");
  const staticChecks = await runStaticChecks(args.artifactDir);
  LOG.ok(`Static: ${staticChecks.passed.length} passed, ${staticChecks.failed.length} failed, ${staticChecks.skipped.length} skipped`);

  // ── Runtime checks (Docker, optional) ───────────────────────────
  let runtimeChecks = { passed: [], failed: [], blocked: [], details: {} };
  if (!args.skipDocker && staticChecks.passed.length > 0 && !staticChecks.findings?.incomplete) {
    LOG.info("Running runtime checks (Docker)...");
    runtimeChecks = await runRuntimeChecks(
      args.artifactDir,
      args.image,
      args.port,
      args.timeout,
      args.verbose
    );
    LOG.ok(`Runtime: ${runtimeChecks.passed.length} passed, ${runtimeChecks.failed.length} failed, ${runtimeChecks.blocked.length} blocked`);
  } else if (args.skipDocker) {
    LOG.info("Runtime checks skipped (--skip-docker)");
  } else {
    LOG.info("Runtime checks skipped (static checks insufficient for runtime)");
  }

  // ── Generate report ─────────────────────────────────────────────
  const report = generateReport(args, staticChecks, runtimeChecks);

  // Write report
  mkdirSync(args.reportDir, { recursive: true });
  const reportPath = join(args.reportDir, "score.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  LOG.ok(`Report written: ${reportPath}`);

  // Print summary
  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Evaluator status: ${report.status}`);
  console.log(`  Score: ${report.score.passed}/${report.score.total} (${report.score.pct}%)`);
  console.log(`  ${report.summary}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log("");

  // Exit code
  if (args.exitCode && report.status !== "passed") {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Evaluator internal error: ${err.message}`);
  // Write a minimal error report
  const report = {
    schemaVersion: 1,
    evaluatedAt: new Date().toISOString(),
    status: "error",
    error: err.message,
    score: { total: 0, passed: 0, failed: 0, skipped: 0, pct: 0 },
    summary: `Internal error: ${err.message}`,
  };
  try {
    const args = parseArgs(process.argv);
    const reportDir = args.reportDir || args.artifactDir || ".";
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(join(reportDir, "score.json"), JSON.stringify(report, null, 2), "utf-8");
    console.error(`Error report written to ${join(reportDir, "score.json")}`);
  } catch { /* cannot even write error report */ }
  process.exit(1);
});