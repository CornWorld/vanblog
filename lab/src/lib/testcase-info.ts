export const EVAL_STRUCTURE = {
  static: { total: 16, label: "静态检查", desc: "文件结构与内容验证" },
  runtime: { total: 8, label: "运行时验证", desc: "Docker 容器 HTTP 调用" },
  fullTotal: 24,
} as const;

export const INCOMPLETE_CHECKS = ["artifact-dir-exists", "pack-dir-found"] as const;

// 24 个 check ID → 中文描述
export const TESTCASE_DESCRIPTIONS: Record<string, string> = {
  "artifact-dir-exists": "artifact 目录存在",
  "pack-dir-found": "pack 目录（含 pack.json）存在",
  "pack-json-valid": "pack.json 格式有效",
  "pack-name-match": "pack 名称匹配目录",
  "pack-version-valid": "pack 版本号有效",
  "frontend-scope-public": "前端 scope 为 public",
  "frontend-script-pow-guard-js": "前端包含 pow-guard.js 引用",
  "hook-file-exists": "hook 文件存在",
  "frontend-file-exists": "前端文件存在",
  "hook-has-challenge-route": "hook 包含 challenge 路由",
  "hook-has-verify-route": "hook 包含 verify 路由",
  "hook-has-crypto-ref": "hook 引用了 crypto/sha256",
  "hook-has-pow-validation": "hook 包含工作量验证逻辑",
  "frontend-uses-localStorage": "前端使用 localStorage",
  "frontend-has-overlay": "前端包含 overlay UI",
  "frontend-has-cache-duration": "前端包含缓存时长配置",
  "challenge-returns-200": "challenge 端点返回 200",
  "challenge-has-nonce": "challenge 响应含 nonce",
  "challenge-has-difficulty": "challenge 响应含 difficulty",
  "pow-solved": "PoW 已求解",
  "verify-negative": "负样本验证：错误 nonce 被拒绝",
  "verify-positive": "正样本验证：正确 nonce 返回 token",
  "homepage-injection": "主页注入 pow-guard.js",
  "frontend-asset-served": "前端资源正常返回",
};

export function parseCheckId(entry: string): string {
  const idx = entry.indexOf(":");
  return idx > 0 ? entry.slice(0, idx).trim() : entry.trim();
}

export function getCheckDesc(entry: string): string {
  return TESTCASE_DESCRIPTIONS[parseCheckId(entry)] ?? "";
}
