#!/usr/bin/env node
// omp-to-pi.mjs — 把本机 omp 的 provider 凭据/模型定义转换为 pi 的配置。
//
// 背景:pi 与 omp 同源但配置格式不同(omp: sqlite auth_credentials + config.yml;
// pi: ~/.pi/agent/{auth.json, models.json})。本脚本让 oci-sg 上的 pi 使用与
// 本机 omp 完全相同的 provider/模型,替代 dev 容器里的 zen free 临时方案。
//
// 在装有 omp 的机器上运行,把输出目录指到目标位置:
//   node scripts/dev/omp-to-pi.mjs --out /tmp/pi-agent
//   scp -r /tmp/pi-agent/* oci-sg:~/.pi/agent/
//
// 读取(只读):
//   ~/.omp/agent/agent.db  auth_credentials(仅 credential_type='api_key' 可迁移;
//                          oauth 型如 github-copilot/xai-oauth 无法静态迁移,跳过)
//   ~/.omp/agent/models.db model_cache(提取 provider 的 baseUrl 与模型清单)
//
// 输出:
//   <out>/models.json  非内置 provider 的完整定义(api/baseUrl/apiKey 内联/models)
//   <out>/auth.json    pi 内置 provider 的 API key(格式 {"<provider>": {"apiKey": "…"}})
//
// 选项: --out <dir>(默认 ~/.pi/agent)
//        --providers <a,b>(默认 zhipu-coding-plan,openrouter,opencode-go)

import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
let outDir = join(homedir(), ".pi/agent");
let providers = ["zhipu-coding-plan", "openrouter", "opencode-go"];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") outDir = args[++i];
  else if (args[i] === "--providers") providers = args[++i].split(",").map((s) => s.trim());
}

// pi 0.84.4 内置 provider 目录(models.md / dist 静态目录中确认存在的)
const PI_BUILTIN = new Set([
  "anthropic", "openai", "openrouter", "google", "xai", "zai", "deepseek",
  "opencode-go", "alibaba-coding-plan", "cerebras", "cloudflare-ai-gateway",
]);

const agentDb = new DatabaseSync(join(homedir(), ".omp/agent/agent.db"), { readOnly: true });
const modelsDb = new DatabaseSync(join(homedir(), ".omp/agent/models.db"), { readOnly: true });

const credRows = agentDb.prepare(
  "SELECT provider, data FROM auth_credentials WHERE credential_type = 'api_key'",
).all();
const creds = new Map(credRows.map((r) => [r.provider, JSON.parse(r.data).key]));
const oauthProviders = agentDb.prepare(
  "SELECT DISTINCT provider FROM auth_credentials WHERE credential_type != 'api_key'",
).all().map((r) => r.provider);

const modelsOut = { providers: {} };
const authOut = {};
const skipped = [];

for (const p of providers) {
  const key = creds.get(p);
  if (!key) {
    skipped.push(`${p}: agent.db 无 api_key 凭据${oauthProviders.includes(p) ? "(oauth 型,无法静态迁移)" : ""}`);
    continue;
  }
  const row = modelsDb.prepare("SELECT models FROM model_cache WHERE provider_id = ?").get(p);
  const models = row?.models ? JSON.parse(row.models) : null;

  if (PI_BUILTIN.has(p)) {
    // 内置 provider:只需要 key,模型目录 pi 自带。
    // 若 models.db 里有缓存定义,仍以内置目录为准(models.json 不重复定义)。
    authOut[p] = { apiKey: key };
    continue;
  }
  if (!models?.length) {
    skipped.push(`${p}: 非内置且 models.db 无定义,无法生成`);
    continue;
  }
  const baseUrl = models[0].baseUrl;
  if (!baseUrl) {
    skipped.push(`${p}: models[0] 无 baseUrl`);
    continue;
  }
  modelsOut.providers[p] = {
    api: models[0].api || "openai-completions",
    baseUrl,
    apiKey: key,
    models: models.map((m) => ({ id: m.id })),
  };
}

mkdirSync(outDir, { recursive: true });
const write = (name, obj) => {
  const path = join(outDir, name);
  const backup = existsSync(path) ? `.bak-${Date.now()}` : null;
  if (backup) writeFileSync(`${path}${backup}`, readFileSync(path));
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
  console.log(`written ${path}${backup ? ` (旧文件备份为 ${name}${backup})` : ""}`);
};
if (Object.keys(modelsOut.providers).length) write("models.json", modelsOut);
if (Object.keys(authOut).length) write("auth.json", authOut);
if (skipped.length) {
  console.log("\nskipped:");
  for (const s of skipped) console.log(`  - ${s}`);
}
console.log(`\n提示: oauth 型 provider(${oauthProviders.join(", ") || "无"})需在目标机 pi 内 /login 重新认证。`);
