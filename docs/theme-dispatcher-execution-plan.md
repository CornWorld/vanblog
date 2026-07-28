# 方案 7 执行计划（Theme Dispatcher）

> **目标**：让 `site.activeTheme` 切换从「重建镜像」降到「<5s 热切换」。单 Node 进程 + ESM 动态 import 多个 theme handler。
>
> **前置阅读**：[`theme-dispatcher-design.md`](./theme-dispatcher-design.md)（完整设计 + spike 结论）
>
> **本文档是给 sub-agent 的执行说明书**。每个 step 是独立可委托的工作单元，含：改动文件、代码骨架、验收标准。

---

## 总体阶段

| Phase | 目标 | 步骤数 | 预估工作量 |
|---|---|---|---|
| **Phase A** | 修复现有架构不一致，让 `site.activeTheme` 至少在重启后生效 | 3 步 | 0.5 天 |
| **Phase B** | 实现 dispatcher 核心（单进程 + 动态 import + theme registry） | 4 步 | 1.5 天 |
| **Phase C** | Theme build 流程改造（`base` / `assetsPrefix`）+ PB 字段 + SDK | 3 步 | 0.5 天 |
| **Phase D** | Admin UI 改造 + palette 迁移策略 | 2 步 | 0.5 天 |
| **Phase E** | 端到端测试 + 文档更新 | 2 步 | 0.5 天 |

---

## Phase A：让现状自洽（修复 entrypoint bug）

> **目标**：不改架构，只修当前 `entrypoint.prod.sh:82` 跑 `/app/dist` 而非 `themes/<active>/dist` 的 bug。修完后 `site.activeTheme` 至少在容器重启后能生效（虽然还不是热切换）。

### Step A1：Dockerfile 把所有 theme 的 dist 都 COPY 进镜像

**当前问题**：Dockerfile 只 build `VANBLOG_ACTIVE_THEME` 一个 theme，其他 theme 不在镜像里 → 无法支持运行时切换。

**改动文件**：`Dockerfile`

**改动要点**：
1. astro-build stage 改成**循环 build 所有 theme**（遍历 `themes/*/`），不只 build active theme
2. prod stage 把整个 `themes/` COPY 到 `/var/lib/vanblog/themes/`（包含所有 dist）
3. 保留 `/etc/vanblog/active-theme` 记录**默认启动 theme**
4. 删除 `RUN ln -s "/build/themes/$(cat /etc/vanblog/active-theme)" /app` 这行（不再用 `/app` symlink）

**代码骨架**：
```dockerfile
# astro-build stage 改动：
COPY themes/ ./themes/

# 循环 build 所有 theme（而不是只 build active）
RUN for theme in themes/*/; do \
      if [ -f "$theme/astro.config.mjs" ]; then \
        echo "Building theme: $theme"; \
        (cd "$theme" && pnpm build) || exit 1; \
      fi; \
    done

# 不再只记录一个 active-theme，保留 default 作为启动 fallback
ARG VANBLOG_ACTIVE_THEME=default
RUN echo "${VANBLOG_ACTIVE_THEME}" > /build/.default-theme

# prod stage 改动：
COPY --from=astro-build /build/themes /var/lib/vanblog/themes
COPY --from=astro-build /build/.default-theme /etc/vanblog/default-theme
# 删除原来的 ln -s 那行
```

**验收**：
- `docker build --target prod -t vanblog:test .` 成功
- 镜像里 `/var/lib/vanblog/themes/default/dist/server/entry.mjs` 存在
- 镜像里 `/var/lib/vanblog/themes/` 包含所有 theme 子目录

---

### Step A2：修改 entrypoint.prod.sh 启动 default theme

**当前问题**：`entrypoint.prod.sh:82` 写死 `cd /app/dist` → 跑错地方。

**改动文件**：`docker/entrypoint.prod.sh`

**改动要点**：
- 读 `/etc/vanblog/default-theme` 获取 theme name
- `cd /var/lib/vanblog/themes/${theme}/dist` 再启动 `node ./server/entry.mjs`

**代码骨架**（替换第 80-85 行）：
```sh
# 4. Start Astro SSR server (default theme; dispatcher will replace this in Phase B)
DEFAULT_THEME=$(cat /etc/vanblog/default-theme 2>/dev/null || echo "default")
THEME_DIR="/var/lib/vanblog/themes/${DEFAULT_THEME}/dist"

if [ ! -f "${THEME_DIR}/server/entry.mjs" ]; then
  echo "[vanblog] FATAL: theme '${DEFAULT_THEME}' dist not found at ${THEME_DIR}"
  echo "[vanblog] Available themes:"
  ls /var/lib/vanblog/themes/ 2>/dev/null
  exit 1
fi

echo "[vanblog] starting Astro SSR server with theme: ${DEFAULT_THEME}"
cd "${THEME_DIR}"
HOST=127.0.0.1 PORT=4321 ASTRO_NODE_AUTOSTART=disabled node ./server/entry.mjs &
# 注意：这里直接用 startServer 而非 handler，因为 Phase A 还没有 dispatcher
HOST=127.0.0.1 PORT=4321 node -e "import('./server/entry.mjs').then(m => m.startServer())" &
```

> **注意**：Phase A 的 entrypoint 启动方式跟 Phase B 不一样。Phase A 是 `startServer()`（自启动 http server），Phase B 改成 dispatcher 接管 http server，theme 只提供 handler。为了不让 Phase A 改两次，可以**直接跳到用 dispatcher**——见 Phase B Step B1。

**简化方案**：Phase A 和 Phase B 合并实施。**跳过 Phase A 的 entrypoint 改动**，直接在 Phase B 实现完整的 dispatcher entrypoint。

**验收（Phase A 只做 Dockerfile）**：
- 镜像里所有 theme 的 dist 都存在
- `/etc/vanblog/default-theme` 内容是 `default`

---

### Step A3：删除 entrypoint 里死代码

**改动文件**：`docker/entrypoint.prod.sh`

删除或注释掉任何引用 `/app/dist` 的代码（已被 Phase A2 替换）。

**验收**：
- `grep -n "/app" docker/entrypoint.prod.sh` 无结果（除了注释）

---

## Phase B：Dispatcher 核心

> **目标**：实现 `app/src/dispatcher/index.ts`，单进程承载多个 theme handler，按 `site.activeTheme` 路由请求。

### Step B1：创建 dispatcher 模块

**新建文件**：`app/src/dispatcher/index.ts`

**职责**：
1. 监听 `127.0.0.1:4321`
2. 启动时扫描 `VANBLOG_THEMES_DIR`（默认 `/var/lib/vanblog/themes`），枚举可用 theme
3. 懒加载：首次请求某 theme 时 `await import('themes/<name>/dist/server/entry.mjs')`
4. 按 `site.activeTheme` 把请求路由给对应 handler
5. LRU 限制最多 loaded 3 个 theme
6. 全局 `unhandledRejection` / `uncaughtException` 兜底（记日志不退出）
7. `/themes/<name>/static/*` → 内部 sirv 服务 `themes/<name>/dist/client/`
8. 订阅 PB realtime `site` record 变更，更新 activeThemeName

**代码骨架**（伪代码，实施 agent 参考 `theme-dispatcher-design.md §4`）：

```ts
// app/src/dispatcher/index.ts
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import sirv from 'sirv';  // 或用 send

const THEMES_DIR = process.env.VANBLOG_THEMES_DIR || '/var/lib/vanblog/themes';
const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_LOADED = 3;

interface LoadedTheme {
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  themeJson: any;
  loadedAt: number;
  refCount: number;
}

const registry = new Map<string, LoadedTheme>();
let activeThemeName = 'default';

// 启动时读 PB 拿 activeThemeName（通过 SDK 或直接 fetch）
async function bootstrapActiveTheme(): Promise<string> {
  try {
    const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090';
    const r = await fetch(`${pbUrl}/api/collections/site/records?perPage=1`);
    const j = await r.json();
    return j?.items?.[0]?.activeTheme || 'default';
  } catch {
    return 'default';
  }
}

async function loadTheme(name: string): Promise<LoadedTheme> {
  const distDir = join(THEMES_DIR, name, 'dist');
  const entryPath = pathToFileURL(join(distDir, 'server', 'entry.mjs')).href;
  if (!existsSync(join(distDir, 'server', 'entry.mjs'))) {
    throw new Error(`theme '${name}' entry.mjs not found at ${entryPath}`);
  }
  const themeJsonPath = join(THEMES_DIR, name, 'theme.json');
  const themeJson = existsSync(themeJsonPath)
    ? JSON.parse(readFileSync(themeJsonPath, 'utf8'))
    : { name };

  // ★ 关键：ASTRO_NODE_AUTOSTART=disabled 阻止 startServer，只拿 handler
  process.env.ASTRO_NODE_AUTOSTART = 'disabled';
  const mod = await import(entryPath);

  return {
    handler: mod.handler,
    themeJson,
    loadedAt: Date.now(),
    refCount: 0,
  };
}

function evictLRU() {
  if (registry.size <= MAX_LOADED) return;
  // 找 refCount=0 且 loadedAt 最早的（非 active）
  let oldest: string | null = null;
  let oldestTime = Infinity;
  for (const [name, t] of registry) {
    if (name === activeThemeName) continue;
    if (t.refCount === 0 && t.loadedAt < oldestTime) {
      oldest = name;
      oldestTime = t.loadedAt;
    }
  }
  if (oldest) {
    console.log(`[dispatcher] LRU evicting theme: ${oldest}`);
    registry.delete(oldest);
  }
}

async function getActiveHandler(): Promise<LoadedTheme> {
  let t = registry.get(activeThemeName);
  if (!t) {
    t = await loadTheme(activeThemeName);
    registry.set(activeThemeName, t);
    evictLRU();
  }
  return t;
}

async function switchTheme(newName: string) {
  if (newName === activeThemeName) return;
  console.log(`[dispatcher] switching theme: ${activeThemeName} → ${newName}`);
  try {
    // 预加载新 theme
    if (!registry.has(newName)) {
      const t = await loadTheme(newName);
      registry.set(newName, t);
      evictLRU();
    }
    activeThemeName = newName;
    console.log(`[dispatcher] theme switched to: ${newName}`);
  } catch (err) {
    console.error(`[dispatcher] FAILED to switch to '${newName}', staying on '${activeThemeName}':`, err);
    // 不改变 activeThemeName，继续用老 theme
  }
}

// 订阅 PB realtime（site record 更新时可能要切 theme）
async function subscribeSiteChanges() {
  // 方案 1（推荐）：PB Server-Sent Events
  // GET /api/realtime/collections/site/records，监听 update 事件
  // 方案 2（fallback）：每 5s 轮询 /api/collections/site/records
  // 实施 agent 选其一实现，加错误重连
  // ...
}

const server = createServer(async (req, res) => {
  try {
    const url = req.url || '/';

    // 1. theme 静态资源
    const staticMatch = url.match(/^\/themes\/([^/]+)\/static\/(.*)$/);
    if (staticMatch) {
      const [, themeName, subPath] = staticMatch;
      const clientDir = join(THEMES_DIR, themeName, 'dist', 'client');
      if (existsSync(clientDir)) {
        req.url = '/' + subPath;  // sirv 看到的 path
        sirv(clientDir, { dev: false })(req, res, () => {
          res.statusCode = 404;
          res.end('theme asset not found');
        });
        return;
      }
    }

    // 2. 页面/API/Pack → 活跃 theme handler
    const theme = await getActiveHandler();
    theme.refCount++;
    try {
      await theme.handler(req, res);
    } finally {
      theme.refCount--;
    }
  } catch (err) {
    console.error('[dispatcher] unhandled error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('dispatcher error');
    }
  }
});

// 全局兜底：不退出进程
process.on('unhandledRejection', (reason) => {
  console.error('[dispatcher] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[dispatcher] uncaughtException:', err);
  // 生产环境可以通知 supervisor 重启自己
});

// boot
async function main() {
  activeThemeName = await bootstrapActiveTheme();
  console.log(`[dispatcher] initial active theme: ${activeThemeName}`);
  console.log(`[dispatcher] themes dir: ${THEMES_DIR}`);
  console.log(`[dispatcher] available themes:`, readdirSync(THEMES_DIR).filter(n => existsSync(join(THEMES_DIR, n, 'dist', 'server', 'entry.mjs'))));

  subscribeSiteChanges();

  server.listen(PORT, HOST, () => {
    console.log(`[dispatcher] listening on ${HOST}:${PORT}`);
  });
}

main().catch(err => {
  console.error('[dispatcher] fatal:', err);
  process.exit(1);
});
```

**依赖**：
- 需要加 `sirv` 到 `app/package.json` dependencies（或用 Node 内置 `send` 替代）

**验收**：
- 文件创建成功，TypeScript 类型正确
- `npx tsc --noEmit -p app/tsconfig.json` 无错（如果有的话）
- 单元测试（mock import）验证 registry/switchTheme/LRU 逻辑

---

### Step B2：Dispatcher 编译到 prod 镜像

**改动文件**：`Dockerfile`、`docker/entrypoint.prod.sh`

**Dockerfile 改动**：
- astro-build stage 增加 `pnpm --filter vanblog-app build`（把 dispatcher 编译成 ESM）
- prod stage COPY dispatcher 产物

或者更简单：**dispatcher 不经过 Astro build**，它是一个独立的 Node 脚本，用 `tsx` 或 `ts-node` 直接运行（或预编译成 `.mjs`）。

**推荐**：把 dispatcher 放在 `app/src/dispatcher/`，通过 `app/package.json` 的 `build` 脚本一起编译：

```json
// app/package.json
{
  "scripts": {
    "build": "astro build && tsc --outDir dist-dispatcher --module esnext --moduleResolution bundler src/dispatcher/index.ts"
  }
}
```

或更简单：dispatcher 用 `.mjs` 写，直接 `node dispatcher.mjs`，无需编译。

**entrypoint 改动**（替换 80-85 行）：
```sh
# 4. Start dispatcher (replaces direct Astro SSR server)
DEFAULT_THEME=$(cat /etc/vanblog/default-theme 2>/dev/null || echo "default")
echo "[vanblog] starting dispatcher (default theme: ${DEFAULT_THEME})"
cd /var/lib/vanblog
VANBLOG_THEMES_DIR=/var/lib/vanblog/themes \
VANBLOG_DEFAULT_THEME=${DEFAULT_THEME} \
PB_URL=http://127.0.0.1:8090 \
node /app/dist-dispatcher/dispatcher.mjs &
ASTRO_PID=$!
wait_for "http://127.0.0.1:4321/" "Dispatcher" 30 || exit 1
```

**验收**：
- 镜像里 `/app/dist-dispatcher/dispatcher.mjs` 存在
- entrypoint 启动后 dispatcher 监听 4321
- `curl http://localhost:4321/` 返回页面 HTML（而不是 502）

---

### Step B3：PB realtime 订阅（或轮询 fallback）

**改动文件**：`app/src/dispatcher/index.ts`（Step B1 里留的占位）

**职责**：dispatcher 启动后，监听 PB `site` collection 的 update 事件，当 `activeTheme` 字段变化时调 `switchTheme()`。

**两种实现（实施 agent 选一）**：

**方案 1：Server-Sent Events（PB Realtime API）**
```ts
async function subscribeSiteChanges() {
  const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090';
  const eventSource = new EventSource(`${pbUrl}/api/realtime/collections/site/records`);

  eventSource.addEventListener('record', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      const newTheme = data?.record?.activeTheme;
      if (typeof newTheme === 'string' && newTheme && newTheme !== activeThemeName) {
        switchTheme(newTheme);
      }
    } catch {}
  });

  eventSource.onerror = () => {
    console.warn('[dispatcher] realtime disconnected, will retry in 5s');
    setTimeout(subscribeSiteChanges, 5000);
  };
}
```

需要 `eventsource` npm 包。

**方案 2：轮询（更简单）**
```ts
async function pollSiteChanges() {
  const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090';
  setInterval(async () => {
    try {
      const r = await fetch(`${pbUrl}/api/collections/site/records?perPage=1`);
      const j = await r.json();
      const newTheme = j?.items?.[0]?.activeTheme;
      if (typeof newTheme === 'string' && newTheme && newTheme !== activeThemeName) {
        await switchTheme(newTheme);
      }
    } catch (err) {
      // PB 暂时不可达，跳过本轮
    }
  }, 5000).unref();
}
```

**验收**：
- 改 `site.activeTheme` → 5 秒内 dispatcher 日志输出 `switching theme`
- 新 theme 的页面生效（curl 验证）
- PB 重启时 dispatcher 不崩溃（自动重连/继续轮询）

---

### Step B4：健康检查端点 + graceful shutdown

**改动文件**：`app/src/dispatcher/index.ts`

**健康检查**：dispatcher 增加一个 `/__dispatcher_health` 端点（在所有其他路由之前匹配），返回 JSON：
```json
{
  "ok": true,
  "activeTheme": "default",
  "loadedThemes": ["default", "magazine"],
  "uptime": 12345
}
```

**Graceful shutdown**：收到 SIGTERM/SIGINT 时：
1. `server.close()` 停止接受新连接
2. 等待 in-flight 请求完成（最多 10s）
3. process.exit(0)

**验收**：
- `curl http://localhost:4321/__dispatcher_health` 返回 JSON
- `kill -TERM <pid>` 后 10s 内进程退出，无泄漏

---

## Phase C：Theme Build 流程 + SDK

> **目标**：让每个 theme build 时自带 `base` 前缀，资源 URL 自带 `/themes/<name>/`。

### Step C1：修改 theme astro.config.mjs 模板

**改动文件**：
- `themes/default/astro.config.mjs`（当前唯一的 theme）
- `scripts/theme-init.mjs`（新建 theme 时的脚手架脚本，如果存在）

**改动要点**：
1. 加 `base: '/themes/<name>/'`
2. 加 `build.assetsPrefix: '<name>/_astro/'`（让 _astro 资源也带前缀）
3. `<name>` 从环境变量 `VANBLOG_THEME_NAME` 读，或从 `package.json` name 读

**代码骨架**（`themes/default/astro.config.mjs`）：
```js
import { defineConfig, memoryCache } from 'astro/config';
import { readFileSync } from 'node:fs';
// ... 现有 imports ...

// 从 package.json 或环境变量拿 theme name
const themeName = process.env.VANBLOG_THEME_NAME
  || JSON.parse(readFileSync(new URL('./theme.json', import.meta.url), 'utf8')).name;

export default defineConfig({
  output: 'server',
  base: `/themes/${themeName}/`,           // ← 新增
  build: {
    assetsPrefix: `${themeName}/_astro/`,  // ← 新增
  },
  adapter: node({ mode: 'standalone' }),
  // ... 其他配置不变 ...
});
```

**验收**：
- `cd themes/default && VANBLOG_THEME_NAME=default pnpm build`
- `grep -o '"base":"[^"]*"' themes/default/dist/server/chunks/server_*.mjs` 显示 `/themes/default/`
- 渲染的 HTML 里 `<_astro/foo.js>` → `/themes/default/_astro/foo.js`

---

### Step C2：Dockerfile build 时注入 theme name

**改动文件**：`Dockerfile`

**改动要点**：循环 build 所有 theme 时，为每个 theme 注入 `VANBLOG_THEME_NAME`：

```dockerfile
RUN for theme in themes/*/; do \
      name=$(basename "$theme"); \
      if [ -f "$theme/astro.config.mjs" ]; then \
        echo "Building theme: $name"; \
        (cd "$theme" && VANBLOG_THEME_NAME="$name" pnpm build) || exit 1; \
      fi; \
    done
```

**验收**：
- 每个 theme 的 dist 里 manifest.base 都对应自己的 name
- `docker build` 成功

---

### Step C3：site schema 加 paletteMigrationMode 字段

**改动文件**：
- `sdk/src/models/site.ts`：加 `paletteMigrationMode` 字段
- `vault/pb_migrations/` 新增 migration：`1783200000_add_palette_migration_mode.go`
- `vault/internal/validation/models.js`（如果是自动生成的，从 schema 重新生成）

**SDK 改动**（`sdk/src/models/site.ts`）：
```ts
const PaletteMigrationModeSchema = z.enum(['keep', 'silent', 'prompt']).default('keep');

// 加到 SiteSchema.extend({...})
paletteMigrationMode: PaletteMigrationModeSchema.optional(),
```

**PB Migration**（`vault/pb_migrations/1783200000_add_palette_migration_mode.go`）：
```go
func init() {
  m.Register(func(db core.App) error {
    col, err := db.FindCollectionByNameOrId("site")
    if err != nil { return err }
    col.Fields.Add(&core.SelectField{
      Name: "paletteMigrationMode",
      Values: []string{"keep", "silent", "prompt"},
    })
    return db.Save(col)
  }, func(db core.App) error {
    col, err := db.FindCollectionByNameOrId("site")
    if err != nil { return err }
    col.Fields.RemoveByName("paletteMigrationMode")
    return db.Save(col)
  })
}
```

**验收**：
- `pnpm --filter sdk build` 成功
- PB 启动后 site collection 有 `paletteMigrationMode` 字段，默认 `keep`

---

## Phase D：Admin UI 改造

### Step D1：site.astro 的「主题与评论」fieldset 改造

**改动文件**：`app/src/pages/admin/site.astro`

**改动要点**：
1. 「调色盘」和「活动主题」合并到一个fieldset，标题「外观」
2. 「活动主题」下拉下方提示：「切换立即生效（<5s）」
3. 高级选项折叠（`<details>`）：
   - 调色盘
   - 暗色模式（已有）
   - paletteMigrationMode（新）
4. 主题切换前先 `confirm()`：「确认切换到 magazine？当前调色盘将保留」（根据 migrationMode 不同提示）

**代码骨架**（替换 72-120 行的「主题与评论」fieldset）：
```html
<fieldset class="grid grid-cols-[160px_1fr] gap-2 items-center border border-[var(--border)] p-4">
  <legend>外观</legend>

  <label>活动主题</label>
  <div class="col-span-2 flex flex-col gap-1">
    <select name="activeTheme" id="active-theme-select" data-current={field('activeTheme')}>
      <option value="default">default</option>
    </select>
    <small class="text-[var(--text-muted)]">切换立即生效（&lt;5s），无需重建镜像</small>
  </div>
  <script is:inline>
    fetch('/api/themes')
      .then(r => r.json())
      .then(data => {
        const sel = document.getElementById('active-theme-select');
        if (!sel) return;
        const current = sel.getAttribute('data-current') || 'default';
        sel.innerHTML = '';
        (data.themes || []).forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.name;
          opt.textContent = t.label || t.name;
          if (t.name === current) opt.selected = true;
          sel.appendChild(opt);
        });
      });
  </script>

  <details class="col-span-2 mt-2">
    <summary class="cursor-pointer text-sm text-[var(--text-muted)]">高级选项</summary>
    <div class="grid grid-cols-[160px_1fr] gap-2 items-center mt-2">

      <label>调色盘</label>
      <select name="palette" id="palette-select" data-current={field('palette')}>
        <option value="default">default</option>
      </select>
      <script is:inline>
        fetch('/api/palettes')
          .then(r => r.json())
          .then(data => {
            const sel = document.getElementById('palette-select');
            if (!sel) return;
            const current = sel.getAttribute('data-current') || 'default';
            sel.innerHTML = '';
            (data.palettes || []).forEach(p => {
              const opt = document.createElement('option');
              opt.value = p.name;
              opt.textContent = p.label || p.name;
              if (p.name === current) opt.selected = true;
              sel.appendChild(opt);
            });
          });
      </script>

      <label>默认主题模式</label>
      <select name="defaultTheme">
        <option value="auto" selected={field('defaultTheme') === 'auto'}>跟随系统</option>
        <option value="light" selected={field('defaultTheme') === 'light'}>始终亮色</option>
        <option value="dark" selected={field('defaultTheme') === 'dark'}>始终暗色</option>
      </select>

      <label>切换主题时调色盘</label>
      <select name="paletteMigrationMode">
        <option value="keep" selected={field('paletteMigrationMode') === 'keep'}>保持当前（默认）</option>
        <option value="silent" selected={field('paletteMigrationMode') === 'silent'}>自动迁移到推荐值</option>
        <option value="prompt" selected={field('paletteMigrationMode') === 'prompt'}>每次询问</option>
      </select>
    </div>
  </details>
</fieldset>
```

**JS 改动**（form submit handler）：
- 在提交前检查 activeTheme 是否改变
- 如果改变且 paletteMigrationMode === 'prompt'，弹 confirm 框
- 提交字段加 `paletteMigrationMode`

**验收**：
- `/admin/site` 渲染新外观 fieldset
- 「活动主题」下拉自动列出所有已安装 theme
- 展开高级选项能看到调色盘、暗色模式、迁移模式
- 切换 theme 后点保存，页面提示「已保存」，5s 内 dispatcher 日志显示切换

---

### Step D2：theme.json 扩展 recommendedPalette 字段

**改动文件**：
- `themes/default/theme.json`：加 `"recommendedPalette": "default"`
- `app/src/pages/api/themes.ts`：返回 recommendedPalette/supportedPalettes 等新字段

**theme.json**：
```json
{
  "name": "default",
  "label": "Vanblog Default",
  "version": "0.1.0",
  "recommendedPalette": "default",
  "paletteMigrationMode": "keep"
}
```

**themes.ts**：`ThemeMeta` interface 扩展，读取时传递新字段。

**验收**：
- `curl /api/themes` 返回的 theme 对象包含 `recommendedPalette`

---

## Phase E：端到端测试 + 文档

### Step E1：创建第二个 theme 用于测试切换

**新建目录**：`themes/minimal/`

**最小内容**（用 `scripts/theme-init.mjs` 或手动创建）：
- `theme.json`：name=`minimal`，label=`极简风`
- `astro.config.mjs`：复制 default 的，改 themeName
- `src/pages/`：复制 default 的薄壳 pages
- `src/builtin-overrides/`：加一个 `layouts/BaseLayout.astro`，只做最简单的改动（比如换 banner 颜色）

**验收**：
- `themes/minimal/dist/server/entry.mjs` 能 build 出来
- 镜像里有 `themes/default/` 和 `themes/minimal/`
- admin 下拉显示两个选项

---

### Step E2：端到端测试 + 更新文档

**测试脚本**：`scripts/test-theme-switch.mjs`

测试流程：
1. 启动容器
2. `curl /` 返回 default theme 的 HTML（带 `/themes/default/_astro/`）
3. `curl /api/themes` 返回 2 个 theme
4. `curl -X POST /api/collections/site/records/<id> -d '{"activeTheme":"minimal"}'`（用 admin auth）
5. 等 6 秒（dispatcher realtime + 切换）
6. `curl /` 返回 minimal theme 的 HTML（带 `/themes/minimal/_astro/`）
7. `curl /themes/default/_astro/foo.js` 返回 200（静态资源仍可访问）
8. `curl /themes/minimal/_astro/foo.js` 返回 200
9. `curl /p/bookmarks` 返回 200（Pack 路由正常）
10. `curl /api/posts` 返回 200（API 不受影响）

**文档更新**：
- `docs/theme-implementer-guide.md` §10.3 更新切换表格（dev/prod 都是「<5s 生效」）
- `docs/agent-theme-architecture.md` 同步
- `README.md` 如果提到 theme 切换需要 rebuild，更新

**验收**：
- 测试脚本全部通过
- 文档不再提「重建镜像」

---

## 执行顺序建议

**强烈建议按 A → C → B → D → E 顺序**（而非 B 先行）：

1. **Phase A** 只改 Dockerfile，让所有 theme 的 dist 都进镜像，不影响现有功能
2. **Phase C** 让 theme build 自带 base，这是 dispatcher 能工作的前提（否则资源 URL 冲突）
3. **Phase B** 实现 dispatcher，此时 theme dist 已经正确
4. **Phase D** admin UI，测试切换
5. **Phase E** 端到端

**理由**：C 的 base 配置是 B 的硬依赖。如果 B 先做，dispatcher 跑起来后资源 URL 还是 `/_astro/`，多 theme 切换会 404。

---

## 风险与回滚

| Phase | 回滚方法 |
|---|---|
| A | 改回 Dockerfile 单 theme build |
| B | entrypoint 改回 `cd themes/default/dist && node server/entry.mjs`（直接 startServer，不用 dispatcher） |
| C | 删除 astro.config 的 base/assetsPrefix 两行 |
| D | 改回 admin/site.astro 原 fieldset |
| E | 无需回滚 |

**每个 Phase 都可以独立合并**，互不阻塞。

---

## sub-agent 委托建议

| Step | 适合的 sub-agent | 工作量 | 备注 |
|---|---|---|---|
| A1 | general | 小 | 纯 Dockerfile |
| A2/A3 | 跳过（合到 B2） | - | - |
| B1 | general | 中 | dispatcher 核心，需参考 §4 |
| B2 | general | 小 | entrypoint 改动 |
| B3 | general | 小 | realtime 或轮询 |
| B4 | general | 小 | 健康检查 + shutdown |
| C1 | general | 小 | astro.config 改动 |
| C2 | general | 极小 | Dockerfile ENV |
| C3 | general | 中 | SDK + migration |
| D1 | general | 中 | UI 改造 |
| D2 | general | 极小 | theme.json + API |
| E1 | general | 中 | 创建 minimal theme |
| E2 | QA | 中 | 测试脚本 |

**推荐分 3 批委托**：
- 批次 1：A1 + C1 + C2（让 theme build 自带 base，镜像含所有 theme）
- 批次 2：B1 + B2 + B3 + B4（dispatcher 完整实现）
- 批次 3：C3 + D1 + D2 + E1 + E2（UI + 测试）

---

## 完成标志

全部完成后，以下场景应该 work：

1. ✅ `docker build` 镜像里包含 N 个 theme 的 dist
2. ✅ 容器启动后 dispatcher 监听 4321，加载 default theme
3. ✅ admin `/admin/site` 选主题并保存
4. ✅ 5 秒内 dispatcher 自动切换到新 theme
5. ✅ 页面 HTML 资源 URL 带 `/themes/<name>/` 前缀
6. ✅ 切换前后 Pack 路由 `/p/*` 正常工作
7. ✅ 切换不影响 PB / API
8. ✅ dispatcher 进程不崩溃（unhandled rejection 兜底）
