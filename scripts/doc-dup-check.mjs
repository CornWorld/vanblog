#!/usr/bin/env node
/**
 * doc-dup-check — vanblog 文档重复内容与冲突检测器
 *
 * 实现 docs/quality/doc-standard.md 的机器检测部分（§6）:
 *   1. 切句 + 规范化 → 8-gram shingle 索引
 *   2. 跨文件 ≥2 个连续命中句 = 重复块 (S1+)
 *   3. 参数冲突检测: 同一 VANBLOG_* 变量 / 镜像名在两文件出现不同值 → S0
 *   4. 输出每文件重复率 / 全局重复率 / 重复块清单 / S0 清单
 *
 * 用法:
 *   node scripts/doc-dup-check.mjs [glob] [--json]
 *   默认扫描 docs 目录下所有 md（含 quality/doc-standard.md 自身,便于自查）
 *   退出码: 0 通过 | 1 S0 或单文件重复率>=30% | 2 S1 或单文件重复率>=15%
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";

// ---------- 配置（对应标准 §5/§6） ----------
const SHINGLE_SIZE = 8; // 词数
const MIN_BLOCK_SENTENCES = 2; // 连续命中句数 >= 此值才算重复块
const WARN_RATIO = 0.15; // 单文件告警阈值
const FAIL_RATIO = 0.30; // 单文件违规阈值

// S2 白名单: 含以下子串的完整句子不参与重复匹配
const WHITELIST_SUBSTRINGS = [
  "ghcr.io/cornworld/vanblog",
  "registry.cn-beijing.aliyuncs.com/cornworld/vanblog",
  "docker compose up",
  "docker-compose.yml",
  "./vanblog.sh",
  "GPL-3.0",
  "Artalk",
];

// ---------- I/O ----------
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".git")) continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (entry.endsWith(".md")) out.push(p);
  }
  return out;
}

const rawTarget = process.argv[2];
const jsonOut = process.argv.includes("--json");
const projectRoot = process.cwd();
let files;
if (rawTarget) {
  // 简单 glob: 支持 "docs/**" / "README.md" / "docs"
  files = rawTarget.includes("README")
    ? [rawTarget]
    : walk(join(projectRoot, rawTarget.split("/**")[0]));
} else {
  files = walk(join(projectRoot, "docs"));
}

// 需要包含 README? 默认不含（README 是门面,允许总结性重复,但它也应有 ref 意识）
// 若传 "all" 则包含根 README.md
if (rawTarget === "all") {
  const r = join(projectRoot, "README.md");
  if (statSync(r, { throwIfNoEntry: false })) files.push(r);
}

// ---------- 文本处理 ----------
function stripCodeFences(text) {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`{1,3}[^`\n]*`{1,3}/g, " ");
}

function normalizeLine(line) {
  return line
    .replace(/^#{1,6}\s+/, "") // 标题
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接 -> 保留文字
    .replace(/[*_>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitSentences(text) {
  const clean = stripCodeFences(text);
  return clean
    .split(/\n|(?<=[。！？!?；;])\s*/)
    .map((l) => normalizeLine(l))
    .filter((l) => l.length >= 6); // 太短的碎片（表格残留）忽略
}

function tokenize(sentence) {
  return sentence.split(" ").filter(Boolean);
}

function shingles(tokens) {
  const out = [];
  for (let i = 0; i + SHINGLE_SIZE <= tokens.length; i++)
    out.push(tokens.slice(i, i + SHINGLE_SIZE).join(" "));
  return out;
}

function isWhitelisted(sentence) {
  return WHITELIST_SUBSTRINGS.some((s) => sentence.includes(s.toLowerCase()));
}

// ---------- 主流程 ----------
const docs = [];
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const sents = splitSentences(raw)
    .map((s) => ({ text: s, hidden: isWhitelisted(s) }))
    .filter((s) => s.text.length > 0);
  docs.push({
    file,
    rel: relative(projectRoot, file),
    totalChars: sents.reduce((n, s) => n + s.text.length, 0),
    sents,
    shingleOwner: new Map(), // shingle -> Set(fileIdx)
  });
}

// 建 shingle 索引: shingle -> [{fileIdx, sentIdx}]
const index = new Map();
docs.forEach((d, fi) => {
  d.sents.forEach((s, si) => {
    if (s.hidden) return;
    for (const sh of shingles(tokenize(s.text))) {
      if (!index.has(sh)) index.set(sh, []);
      index.get(sh).push({ fi, si });
    }
  });
});

// 跨文件重复块检测
// 对每对 (fileA, fileB), 找出 A 中连续句子,这些句子在 B 里有 shingle 命中。
const blocks = []; // {aFile, bFile, aFrom, aTo, chars, sents}
for (let a = 0; a < docs.length; a++) {
  for (let b = a + 1; b < docs.length; b++) {
    const A = docs[a],
      B = docs[b];
    // B 的 shingle 集合 (用于快速查命中)
    const bShingles = new Set();
    B.sents.forEach((s, si) => {
      if (s.hidden) return;
      for (const sh of shingles(tokenize(s.text))) bShingles.add(sh);
    });
    // A 的每个句子是否与 B 有命中
    const hit = A.sents.map((s, si) => {
      if (s.hidden) return false;
      return shingles(tokenize(s.text)).some((sh) => bShingles.has(sh));
    });
    // 找连续命中段
    let i = 0;
    while (i < A.sents.length) {
      if (!hit[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < A.sents.length && hit[j]) j++;
      if (j - i >= MIN_BLOCK_SENTENCES) {
        const text = A.sents
          .slice(i, j)
          .map((s) => s.text)
          .join(" ");
        // 去重: 同一 A/B 的重复段合并（A 里连续 j-i 句本身就是一块）
        blocks.push({
          aFile: A.rel,
          bFile: B.rel,
          aFrom: i,
          aTo: j - 1,
          chars: text.length,
          sents: j - i,
          text: text.slice(0, 140),
        });
      }
      i = j;
    }
  }
}

// 每文件重复率: 该文件作为 A 参与的所有 block 的 chars 并集 / 总字数
const fileDupChars = new Map();
for (const blk of blocks) {
  fileDupChars.set(blk.aFile, (fileDupChars.get(blk.aFile) || 0) + blk.chars);
}
const fileRatios = docs.map((d) => ({
  file: d.rel,
  ratio: d.totalChars ? (fileDupChars.get(d.rel) || 0) / d.totalChars : 0,
  dupChars: fileDupChars.get(d.rel) || 0,
  totalChars: d.totalChars,
}));

// 全局重复率: 所有 block chars 之和（近似） / 总字数
const totalChars = docs.reduce((n, d) => n + d.totalChars, 0);
const dupCharsTotal = blocks.reduce((n, b) => n + b.chars, 0);
const globalRatio = totalChars ? dupCharsTotal / totalChars : 0;

// ---------- S0 参数冲突检测 ----------
const envVals = new Map(); // envName -> Map<value, Set<file>>
const IMAGE_RE = /ghcr\.io\/cornworld\/vanblog:[^\s`]+/g;
const ENV_DEFAULT_RE = /VANBLOG_[A-Z_0-9]+\s*(?:=|:\s*)\s*"?([^\s,}`）(\[\]"']+)/g;
const envConflicts = [];
const imageConflicts = [];

for (const d of docs) {
  const raw = readFileSync(d.file, "utf8");
  // 环境变量默认值
  for (const m of raw.matchAll(ENV_DEFAULT_RE)) {
    const name = m[0].match(/VANBLOG_[A-Z_0-9]+/)[0];
    const val = m[1];
    if (/^(1|true|false|\$\{?\w|admin@example|warn|error|info|debug|localhost|\/)/.test(val)) {
      if (!envVals.has(name)) envVals.set(name, new Map());
      const byVal = envVals.get(name);
      if (!byVal.has(val)) byVal.set(val, new Set());
      byVal.get(val).add(d.rel);
    }
  }
  // 镜像名
  for (const m of raw.matchAll(IMAGE_RE)) {
    if (!imageConflicts.some((c) => c.img === m[0] && c.file === d.rel)) {
      imageConflicts.push({ img: m[0], file: d.rel });
    }
  }
}
for (const [name, byVal] of envVals) {
  if (byVal.size > 1) {
    envConflicts.push({
      env: name,
      values: [...byVal.entries()].map(([v, f]) => ({ value: v, files: [...f] })),
    });
  }
}

// ---------- 汇总 ----------
const s0Count = envConflicts.length;
const s1Blocks = blocks.filter((b) => b.sents >= MIN_BLOCK_SENTENCES);
const failingFiles = fileRatios.filter((f) => f.ratio >= FAIL_RATIO);
const warningFiles = fileRatios.filter((f) => f.ratio >= WARN_RATIO && f.ratio < FAIL_RATIO);

function humanReport() {
  const L = [];
  L.push(`doc-dup-check — 扫描 ${docs.length} 个文件`);
  L.push(`全局段落级重复率: ${(globalRatio * 100).toFixed(1)}% (目标 <5%)`);
  L.push(`S0 参数冲突: ${s0Count} (硬性要求 = 0)`);
  L.push(`S1 重复块(≥${MIN_BLOCK_SENTENCES}句): ${s1Blocks.length}`);
  L.push("");
  L.push("每文件重复率:");
  for (const f of [...fileRatios].sort((x, y) => y.ratio - x.ratio)) {
    const flag =
      f.ratio >= FAIL_RATIO ? "❌" : f.ratio >= WARN_RATIO ? "⚠️" : "✅";
    L.push(`  ${flag} ${(f.ratio * 100).toFixed(1).padStart(5)}%  ${f.file}`);
  }
  if (s0Count) {
    L.push("");
    L.push("S0 参数冲突:");
    for (const c of envConflicts) {
      L.push(`  ✗ ${c.env}:`);
      for (const v of c.values) L.push(`      ${v.value} — ${v.files.join(", ")}`);
    }
  }
  if (s1Blocks.length) {
    L.push("");
    L.push(`S1 重复块 Top ${Math.min(15, s1Blocks.length)}:`);
    for (const b of s1Blocks.slice(0, 15)) {
      L.push(
        `  • ${b.aFile} (L${b.aFrom}-${b.aTo}) ↔ ${b.bFile} [${b.sents}句/${b.chars}字]`
      );
      L.push(`      “${b.text}…”`);
    }
  }
  return L.join("\n");
}

const report = jsonOut
  ? JSON.stringify(
      {
        files: docs.length,
        globalRatio,
        s0Count,
        s1Blocks: s1Blocks.length,
        fileRatios,
        envConflicts,
        blocks: s1Blocks.slice(0, 50),
      },
      null,
      2
    )
  : humanReport();

console.log(report);

// 退出码
if (s0Count > 0 || failingFiles.length > 0) process.exit(1);
if (s1Blocks.length > 0 || warningFiles.length > 0) process.exit(2);
process.exit(0);
