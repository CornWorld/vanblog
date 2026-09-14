#!/usr/bin/env node
/**
 * vendor-sync — themes/vanblog 上游血缘台账的机器校验/同步/审计工具。
 *
 * 单一事实源: themes/vanblog/src/vendor/upstream.manifest.json
 * vendor 文件头的 `UPSTREAM:` 行是 manifest 的冗余视图(sync-headers 再生成)。
 *
 * 子命令:
 *   check                    校验 manifest↔磁盘↔文件头 一致 + 上游覆盖率 + 改写规则引用
 *   affected <from>..<to>    上游 sha 区间 → 受影响本地文件按同步策略分组
 *                            (可用 `--simulate <path>` 代替真实区间做演练)
 *   sync-headers             依 manifest 再生成全部 vendor 文件头 UPSTREAM 行(规范形态)
 *   metrics [--json]         审计指标: 上游覆盖占比/保真度/偏离密度/漂移敞口
 *
 * 零依赖。exit 0 = 干净;1 = 有错误。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(new URL("..", import.meta.url).pathname, "..");
const THEME = path.join(REPO, "themes", "vanblog");
const MANIFEST = path.join(THEME, "src", "vendor", "upstream.manifest.json");
const VENDOR_DIRS = ["src/vendor", "src/styles/vendor"];
const HEADER_ALLOW = new Set(["README.md"]);
const UP_EXT = new Set([".ts", ".tsx", ".css"]);
const UP_SCOPES = ["components", "utils", "styles", "api", "types", "pages", "public"];
const SCOPE_VENDORABLE = ["components", "utils", "styles", "api", "types"];
const DERIVATIONS = ["verbatim", "mechanical", "merged", "contract", "fork", "platform"];

const die = (msg) => { console.error(msg); process.exit(1); };
const rel = (p) => path.relative(REPO, p);
const readLines = (p) => fs.readFileSync(p, "utf8").split("\n");
const loc = (p) => { try { return readLines(p).length; } catch { return 0; } };

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) die(`manifest 不存在: ${rel(MANIFEST)}`);
  let m;
  try { m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); }
  catch (e) { die(`manifest JSON 解析失败: ${e.message}`); }
  if (!Array.isArray(m.files) || !Array.isArray(m.skipped)) die("manifest 缺 files/skipped 数组");
  if (!m.upstream?.pinned || !m.upstream?.root) die("manifest 缺 upstream.pinned/root");
  return m;
}

const shaOf = (m, src) => src.sha || m.upstream.pinned;
const canonicalUpstreamLines = (m, entry) => {
  if (entry.upstream?.length) {
    return entry.upstream.map(
      (s, i) => `${i === 0 ? "/*" : " *"} UPSTREAM: ${m.upstream.root}/${s.path}@${shaOf(m, s)}`);
  }
  const ph = entry.derivation === "platform"
    ? "(平台文件,无上游对应)"
    : "(seam 文件,无上游对应;契约即本文件导出类型)";
  return [`/* UPSTREAM: ${ph}`];
};

/** 头注释块内 UPSTREAM 区间: [首个含 UPSTREAM: 的行, 首个 SEAM: 行或块尾) */
function headerRegion(lines) {
  const end = lines.findIndex((l) => /^\s*\*?\s*(SEAM:|\*\/)/.test(l));
  const start = lines.findIndex((l) => l.includes("UPSTREAM:"));
  return { start, end: end === -1 ? lines.length : end, hasUpstream: start !== -1 };
}

function git(worktree, args) {
  return execFileSync("git", ["-C", worktree, ...args], { encoding: "utf8" }).trim();
}

// ---------- check ----------
function policyOf(entry) {
  const hasPatches = (entry.patches?.length ?? 0) > 0;
  if (entry.derivation === "platform") return "none";
  if (entry.derivation === "fork" || entry.derivation === "contract") {
    return entry.upstream?.length ? "manual" : "none";
  }
  if (hasPatches) return "manual";
  if ((entry.rewrites?.length ?? 0) > 0 || entry.derivation === "merged") return "replay";
  return "direct";
}

function cmdCheck(m) {
  const errors = [];
  const warn = [];
  const byLocal = new Map();

  for (const e of m.files) {
    if (!DERIVATIONS.includes(e.derivation)) errors.push(`${e.local}: 非法 derivation "${e.derivation}"`);
    if (byLocal.has(e.local)) errors.push(`${e.local}: 重复条目`);
    byLocal.set(e.local, e);
    const abs = path.join(THEME, e.local);
    if (!fs.existsSync(abs)) errors.push(`${e.local}: 文件不存在`);
    for (const r of e.rewrites ?? [])
      if (!m.rewrites?.[r]) errors.push(`${e.local}: rewrites 引用未注册规则 "${r}"`);
  }

  // 磁盘↔manifest 一一对应
  const onDisk = [];
  for (const dir of VENDOR_DIRS) {
    const root = path.join(THEME, dir);
    if (!fs.existsSync(root)) continue;
    for (const f of fs.readdirSync(root, { recursive: true })) {
      const relPath = path.join(dir, f).replaceAll(path.sep, "/");
      if (!fs.statSync(path.join(THEME, relPath)).isFile()) continue;
      if (HEADER_ALLOW.has(path.basename(relPath))) continue;
      if (relPath.endsWith("upstream.manifest.json")) continue;
      onDisk.push(relPath);
    }
  }
  for (const f of onDisk) if (!byLocal.has(f)) errors.push(`磁盘文件无台账条目(孤儿): ${f}`);
  for (const e of m.files) if (!onDisk.includes(e.local)) warn.push(`台账条目不在磁盘(空条目?): ${e.local}`);

  // 上游覆盖率
  const worktree = path.join(REPO, m.upstream.worktree);
  const covered = new Set();
  for (const e of m.files) for (const s of e.upstream ?? []) covered.add(s.path);
  const skippedSet = new Set();
  for (const s of m.skipped) {
    if (skippedSet.has(s.path)) errors.push(`skipped 重复: ${s.path}`);
    skippedSet.add(s.path);
    if (!s.reason) errors.push(`skipped ${s.path}: 缺 reason`);
  }
  const upstreamFiles = [];
  for (const scope of UP_SCOPES) {
    const root = path.join(worktree, m.upstream.root, scope);
    if (!fs.existsSync(root)) continue;
    for (const f of fs.readdirSync(root, { recursive: true })) {
      if (!UP_EXT.has(path.extname(f))) continue;
      const p = `${scope}/${f.replaceAll(path.sep, "/")}`;
      if (p.includes("__tests__") || /\.d\.ts$/.test(p) || /\.spec\./.test(p)) continue;
      upstreamFiles.push(p);
    }
  }
  for (const p of upstreamFiles) {
    if (covered.has(p) || skippedSet.has(p)) continue;
    errors.push(`上游文件未入账(present/skipped 二选一): ${p}`);
  }
  for (const p of skippedSet)
    if (!fs.existsSync(path.join(worktree, m.upstream.root, p)))
      errors.push(`skipped 指向不存在的上游文件: ${p}`);

  // 文件头 UPSTREAM 视图 ↔ manifest
  for (const e of m.files) {
    const abs = path.join(THEME, e.local);
    if (!fs.existsSync(abs)) continue;
    const lines = readLines(abs);
    const { start, end, hasUpstream } = headerRegion(lines);
    const expect = canonicalUpstreamLines(m, e);
    const found = hasUpstream ? lines.slice(start, end) : [];
    const norm = (a) => a.map((l) => l.replace(/^\/\*\s*|^ \s*/, "").replace(/\s+$/, ""));
    if (JSON.stringify(norm(found)) !== JSON.stringify(norm(expect)))
      errors.push(`${e.local}: 文件头 UPSTREAM 视图与 manifest 不一致\n  期望: ${JSON.stringify(norm(expect))}\n  实际: ${JSON.stringify(norm(found))}`);
  }

  // 行内 SEAM 锚点(前瞻校验: 有则必须引用已声明 id)
  for (const e of m.files) {
    const abs = path.join(THEME, e.local);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    const declared = new Set([...(e.rewrites ?? []), ...(e.patches ?? []).map((p) => p.id)]);
    for (const match of text.matchAll(/SEAM(?:-LOCAL)?\(([A-Za-z0-9_-]+)\)/g))
      if (!declared.has(match[1]))
        errors.push(`${e.local}: 行内锚点 "${match[1]}" 未在 manifest 声明`);
  }

  for (const w of warn) console.log(`  warn: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`  FAIL: ${e}`);
    die(`check: ${errors.length} 个错误`);
  }
  console.log(`check: 干净 — ${m.files.length} 条目 / ${onDisk.length} 磁盘文件 / 上游 ${upstreamFiles.length} 文件全覆盖(skipped ${m.skipped.length})`);
}

// ---------- affected ----------
function cmdAffected(m, range, simulate) {
  const worktree = path.join(REPO, m.upstream.worktree);
  let changed;
  if (simulate) {
    changed = simulate.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    if (!range || !range.includes("..")) die("用法: vendor-sync affected <from>..<to> | --simulate a,b,c");
    for (const ref of range.split("..")) {
      try { git(worktree, ["rev-parse", "--verify", "--quiet", ref + "^{commit}"]); }
      catch { die(`上游引用不存在: ${ref}`); }
    }
    changed = git(worktree, ["diff", "--name-only", range, "--", m.upstream.root])
      .split("\n").filter(Boolean)
      .map((p) => p.replace(new RegExp(`^${m.upstream.root}/`), ""));
  }

  const groups = { direct: [], replay: [], manual: [], none: [] };
  const skippedHit = [], untriaged = [];
  for (const p of changed) {
    const hits = m.files.filter((e) => (e.upstream ?? []).some((s) => s.path === p));
    if (hits.length) {
      for (const e of hits) groups[policyOf(e)].push({ path: p, local: e.local, rewrites: e.rewrites ?? [], patches: (e.patches ?? []).map((x) => x.id) });
      continue;
    }
    const skip = m.skipped.find((s) => s.path === p);
    if (skip) { skippedHit.push(skip); continue; }
    untriaged.push(p);
  }

  const label = { direct: "direct  (可盲 apply)", replay: "replay  (patch+重放登记改写)", manual: "manual  (人工评审,勿盲 apply)", none: "none    (不涉及)" };
  let n = 0;
  for (const g of ["direct", "replay", "manual", "none"]) {
    if (!groups[g].length) continue;
    console.log(`\n[${label[g]}]`);
    for (const h of groups[g]) {
      n++;
      console.log(`  ${h.path}  →  ${h.local}`);
      if (h.rewrites.length) console.log(`    rewrites: ${h.rewrites.join(", ")}`);
      if (h.patches.length) console.log(`    patches(勿冲掉): ${h.patches.join(", ")}`);
    }
  }
  if (skippedHit.length) {
    console.log(`\n[skipped-hit  上游改了未 vendor 文件 — 复核缺席理由是否仍成立]`);
    for (const s of skippedHit) { n++; console.log(`  ${s.path}\n    理由: ${s.reason}`); }
  }
  if (untriaged.length) {
    console.error(`\n[UNTRIAGED  上游新文件/未入账 — 需人工分诊后补 manifest]`);
    for (const p of untriaged) console.error(`  ${p}`);
  }
  console.log(`\naffected: 变更 ${changed.length} 个上游文件;受管 ${n},未分诊 ${untriaged.length}`);
  if (untriaged.length) process.exit(1);
}

// ---------- sync-headers ----------
function cmdSyncHeaders(m) {
  let changed = 0;
  for (const e of m.files) {
    const abs = path.join(THEME, e.local);
    if (!fs.existsSync(abs)) { console.error(`  skip(不存在): ${e.local}`); continue; }
    const lines = readLines(abs);
    if (!lines[0]?.startsWith("/*")) { console.error(`  skip(无头注释): ${e.local}`); continue; }
    const { start, end, hasUpstream } = headerRegion(lines);
    const gen = canonicalUpstreamLines(m, e);
    let next;
    if (hasUpstream) {
      const stop = Math.max(end, start + 1);
      next = [...lines.slice(0, start), ...gen, ...lines.slice(stop)];
    } else if (lines[0] === "/*") {
      const at = Math.max(end, 1);
      next = [...lines.slice(0, at), ...gen, ...lines.slice(at)];
    } else {
      console.error(`  skip(头注释无 UPSTREAM 且首行非 "/*",需手工迁移): ${e.local}`);
      continue;
    }
    const out = next.join("\n");
    if (out !== lines.join("\n")) { fs.writeFileSync(abs, out); changed++; console.log(`  sync: ${e.local}`); }
  }
  console.log(`sync-headers: ${changed} 个文件头已按 manifest 再生成`);
}

// ---------- metrics ----------
function cmdMetrics(m, asJson) {
  const worktree = path.join(REPO, m.upstream.worktree);
  const upstreamFiles = [];
  for (const scope of UP_SCOPES) {
    const root = path.join(worktree, m.upstream.root, scope);
    if (!fs.existsSync(root)) continue;
    for (const f of fs.readdirSync(root, { recursive: true })) {
      if (!UP_EXT.has(path.extname(f))) continue;
      const p = `${scope}/${f.replaceAll(path.sep, "/")}`;
      if (p.includes("__tests__") || /\.d\.ts$/.test(p) || /\.spec\./.test(p)) continue;
      upstreamFiles.push({ path: p, scope, loc: loc(path.join(worktree, m.upstream.root, p)) });
    }
  }
  const covered = new Set();
  for (const e of m.files) for (const s of e.upstream ?? []) covered.add(s.path);
  const skippedSet = new Set(m.skipped.map((s) => s.path));
  const inScope = (f, scopes) => scopes.includes(f.scope);

  const cov = (scopes) => {
    const files = upstreamFiles.filter((f) => inScope(f, scopes));
    const covFiles = files.filter((f) => covered.has(f.path));
    const skipFiles = files.filter((f) => skippedSet.has(f.path));
    const locTotal = files.reduce((a, f) => a + f.loc, 0);
    const locCov = covFiles.reduce((a, f) => a + f.loc, 0);
    return {
      files_total: files.length, files_covered: covFiles.length, files_skipped: skipFiles.length,
      loc_total: locTotal, loc_covered_src: locCov,
      coverage_files_pct: files.length ? +(100 * covFiles.length / files.length).toFixed(1) : 100,
      coverage_loc_pct: locTotal ? +(100 * locCov / locTotal).toFixed(1) : 100,
    };
  };
  const vendoredLoc = m.files.reduce((a, e) => a + loc(path.join(THEME, e.local)), 0);

  const fidelity = {};
  for (const d of DERIVATIONS) fidelity[d] = { entries: 0, loc: 0 };
  for (const e of m.files) { fidelity[e.derivation].entries++; fidelity[e.derivation].loc += loc(path.join(THEME, e.local)); }
  for (const d of DERIVATIONS) fidelity[d].loc_pct = vendoredLoc ? +(100 * fidelity[d].loc / vendoredLoc).toFixed(1) : 0;

  const devEntries = m.files
    .map((e) => ({ local: e.local, n: (e.rewrites?.length ?? 0) + (e.patches?.length ?? 0), policy: policyOf(e) }))
    .sort((a, b) => b.n - a.n);
  const totalDev = devEntries.reduce((a, x) => a + x.n, 0);

  const atPinned = m.files.filter((e) => (e.upstream ?? []).every((s) => shaOf(m, s) === m.upstream.pinned)).length;
  let drift = null, driftCommits = 0;
  try {
    driftCommits = +git(worktree, ["rev-list", "--count", `${m.upstream.pinned}..HEAD`, "--", m.upstream.root]);
    drift = driftCommits;
  } catch { /* 非 git 或浅克隆 */ }

  const policyDist = {};
  for (const e of m.files) { const p = policyOf(e); policyDist[p] = (policyDist[p] ?? 0) + 1; }

  const out = {
    coverage: {
      vendorable_scope: cov(SCOPE_VENDORABLE),
      whole_frontend_scope: cov(UP_SCOPES),
      local_vendored_loc: vendoredLoc,
      note: "coverage_loc_pct = 上游侧被收录文件的 LOC 占比;本地 vendored LOC 因合并/改写与上游不等值,仅作规模参考",
    },
    fidelity_by_derivation: fidelity,
    deviation: {
      total_marks: totalDev,
      avg_per_entry: +(totalDev / m.files.length).toFixed(2),
      top5: devEntries.slice(0, 5),
      policy_distribution: policyDist,
    },
    freshness: {
      entries_at_pinned: atPinned, entries_bumped: m.files.length - atPinned,
      pinned: m.upstream.pinned,
      upstream_commits_since_pinned_in_scope: drift,
      drift_exposure: drift === null ? "unknown(上游 worktree 非 git)" : driftCommits === 0 ? "0(与 pinned 同步)" : `${driftCommits} 个上游提交未评估 — 跑 affected ${m.upstream.pinned}..HEAD`,
    },
  };
  if (asJson) { console.log(JSON.stringify(out, null, 2)); return; }
  const A = out.coverage.vendorable_scope, B = out.coverage.whole_frontend_scope;
  console.log(`上游覆盖占比(可 vendor 面 components/utils/styles/api/types)
  文件: ${A.files_covered}/${A.files_total} = ${A.coverage_files_pct}%   (skipped ${A.files_skipped})
  LOC : ${A.loc_covered_src}/${A.loc_total} = ${A.coverage_loc_pct}% (上游侧源码)
  本地 vendored 规模: ${out.coverage.local_vendored_loc} 行(合并/改写后,规模参考)
上游覆盖占比(整个前台,含 pages/public)
  文件: ${B.files_covered}/${B.files_total} = ${B.coverage_files_pct}%   LOC: ${B.loc_covered_src}/${B.loc_total} = ${B.coverage_loc_pct}%`);
  console.log(`\n保真度(derivation × 条目/本地 LOC 占比)`);
  for (const d of DERIVATIONS) {
    const f = fidelity[d];
    if (!f.entries) continue;
    console.log(`  ${d.padEnd(10)} ${String(f.entries).padStart(3)} 条目  ${String(f.loc).padStart(5)} 行 (${f.loc_pct}%)`);
  }
  console.log(`\n偏离密度: ${totalDev} 个登记标记(rewrites+patches),均值 ${out.deviation.avg_per_entry}/条目;top5:`);
  for (const t of out.deviation.top5) console.log(`  ${String(t.n).padStart(2)}  ${t.local}  [${t.policy}]`);
  console.log(`\n同步策略分布: ${JSON.stringify(policyDist)}`);
  console.log(`新鲜度: pinned=${m.upstream.pinned.slice(0, 8)};${atPinned} 条目在 pinned,${out.freshness.entries_bumped} 已单独跟进`);
  console.log(`漂移敞口: ${out.freshness.drift_exposure}`);
}

// ---------- main ----------
const [cmd, ...args] = process.argv.slice(2);
const m = loadManifest();
if (cmd === "check") cmdCheck(m);
else if (cmd === "sync-headers") cmdSyncHeaders(m);
else if (cmd === "affected") {
  const simIdx = args.indexOf("--simulate");
  if (simIdx !== -1) cmdAffected(m, null, args[simIdx + 1]);
  else cmdAffected(m, args[0]);
} else if (cmd === "metrics") cmdMetrics(m, args.includes("--json"));
else die("用法: vendor-sync <check|affected|sync-headers|metrics> [args]");
