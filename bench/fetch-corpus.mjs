// fetch-corpus.mjs — 从公开数据源抓取真实博文语料（仅用于 benchmark seed）
//
// 数据源（均无需鉴权）：
//   1. Hacker News Algolia API — ask_hn / show_hn 帖子（标题 + 正文 HTML + 作者 + 分数）
//   2. arXiv Atom API — cs 类目论文（标题 + 摘要 + 作者 + 分类）
//
// 输出 JSONL（每行一篇文章）：
//   { title, content, author, created, source, points, url }
//
// 用法: node fetch-corpus.mjs [count] > corpus.jsonl
//   默认抓 1000 篇（HN 700 + arXiv 300），单次抓取后缓存在仓库里复用。

import { setTimeout as sleep } from "node:timers/promises";

const COUNT = parseInt(process.argv[2] || "1000", 10);
const HN_COUNT = Math.floor(COUNT * 0.7);
const ARXIV_COUNT = COUNT - HN_COUNT;

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
    .filter((h) => h.title && h.story_text && h.story_text.length > 50)
    .map((h) => ({
      title: h.title,
      content: hnTextToMarkdown(h.story_text),
      author: h.author || "unknown",
      created: h.created_at,
      points: h.points || 0,
      url: h.url || "",
      source: "hn",
    }));
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

async function fetchArxivBatch(start) {
  const cat = ARXIV_CATS[Math.floor(start / 100) % ARXIV_CATS.length];
  const url = `https://export.arxiv.org/api/query?search_query=cat:${cat}&start=${start % 100}&max_results=50&sortBy=submittedDate&sortOrder=descending`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  const xml = await res.text();

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
      console.error(`[fetch-corpus] ${label} page ${page} failed: ${e.message}`, { file: "fetch-corpus.mjs" });
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
  console.error(`[fetch-corpus] ${label}: ${got}/${want} collected`, { file: "fetch-corpus.mjs" });
}

const all = [];
await collect(fetchHNPage, HN_COUNT, "hackernews", all);
await collect(fetchArxivBatch, ARXIV_COUNT, "arxiv", all);

for (const item of all) {
  process.stdout.write(JSON.stringify(item) + "\n");
}
console.error(`[fetch-corpus] wrote ${all.length} articles to stdout`, { file: "fetch-corpus.mjs" });
