/**
 * Live2D Companion — Full widget with tools, tips, model switching.
 *
 * Uses stevenjoezhang/live2d-widget via CDN. The widget manages its own
 * canvas, toolbar, tips, and model loading. This script:
 *   1. Reads server-side config injected by the pack page (or DEFAULT_CONFIG)
 *   2. Loads autoload.js (which calls initWidget internally)
 *   3. Provides graceful fallback if CDN fails
 *   4. Exposes window.live2dCompanion API for the config page
 *   5. Persists config to PocketBase collection `live2d_config` (admin only)
 */

// ─── Default Configuration ────────────────────────────────────
// widgetPath 解析顺序:SSR serverConfig 覆盖 > 本地 vendored 副本(从本脚本
// URL 推导,随镜像分发,无外网依赖)> widgetCdnPath(CDN 兜底)。模型资产
// (cdnPath/live2d_api)体积大且授权复杂,保持 CDN + 失败静默降级。
const WIDGET_CDN_PATH =
  "https://fastly.jsdelivr.net/npm/live2d-widgets@1.0.1/dist/";
const DEFAULT_CONFIG = {
  widgetPath: "",
  widgetCdnPath: WIDGET_CDN_PATH,
  cdnPath: "https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/",
  modelId: 0,
  modelTexturesId: 53,
  tools: [
    "hitokoto",
    "switch-model",
    "switch-texture",
    "photo",
    "info",
    "quit",
  ],
  minWidth: 768,
};

const COLLECTION = "live2d_config";

// ─── Load SSR-injected config ─────────────────────────────────
function loadSsrConfig() {
  const node = document.getElementById("l2d-ssr-data");
  if (!node) return null;
  try {
    const data = JSON.parse(node.textContent || "{}");
    return data.serverConfig || null;
  } catch {
    console.warn("[live2d-companion] failed to parse SSR config");
    return null;
  }
}

// 本地 vendored 副本与本脚本同目录的 widget/ 子目录(构建管线把 frontend/
// static 目录原样发射到 _astro/ 下)。本脚本经 <script type="module" src=…>
// 注入(BaseLayout),模块上下文里 document.currentScript 为 null,只能用
// import.meta.url 取自身地址;文件内容原样发射,URL 不被构建改写。
function deriveLocalWidgetPath() {
  try {
    if (import.meta.url) return new URL("widget/", import.meta.url).href;
  } catch {
    // URL 解析失败(理论不可达),交由 CDN 兜底
  }
  return "";
}

const CONFIG = {
  ...DEFAULT_CONFIG,
  widgetPath: deriveLocalWidgetPath(),
  ...(loadSsrConfig() || {}),
};

// ─── Widget runtime error guard ───────────────────────────────
// live2d-widgets@1.0.1 的 followPointer 在模型未就绪时读 null.hitTest
// 抛 TypeError(快速指针移动/合成点击均可触发,上游未设防)。在 window
// 捕获阶段拦下该包抛出的错误:阻止默认上报,只提示一次。升级 widget
// 依赖修复后此守卫可移除。
(function guardWidgetErrors() {
  let warned = false;
  window.addEventListener(
    "error",
    (ev) => {
      if (!ev.filename || !ev.filename.includes("live2d-widgets")) return;
      ev.preventDefault();
      if (!warned) {
        warned = true;
        console.warn(
          "[live2d-companion] widget runtime error suppressed (known live2d-widgets@1.0.1 followPointer issue)"
        );
      }
    },
    true
  );
})();

// ─── State ────────────────────────────────────────────────────
const NAMESPACE = "live2d-companion";
const ROOT_SELECTOR = `[data-vanblog-pack="${NAMESPACE}"]`;
let widgetRoot = null;
let fallbackShown = false;

// ─── DOM helper ───────────────────────────────────────────────
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "className") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function")
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (typeof child === "string")
      node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

// ─── Mobile gate ──────────────────────────────────────────────
function checkMobile() {
  const hide = window.innerWidth < CONFIG.minWidth;
  const waifu = document.getElementById("waifu");
  if (waifu) waifu.style.display = hide ? "none" : "";
  if (widgetRoot) widgetRoot.style.display = hide ? "none" : "";
}

// ─── Main init ────────────────────────────────────────────────
function init() {
  if (document.querySelector(ROOT_SELECTOR)) return;

  widgetRoot = el("div", {
    dataset: { vanblogPack: NAMESPACE },
    "aria-label": "Live2D 看板娘",
  });
  document.body.append(widgetRoot);

  window.addEventListener("resize", checkMobile);
  checkMobile();

  loadWidgetScript()
    .then(() => {
      widgetRoot.dataset.state = "ready";
      moveWidgetIntoNamespace();
      checkMobile();
    })
    .catch((err) => {
      console.warn("[live2d-companion] widget load failed", err);
      renderFallback(err);
    });
}

function loadScriptOnce(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;

    // Hard timeout: reject and remove the tag so a late-loading script
    // cannot inject an orphaned widget after we moved on.
    const hardTimeout = setTimeout(() => {
      script.remove();
      reject(new Error("widget script timeout: " + src));
    }, timeoutMs);

    script.onerror = () => {
      clearTimeout(hardTimeout);
      reject(new Error("widget script unavailable: " + src));
    };
    script.onload = () => {
      clearTimeout(hardTimeout);
      resolve();
    };

    document.head.append(script);
  });
}

function waitForWaifuMount(timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = setInterval(() => {
      if (document.getElementById("waifu")) {
        clearInterval(poll);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(poll);
        resolve(false);
      }
    }, 200);
  });
}

async function loadWidgetScript() {
  // 候选链:本地 vendored 副本 → CDN 兜底。脚本加载失败或 #waifu 迟迟不
  // 挂载(脚本加载成功但其兄弟资源缺失)都视为该源不可用,尝试下一个。
  const candidates = [CONFIG.widgetPath, CONFIG.widgetCdnPath].filter(Boolean);
  for (const base of candidates) {
    try {
      await loadScriptOnce(base + "autoload.js", 10000);
      // autoload.js 异步注入 #waifu;短暂轮询确认挂载,便于
      // moveWidgetIntoNamespace() 把它迁入命名空间根。
      if (await waitForWaifuMount(8000)) return;
      console.warn("[live2d-companion] widget did not mount from:", base);
    } catch (err) {
      console.warn("[live2d-companion] widget source unavailable:", err.message);
    }
  }
  throw new Error("all widget sources unavailable");
}


// ─── Fallback ─────────────────────────────────────────────────
function renderFallback(error) {
  if (fallbackShown) return;
  fallbackShown = true;
  widgetRoot.dataset.state = "fallback";

  const card = el(
    "div",
    { className: `${NAMESPACE}__fallback-card`, role: "status" },
    [
      el(
        "div",
        { className: `${NAMESPACE}__fallback-avatar`, "aria-hidden": "true" },
        "🌸"
      ),
      el(
        "p",
        { className: `${NAMESPACE}__fallback-message` },
        "Failed to load companion widget. Please check your network connection."
      ),
      el(
        "button",
        {
          type: "button",
          className: `${NAMESPACE}__fallback-retry`,
          onClick: () => {
            fallbackShown = false;
            widgetRoot.innerHTML = "";
            widgetRoot.dataset.state = "loading";
            init();
          },
        },
        "Retry"
      ),
    ]
  );
  widgetRoot.append(card);
}

// ─── Backend persistence ──────────────────────────────────────
async function fetchConfigRecordId() {
  const pb = self.vanblog?.pb;
  if (!pb) return null;
  try {
    const record = await pb.collection(COLLECTION).getFirstListItem("1=1");
    return record.id;
  } catch {
    console.warn("[live2d-companion] live2d_config record not found");
    return null;
  }
}

async function upsertConfig(payload) {
  const pb = self.vanblog.pb;
  if (!pb) throw new Error("PocketBase client unavailable");
  const existingId = await fetchConfigRecordId();
  if (existingId) {
    return pb.collection(COLLECTION).update(existingId, payload);
  }
  const created = await pb.collection(COLLECTION).create(payload);
  return created;
}

// ─── Public API for config page ───────────────────────────────
window.live2dCompanion = {
  getConfig() {
    return { ...CONFIG };
  },
  getDefaultConfig() {
    return { ...DEFAULT_CONFIG };
  },
  async saveConfig(newConfig) {
    const merged = { ...DEFAULT_CONFIG, ...CONFIG, ...newConfig };
    await upsertConfig(merged);
    Object.assign(CONFIG, merged);
    return merged;
  },
  async resetConfig() {
    await upsertConfig({ ...DEFAULT_CONFIG });
    Object.assign(CONFIG, DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  },
  reload() {
    location.reload();
  },
};

// ─── Boot ─────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
