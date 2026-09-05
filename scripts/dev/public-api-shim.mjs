// Dev-only parity shim:在 3000 端口把原版 mereithhh/website 的 legacy
// `/api/public/*` 数据面映射到本仓库 PocketBase(vault)的真实数据。
//
// 用途(计划 .snow/plan/vendor-upstream-islands-parity.md §Wave4):
//   原版 Next 站点(`refs/mereithhh-original/packages/website`,`pnpm dev`
//   监听 3001,dev rewrite 已指向 http://127.0.0.1:3000)以此为后端跑起来,
//   与本仓库 Astro 主题做同数据源的截图/行为对比。**不进生产**。
//
// 端点(形状来自原版 packages/website/api/*.ts 的消费方):
//   GET  /api/public/meta                → getPublicMeta
//   GET  /api/public/article             → getArticlesByOption(分页/分类/标签/排序)
//   GET  /api/public/article/:id         → getArticleByIdOrPathname({article,pre,next})
//   POST /api/public/article/:id         → 密码取文(错误 → data:null)
//   GET  /api/public/article/viewer/:id  → getArticleViewer({viewer})
//   GET/POST /api/public/viewer          → getPageview/updatePageview({viewer,visited})
//   GET  /api/public/search?value=       → searchArticles({data:{data:[...]}})
//   GET  /api/public/timeline|category   → washArticlesByKey 分组产物
//   GET  /api/public/customPage/all      → []
//   GET  /api/public/customPage?path=    → null
//
// 运行:PB_URL=http://127.0.0.1:8090 node scripts/dev/public-api-shim.mjs
import { createServer } from "node:http";

const PB = (process.env.PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
const PORT = Number(process.env.SHIM_PORT || 3000);
const VERSION = process.env.VAN_BLOG_VERSION || "shim-dev";

// ── PB REST 帮手 ─────────────────────────────────────────────────────────
async function pbList(collection, params = {}) {
  const qs = new URLSearchParams({ perPage: "500", ...params });
  const res = await fetch(`${PB}/api/collections/${collection}/records?${qs}`);
  if (!res.ok) return { items: [], totalItems: 0 };
  const body = await res.json();
  // 超过一页时翻齐(个人博客量级足够)
  let items = body.items ?? [];
  const totalPages = body.totalPages ?? 1;
  for (let p = 2; p <= totalPages; p++) {
    const r = await fetch(
      `${PB}/api/collections/${collection}/records?${new URLSearchParams({ ...params, perPage: "500", page: String(p) })}`
    );
    if (r.ok) items = items.concat((await r.json()).items ?? []);
  }
  return { items, totalItems: body.totalItems ?? items.length };
}

async function pbGet(collection, id) {
  const res = await fetch(`${PB}/api/collections/${collection}/records/${id}`);
  return res.ok ? res.json() : null;
}

async function fetchPosts() {
  const { items } = await pbList("posts", {
    filter: `status='published' && deleted=false`,
    sort: "-top,-created",
    expand: "category,tags",
  });
  return items.map(toLegacyArticle);
}

// PB post → 原版 Article(types/article.ts)。密码锁文章对原版即 private。
function toLegacyArticle(r) {
  return {
    id: r.id,
    title: r.title ?? "",
    content: r.content ?? "",
    createdAt: (r.created || "").replace(" ", "T"),
    updatedAt: (r.updated || "").replace(" ", "T"),
    category: r.expand?.category?.name ?? "",
    catelog: r.expand?.category?.name ?? "",
    tags: (r.expand?.tags ?? []).map((t) => t.name),
    top: r.top ?? 0,
    private: Boolean(r.private) || Boolean(r.password),
    author: r.expand?.author?.name || r.author || "",
    copyright: r.copyright ?? "",
    pathname: r.pathname || r.id,
    wordCount: (r.content ?? "").length,
  };
}

const wordTotalOf = (articles) =>
  articles.reduce((sum, a) => sum + (a.content?.length || 0), 0);

async function buildMeta() {
  const sites = await pbList("site");
  const site = sites.items[0] ?? {};
  const cats = (await pbList("categories")).items;
  const tagRows = (await pbList("tags")).items;
  const posts = await fetchPosts();

  const boolStr = (v, d = "true") => (v == null ? d : v ? "true" : "false");
  const nav = Array.isArray(site.nav) && site.nav.length ? site.nav : null;
  const menus = (nav ?? [
    { name: "首页", value: "/" },
    { name: "归档", value: "/archive" },
    { name: "时间轴", value: "/timeline" },
    { name: "标签", value: "/tags" },
    { name: "分类", value: "/categories" },
  ]).map((n, i) => ({
    id: i + 1,
    name: n.name,
    value: n.value,
    level: n.level ?? 0,
    ...(n.children?.length ? { children: n.children.map((c, j) => ({ id: (i + 1) * 100 + j, name: c.name, value: c.value, level: 1 })) } : {}),
  }));

  return {
    version: VERSION,
    totalWordCount: wordTotalOf(posts),
    totalArticles: posts.length,
    menus,
    tags: tagRows.map((t) => ({ name: t.name, count: 0 })),
    meta: {
      categories: cats.map((c) => c.name),
      links: site.links ?? [],
      socials: [],
      rewards: [],
      about: {
        updatedAt: (site.aboutUpdatedAt || site.updated || "").replace(" ", "T"),
        content: site.aboutContent ?? "",
      },
      layout: {},
      siteInfo: {
        author: site.author ?? "",
        authorDesc: site.authorDesc ?? "",
        authorLogo: site.authorLogo ?? "",
        authorLogoDark: site.authorLogoDark ?? "",
        siteLogo: site.siteLogo ?? "",
        siteLogoDark: site.siteLogoDark ?? "",
        favicon: site.favicon ?? "",
        siteName: site.siteName ?? "VanBlog",
        siteDesc: site.siteDesc ?? "",
        copyrightAgreement: site.copyrightAgreement ?? "BY-NC-SA",
        beianNumber: site.beianNumber ?? "",
        beianUrl: site.beianUrl ?? "",
        gaBeianNumber: site.gaBeianNumber ?? "",
        gaBeianUrl: site.gaBeianUrl ?? "",
        gaBeianLogoUrl: site.gaBeianLogoUrl ?? "",
        payAliPay: "", payWechat: "", payAliPayDark: "", payWechatDark: "",
        since: site.created || "",
        enableComment: boolStr(site.enableComment ?? true),
        baseUrl: site.baseUrl ?? "",
        showSubMenu: boolStr(site.displayOptions?.showSubMenu ?? true),
        subMenuOffset: site.displayOptions?.subMenuOffset ?? 0,
        headerLeftContent: site.displayOptions?.headerLeftContent ?? "siteName",
        showDonateInfo: boolStr(site.displayOptions?.showDonateInfo ?? true),
        showFriends: boolStr(site.displayOptions?.showFriends ?? true),
        showAdminButton: boolStr(site.displayOptions?.showAdminButton ?? true),
        defaultTheme: site.displayOptions?.defaultTheme ?? "auto",
        showDonateInAbout: boolStr(site.displayOptions?.showDonateInAbout ?? false),
        enableCustomizing: "false",
        showCopyRight: boolStr(site.displayOptions?.showCopyRight ?? true),
        showDonateButton: boolStr(site.displayOptions?.showDonateButton ?? true),
        showExpirationReminder: boolStr(site.displayOptions?.showExpirationReminder ?? true),
        showRSS: boolStr(site.displayOptions?.showRSS ?? true),
        openArticleLinksInNewWindow: boolStr(site.displayOptions?.openArticleLinksInNewWindow ?? false),
        showEditButton: boolStr(site.displayOptions?.showEditButton ?? false),
        baiduAnalysisId: site.baiduAnalysisId ?? "",
        gaAnalysisId: site.gaAnalysisId ?? "",
      },
    },
  };
}

function groupBy(articles, keyFn) {
  const out = {};
  for (const a of articles) {
    const k = String(keyFn(a));
    (out[k] ??= []).push({ title: a.title, id: a.id, createdAt: a.createdAt, updatedAt: a.updatedAt });
  }
  // 原版 washArticlesByKey 按首次出现顺序;补一个年内倒序
  for (const k of Object.keys(out)) {
    out[k].sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
  }
  return out;
}

function ok(res, data) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ statusCode: 200, data }));
}

function main(res, data) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ── 服务 ────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  try {
    if (!p.startsWith("/api/public/")) {
      res.writeHead(404).end("not found (parity shim serves /api/public/* only)");
      return;
    }

    // 全站访客计数:viewer=总浏览,visited 用同值(平台无独立 UV 计数,基线用途足够)
    if (p === "/api/public/viewer") {
      if (req.method === "POST") {
        // 消费请求体后向 PB 记一次站点访问(path='/',不计文章)
        await fetch(`${PB}/api/vanblog/visits/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "/" }),
        }).catch(() => {});
      }
      const r = await fetch(`${PB}/api/vanblog/visits/summary`);
      const total = r.ok ? (await r.json()).totalViews ?? 0 : 0;
      main(res, { statusCode: 200, data: { viewer: total, visited: total } });
      return;
    }

    if (p.startsWith("/api/public/article/viewer/")) {
      const id = p.split("/").pop();
      const post = await pbGet("posts", id);
      main(res, { statusCode: 200, data: { viewer: post?.viewCount ?? 0 } });
      return;
    }

    if (p === "/api/public/search") {
      const q = (url.searchParams.get("value") || "").toLowerCase();
      const posts = await fetchPosts();
      const hits = posts.filter(
        (a) => !a.private && (a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q))
      );
      main(res, { statusCode: 200, data: { data: hits } });
      return;
    }

    if (p === "/api/public/timeline") {
      const grouped = groupBy(await fetchPosts(), (a) => new Date(a.createdAt).getFullYear());
      return ok(res, grouped);
    }

    if (p === "/api/public/category") {
      const grouped = groupBy(await fetchPosts(), (a) => a.category);
      return ok(res, grouped);
    }

    if (p === "/api/public/tag") {
      const grouped = groupBy(await fetchPosts(), (a) => a.tags);
      return ok(res, grouped);
    }

    if (p === "/api/public/customPage/all") {
      return ok(res, []);
    }

    if (p === "/api/public/customPage") {
      return main(res, { statusCode: 200, data: null });
    }

    if (p === "/api/public/meta") {
      return ok(res, await buildMeta());
    }

    if (p === "/api/public/article") {
      const q = url.searchParams;
      let posts = await fetchPosts();
      const cat = q.get("category");
      const tag = q.get("tags");
      if (cat) posts = posts.filter((a) => a.category === cat);
      if (tag) posts = posts.filter((a) => a.tags.includes(tag));
      if (q.get("sortCreatedAt") === "asc") posts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const total = posts.length;
      const totalWordCount = wordTotalOf(posts);
      const page = parseInt(q.get("page") || "1");
      const pageSize = parseInt(q.get("pageSize") || "5");
      if (pageSize > 0) posts = posts.slice((page - 1) * pageSize, page * pageSize);
      main(res, { statusCode: 200, data: { articles: posts, total, totalWordCount } });
      return;
    }

    const articleMatch = p.match(/^\/api\/public\/article\/(.+)$/);
    if (articleMatch) {
      const id = decodeURIComponent(articleMatch[1]);
      const raw = await pbGet("posts", id);
      const posts = await fetchPosts();
      const idx = posts.findIndex((a) => a.id === id);
      if (!raw || idx < 0) {
        return main(res, { statusCode: 404, data: null });
      }
      if (req.method === "POST") {
        // 密码取文:错误密码 → data:null(原版客户端以 !data 判失败)
        let body = "";
        for await (const chunk of req) body += chunk;
        let password = "";
        try { password = JSON.parse(body).password ?? ""; } catch {}
        if (!raw.password || raw.password !== password) {
          return main(res, { statusCode: 401, data: null });
        }
        return main(res, { statusCode: 200, data: posts[idx] });
      }
      const article = posts[idx];
      const pre = posts.slice(idx + 1).find((a) => !a.private) ?? null;
      const next = posts.slice(0, idx).reverse().find((a) => !a.private) ?? null;
      return ok(res, {
        article,
        pre: pre ? { title: pre.title, id: pre.id, pathname: pre.pathname } : undefined,
        next: next ? { title: next.title, id: next.id, pathname: next.pathname } : undefined,
      });
    }

    res.writeHead(404).end("not found");
  } catch (err) {
    console.error("[shim]", p, err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ statusCode: 500, message: String(err) }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[parity-shim] legacy /api/public/* on http://127.0.0.1:${PORT} → PB ${PB}`);
});
