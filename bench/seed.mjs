// seed.mjs — 把真实语料灌入 vanblog（benchmark 用）
//
// 输入: corpus.jsonl（fetch-corpus.mjs 的输出）
// 动作: 建 categories → 建 tags → 建文章（author 关联管理员）
//
// 用法: node seed.mjs <pb_url> <superuser_token> <admin_token> <count> <corpus> [--update] [--dry]
//   count=0 表示清空（删全部文章）
//   --update: upsert(按 pathname slug-<i> 定位)——demo 站已有内容时的非破坏
//             补充:改写正文(含 HN 评论区块)、补全 tag 分配;不删不重建。
//   --dry:   与 --update 连用,只打印将做的变更,不写。
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

// 评论区块渲染(语料 comments[] → markdown;放正文,平台无内建评论存储,
// Artalk 是外部服务不适合 demo seed)。返回空串表示无评论。
// 原文 url footer 恒在最后;正文 + 评论合计压进 posts.content 上限(5000)。
const CONTENT_LIMIT = 5000;
const COMMENTS_HEADING = "HN 热门评论";

function renderComments(comments, budget) {
  if (!Array.isArray(comments) || comments.length === 0 || budget <= 200) return "";
  const blocks = [];
  let used = COMMENTS_HEADING.length + 20;
  for (const c of comments) {
    if (!c || !c.text) continue;
    // 引用块 + @作者(链到 HN 用户页);单条过长截断,保证多条都能进。
    const text = c.text.length > 700 ? `${c.text.slice(0, 699)}…` : c.text;
    const block = `> **[@${c.author}](https://news.ycombinator.com/user?id=${encodeURIComponent(c.author)})**: ${text}\n\n`;
    if (used + block.length > budget) break;
    blocks.push(block);
    used += block.length;
  }
  if (blocks.length === 0) return "";
  return `---\n\n**${COMMENTS_HEADING}**\n\n${blocks.join("")}`;
}

function buildContent(art) {
  const footer = art.url ? `\n\n---\n\n> 原文: [${art.url}](${art.url})` : "";
  const commentsBudget = 1600;
  const comments = renderComments(art.comments, commentsBudget);
  const bodyBudget = CONTENT_LIMIT - footer.length - comments.length;
  const body = art.content.length > bodyBudget
    ? `${art.content.slice(0, Math.max(0, bodyBudget - 1))}…`
    : art.content;
  return body + comments + footer;
}

// pathname 形态与 seed 逻辑唯一对应(slug-<i>),--update 按它定位已入库文章。
function slugify(title, i) {
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "post";
  return `${slug}-${i}`;
}

// tag 全量分配(2026-10-04):此前每篇只挂 [source, performance?, linux?],
// TAG_POOL 其余 12 个 tag 建了记录却永远没有文章 → 线上 tag 页大片
// 「0 文章」。7/11 与 15 互质,前 15 篇即覆盖全部 TAG_POOL。
function pickTags(art, i, tagIds) {
  const pool = TAG_POOL;
  const idxA = (i * 7 + 3) % pool.length;
  const idxB = (i * 11 + 5) % pool.length;
  return [...new Set([
    tagIds[art.source],
    tagIds[pool[idxA]],
    tagIds[pool[idxB]],
  ])].filter(Boolean);
}

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
    const tags = pickTags(art, i, tagIds);
    const content = buildContent(art);
    const pathname = slugify(art.title, i);

    const payload = {
      title: art.title.slice(0, 200),
      content,
      status: "published",
      pathname,
      author: adminId,
      category: catIds[catIdx],
      tags,
    };

    let r;
    if (UPDATE) {
      // --update:按 pathname 定位(upsert)。demo 站已有内容时的非破坏
      // 补充路径:改写正文(带评论区块)/补 tag,不重建站点。
      const f = await api(`/api/collections/posts/records?filter=${encodeURIComponent(`pathname="${pathname}"`)}`);
      const existing = f.json.items?.[0];
      r = existing
        ? await api(`/api/collections/posts/records/${existing.id}`, "PATCH", { content, tags, category: catIds[catIdx] })
        : await api("/api/collections/posts/records", "POST", payload);
      if (existing && r.status >= 400) {
        // 关联字段被规则拒绝时退化为纯正文更新(评论区块仍在)
        r = await api(`/api/collections/posts/records/${existing.id}`, "PATCH", { content });
      }
      if (DRY) {
        console.log(`[dry] ${existing ? "patch" : "create"} ${pathname} (${content.length} chars, tags=${tags.length})`);
        continue;
      }
    } else {
      r = await api("/api/collections/posts/records", "POST", payload);
      if (r.status >= 400) {
        // validation hook may reject category/tags 关联 —— 降级为最小 payload 重试
        const minimal = { title: payload.title, content: payload.content, status: "published", pathname: payload.pathname, author: adminId };
        r = await api("/api/collections/posts/records", "POST", minimal);
      }
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

// --update:upsert 语义(按 pathname 定位,demo 站非破坏补充);
// --dry:与 --update 连用,只打印将做的变更。注意 --update 幂等:正文由
// 语料确定性重建(带评论区块),重复跑产出一致,只有内容真变了才 PATCH。
const UPDATE = process.argv.includes("--update");
const DRY = process.argv.includes("--dry");

if (COUNT === 0) {
  console.log("wiping...");
  await wipe();
} else {
  console.log(`seeding ${COUNT} posts → ${PB}${UPDATE ? " (update mode)" : ""}${DRY ? " (dry run)" : ""}`);
  await seed();
}
