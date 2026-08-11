#!/usr/bin/env node
// upgrade-diff.mjs — 轻量版「base 是否还匹配我的 override」静态报告。
//
// 轻量设计动机（Phase D）：
//   - 不做 git-range 分类引擎：不解析 commit 区间、不 blame、不区分 release
//     边界。报告只回答一个问题——「我的 src/base-overrides/ 还匹配当前
//     app/src 的 base 吗？」。
//   - 不依赖 git 历史：纯静态字节对比 + frontmatter 块文本对比。任何
//     checkout（shallow clone、无 .git 的产物镜像）都能跑。
//   - 只报告、不当门禁：无论结果如何始终 exit 0，绝不做 CI contract-diff
//     拦截。人工判断 REVIEW / ORPHANED。
//
// 用法：
//   node scripts/upgrade-diff.mjs [themeDir=themes/vanblog] [baseDir=app/src]
//
// 输出分组：
//   ORPHANED — base 已删除该文件，override 成孤儿
//   REVIEW   — 与 base 内容有差异，需人工过目；对 .astro/.ts/.tsx 且含
//              frontmatter（首行 `---` 到第二个 `---`）的文件，若 frontmatter
//              块文本与 base 不一致，额外标注「L0 frontmatter drift」
//   OK       — 与 base 完全一致，无需处理

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const DEFAULT_THEME_DIR = 'themes/vanblog';
const DEFAULT_BASE_DIR = 'app/src';

const [themeDirArg, baseDirArg] = process.argv.slice(2);
const themeDir = themeDirArg || DEFAULT_THEME_DIR;
const baseDir = baseDirArg || DEFAULT_BASE_DIR;

const overridesRoot = join(themeDir, 'src', 'base-overrides');

// ---- helpers ------------------------------------------------------------

/** Recursively list all files under dir, returning '/' -relative paths. */
function walk(dir, prefix = '') {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // missing / unreadable → treat as empty
  }
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    } else {
      // symlink / special: resolve via stat
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) out.push(...walk(full, rel));
      else if (st.isFile()) out.push(rel);
    }
  }
  return out;
}

/** File types whose frontmatter block is part of the L0 contract surface. */
const FRONTMATTER_SRC = /\.(astro|ts|tsx)$/;

/**
 * Extract the frontmatter block (both `---` markers) if the file starts with
 * one, otherwise null. Only used for the L0 drift annotation.
 */
function extractFrontmatter(text) {
  if (!text.startsWith('---')) return null;
  const second = text.indexOf('\n---');
  if (second === -1) return null;
  return text.slice(0, second + 4); // include the closing `---`
}

/**
 * Classify a single override file.
 * Returns { status: 'ORPHANED'|'REVIEW'|'OK', rel, detail }.
 */
function classify(rel, overridePath, basePath) {
  let base;
  try {
    base = readFileSync(basePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { status: 'ORPHANED', rel, detail: 'base 已删除，override 成孤儿' };
    }
    return { status: 'REVIEW', rel, detail: `base 读取失败：${err.message}` };
  }

  let override;
  try {
    override = readFileSync(overridePath);
  } catch (err) {
    return { status: 'REVIEW', rel, detail: `override 读取失败：${err.message}` };
  }

  if (override.equals(base)) {
    return { status: 'OK', rel, detail: '与 base 一致，无需处理' };
  }

  let detail = '与 base 有差异，需人工过目';
  if (FRONTMATTER_SRC.test(rel)) {
    const ov = extractFrontmatter(override.toString('utf8'));
    const b = extractFrontmatter(base.toString('utf8'));
    if (ov && b && ov !== b) {
      detail += '｜L0 frontmatter drift（base 契约变量有变，务必核对）';
    }
  }
  return { status: 'REVIEW', rel, detail };
}

// ---- main ---------------------------------------------------------------

const overrides = walk(overridesRoot);

console.log(`=== upgrade-diff：${overridesRoot} vs ${baseDir} ===`);
console.log('');

if (overrides.length === 0) {
  console.log('无 override：src/base-overrides 为空（或不存在），没有需要检查的文件。');
  console.log('');
  console.log('提示：多数 base 升级不会破坏 theme。只有在你覆盖了 base 文件、');
  console.log('且 base 侧同路径文件已删除（ORPHANED）或内容变化（REVIEW）时，');
  console.log('才需要人工处理。');
  process.exit(0);
}

const groups = { ORPHANED: [], REVIEW: [], OK: [] };
for (const rel of overrides) {
  const r = classify(rel, join(overridesRoot, rel), join(baseDir, rel));
  groups[r.status].push(r);
}

for (const status of ['ORPHANED', 'REVIEW', 'OK']) {
  const items = groups[status];
  if (items.length === 0) continue;
  console.log(`[${status}]`);
  for (const item of items) {
    console.log(`  ${item.rel}`);
    console.log(`    ${item.detail}`);
  }
  console.log('');
}

console.log(
  `Summary: ${overrides.length} override(s) — ` +
    `ORPHANED: ${groups.ORPHANED.length}, ` +
    `REVIEW: ${groups.REVIEW.length}, ` +
    `OK: ${groups.OK.length}`
);
console.log('');
console.log('说明：本报告仅作提示，始终 exit 0。REVIEW/ORPHANED 需人工判断，不是构建门禁。');

process.exit(0);
