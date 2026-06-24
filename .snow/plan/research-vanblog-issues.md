# VanBlog Issues 调研

## Context
需要系统梳理 vanblog 的 GitHub Issues，产出可执行的产品洞察（用户需求、体验痛点、维护态度/效率、主线未解决问题）。

## Analysis
- **数据来源**: GitHub Issues（`Mereithhh/vanblog`）
- **工作目录**: `/refs`（已加入 `.gitignore` 防止污染 git）
- **工具**: `gh cli`（已登录态）
- **输出**: 结构化调研文档 + 摘要表

## Phases

### Phase 1: 拉取 issues
- **Goal**: 下载全部 issues 到本地 JSON/CSV
- **Files**: `refs/issues.json`, `refs/issues.csv`
- **Steps**:
  - [ ] 使用 `gh issue list --repo Mereithhh/vanblog --state all --limit 5000 --json` 拉取
  - [ ] 保存到 `refs/issues.json` 与 `refs/issues.csv`
- **Done when**: 文件存在且记录数 > 0

### Phase 2: 梳理与分类
- **Goal**: 结构化分类 issues
- **Files**: `refs/analysis.md`
- **Steps**:
  - [ ] 按标签/关键词归类：功能需求、Bug、体验、文档、讨论
  - [ ] 统计高需求主题（复现高频关键词）
  - [ ] 识别“未关闭/长期未解决”问题
- **Done when**: `refs/analysis.md` 包含分类表与 Top 10 主题

### Phase 3: 洞察总结
- **Goal**: 提炼可执行洞察
- **Files**: `refs/summary.md`
- **Steps**:
  - [ ] 分析维护者回复模式：速度、态度、解决效率
  - [ ] 总结用户容易难受的场景（安装、配置、升级、数据兼容）
  - [ ] 列出主线仍未解决的功能/缺陷
- **Done when**: `refs/summary.md` 包含洞察列表 + 建议

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| issues 数量过大 | 中 | 分页拉取，先写入 JSON，再离线分析 |
| 标签缺失/不一致 | 中 | 用关键词 + 关闭率辅助分类 |
| 需要进一步验证信息 | 低 | 标注需要人工确认项 |

## Rollback Strategy
删除 `refs/` 目录并移除 `.gitignore` 中 `/refs/` 即可完全回滚。
