# Plugin Cleanup — 修复最简单问题 + 安全验证

## 修复 (3 项)

### Phase 1: 删除 buildPageData 死代码
- **文件**: `vault/internal/plugins/plugins.go`
- **改动**: 删除 `"SiteName": "Vanblog"` 行（紧接着被 site config 覆盖）
- **风险**: 无

### Phase 2: Admin 列表只显示当前用户记录
- **文件**: `plugins/moments/moments.pb.js`、`plugins/bookmarks/bookmarks.pb.js`
- **改动**: 在 admin 页面的 list API handler 中过滤 `author = @request.auth.id`
- **风险**: 需要验证 `@request.auth.id` 在 JSVM 的 `$dbx` filter 中如何表达

### Phase 3: 提取共享 getQuery 到 pb_hooks/lib/
- **新文件**: `vault/pb_hooks/lib/vanblog-query.js`
- **改动**: moments.pb.js 和 bookmarks.pb.js 中删除内联 getQuery，改为 require
- **风险**: 需确认 JSVM require 路径解析规则

## 安全验证 (3 项)

### Phase 4: 模板引擎安全性
- 检查 PocketBase `tplreg.NewRegistry()` 默认行为：是 `html/template` 还是 `text/template`？
- 如果后者，`{{.Title}}` 需要显式转义

### Phase 5: CSRF 保护
- `routerAdd` 注册的路由是否经过 PocketBase CSRF 中间件？
- 如果 `routerAdd("POST", ...)` 没有 CSRF 保护，需要加 token 验证

### Phase 6: XSS 向量扫描
- 审查所有 `innerHTML`、字符串拼接中的用户数据
- 审查 `esc()` 函数覆盖范围
- 审查 `{{.Title}}` 等 Go 模板变量是否自动转义
