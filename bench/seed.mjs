// seed.mjs — 把真实语料灌入 vanblog（benchmark 用）
//
// 输入: corpus.jsonl（fetch-corpus.mjs 的输出）
// 动作: 建 categories → 建 tags → 建文章（author 关联管理员）
//
// 用法: node seed.mjs <pb_url> <superuser_token> <admin_token> <count> <corpus>
//   count=0 表示清空（删全部文章）
//
// 权限说明:
//   - categories/tags 创建需要 SUPERUSER token（普通 admin 只有 posts 的创建权）
//   - posts 创建需要 admin token（author 指向 admin 用户）
//
// 前置条件: 目标 PB 已完成 setup（bootstrap 同时创建 _superusers 记录，
//   邮箱/密码与 admin 相同——用 {@link https://github.com/pocketbase/pocketbase} 的
//   /api/collections/_superusers/auth-with-password 获取）。

import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PB = process.argv[2] || "http://127.0.0.1:8090";
const SUPER_TOKEN = process.argv[3] || "";
const ADMIN_TOKEN = process.argv[4] || "";
const COUNT = parseInt(process.argv[5] || "100", 10);
const CORPUS = process.argv[6] || "corpus.jsonl";
const H = { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN || SUPER_TOKEN}` };
const HS = { "Content-Type": "application/json", Authorization: `Bearer ${SUPER_TOKEN}` };

async function api(path, method = "GET", body) {
  const res = await fetch(`${PB}${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

// superuser-scoped API（categories/tags 用）
async function apiS(path, method = "GET", body) {
  const res = await fetch(`${PB}${path}`, {
    method,
    headers: HS,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// 清空
// ---------------------------------------------------------------------------

async function wipe() {
  for (const col of ["posts", "revisions", "tags", "categories"]) {
    let page = 1;
    let total = Infinity;
    let deleted = 0;
    while (deleted < total) {
      const r = await api(`/api/collections/${col}/records?page=${page}&perPage=200`);
      if (r.status !== 200) { console.error(`${col}: list ${r.status}`); break; }
      total = r.json.totalItems ?? 0;
      const items = r.json.items ?? [];
      if (items.length === 0) break;
      // batch delete
      const ids = items.map((i) => i.id);
      const dr = await api(`/api/collections/${col}/records/batch`, "DELETE", ids.map((id) => ({ id })));
      if (dr.status >= 400) {
        // fallback: one by one
        for (const id of ids) await api(`/api/collections/${col}/records/${id}`, "DELETE");
      }
      deleted += ids.length;
      process.stdout.write(`\r  ${col}: deleted ${deleted}/${total}    `);
    }
    console.log(`\r  ${col}: cleared (${deleted})            `);
  }
}

// ---------------------------------------------------------------------------
// 建分类 / 标签 / 文章
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: "随想", slug: "thoughts", type: "category", meta: { title: "随想", description: "", keywords: [] } },
  { name: "技术", slug: "tech", type: "category", meta: { title: "技术", description: "", keywords: [] } },
  { name: "论文笔记", slug: "papers", type: "category", meta: { title: "论文笔记", description: "", keywords: [] } },
  { name: "工具", slug: "tools", type: "category", meta: { title: "工具", description: "", keywords: [] } },
  { name: "问答", slug: "qa", type: "category", meta: { title: "问答", description: "", keywords: [] } },
];

const TAG_POOL = ["hn", "arxiv", "performance", "kubernetes", "go", "memory", "gc", "linux", "docker", "api", "database", "networking", "ai", "security", "compiler"];

async function seed() {
  // --- admin user id (author 字段必须指向真实记录) ---
  const me = await api("/api/collections/users/records?perPage=1");
  const adminId = me.json.items?.[0]?.id;
  if (!adminId) throw new Error("no admin user found — run setup first");
  console.log(`admin: ${adminId}`);

  // --- categories ---
  const catIds = [];
  for (const c of CATEGORIES) {
    let r = await apiS("/api/collections/categories/records", "POST", c);
    if (r.status >= 400) {
      // maybe exists — find it
      const f = await apiS(`/api/collections/categories/records?filter=${encodeURIComponent(`name="${c.name}"`)}`);
      r = { status: 200, json: { id: f.json.items?.[0]?.id } };
    }
    catIds.push(r.json.id);
  }
  console.log(`categories: ${catIds.length}`);

  // --- tags ---
  const tagIds = {};
  for (const t of TAG_POOL) {
    let r = await apiS("/api/collections/tags/records", "POST", { name: t, slug: t });
    if (r.status >= 400) {
      const f = await apiS(`/api/collections/tags/records?filter=${encodeURIComponent(`name="${t}"`)}`);
      r = { status: 200, json: { id: f.json.items?.[0]?.id } };
    }
    tagIds[t] = r.json.id;
  }
  console.log(`tags: ${Object.keys(tagIds).length}`);

  // --- posts ---
  const corpus = readFileSync(CORPUS, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

  if (corpus.length === 0) throw new Error("corpus is empty");

  let created = 0;
  for (let i = 0; i < COUNT; i++) {
    const art = corpus[i % corpus.length];
    // arXiv → 论文笔记/技术；HN → 按标题分流
    const catIdx =
      art.source === "arxiv"
        ? i % 2 === 0 ? 2 : 1
        : art.title.startsWith("Ask HN")
          ? 4
          : art.title.startsWith("Show HN")
            ? 3
            : i % 2;
    const tags = [tagIds[art.source], ...(i % 3 === 0 ? [tagIds.performance] : []), ...(i % 5 === 0 ? [tagIds.linux] : [])].filter(Boolean);

    const payload = {
      title: art.title.slice(0, 200),
      content: art.content,
      status: "published",
      pathname: `bench-${i}-${Date.now().toString(36)}`,
      author: adminId,
      category: catIds[catIdx],
      tags,
    };

    let r = await api("/api/collections/posts/records", "POST", payload);
    if (r.status >= 400) {
      // validation hook may reject category/tags 关联 —— 降级为最小 payload 重试
      const minimal = { title: payload.title, content: payload.content, status: "published", pathname: payload.pathname, author: adminId };
      r = await api("/api/collections/posts/records", "POST", minimal);
    }
    if (r.status === 200) {
      created++;
    } else {
      if (created === 0 && i < 3) console.error("first failure sample:", JSON.stringify(r.json).slice(0, 300));
    }
    if (i % 50 === 49) {
      process.stdout.write(`\r  posts: ${created}/${COUNT}    `);
      await sleep(50);
    }
  }
  console.log(`\r  posts: ${created}/${COUNT} created          `);

  // verify
  const v = await api("/api/collections/posts/records?perPage=1");
  console.log(`\ntotal posts in DB: ${v.json.totalItems}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

if (COUNT === 0) {
  console.log("wiping...");
  await wipe();
} else {
  console.log(`seeding ${COUNT} posts → ${PB}`);
  await seed();
}
