#!/usr/bin/env node
// wait-sync — 等待 Syncthing folder 达到 in-sync 状态后再放行后续验证命令。
//
// 用途:编辑端(m4air)改代码 → Syncthing 传播 → 执行端(oci-sg)跑测试。
// 若不等待,测试可能跑在旧代码上,产生假阴性。串联用法:
//
//   node scripts/dev/wait-sync.mjs && make test
//
// 认证:X-API-Key 取自 Syncthing config.xml 的 <apikey>(macOS/Linux 常见路径
// 自动探测),SYNCTHING_API_KEY 优先。容器内访问宿主 Syncthing 时设
// SYNCTHING_URL=http://host.docker.internal:8384。
//
// 选项:
//   -t, --timeout <sec>   最长等待(默认 120)
//   -f, --folder <id>     folder id(默认 dev-code)
// 环境变量:SYNCTHING_URL(默认 http://127.0.0.1:8384)、SYNCTHING_API_KEY

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
let timeoutSec = 120;
let folder = process.env.SYNCTHING_FOLDER || "dev-code";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-t" || args[i] === "--timeout") timeoutSec = Number(args[++i]);
  else if (args[i] === "-f" || args[i] === "--folder") folder = args[++i];
  else {
    console.error(`usage: wait-sync.mjs [-t timeoutSec] [-f folderId]`);
    process.exit(2);
  }
}

const base = process.env.SYNCTHING_URL || "http://127.0.0.1:8384";

function detectApiKey() {
  if (process.env.SYNCTHING_API_KEY) return process.env.SYNCTHING_API_KEY;
  const candidates = [
    join(homedir(), "Library/Application Support/Syncthing/config.xml"),
    join(homedir(), ".local/state/syncthing/config.xml"),
    join(homedir(), ".config/syncthing/config.xml"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/<apikey>([^<]+)<\/apikey>/);
    if (m) return m[1];
  }
  return null;
}

const apiKey = detectApiKey();
if (!apiKey) {
  console.error("wait-sync: 找不到 Syncthing API key(设置 SYNCTHING_API_KEY 或确认 config.xml 路径)");
  process.exit(2);
}

async function status() {
  const res = await fetch(`${base}/rest/db/status?folder=${encodeURIComponent(folder)}`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) throw new Error(`GET status HTTP ${res.status}(检查 folder id: ${folder})`);
  return res.json();
}

const deadline = Date.now() + timeoutSec * 1000;
process.stderr.write(`wait-sync: 等待 folder "${folder}" in-sync(超时 ${timeoutSec}s)…\n`);
while (true) {
  let s;
  try {
    s = await status();
  } catch (e) {
    if (Date.now() > deadline) {
      console.error(`wait-sync: 失败 — ${e.message}`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1000));
    continue;
  }
  const inSync =
    s.inSyncBytes === s.globalBytes && s.inSyncFiles === s.globalFiles &&
    (s.state === "idle" || s.state === "scanning");
  if (inSync) {
    console.log(
      `wait-sync: OK — ${s.inSyncFiles}/${s.globalFiles} files, ` +
        `${(s.inSyncBytes / 1e6).toFixed(1)}/${(s.globalBytes / 1e6).toFixed(1)} MB (state=${s.state})`,
    );
    process.exit(0);
  }
  if (Date.now() > deadline) {
    console.error(
      `wait-sync: 超时 — state=${s.state}, ${s.inSyncFiles}/${s.globalFiles} files, ` +
        `${(s.inSyncBytes / 1e6).toFixed(1)}/${(s.globalBytes / 1e6).toFixed(1)} MB`,
    );
    process.exit(1);
  }
  process.stderr.write(`  … state=${s.state} ${s.inSyncFiles}/${s.globalFiles} files\n`);
  await new Promise((r) => setTimeout(r, 1000));
}
