#!/usr/bin/env node
/**
 * ocr-rules-check — 断言 OCR 项目层规则包(.opencodereview/rule.json)对各路径域真实生效。
 *
 * 背景: OCR 自定义规则字段写错/path 不匹配时会静默回退 System built-in,
 * 不报错。本脚本对每个路径域选一个代表性文件跑 `ocr rules check`,
 * 断言 Source 为 Project (.opencodereview/rule.json)。
 *
 * 用法: node scripts/check/ocr-rules-check.mjs
 * 退出码: 0 通过(或 ocr 未安装,警告跳过) | 1 任一代表文件未命中 Project 层
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// 每个路径域一个代表文件(与 rule.json 的 path 模式一一对应)
const REPRESENTATIVES = [
  "vault/pb_migrations/1783600100_site_secrets_isolation.go",
  "vault/internal/article/unlock.go",
  "app/src/pages/api/revalidate.ts",
  "themes/vanblog/src/pages/api/unlock.ts",
  "app/src/loaders/posts.ts",
  "scripts/dev/public-api-shim.mjs",
  "vault/pb_hooks/system.pb.js",
];

const MARKER = "Source: Project (.opencodereview/rule.json)";

let ocr;
try {
  ocr = execFileSync("which", ["ocr"], { encoding: "utf8" }).trim();
} catch {
  console.warn("[ocr-rules-check] ocr 未安装,跳过断言(规则包未被验证)");
  process.exit(0);
}
if (!ocr) {
  console.warn("[ocr-rules-check] ocr 未安装,跳过断言(规则包未被验证)");
  process.exit(0);
}

let failed = 0;
for (const file of REPRESENTATIVES) {
  if (!existsSync(file)) {
    console.warn(`[ocr-rules-check] 代表文件不存在,跳过: ${file}`);
    continue;
  }
  let out;
  try {
    out = execFileSync("ocr", ["rules", "check", file], { encoding: "utf8" });
  } catch (err) {
    console.error(`✗ ${file}\n  ocr 执行失败: ${err.message}`);
    failed++;
    continue;
  }
  const source = out.split("\n").find((l) => l.startsWith("Source:")) || "(无 Source 行)";
  if (out.includes(MARKER)) {
    console.log(`✓ ${file}  ${source.trim()}`);
  } else {
    console.error(`✗ ${file}\n  未命中 Project 层规则(静默回退?): ${source.trim()}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n[ocr-rules-check] ${failed} 个域未命中 Project 层 — 检查 .opencodereview/rule.json 的 path 字段与 JSON schema(字段名是 path/rule,写错会静默回退)`);
  process.exit(1);
}
console.log("\n[ocr-rules-check] 全部路径域命中 Project 层规则 ✓");
