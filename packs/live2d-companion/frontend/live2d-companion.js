/**
 * Live2D Companion — Full widget with tools, tips, model switching.
 *
 * Uses stevenjoezhang/live2d-widget via CDN. The widget manages its own
 * canvas, toolbar, tips, and model loading. This script:
 *   1. Loads user config from localStorage (if available)
 *   2. Loads autoload.js (which calls initWidget internally)
 *   3. Provides graceful fallback if CDN fails
 *   4. Exposes window.live2dCompanion API for the config page
 */

// ─── Default Configuration ────────────────────────────────────
const DEFAULT_CONFIG = {
  widgetPath: 'https://fastly.jsdelivr.net/npm/live2d-widgets@1.0.1/dist/',
  cdnPath: 'https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/',
  modelId: 0,
  modelTexturesId: 53,
  tools: ['hitokoto', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
  minWidth: 768,
};

const STORAGE_KEY = 'live2d-companion-config';

// ─── Load user overrides ──────────────────────────────────────
function loadUserConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch { return null; }
}

function saveUserConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* storage unavailable */ }
}

const CONFIG = loadUserConfig() || DEFAULT_CONFIG;

// ─── State ────────────────────────────────────────────────────
const NAMESPACE = 'live2d-companion';
const ROOT_SELECTOR = `[data-vanblog-pack="${NAMESPACE}"]`;
let widgetRoot = null;
let fallbackShown = false;

// ─── DOM helper ───────────────────────────────────────────────
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

// ─── Mobile gate ──────────────────────────────────────────────
function checkMobile() {
  if (CONFIG.minWidth === 'disable') return;
  const hide = window.innerWidth < CONFIG.minWidth;
  const waifu = document.getElementById('waifu');
  if (waifu) waifu.style.display = hide ? 'none' : '';
  if (widgetRoot) widgetRoot.style.display = hide ? 'none' : '';
}

// ─── Main init ────────────────────────────────────────────────
function init() {
  if (typeof window === 'undefined') return;
  if (document.querySelector(ROOT_SELECTOR)) return;

  widgetRoot = el('div', {
    dataset: { vanblogPack: NAMESPACE },
    'aria-label': 'Live2D 看板娘',
  });
  document.body.append(widgetRoot);

  window.addEventListener('resize', checkMobile);
  checkMobile();

  loadWidgetScript()
    .then(() => {
      widgetRoot.dataset.state = 'ready';
      moveWidgetIntoNamespace();
      checkMobile();
    })
    .catch((err) => {
      console.warn('[live2d-companion] widget load failed', err);
      renderFallback(err);
    });
}

function moveWidgetIntoNamespace() {
  const waifu = document.getElementById('waifu');
  if (waifu && widgetRoot && !widgetRoot.contains(waifu)) {
    widgetRoot.append(waifu);
  }
}

function loadWidgetScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CONFIG.widgetPath + 'autoload.js';
    script.async = true;
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) reject(new Error('CDN timeout'));
    }, 10000);

    script.onload = () => {
      const checkInterval = setInterval(() => {
        const waifu = document.getElementById('waifu');
        if (waifu) {
          clearInterval(checkInterval);
          clearTimeout(timer);
          resolved = true;
          resolve();
        }
      }, 200);
      setTimeout(() => {
        if (!resolved) {
          clearInterval(checkInterval);
          clearTimeout(timer);
          resolved = true;
          resolve();
        }
      }, 8000);
    };
    script.onerror = () => {
      clearTimeout(timer);
      if (!resolved) { resolved = true; reject(new Error('CDN script unavailable')); }
    };
    document.head.append(script);
  });
}

// ─── Fallback ─────────────────────────────────────────────────
function renderFallback(error) {
  if (fallbackShown) return;
  fallbackShown = true;
  widgetRoot.dataset.state = 'fallback';

  const card = el('div', { className: `${NAMESPACE}__fallback-card`, role: 'status' }, [
    el('div', { className: `${NAMESPACE}__fallback-avatar`, 'aria-hidden': 'true' }, '🌸'),
    el('p', { className: `${NAMESPACE}__fallback-message` }, '看板娘加载失败，请检查网络连接'),
    el('button', {
      type: 'button',
      className: `${NAMESPACE}__fallback-retry`,
      onClick: () => {
        fallbackShown = false;
        widgetRoot.innerHTML = '';
        widgetRoot.dataset.state = 'loading';
        init();
      },
    }, '重新加载'),
  ]);
  widgetRoot.append(card);
}

// ─── Public API for config page ───────────────────────────────
window.live2dCompanion = {
  getConfig() { return { ...CONFIG }; },
  getDefaultConfig() { return { ...DEFAULT_CONFIG }; },
  saveConfig(newConfig) {
    const merged = { ...DEFAULT_CONFIG, ...CONFIG, ...newConfig };
    saveUserConfig(merged);
    Object.assign(CONFIG, merged);
    return merged;
  },
  resetConfig() {
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(CONFIG, DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  },
  reload() {
    if (widgetRoot) { widgetRoot.innerHTML = ''; widgetRoot.dataset.state = 'loading'; fallbackShown = false; }
    init();
  },
};

// ─── Boot ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
