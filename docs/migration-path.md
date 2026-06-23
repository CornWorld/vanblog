# 迁移路径 v2

> **依据**:[`pb-schema-design.md`](./pb-schema-design.md) v2 + [`feature-decision-matrix.md`](./feature-decision-matrix.md) v2 + [原项目 `backup.controller.ts`](file:///Users/corn/Code/vanblog-upstream/packages/server/src/controller/admin/backup/backup.controller.ts)
>
> **核心目标**:原 Vanblog 用户通过"后台导出 JSON → 在新 Vanblog 导入 JSON"两步完成迁移,**无需操作 Mongo、无需写脚本**。
>
> **v2 关键变化**:
>
> - `Meta` 单文档 → `site` 单行 JSON 字段(**一阶段迁移**,不再六阶段)
> - 标签用 pb relation 数组(无关联表,迁移代码减半)
> - CustomPage **不入库**,导出为 HTML 文件让用户放 Astro `src/pages/`
> - Pipeline 完全不迁移(已确认裁剪)
> - 新增三个独立开关:`revisions` / `output` / `sync`

---

## 1. 原项目导出格式(事实)

> 源码:[`backup.controller.ts:52-89`](file:///Users/corn/Code/vanblog-upstream/packages/server/src/controller/admin/backup/backup.controller.ts)

原项目 `GET /api/admin/backup/export` 返回单 JSON 文件(`temp.json`):

```json
{
  "articles": [
    /* Article schema 全字段 */
  ],
  "drafts": [
    /* Draft schema 全字段 */
  ],
  "categories": [
    /* Category schema 全字段 */
  ],
  "tags": [
    /* 从 articles.tags 聚合的 string[] */
  ],
  "meta": {
    /* Meta 单文档全字段 */
  },
  "user": {
    /* User 单条记录 */
  },
  "viewer": [
    /* Viewer schema(每日全站)*/
  ],
  "visit": [
    /* Visit schema(每日按路径)*/
  ],
  "static": [
    /* Static schema(图床记录)*/
  ],
  "setting": {
    "static": {
      /* StaticSetting */
    }
  }
}
```

**关键观察**:

- `articles` 与 `drafts` 分离(对应原 schema 双表)
- `meta` 是单文档(含 `links/socials/menus/rewards/about/siteInfo`)
- **不包含**:Pipeline、Token、Waline 数据(Waline 在独立 Mongo 库)
- **不包含**:`CustomPage`(**原项目导出遗漏**,见 §7)
- 导出 JSON 保留 Mongo `_id` / `__v`(导入时 `removeID` 去掉)

---

## 2. 迁移工具形态

### 2.1 选型

| 方案                          | 评分    | 理由                                      |
| ----------------------------- | ------- | ----------------------------------------- |
| Admin UI 上传 + pb_hooks 处理 | ✅ 推荐 | 与原项目体验一致(原项目也是后台上传 JSON) |
| pb migration(Go)              | ❌      | 用户要自己跑命令,体验差                   |
| 独立 CLI 工具                 | ⚠️ 备选 | v1.0 再做                                 |

### 2.2 实现

**用户体验**(对齐原项目):

```
原项目后台 → 备份导出 → 下载 temp.json
↓
新 Vanblog 后台 → 迁移 → 上传 temp.json
↓
解析 → 转换 → 写入 pb → 完成提示
```

**分工**:

- 前端(Astro admin UI):文件上传组件,调用 pb custom route
- 后端(pb_hooks JSVM):custom route 接收 JSON,逐表转换写入
- 大库优化:超过 1000 篇文章时前端显示进度条,后端分批 `app.RunInTransaction()`

---

## 3. 字段映射详细规则

### 3.1 `articles` + `drafts` → `posts`(合并)

| 原字段                                   | →   | 新字段                   | 转换                                                               |
| ---------------------------------------- | --- | ------------------------ | ------------------------------------------------------------------ |
| `_id` / `__v`                            |     | (丢弃)                   | Mongo 特有                                                         |
| `id`                                     | →   | `oldId`                  | 加 unique 索引                                                     |
| `title`, `content`, `copyright`          | →   | 同名                     |                                                                    |
| (来源表)                                 | →   | `status`                 | Article → `published` / `hidden`(若 `hidden=true`);Draft → `draft` |
| `tags[]`                                 | →   | `tags` relation 数组     | 解析为 tag record id 数组                                          |
| `category`                               | →   | `category` relation      | 按 name 查 categories                                              |
| `author`                                 | →   | `author` relation        | 按 name 查 users                                                   |
| `top`, `private`, `password`, `pathname` | →   | 同名                     |                                                                    |
| `deleted`                                | →   | `deleted`                |                                                                    |
| `viewer`                                 | →   | `viewCount`              | 重命名                                                             |
| `visited`                                | →   | `visitedCount`           | 重命名                                                             |
| `lastVisitedTime`                        | →   | `lastVisitedAt`          | 重命名                                                             |
| `createdAt` / `updatedAt`                | →   | pb `created` / `updated` | 显式赋值(覆盖 autodate)                                            |

**oldId 冲突处理**(Article.id 与 Draft.id 可能相同):

- Article:用原 id
- Draft:`oldId = 1000000 + 原 id`(偏移量可配置,迁移文档说明)

### 3.2 `categories` → `categories`

直接字段映射:

- `type: 'category' | 'column'` → `type` select,值不变
- `password` 明文 → 见 §6.1
- `meta: Mixed` → `meta` json
- `id` → `oldId`

### 3.3 `tags` → `tags` + `posts.tags` relation

> **v2 简化**:不再需要关联表,用 pb 原生 relation 数组。

**两阶段**:

1. 从 `articles[].tags[]` 和 `drafts[].tags[]` 去重提取所有 tag name → 写入 `tags` 表(`name`, `oldName`)
2. 遍历每条 post,为其 tags 数组中的每个 name 查询 `tags` 表得到 id → 写入 `posts.tags` relation 数组

**对比 v1**:v1 需要维护 `post_tags` 关联表(两阶段,代码复杂),v2 直接用 relation 数组(一次赋值)。

### 3.4 `meta`(单文档) → `site`(单行)

> **v2 简化**:v1 六阶段拆分,v2 一阶段序列化。

**一阶段映射**:

- `meta.siteInfo.*` 标量字段 → `site.info` JSON 对象(消除 `'true'/'false'` 字符串为 bool)
- `meta.menus[]` → `site.nav` JSON 数组
- `meta.links[]` → `site.links` JSON 数组
- `meta.socials[]` → `site.socials` JSON 数组
- `meta.rewards[]` → `site.rewards` JSON 数组
- `meta.about` → `site.about` JSON `{ content, updatedAt }`
- `meta.siteInfo.gaAnalysisId` + `baiduAnalysisId` → `site.analyticsScript`(组合成 `<script>` 标签)
- `meta.siteInfo.enableComment` → `site.commentsProvider`(默认 `disabled`,用户后续配置)
- 新增字段默认值:`theme='default'`, `routing=[]`, `customize={}`, `imageConfig={}`, `revisions={enabled:true,retention:50}`, `output={enabled:false}`, `sync={enabled:false}`

### 3.5 `static` → `media`

| 原字段             | →   | 新字段                           | 转换                                        |
| ------------------ | --- | -------------------------------- | ------------------------------------------- |
| `sign`             | →   | `sign`                           | 直接复制(MD5)                               |
| `staticType`       | →   | `staticType`                     | 扩展枚举(img/customPage/favicon/attachment) |
| `storageType`      | →   | `storageType`                    | `'picgo' → 's3'`                            |
| `fileType`, `meta` | →   | 同名                             |                                             |
| `realPath`         | →   | `externalUrl`                    | 保留 URL,**不下载文件**(见 §6.3)            |
| `name`             | →   | `oldId` + `file`(FileField 留空) |                                             |
| `updatedAt`        | →   | pb `updated`                     |                                             |

### 3.6 `user` → `users`

| 原字段              | →   | 新字段             | 转换                                      |
| ------------------- | --- | ------------------ | ----------------------------------------- |
| `name`              | →   | `username`         |                                           |
| `nickname`          | →   | `nickname`         |                                           |
| `type`              | →   | `role`             | `'admin' → 'admin'`(单用户场景直接 admin) |
| `permissions`       | →   | `permissions`      | 数组复制                                  |
| `password` + `salt` | →   | pb 内置 `password` | **见 §6.1,需用户重设密码**                |
| `id`                | →   | `oldId`            |                                           |

### 3.7 `viewer` + `visit` → `visits`(合并)

**合并规则**:

- `viewer`(全站每日)→ `visits` 中 `path=""` 的行
- `visit`(按路径每日)→ `visits` 中 `path=pathname` 的行
- 字段:`date / views(原 visited) / uniques(原 viewer) / lastVisitedAt`

### 3.8 `setting.static` → `site.imageConfig`

原 `StaticSetting`:

- `storageType` → 用于推断 `media.storageType` 默认值
- `enableWatermark / watermarkText / enableWebp` → `site.imageConfig` JSON
- `picgoConfig / picgoPlugins` → **归档到迁移档案**(见 §4.3,用户改用 pb S3 provider)

---

## 4. 不兼容数据的统一兜底策略

### 4.1 设计原则

原项目有大量数据在新架构中**无对应位置**(Pipeline 脚本、picgo 配置、CustomPage HTML、Caddy 配置、百度统计 ID、Waline SMTP 等)。

**统一策略**:**绝不丢弃,全部打包为"迁移档案"存入数据库**。

### 4.2 迁移档案机制

迁移工具在 `posts` 表创建一条特殊记录作为"迁移档案":

```
posts: {
  title: "[迁移档案] 原始数据归档",
  status: "hidden",              # 默认隐藏,不对外
  content: migration_guide.md,    # 迁移指南(AI agent / 人工友好)
  type: "migration-archive",      # 特殊类型标记
  attachments: [                   # media 表关联
    { filename: "pipeline_scripts.json",   content: ... },
    { filename: "picgo_config.json",       content: ... },
    { filename: "caddy_settings.json",     content: ... },
    { filename: "custom_pages/about.html", content: ... },
    { filename: "custom_pages/projects.html", content: ... },
    { filename: "legacy_meta.json",        content: ... },  # 未映射的 Meta 字段
    ...
  ]
}
```

**迁移指南正文**告诉用户:

- 每个附件是什么(原项目对应功能)
- 新架构的替代方案(决策矩阵链接)
- 建议用 AI agent 辅助转换(如老 HTML → Astro 组件)
- 迁移完成后可删除此 post

### 4.3 兜底清单

| 原数据                     | 处理                          | 附件名                      |
| -------------------------- | ----------------------------- | --------------------------- |
| Pipeline 脚本              | ✂️ 不迁移,归档                | `pipeline_scripts.json`     |
| CustomPage HTML            | 期望用户转 Astro 组件         | `custom_pages/{path}.html`  |
| CustomPage 目录型          | 生成清单,用户手动拷贝         | `folder_pages_manifest.txt` |
| picgo 配置                 | 用户改用 pb S3                | `picgo_config.json`         |
| Caddy https setting        | 新架构自动处理                | `caddy_settings.json`       |
| 百度/GA ID                 | 用户填 `site.analyticsScript` | `analytics_ids.json`        |
| Waline SMTP 配置           | 用户重配 Waline 容器          | `waline_smtp.json`          |
| 原项目 Token               | 用户重新生成 pb token         | 不归档(敏感)                |
| 未映射的 Meta 字段         | 保留备查                      | `legacy_meta.json`          |
| Setting 各 type 未映射部分 | 保留备查                      | `legacy_settings.json`      |

### 4.4 为什么这么做

1. **零数据丢失** —— 即使我们判断某功能"裁剪",用户的数据仍被保留
2. **AI agent 友好** —— 所有不兼容数据集中一处,带指南,AI 能自动转换
3. **人工兜底** —— 不愿用 AI 的用户可手动处理,附件可单独下载
4. **简化工具实现** —— 迁移工具不需要为每种不兼容数据写特殊逻辑,统一打包即可
5. **无 SSRF 风险** —— 不主动拉取原项目,用户上传 JSON 后由工具处理

### 4.5 原数据中的"敏感字段"处理

**不归档**(避免泄露):

- `Token`(原项目 API token)—— 迁移后失效,用户重新生成
- `User.password` + `salt` —— pb 自动加盐,用户重设密码(见 §6.1)
- `Waline` 的 JWT token —— 用户重配

**归档但标记敏感**:

- `picgo_config`(可能含 accessKey)—— 附件标记 `sensitive: true`,Admin UI 警告

---

## 5. 迁移流程(用户视角)

### 5.1 标准迁移(小到中型,< 500 篇)

```
1. 旧后台 → 备份导出 → 下载 temp.json
2. (可选)单独导出 CustomPage → 见 §7
3. 部署新 Vanblog(prod 镜像)
4. 首次启动 → 创建管理员账户
5. 后台 → 迁移 → 上传 temp.json
6. 等待处理(秒级)→ 提示成功
7. 检查文章/分类/标签/图床
8. 重新设置密码(见 §6.1)
9. 重新配置评论 provider / 统计脚本
```

### 5.2 大型博客(≥ 500 篇)

```
1. 同上 1-4 步
2. 后台 → 迁移 → 上传(分批模式,前端按 500 篇/批切分)
3. 后端事务内逐批处理
4. 完成后提示总迁移数 + 失败数
5. 下载迁移日志(失败项详情)
```

---

## 6. 待决问题解答(来自 schema v1)

### 6.1 加密文章密码是否哈希?

**决策:不哈希迁移,Admin UI 不展示明文。**

**理由**:

- 原 `Article.password` / `Category.password` 是明文
- 让用户为每篇加密文章重设密码,体验极差
- pb auth 表密码是 bcrypt 加盐,但**文章密码不是用户密码**,属于"访问口令"

**实现**:

- 迁移时原密码直接复制到 `posts.password` / `categories.password`
- Admin UI 不展示 password 字段值(只显示"已设置")
- pb_hooks 不返回明文给前台(返回 `hasPassword: true`)
- 前端弹窗接收用户输入 → pb hook 校验字符串相等

### 6.2 图床 storageType `picgo → s3`

**决策:迁移时统一标记为 `s3`,保留 `externalUrl`,实际 URL 不失效。**

**理由**:

- picgo 上传到 OSS/GitHub 的图片,真实 URL 在 `realPath` 字段
- 迁移后保留该 URL 即可继续访问
- pb S3 provider 原生支持 OSS/MinIO/Cloudflare R2 等所有 S3 兼容存储

**实现**:

- `static.storageType = 'picgo'` → `media.storageType = 's3'`
- `static.realPath` → `media.externalUrl`(新增字段,保留原 URL)
- pb FileField `file` 留空(不下载原文件)
- 新上传走 pb S3 provider,用户配置 `endpoint/bucket/accessKey/secretKey`

### 6.3 media.file 的文件下载策略

**决策:不下载原图片,只迁移元数据 + URL。**

**理由**:

- 下载所有图片到 pb storage 体积太大、迁移时间长
- 原图可能在本地(原 `local` storage)也可能在 picgo 外部
- 用户挂载原 `data/static` 目录可保留本地图片访问

**实现**:

- `media` 表新增 `externalUrl`(text)字段
- pb FileField `file` 留空
- 文章中的 `<img src="/static/img/xxx">` URL 在 Astro 构建期 rewrite 到 `externalUrl`
- 本地图床的图片 URL 路径变化 → 用户保留原 `data/static` 目录或接受重定向

### 6.4 水印/WebP 存量图片处理

**决策:不反向处理,新上传走新流程。**

**理由**:原 `enableWebp=true` 时图片已是 WebP + 水印,反向解水印无意义。

**新流程**(对齐决策矩阵 #11):

- 上传前水印 → 前端 Photon.rs(WASM)
- 上传前 WebP 压缩 → 前端 Squoosh(WASM)
- pb runtime 不处理图片
- pb FileField 内置 thumbs 生成(运行时缩略图)

---

## 7. CustomPage 迁移

> **归入 §4 统一兜底策略**。CustomPage 是该策略的典型用例,详见 §4.2 迁移档案机制和 §4.3 兜底清单。

**CustomPage 特有细节**(其他不兼容数据没有的):

- 原项目 `backup.controller.ts` 的 `getAll()` 中**没有**导出 `customPage`,用户需单独调用 `/api/admin/customPage/all` 导出
- HTML 文件作为附件存入迁移档案 post,附件名 `custom_pages/{path}.html`
- 目录型(`type: 'folder'`)生成清单 `folder_pages_manifest.txt`,用户手动拷贝到 Astro `public/`

---

## 8. 版本控制 / md 输出 / 外部同步(三个独立开关)

> 本节是这三个功能的**迁移影响**。完整设计见 [`pb-schema-design.md`](./pb-schema-design.md) §2.5(revisions 表)和 [`feature-decision-matrix.md`](./feature-decision-matrix.md) #30。

### 8.1 应用内历史(`revisions` 表)

- **默认开启**(`site.revisions.enabled = true`)
- 不迁移(老 Vanblog 无此功能)
- 由 `OnRecordUpdateRequest("posts")` hook 自动写入
- 保留策略:`site.revisions.retention`(默认 50 版/篇,LRU 清理)

### 8.2 Markdown 外部输出(`md_output`)

- **默认关闭**(`site.output.enabled = false`)
- 原 Vanblog 用户迁移后可手动开启
- 配置:`site.output = { enabled, format, dest, include, naming, trigger }`
- `trigger: "onUpdate"` 时由 hook 自动写入;`"cron"` 时定时全量快照

### 8.3 外部 git 同步

- **默认关闭**(`site.sync.enabled = false`)
- 基于 `md_output` 目录 + git cli(**不用 go-git**)
- dev 镜像预装 git,prod 镜像默认不装
- 配置:`site.sync = { enabled, remote, branch, schedule, sshKey }`

**go-git vs git cli 选型结论**(调研):

- go-git 是纯 Go 重实现,**功能完整度 ~80%**(无 LFS,SSH 弱)
- 外部同步场景用户期望"标准 git 仓库",git cli 100% 兼容
- go-git 适合程序内部(Gitea/CI/Pulumi),不适合用户直接交互

---

## 9. 迁移验证

迁移完成后,后台提供**验证报告**:

| 检查项         | 方式                                               |
| -------------- | -------------------------------------------------- |
| 文章数一致     | `articles.length + drafts.length` vs 新 `posts` 数 |
| 分类数一致     | `categories.length` vs 新 `categories` 数          |
| 标签数一致     | `tags.length` vs 新 `tags` 数                      |
| 图片数一致     | `static.length` vs 新 `media` 数                   |
| 友链/社交/菜单 | `meta.xxx.length` vs `site.xxx` JSON 数组长度      |
| 失败项详情     | JSON 下载,含原因(字段缺失/格式错)                  |

**抽样验证**:迁移后随机选 5 篇文章,前端对比渲染结果是否一致。

---

## 10. Rollback 策略

迁移失败时:

1. **事务回滚**:Go 层用 `app.RunInTransaction(func(txApp core.App) error {...})`,任一表失败则全部回滚
2. **保留原 JSON**:用户原 `temp.json` 不修改,可重试
3. **清空库重试**:Admin UI 提供"清空所有数据"按钮(危险操作,二次确认)
4. **原项目不动**:迁移是只读原 JSON,原 Vanblog 实例完全不受影响

---

## 11. 实现优先级

**v0.1 MVP**(对应 README"前端优先"):

- [ ] pb_hooks `/api/migrate/import` 端点
- [ ] Admin UI 上传组件
- [ ] `articles + drafts` → `posts` 迁移
- [ ] `categories` / `tags`(relation 数组)迁移
- [ ] `meta` → `site`(单行 JSON)迁移
- [ ] 用户密码重设流程
- [ ] 迁移报告

**v0.2**:

- [ ] `static` → `media`(含 externalUrl)
- [ ] `viewer + visit` → `visits` 合并
- [ ] CustomPage 单独导出为 HTML 文件
- [ ] 大库分批迁移

**v1.0**:

- [ ] 独立 CLI 工具 `vanblog-migrate`
- [ ] 迁移前后数据一致性自动校验
- [ ] Rollback 按钮
