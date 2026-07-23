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
const DEFAULT_CONFIG = {
  widgetPath: "https://fastly.jsdelivr.net/npm/live2d-widgets@1.0.1/dist/",
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

const CONFIG = { ...DEFAULT_CONFIG, ...(loadSsrConfig() || {}) };

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

function moveWidgetIntoNamespace() {
  const waifu = document.getElementById("waifu");
  if (waifu && widgetRoot && !widgetRoot.contains(waifu)) {
    widgetRoot.append(waifu);
  }
}

function loadWidgetScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CONFIG.widgetPath + "autoload.js";
    script.async = true;

    let settled = false;
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      reject(new Error(msg));
    };
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    // Hard timeout: reject if the script itself never loads.
    const hardTimeout = setTimeout(() => fail("CDN timeout"), 10000);

    script.onerror = () => {
      clearTimeout(hardTimeout);
      fail("CDN script unavailable");
    };

    script.onload = () => {
      clearTimeout(hardTimeout);
      // autoload.js injects #waifu asynchronously; poll briefly for it so
      // moveWidgetIntoNamespace() can relocate it into our namespaced root.
      const started = Date.now();
      const poll = setInterval(() => {
        if (document.getElementById("waifu")) {
          clearInterval(poll);
          done();
        } else if (Date.now() - started > 8000) {
          clearInterval(poll);
          // Script loaded but widget never mounted. Resolve anyway — the
          // widget may appear later; fallback UI would hide a late arrival.
          done();
        }
      }, 200);
    };

    document.head.append(script);
  });
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
        "看板娘加载失败，请检查网络连接"
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
        "重新加载"
      ),
    ]
  );
  widgetRoot.append(card);
}

// ─── Backend persistence ──────────────────────────────────────
async function fetchConfigRecordId() {
  const pb = self.vanblog.pb;
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
