# 品味修正

## Status: ✅ Completed

## Context
评审发现的代码质量问题修复。

## Phases

### Phase 1: 修复 BaseLayout.astro 插件导航获取
- **Goal**: 消除 hardcoded URL，加超时，改错误处理
- **Files**: `app/src/layouts/BaseLayout.astro`
- **Steps**:
  - [ ] `http://127.0.0.1:8090` → 环境变量 + fallback
  - [ ] fetch 加 3s AbortController 超时
  - [ ] `catch {}` → `console.warn` 含上下文
- **Done when**: 语法正确，astro 无新增错误

### Phase 2: 修复 eslint.config.js 死代码 bug
- **Goal**: `*.pb.js` globals 配置能实际生效
- **Files**: `eslint.config.js`
- **Steps**:
  - [ ] 从 ignores 中移除 `**/pb_hooks/**`
  - [ ]（globals 配置保留不动，去掉 ignore 后自然生效）
- **Done when**: 逻辑正确，无死代码

### Phase 3: 修正 main.go import 顺序
- **Goal**: 按 Go 惯例字母序排列
- **Files**: `vault/main.go`
- **Steps**:
  - [ ] `plugins` 移到 `migration` 之后
- **Done when**: go vet 通过，import 顺序符合 gofmt

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| 改 BaseLayout 引入 Astro 编译错误 | SSR 渲染失败 | astro check 验证 |
| eslint 改后 lint 报新错 | CI 红 | 运行 eslint 验证 |
