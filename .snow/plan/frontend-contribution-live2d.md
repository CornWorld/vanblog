# Frontend Contribution 宿主扩展与 Live2D Demo Pack

## Context

当前 Pack registry 只支持 metadata、导航和 `/p/<pack>` 页面注入，无法满足 Live2D 看板娘、全局音乐播放器、鼠标特效等真实插件需求。用户通常期望 widget 出现在所有公开博客页面的固定 viewport 位置，而不是只存在于 `/p/<pack>` 演示页。

本任务接受修改宿主基础设施，但不为 Live2D 写特判。目标是增加一个受控、通用的 Frontend Contribution contract，再由新的 `live2d-companion` Pack 作为第一个真实消费者。

## Analysis

- **Affected files**:
  - `app/integrations/packs/resolver.mjs`：发现并校验 Pack frontend contribution 声明。
  - `app/integrations/packs/index.mjs`：生成包含安全资源引用的 virtual frontend registry，并加入 watcher。
  - `app/src/env.d.ts`：声明 virtual frontend registry 类型。
  - `app/src/layouts/BaseLayout.astro`：在公共页面 head/body/footer 安全消费全局 contributions。
  - `app/integrations/packs/resolver.test.mjs`：覆盖声明校验、排序、路径安全和非法 scope。
  - `packs/live2d-companion/*`：新的 demo Pack，只消费通用 contract。
  - `docs/future-pack-architecture.md`：记录 Frontend Contribution ownership、边界和安全模型。
- **New files**:
  - `packs/live2d-companion/pack.json`
  - `packs/live2d-companion/pack.ts`
  - `packs/live2d-companion/frontend/live2d-companion.css`
  - `packs/live2d-companion/frontend/live2d-companion.js`
  - `packs/live2d-companion/pages/index.astro`：配置/演示页。
- **Dependencies**: 现有 Astro integration、Vite virtual module、浏览器原生 DOM API；不新增根目录依赖。Live2D 第三方 loader/model URL 必须由 Pack 资源声明或配置，失败时提供 fallback。
- **Complexity**: complex。
- **Risk areas**:
  - 任意 Pack 资源注入可能造成 XSS、页面崩溃或 CSS 污染。
  - 当前 `pack.json` 是严格 identity 文件，不能直接塞入 frontend 配置；声明应放在 `pack.ts`，但必须区分 client metadata 与 host contribution。
  - SSR 阶段不能访问 `window`/`document`；global script 必须 client-only。
  - 只允许 public scope，不能注入 admin/API 页面。
  - Pack 全局 script 需要防重复初始化，并能处理导航、资源失败、移动端和 reduced-motion。

## Target Contract

Pack `pack.ts` 保持 default object，但增加受控字段：

```ts
export default {
  title: "Live2D Companion",
  nav: { label: "Live2D", href: "/p/live2d-companion" },
  frontend: {
    scope: "public",
    styles: ["frontend/live2d-companion.css"],
    scripts: ["frontend/live2d-companion.js"],
  },
};
```

Resolver 只暴露安全的 build-time virtual registry，不暴露绝对文件系统路径：

```ts
interface PackFrontendContribution {
  scope: "public";
  styles: string[];
  scripts: string[];
}
```

Integration 将 Pack 内相对路径解析为受控 Vite import/module URL；禁止 `..`、绝对路径、任意 URL、admin/API scope 和非 frontend 目录资源。

`BaseLayout.astro` 仅渲染 public contribution：

- head：Pack CSS。
- body 末尾：Pack global scripts。
- 不允许 arbitrary HTML fragment。
- script 使用 module/client-safe 输出，Pack 自己负责 mount DOM；更稳健的实现可让 script 创建唯一 namespace mount。

## Phases

### Phase 1: Lock and implement the generic contribution contract

- **Goal**: 扩展 Pack registry，使 Pack 能声明受控 public CSS/JS contribution。
- **Files**: `resolver.mjs`, `index.mjs`, `resolver.test.mjs`, `env.d.ts`。
- **Steps**:
  - [ ] 定义 frontend 字段的最小 schema 和 `public` scope。
  - [ ] 校验资源路径必须位于 Pack 的 `frontend/` 目录，禁止 traversal、绝对路径、外部 URL 和重复资源。
  - [ ] 将安全路径转成 Vite 可消费的 virtual registry 引用，不能向客户端暴露绝对源码路径。
  - [ ] 增加 discovery sorting、非法字段、非法路径、非法 scope、合法 contribution 测试。
- **Done when**: resolver tests 通过，virtual registry 仅含安全 client-facing contribution 数据。

### Phase 2: Consume contributions in BaseLayout

- **Goal**: 让所有使用 BaseLayout 的公开页面自动获得 Pack global CSS/JS。
- **Files**: `BaseLayout.astro`。
- **Steps**:
  - [ ] head 中渲染所有 public contribution styles。
  - [ ] body 末尾加载所有 public contribution scripts。
  - [ ] 明确 SSR/client 边界，避免服务端执行 browser-only code。
  - [ ] 保持现有 SEO、导航、theme、admin 页面行为不变；只由 BaseLayout 消费 public contributions。
- **Done when**: 既有页面和 Pack 页面均能构建，未注入 admin/API 路由，暂无 runtime crash。

### Phase 3: Implement Live2D Companion Pack only through the contract

- **Goal**: 用通用 contribution API 实现真实博客场景的全站 Live2D 看板娘。
- **Files**: `packs/live2d-companion/pack.json`, `pack.ts`, `frontend/*`, `pages/index.astro`。
- **Steps**:
  - [ ] 创建最小 identity 和 metadata/frontend 声明，不修改宿主代码来适配 Live2D。
  - [ ] global CSS 使用唯一 namespace，固定 viewport 右下角，不占用正文布局，支持移动端隐藏和 reduced-motion。
  - [ ] global JS 实现一次性 mount、第三方 loader/model loader、loading/error/fallback、关闭/重新打开、键盘操作和基本互动。
  - [ ] `/p/live2d-companion` 提供配置说明和 demo 状态，不把配置塞进 `pack.json`。
- **Done when**: 全站公开页面显示 widget；第三方资源失败不影响博客；Pack 页面提供可验证的配置/降级演示。

### Phase 4: Verification, documentation and security review

- **Goal**: 证明通用能力可复用且没有把 Live2D 特判泄漏进宿主。
- **Files**: tests、docs、plan。
- **Steps**:
  - [ ] 运行 Pack resolver tests、model tests、Astro check/build。
  - [ ] 检查构建产物包含 global CSS/JS 和 `/p/live2d-companion` route。
  - [ ] 运行 diff check，确认新增 Live2D 之外的宿主修改仅限通用 contribution infrastructure。
  - [ ] 记录安全限制、未来 admin scope 和 trusted Pack 发行边界。
- **Done when**: build/tests/diagnostics 全部通过，无运行时崩溃，文档与实际 contract 一致。

## Risks & Mitigations

| Risk                       | Impact               | Mitigation                                                                                                                           |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Pack CSS 覆盖宿主样式      | 全站布局异常         | 只允许 Pack 自带 frontend CSS，文档要求唯一 namespace；Live2D CSS 全部使用 `[data-vanblog-pack="live2d-companion"]` 前缀             |
| Pack JS 执行任意恶意逻辑   | XSS/数据泄露         | Frontend contributions 视为 trusted build-time Pack code；不允许远程脚本 URL，资源必须是本地 Pack 文件；未来再加入签名/审核/权限模型 |
| SSR 执行 browser code      | 构建失败或服务端崩溃 | 仅以 client module script 加载，脚本内部检查 `window`/`document`                                                                     |
| 全局注入影响 admin         | 管理页面异常         | 当前 contract 只接受 `scope: public`，BaseLayout 只用于公开布局；resolver 拒绝其他 scope                                             |
| Live2D CDN/model 失败      | widget 空白          | timeout、catch、静态 fallback、关闭/重试按钮，不阻断宿主页面                                                                         |
| Pack 配置污染严格 identity | discovery 失败       | `pack.json` 保持只有 `name`/`version`；frontend 声明位于 `pack.ts` 并经过 resolver 白名单校验                                        |

## Rollback Strategy

先删除 `packs/live2d-companion/`，即可移除 demo。若需要完全回滚宿主扩展，再一起还原 `resolver.mjs`、`index.mjs`、`BaseLayout.astro`、`env.d.ts` 和对应测试/文档；不涉及 Go runtime、Docker、SDK 或 Pack kernel。

## Acceptance Criteria

- [x] Frontend Contribution contract 通用，不包含 Live2D 特判。
- [x] Pack 可声明 public global CSS/JS，但不能注入 arbitrary HTML、外部 URL 或 admin/API 页面。
- [x] 所有公开 BaseLayout 页面消费 contributions。
- [x] Live2D Pack 只通过该 contract 实现全站 widget。
- [x] 第三方资源失败、用户关闭、移动端和 reduced-motion 场景不崩溃。
- [x] Pack resolver tests、Astro check/build、Docker check、diff check 通过。
- [x] 无构建错误、无 runtime crash；IDE bridge 不可用，但 Astro check 报告无错误。
