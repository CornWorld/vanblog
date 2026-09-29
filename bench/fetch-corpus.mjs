// fetch-corpus.mjs — 从公开数据源抓取真实博文语料（仅用于 benchmark seed）
//
// 数据源（均无需鉴权）：
//   1. Hacker News Algolia API — ask_hn / show_hn 帖子（标题 + 正文 HTML + 作者 + 分数）
//   2. arXiv Atom API — cs 类目论文（标题 + 摘要 + 作者 + 分类）
//
// 输出 JSONL（每行一篇文章）：
//   { title, content, author, created, source, points, url }
//
// 用法:
//   node fetch-corpus.mjs [count]        默认模式：按搜索/分页抓 count 篇（默认
//                                        1000，HN 70% + arXiv 30%）。结果每次
//                                        抓取都会变（源数据持续更新），不入库。
//   node fetch-corpus.mjs --pin [count]  抓取后把源 ID 序列写入 bench/corpus.ids.json
//                                        （跟踪入库，几 KB），供 --replay 复现。
//   node fetch-corpus.mjs --replay       按 corpus.ids.json 逐 ID 重抓（HN items
//                                        端点 / arXiv id_list），输出与 pin 时
//                                        一致的确定语料。corpus.jsonl 本身不入库
//                                        （.gitignore），需要时 replay 重建。
//
// 复现流程见 bench/README.md。

import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// arg parsing: [--pin | --replay] [count]
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = args.find((a) => a === "--pin" || a === "--replay");
const MODE = flag ? flag.slice(2) : "default";
const COUNT = parseInt(args.find((a) => /^\d+$/.test(a)) || "1000", 10);
const HN_COUNT = Math.floor(COUNT * 0.7);
const ARXIV_COUNT = COUNT - HN_COUNT;

const IDS_FILE = new URL("./corpus.ids.json", import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Hacker News (Algolia) — ask_hn / show_hn 有正文
// ---------------------------------------------------------------------------

async function fetchHNPage(page) {
  // 混合 ask_hn 和 show_hn，按页轮换
  const tag = page % 2 === 0 ? "ask_hn" : "show_hn";
  const url = `https://hn.algolia.com/api/v1/search?tags=${tag}&hitsPerPage=50&page=${Math.floor(page / 2)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HN ${res.status}`);
  const d = await res.json();
  return (d.hits || [])
    .filter((h) => h.title && (h.story_text || h.text) && (h.story_text || h.text).length > 50)
    .map((h) => ({
      id: h.objectID,
      title: h.title,
      content: hnTextToMarkdown(h.story_text || h.text),
      author: h.author || "unknown",
      created: h.created_at,
      points: h.points || 0,
      url: h.url || "",
      source: "hn",
    }));
}

// 单 ID 抓取（--replay 用）：items 端点返回全文，字段名与 search 略有差异
async function fetchHNById(id) {
  const url = `https://hn.algolia.com/api/v1/items/${id}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HN item ${id}: ${res.status}`);
  const h = await res.json();
  const text = h.text || "";
  if (!h.title || text.length <= 50) throw new Error(`HN item ${id}: deleted or too short`);
  return {
    id: h.id ? String(h.id) : id,
    title: h.title,
    content: hnTextToMarkdown(text),
    author: h.author || "unknown",
    // items 端点给毫秒精度（.000Z）；search 端点给秒精度。归一到秒，
    // 保证 --replay 输出与 --pin 逐字节一致。
    created: (h.created_at || "").replace(/\.\d+Z$/, "Z"),
    points: h.points || 0,
    url: h.url || "",
    source: "hn",
  };
}

// HN 正文是 HTML（<p> 分段、<a> 链接）——粗转 markdown
function hnTextToMarkdown(html) {
  return html
    .replace(/<p>/gi, "\n\n")
    .replace(/<\/p>/gi, "")
    .replace(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, "[$2]($1)")
    .replace(/<i>|<em>/gi, "*")
    .replace(/<\/i>|<\/em>/gi, "*")
    .replace(/<code>/gi, "`")
    .replace(/<\/code>/gi, "`")
    .replace(/<pre>/gi, "\n```\n")
    .replace(/<\/pre>/gi, "\n```\n")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

// ---------------------------------------------------------------------------
// arXiv — cs 类目摘要（长文，更像技术文章）
// ---------------------------------------------------------------------------

const ARXIV_CATS = ["cs.SE", "cs.DC", "cs.OS", "cs.DB", "cs.PL", "cs.NI", "cs.LG"];

function parseArxivXml(xml) {
  // 解析 Atom entries（regex 足够 —— 结构固定且我们只取少数字段）
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const e = m[1];
    const pick = (re) => {
      const mm = e.match(re);
      return mm ? mm[1].trim() : "";
    };
    const title = pick(/<title>([\s\S]*?)<\/title>/);
    const summary = pick(/<summary>([\s\S]*?)<\/summary>/);
    const published = pick(/<published>([\s\S]*?)<\/published>/);
    const idUrl = pick(/<id>([\s\S]*?)<\/id>/);
    const authors = [...e.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((a) => a[1]);
    if (title && summary) {
      entries.push({
        id: idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, ""),
        title: title.replace(/\s+/g, " "),
        content: summary.replace(/\s+/g, " ").trim(),
        author: authors[0] || "unknown",
        created: published,
        points: 0,
        url: idUrl,
        source: "arxiv",
      });
    }
  }
  return entries;
}

async function fetchArxivBatch(start) {
  const cat = ARXIV_CATS[Math.floor(start / 100) % ARXIV_CATS.length];
  const url = `https://export.arxiv.org/api/query?search_query=cat:${cat}&start=${start % 100}&max_results=50&sortBy=submittedDate&sortOrder=descending`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  return parseArxivXml(await res.text());
}

// 按 ID 批量抓取（--replay 用，id_list 支持逗号分隔，50 一批）
async function fetchArxivByIds(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = `https://export.arxiv.org/api/query?id_list=${chunk.join(",")}&max_results=${chunk.length}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`arXiv id_list ${res.status}`);
    const got = parseArxivXml(await res.text());
    // id_list 的返回顺序不保证与请求一致（实测按提交历史）——按请求
    // ID 序重排，保证 --replay 输出与 --pin 逐字节一致。
    const byId = new Map(got.map((e) => [e.id, e]));
    for (const id of chunk) {
      const e = byId.get(id);
      if (!e) throw new Error(`arXiv id_list missing ${id}`);
      out.push(e);
    }
    if (i + 50 < ids.length) await sleep(1000); // be polite
  }
  return out;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function collect(fetcher, want, label, out) {
  let page = 0;
  let got = 0;
  let failures = 0;
  while (got < want && failures < 5) {
    let items;
    try {
      items = await fetcher(page);
    } catch (e) {
      failures++;
      console.error(`[fetch-corpus] ${label} page ${page} failed: ${e.message}`);
      await sleep(2000);
      continue;
    }
    for (const it of items) {
      if (got >= want) break;
      out.push(it);
      got++;
    }
    page++;
    await sleep(400); // be polite to public APIs
  }
  console.error(`[fetch-corpus] ${label}: ${got}/${want} collected`);
}

// 输出 JSONL：剥离内部 id 字段，保持行结构与历史 corpus.jsonl 一致
function emit(all) {
  for (const { id: _id, ...item } of all) {
    process.stdout.write(JSON.stringify(item) + "\n");
  }
  console.error(`[fetch-corpus] wrote ${all.length} articles to stdout`);
}

if (MODE === "replay") {
  const pinned = JSON.parse(readFileSync(IDS_FILE, "utf8"));
  const hnIds = pinned.ids.filter((x) => x.source === "hn").map((x) => x.id);
  const arxivIds = pinned.ids.filter((x) => x.source === "arxiv").map((x) => x.id);
  console.error(`[fetch-corpus] replay: ${hnIds.length} hn + ${arxivIds.length} arxiv from corpus.ids.json (pinned ${pinned.pinnedAt})`);

  const all = [];
  let failures = 0;
  for (const id of hnIds) {
    try {
      all.push(await fetchHNById(id));
    } catch (e) {
      failures++;
      console.error(`[fetch-corpus] hn ${id}: ${e.message}`);
    }
    await sleep(300);
  }
  if (failures > hnIds.length * 0.1 && hnIds.length > 0) {
    console.error(`[fetch-corpus] too many HN replay failures (${failures}/${hnIds.length}), aborting`);
    process.exit(1);
  }
  failures = 0;
  for (let i = 0; i < arxivIds.length; i += 50) {
    try {
      all.push(...(await fetchArxivByIds(arxivIds.slice(i, i + 50))));
    } catch (e) {
      failures++;
      console.error(`[fetch-corpus] arxiv batch: ${e.message}`);
    }
  }
  if (failures > 0 && all.length === 0) {
    console.error("[fetch-corpus] arxiv replay failed entirely, aborting");
    process.exit(1);
  }
  emit(all);
} else {
  const all = [];
  await collect(fetchHNPage, HN_COUNT, "hackernews", all);
  await collect(fetchArxivBatch, ARXIV_COUNT, "arxiv", all);

  if (MODE === "pin") {
    const payload = {
      pinnedAt: new Date().toISOString(),
      count: all.length,
      ids: all.map(({ id, source }) => ({ source, id })),
    };
    writeFileSync(IDS_FILE, JSON.stringify(payload, null, 2) + "\n");
    console.error(`[fetch-corpus] pinned ${all.length} ids -> corpus.ids.json`);
  }
  emit(all);
}
