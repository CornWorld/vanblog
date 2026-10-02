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
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// arg parsing: [--pin | --replay] [count]
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = args.find((a) => a === "--pin" || a === "--replay");
const MODE = flag ? flag.slice(2) : "default";
const COUNT = parseInt(args.find((a) => /^\d+$/.test(a)) || "1000", 10);
const HN_COUNT = Math.floor(COUNT * 0.7);
const ARXIV_COUNT = COUNT - HN_COUNT;

// fileURLToPath + resolve:URL.pathname 在 Windows 上产生 /C:/... 这类
// readFileSync 解析不可靠的路径
const IDS_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "corpus.ids.json");

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
      // 与 fetchHNById 相同的秒精度归一:search 端点目前给秒,但若哪天对齐
      // items 端点的毫秒格式,replay 输出会静默偏离 pin 输出
      created: (h.created_at || "").replace(/\.\d+Z$/, "Z"),
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

// 按 ID 批量抓取（--replay 用）。调用方已按 50 预分块——id_list 单请求
// 上限 50,这里不再二次分块;批量节流(sleep)也归调用方。
async function fetchArxivByIds(ids) {
  const url = `https://export.arxiv.org/api/query?id_list=${ids.join(",")}&max_results=${ids.length}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`arXiv id_list ${res.status}`);
  const got = parseArxivXml(await res.text());
  // id_list 的返回顺序不保证与请求一致（实测按提交历史）——按请求
  // ID 序重排,缺席的点名抛错,保证 --replay 输出与 --pin 逐字节一致。
  const byId = new Map(got.map((e) => [e.id, e]));
  const out = [];
  for (const id of ids) {
    const e = byId.get(id);
    if (!e) throw new Error(`arXiv id_list missing ${id}`);
    out.push(e);
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
  // 「复现或响亮失败」是本脚本的契约:manifest 读不出/形状不对给可读错误,
  // 而不是裸 ENOENT/SyntaxError/TypeError 栈
  let pinned;
  try {
    pinned = JSON.parse(readFileSync(IDS_FILE, "utf8"));
  } catch (e) {
    console.error(`[fetch-corpus] cannot read manifest ${IDS_FILE}: ${e.message} (先跑 --pin 生成)`);
    process.exit(1);
  }
  if (!pinned || !Array.isArray(pinned.ids) || pinned.ids.length === 0 ||
      pinned.ids.some((x) => !x || !x.source || !x.id)) {
    console.error(`[fetch-corpus] malformed manifest ${IDS_FILE}: 期望非空 ids[] 且每项含 {source,id}`);
    process.exit(1);
  }
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
  for (let i = 0; i < arxivIds.length; i += 50) {
    if (i > 0) await sleep(1000); // be polite
    try {
      all.push(...(await fetchArxivByIds(arxivIds.slice(i, i + 50))));
    } catch (e) {
      failures++;
      console.error(`[fetch-corpus] arxiv batch: ${e.message}`);
    }
  }
  // README 契约:重建失败 abort 而非静默缺篇——缺任何一篇都不许 exit 0,
  // 两源同一标准(旧实现 HN 容忍 10%、arXiv 仅全灭才 abort,均弱于契约)
  const wantTotal = hnIds.length + arxivIds.length;
  if (failures > 0 || all.length !== wantTotal) {
    console.error(`[fetch-corpus] replay incomplete (${all.length}/${wantTotal}, ${failures} 个抓取错误), aborting`);
    process.exit(1);
  }
  emit(all);
} else {
  const all = [];
  await collect(fetchHNPage, HN_COUNT, "hackernews", all);
  await collect(fetchArxivBatch, ARXIV_COUNT, "arxiv", all);

  if (MODE === "pin") {
    // 拒绝退化 manifest:某源彻底颗粒无收时(如 HN 被限流耗尽 5 次重试),
    // 静默 pin 会把单源语料固化为「复现基准」
    const hn = all.filter((x) => x.source === "hn").length;
    if (all.length === 0 || all.some((x) => !x.id)) {
      console.error(`[fetch-corpus] refusing to pin a degenerate manifest (collected ${all.length} articles, 存在缺 id 项)`);
      process.exit(1);
    }
    if ((HN_COUNT > 0 && hn === 0) || (ARXIV_COUNT > 0 && all.length - hn === 0)) {
      console.error(`[fetch-corpus] refusing to pin a one-sided manifest (hn ${hn}/${HN_COUNT}, arxiv ${all.length - hn}/${ARXIV_COUNT})`);
      process.exit(1);
    }
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
