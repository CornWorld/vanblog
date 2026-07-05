# 迁移工具 CLI

## Context

替代 tar.gz 上传方案。提供一个独立的迁移 CLI，从旧 VanBlog MongoDB 数据目录直接提取内容，输出为 V4 可导入的格式。

**核心思路**：启动临时 MongoDB 容器指向旧数据目录 → 读取所有 collection → 转换并输出 JSON → 调用已有 `POST /api/vanblog/migrate/import` 导入。

## Analysis

- **为什么不在 pb 进程内做**：MongoDB driver 是额外依赖；临时容器隔离更干净；失败不影响运行中的 V4
- **输入**：旧 VanBlog 的 MongoDB 数据目录（`/var/vanblog/mongo/db/`） + 可选的 static 文件目录
- **输出**：JSON 写入 stdout 或直接 POST 到目标 V4 实例
- **Affected files**：
  - `vault/cmd/migrate/main.go` — **新建**，CLI 入口
  - `vault/internal/migration/reader.go` — **新建**，MongoDB reader + 数据转换
  - `scripts/vanblog-migrate.sh` — **新建**，docker-compose 封装
- **Dependencies**：`go.mongodb.org/mongo-driver`（仅在 migrate 命令中使用）
- **Complexity**：medium
- **Risk areas**：MongoDB 版本兼容性（旧 VanBlog 用 4.x/5.x）；WiredTiger 存储引擎兼容

## Phases

### Phase 1: MongoDB Reader + 数据提取
- **Goal**：连接 MongoDB，读取所有 collection，转换为 `LegacyBackup` JSON
- **Files**：`vault/cmd/migrate/main.go` (new)，`vault/internal/migration/reader.go` (new)
- **Steps**：
  - [ ] 添加 `go.mongodb.org/mongo-driver` 依赖
  - [ ] `reader.go`：`ReadFromMongo(ctx, mongoURI, dbName) (*LegacyBackup, error)`
    - 读取 `articles` collection → `[]LegacyArticle`
    - 读取 `drafts` collection → `[]LegacyDraft`
    - 读取 `categories` collection → `[]LegacyCategory`
    - 读取 `tags` collection → `[]string`
    - 读取 `meta`/`user`/`viewer`/`visit`/`setting` → `json.RawMessage`
    - 读取 `statics`/`static` collection → `[]LegacyStatic`
  - [ ] `main.go`：CLI flags `--mongo-uri` / `--target-url` / `--output`
  - [ ] `--output -` 模式：JSON 输出到 stdout（用于管道给 import API）
  - [ ] `--target-url http://v4:8090` 模式：直接 POST 到 `/api/vanblog/migrate/import`
- **Done when**：`go run ./cmd/migrate --mongo-uri mongodb://localhost:27017 --output -` 输出完整 JSON

### Phase 2: Docker 封装（一键迁移脚本）
- **Goal**：用户无需了解 MongoDB，一条命令完成迁移
- **Files**：`scripts/vanblog-migrate.sh` (new)，`docker-compose.migrate.yml` (new)
- **Steps**：
  - [ ] `docker-compose.migrate.yml`：临时 MongoDB + migrate CLI 在同一 network
  - [ ] MongoDB 容器挂载用户提供的旧数据目录（只读）
  - [ ] migrate CLI 连接临时 MongoDB，提取数据，写入 stdout
  - [ ] `vanblog-migrate.sh`：交互式脚本，收集路径参数，执行迁移
  - [ ] 支持 `--dry-run` 先预览不导入
- **Done when**：`./vanblog-migrate.sh --from /var/vanblog/mongo_data` 完成迁移

### Phase 3: 验证 + 文档
- **Files**：`docs/deployment-strategy.md`
- **Steps**：
  - [ ] 用真实旧 VanBlog 数据验证完整迁移链路
  - [ ] 更新部署文档补充迁移 CLI 使用说明
- **Done when**：端到端可跑通 + 文档完整

## 删除的代码

- `vault/internal/migration/migration.go` 中 `ImportTar()` 和 `TarResult` 移除
- `vault/internal/migration/routes.go` 中 `POST /api/vanblog/migrate/import-tar` 路由移除
- `app/src/pages/admin/migrate.astro` 中 tar.gz 上传区域替换为迁移 CLI 使用说明

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| MongoDB collection 字段名与原项目不一致 | 数据提取失败 | reader 层使用 `bson.M` 灵活映射，记录 warning |
| 旧数据目录中的 WiredTiger 文件损坏 | 读取失败 | 临时 MongoDB 启动时会校验，启动失败即报错 |
| 大库（>10万篇）提取慢 | 超时 | 流式读取 + 分批写入 JSON |
