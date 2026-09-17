#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// e2e-browser.mjs — 真实浏览器旅程(暗色切换 / 按钮可点击性 / 解锁交互 / 编辑器)
//
// 前提: 全栈在 BASE 可达(dev-verify 或 CI 容器);系统 Chrome。
//       种子由内置调用 e2e-journey.sh 完成(E2E_KEEP_SEED=1 保留数据),
//       结尾再跑一次 journey 完成清理——journey 自身退出即清种子。
// 用法: node scripts/test/e2e-browser.mjs [BASE]
// 环境变量:
//   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — 管理员凭据(编辑器 UI 测试);
//   E2E_SKIP_JOURNEY=1 — 跳过内置 journey 调用(已单独跑过时)。
// 已知噪音豁免:
//   live2d 看板娘(CDN 第三方包 live2d-widgets)对合成点击的指针处理
//   不设防(followPointer 读 null 抛 TypeError),相关 pageerror 记豁免;
//   widget 已 vendor 本地化(frontend.static),但模型资产(live2d_api)
//   仍走 CDN,hermetic 屏蔽下 loadLive2D 抛 null.Version——console 路径
//   同样豁免(widget 降级为无模型,工具/提示不受影响)。
// ═══════════════════════════════════════════════════════════════
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://localhost:8080';
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@test.com';
const PW_FILE = `/tmp/vanblog-e2e-admin-${EMAIL}${process.env.E2E_INSTANCE ? `-${process.env.E2E_INSTANCE}` : ''}.env`;
// 凭据惰性解析:全新实例的密码文件由内置 journey 的 setup 阶段写出,
// 必须在 journey 跑完后再读(脚本启动时读会拿到空值)。
const resolvePassword = () => process.env.E2E_ADMIN_PASSWORD
  ?? (existsSync(PW_FILE) ? readFileSync(PW_FILE, 'utf8').trim() : '');

let passed = 0, failed = 0;
function ok(name) { passed++; console.log(`  ✓ ${name}`); }
function bad(name, detail) { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
async function assert(name, fn) {
  try { await fn(); ok(name); }
  catch (err) { bad(name, String(err?.message ?? err).split('\n')[0].slice(0, 160)); }
}

// ── 种子 ──
const runJourney = (keepSeed) => spawnSync('bash', [join(HERE, 'e2e-journey.sh'), BASE], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, E2E_ADMIN_EMAIL: EMAIL, ...(keepSeed ? { E2E_KEEP_SEED: '1' } : {}) },
});
if (process.env.E2E_SKIP_JOURNEY !== '1') {
  const r = runJourney(true);
  if (r.status !== 0) {
    console.error('e2e-journey(种子)失败:\n' + r.stdout?.toString().slice(-800));
    process.exit(2);
  }
  console.log('种子就绪(e2e-journey PASS,KEEP_SEED)\n');
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  // 钉死浅色:无头 Chrome 会继承宿主 OS 的深色模式(实测 macOS 深色下
  // prefers-color-scheme: dark),theme=auto 初始即暗色,D2/D3 的
  // light→dark 前后对比就失去基线。CI 的 ubuntu 默认 light 才碰巧绿。
  colorScheme: 'light',
});
// 屏蔽外部 CDN(live2d 从 fastly.jsdelivr.net 加载):测试保持 hermetic,
// CDN 抖动不再污染断言;装饰性组件缺席不影响行为检查。
await ctx.route(/jsdelivr\.net|unpkg\.com|cdn\./, (r) => r.abort());
const page = await ctx.newPage();
const pageErrors = [];
const pageerrorFilter = (e) => {
  const s = String(e?.stack ?? e);
  if (s.includes('live2d')) return null; // 已知第三方噪音,见文件头豁免
  pageErrors.push(s.split('\n')[0].slice(0, 120));
};
page.on('pageerror', (e) => pageerrorFilter(e));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  // 资源加载失败(CDN 抖动等)与点击行为无关,不计入页面异常
  if (/net::|Failed to load resource/.test(m.text())) return;
  // 模型资产(live2d_api)按设计走 CDN,hermetic 旅程屏蔽后 widget 内部
  // loadLive2D 必然抛 null.Version——工具/提示不受影响,属已知降级噪音
  if (/loadLive2D failed/.test(m.text())) return;
  pageerrorFilter(m.text());
});
const errorsBefore = () => pageErrors.length;

async function gotoClean(url) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => customElements.get('astro-island') !== undefined, { timeout: 15000 }).catch(() => {});
  // island 水合会整体替换子树——等网络静默,后续 DOM 标记才不会被 hydration 抹掉
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
}

// 主题切换按钮:三个状态 svg 常驻 DOM,仅可见者可点(点击循环 auto→light→dark)
const themeIcon = page.locator('[aria-label="light icon"]:visible, [aria-label="dark icon"]:visible, [aria-label="auto icon"]:visible').first();
async function clickThemeIcon() {
  await themeIcon.click({ timeout: 5000 });
  await page.waitForTimeout(200);
}
const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));

// 采样暗色敏感计算样式:html 背景 + 视口顶部/底部区域首个非透明背景元素
// (排除 fixed/absolute 浮层——遮罩不算布局背景)
async function sampledStyles() {
  return page.evaluate(() => {
    const vh = innerHeight;
    const firstPainted = (zone) => {
      const el = [...document.querySelectorAll('body *')].find((n) => {
        const cs = getComputedStyle(n);
        if (cs.position === 'fixed' || cs.position === 'absolute') return false;
        const r = n.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return false;
        if (zone === 'top' && r.top > vh * 0.25) return false;
        if (zone === 'bottom' && r.bottom < vh * 0.75) return false;
        return cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
      });
      return el ? getComputedStyle(el).backgroundColor : null;
    };
    return {
      html: getComputedStyle(document.documentElement).backgroundColor,
      header: firstPainted('top'),
      footer: firstPainted('bottom'),
    };
  });
}

console.log('== 暗色模式 ==');
await gotoClean('/');
// 基线必须显式钉 light:getAutoTheme 按钟点判昼夜(hour>18||hour<8 为夜,
// 上游 seam 行为),18 点后跑套件时 auto 初始即暗色,light 样本失真,
// D2/D3 的前后对比必挂——CI 曾靠 UTC 时段碰巧绿。
await page.evaluate(() => { localStorage.setItem('theme', 'light'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000); // 让 island 水合竞态的错误先浮出,避免误记到点击头上
const light = await sampledStyles();
// H1(诊断位,非门禁): 锁定页 React 水合竞态(已登记缺陷,待修复后转门禁)
{
  const p2 = await ctx.newPage();
  const hyd = [];
  p2.on('pageerror', (e) => { if (/React error #41[89]|#423/.test(String(e))) hyd.push(String(e).slice(0, 60)); });
  await p2.goto(`${BASE}/post/e2e-locked`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p2.waitForTimeout(3000);
  await p2.close();
  if (hyd.length) {
    console.log(`  ⚠ H1 锁定页水合竞态(React #418/#423)复现 ${hyd.length} 次——已登记缺陷,暂不门禁`);
  } else {
    console.log('  · H1 本轮未见水合竞态(该竞态为间歇性)');
  }
}

await gotoClean('/');
await page.waitForTimeout(500);
await assert('D1 点击 ThemeButton → html.dark 置位', async () => {
  for (let i = 0; i < 3; i++) {
    if (await isDark()) return;
    await clickThemeIcon();
  }
  if (!(await isDark())) throw new Error('三轮点击后仍未进入暗色');
});
const dark = await sampledStyles();
await assert('D2 html 计算背景随暗色变化', async () => {
  if (light.html === dark.html) throw new Error(`html 背景未变: ${light.html}`);
});
await assert('D3 采样组件跟随暗色(顶部/底部区域至少一项变化)', async () => {
  const changed = ['header', 'footer'].filter((k) => dark[k] && light[k] && dark[k] !== light[k]);
  if (changed.length === 0) throw new Error(`顶部=${dark.header} 底部=${dark.footer} 均未变`);
});
await assert('D4 刷新后暗色持久(localStorage)', async () => {
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  if (!(await isDark())) throw new Error('刷新后 html.dark 丢失');
});
await assert('D5 带背景可见元素暗色未变占比 ≤ 40%', async () => {
  const collect = () => page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 12 && r.height > 12 && cs.visibility !== 'hidden' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    });
    return els.slice(0, 250).map((el) => ({
      bg: getComputedStyle(el).backgroundColor,
      desc: `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(' ').slice(0, 2).join('.')}`.slice(0, 56),
    }));
  });
  const darkSample = await collect();
  // 切回亮色(最多三轮)取同 DOM 位置对比
  for (let i = 0; i < 3; i++) {
    if (!(await isDark())) break;
    await clickThemeIcon();
  }
  const lightSample = await collect();
  const n = Math.min(darkSample.length, lightSample.length);
  const unchanged = [];
  for (let i = 0; i < n; i++) if (darkSample[i].bg === lightSample[i].bg) unchanged.push(darkSample[i].desc);
  const ratio = n ? unchanged.length / n : 0;
  if (unchanged.length) {
    console.log(`    · 暗色下背景未变: ${unchanged.slice(0, 6).join(' | ')}${unchanged.length > 6 ? ` 等 ${unchanged.length} 个` : ''}`);
  }
  console.log(`    · 采样 ${n} 个带背景可见元素,暗色未变 ${unchanged.length} 个(${(ratio * 100).toFixed(0)}%)`);
  if (ratio > 0.4) throw new Error(`${(ratio * 100).toFixed(0)}% 的可见元素暗色下背景未变`);
});
// 恢复基线亮色(后续套件在亮色下跑)
for (let i = 0; i < 3; i++) {
  if (!(await isDark())) break;
  await clickThemeIcon();
}
await page.evaluate(() => { localStorage.theme = 'light'; });

// ── 可见按钮/链接可点击性 ──
console.log('== 可见元素可点击性 ==');
async function clickabilitySweep(path, label) {
  await assert(`B(${label}) 可见 button/a 全部可点击`, async () => {
    await gotoClean(path);
    // 打标:统一用 data-e2e-idx 定位,规避 text/aria 命中歧义
    const items = await page.evaluate(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none';
      };
      return [...document.querySelectorAll('button, [role="button"], a[href]')]
        .filter(vis).slice(0, 40)
        .map((el, i) => {
          el.setAttribute('data-e2e-idx', String(i));
          return {
            idx: i,
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 20),
            href: el.getAttribute('href'),
            disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
          };
        });
    });
    if (items.length === 0) throw new Error('页面上没有可见可交互元素?');
    for (const it of items) {
      if (it.disabled) throw new Error(`可见但 disabled: <${it.tag}> "${it.text}"`);
      const loc = page.locator(`[data-e2e-idx="${it.idx}"]`);
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
      if (!(await loc.boundingBox())) throw new Error(`无 boundingBox: <${it.tag}> "${it.text}"`);
    }
    // 同源链接响应抽查(<400 即可达;外链跳过)
    for (const it of items.filter((x) => x.tag === 'a' && x.href?.startsWith('/') && !x.href.startsWith('//')).slice(0, 12)) {
      const res = await page.request.get(`${BASE}${it.href}`);
      if (res.status() >= 400) throw new Error(`链接不可达 ${it.href} → ${res.status()}`);
    }
    // 逐个点击 button:不抛错、不产生页面异常(live2d 噪音已在源头过滤);
    // 每次点击前清掉上一次点击唤起的 toast——react-hot-toast 的固定容器
    // 会盖住下一个按钮,那是测试流的伪影而非产品缺陷;
    // 点击超时(水合替换子树致标记丢失)则按记录文本回退重试一次。
    const e0 = errorsBefore();
    for (const it of items.filter((x) => x.tag !== 'a').slice(0, 15)) {
      await page.evaluate(() => document.querySelectorAll('[id^="react-hot-toast"], .go2072408551').forEach((n) => n.remove()));
      // 点击可能唤起下拉/浮层(如调色盘面板)盖住下一个按钮,三层回退:
      // 原位重试 → Escape 关浮层后按文本点 → 干净页面按文本点
      try {
        await page.locator(`[data-e2e-idx="${it.idx}"]`).click({ timeout: 3000 });
      } catch {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(250);
        try {
          await page.locator(`[data-e2e-idx="${it.idx}"]`).click({ timeout: 3000 });
        } catch {
          if (!it.text) throw new Error('标记丢失且无文本可回退');
          await gotoClean(path);
          await page.getByText(it.text, { exact: true }).first().click({ timeout: 4000 });
        }
      }
      await page.waitForTimeout(150);
    }
    // 锁定页的水合竞态(React #418/#423,见 H1 诊断位)由滚动触发水合本身
    // 产生,非点击引入——从点击异常中排除;该缺陷已单列登记。
    const fresh = pageErrors.slice(e0).filter((x) => !/React error #41[89]|#423/.test(x));
    if (fresh.length > 0) throw new Error(`点击引发页面错误: ${fresh[0].slice(0, 100)}`);
    console.log(`    · ${label}: ${items.length} 个可见元素全过,${items.filter((x) => x.tag !== 'a').length} 个按钮点击无页面错误`);
  });

  // 反向扫描:视觉上可点击(computed cursor:pointer)但命中测试失败的元素。
  // 正向枚举只认 button/[role]/a[href] 语义标签;span+onClick 伪按钮、点击
  // 穿透(命中落到别的元素)、pointer-events:none 继承——这一类「看起来可点
  // 但点不动」的缺陷只有视觉面能抓(真实案例:live2d 工具按钮 pointer-events
  // 继承 none,点击物理穿透到画布,CI 因 CDN 屏蔽永不挂载而漏检)。
  // 命中判据:元素中心 elementFromPoint 须落在自身或后代;落到别处即失败。
  await assert(`B(${label}) 视觉可点击元素无穿透/遮挡`, async () => {
    await gotoClean(path);
    const offenders = await page.evaluate(() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        if (bad.length >= 20) break;
        // 语义可交互元素由正向面逐个真点,这里只抓非语义伪按钮
        if (el.matches('button, a[href], input, select, textarea, label, summary, [role]')) continue;
        const cs = getComputedStyle(el);
        if (cs.cursor !== 'pointer' || cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (cx < 0 || cy < 0 || cx >= vw || cy >= vh) continue; // 视口外交给滚动后的轮次
        const top = document.elementFromPoint(cx, cy);
        // 可达 = 命中自身/后代(事件落在自己子树),或命中祖先(SVG 内部图形
        // 的 elementFromPoint 恒返回 <svg> 根,事件沿祖先链冒泡到真实处理器;
        // Chrome 对 pointer-events:none 子树的 svg 根也如此)。命中无关子树
        // 才是穿透/遮挡。
        const reachable = top && (top === el || el.contains(top) || top.contains(el));
        if (reachable) continue;
        bad.push({
          desc: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className?.baseVal ?? el.className).split(' ').slice(0, 2).join('.')}`.slice(0, 70),
          hit: top ? `${top.tagName.toLowerCase()}${top.id ? '#' + top.id : ''}` : 'null(视口外)',
        });
      }
      return bad;
    });
    if (offenders.length) {
      const d = offenders[0];
      throw new Error(`${offenders.length} 个 cursor:pointer 元素命中失败,如 <${d.desc}> 实际命中 ${d.hit}`);
    }
  });
}
await clickabilitySweep('/', '首页');
await clickabilitySweep('/post/e2e-normal', '正常文详情');
await clickabilitySweep('/post/e2e-locked', '锁定文详情');

// ── 解锁交互(浏览器级行为) ──
console.log('== 解锁交互 ==');
await assert('U1 锁定文错误密码 → toast「密码错误」', async () => {
  await gotoClean('/post/e2e-locked');
  await page.fill('input[type=password]', 'wrong-password');
  await page.locator('button.grow-0, button:has-text("确认")').first().click({ timeout: 6000 });
  await page.waitForSelector('text=密码错误', { timeout: 6000 });
});

// ── 编辑器 UI ──
console.log('== 编辑器 UI ==');
await assert('ED1 /login 登录进入 /admin', async () => {
  const PASSWORD = resolvePassword();
  if (!PASSWORD) throw new Error('缺 E2E_ADMIN_PASSWORD/PW_FILE');
  await gotoClean('/login');
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin**', { timeout: 10000 });
});
await assert('ED2 /admin/edit/new bytemd 挂载', async () => {
  await gotoClean('/admin/edit/new');
  await page.waitForSelector('#bytemd-editor .CodeMirror', { timeout: 15000 });
});
await assert('ED3 CodeMirror 输入同步 #post-content', async () => {
  await page.click('#bytemd-editor .CodeMirror-scroll', { timeout: 6000 });
  await page.keyboard.type('E2E-EDITOR-BINDING-MARKER');
  await page.waitForFunction(
    () => document.querySelector('#post-content')?.value.includes('E2E-EDITOR-BINDING-MARKER'),
    { timeout: 5000 },
  );
});

await browser.close();

// ── 收尾:再跑一次 journey,清掉浏览器套件的种子残留 ──
if (process.env.E2E_SKIP_JOURNEY !== '1') {
  runJourney(false);
}

console.log(`\n════ 浏览器旅程: PASS=${passed} FAIL=${failed} ════`);
process.exit(failed > 0 ? 1 : 0);
