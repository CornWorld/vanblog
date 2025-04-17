---
title: 发布流程
icon: rocket
order: 9
---

# VanBlog 发布流程文档

本文档描述了 VanBlog 项目的发布流程，包括标准版本和 CornWorld fork 版本。

## 版本命名规则

VanBlog 使用以下版本命名规则：

1. **标准版本**：遵循语义化版本（[SemVer](https://semver.org/lang/zh-CN/)）规范，格式为 `X.Y.Z`

   - 例如：`0.54.0`、`1.0.0`

2. **CornWorld fork 版本**：在标准版本基础上增加 `-corn.N` 后缀
   - 例如：`0.54.0-corn.5`
   - 其中基础版本号（`0.54.0`）通常与上游版本保持一致

## 支持的提交消息格式

版本管理系统支持以下提交消息格式：

1. **Conventional Commits**：标准的约定式提交格式

   ```
   feat(component): add new feature
   fix: correct issue with login
   ```

2. **HadTeam 格式**：HadTeam Git 提交协议格式
   ```
   [Feat] Add new feature
   [Fix] Correct issue with login
   [Feat&Refactor] Add feature and refactor code
   ```

提交消息将按类型自动分类并包含在更新日志中。

## 版本管理系统

VanBlog 使用模块化的版本管理系统，位于 `src/version/` 目录下。该系统支持标准版本和 fork 版本的发布，并提供了多种灵活的选项。

### 使用方法

```bash
# 基本用法（自动检测版本类型）
pnpm release:unified <version>

# 指定为 fork 版本
pnpm release:fork <version>-corn.<number>

# 指定为标准版本
pnpm release:standard <version>

# 仅更新文档
pnpm release:docs <version>
```

也可以直接使用 Node.js 运行：

```bash
node src/version/index.js [options] <version>
```

### 可用选项

| 选项             | 描述                                   |
| ---------------- | -------------------------------------- |
| `--version, -v`  | 指定版本号                             |
| `--type, -t`     | 发布类型：'auto'、'standard' 或 'fork' |
| `--skipUpstream` | 跳过上游版本检查                       |
| `--skipDocs`     | 跳过文档更新                           |
| `--skipTag`      | 跳过 Git 标签创建                      |
| `--help, -h`     | 显示帮助信息                           |

### 发布流程

版本管理系统执行以下步骤：

1. 更新项目中所有 package.json 中的版本号
2. 对于 fork 版本，检查是否基于上游版本
3. 从 Git 提交历史中生成更新日志（CHANGELOG.md）
4. 生成发布说明（RELEASE_NOTES.md）
5. 更新文档中的更新日志
6. 创建 Git 标签

### 更新日志自动生成

系统会自动从上一个标签以来的 Git 提交历史中生成更新日志。提交消息会根据类型自动分类，例如：

- 特性（Features）
- 错误修复（Bug Fixes）
- 文档更新（Documentation）
- 代码重构（Code Refactoring）
- 样式调整（Styling）
- 性能改进（Performance Improvements）
- 等等

支持 Conventional Commits 和 HadTeam 格式的提交消息，以及它们的类型映射。

### 自动化发布流程

当推送带有标签的提交到 GitHub 时，会自动触发相应的工作流：

1. **标准版本**：当推送 `v*` 且不是 `v*-corn.*` 的标签时，触发 `standard-release.yml` 工作流

   - 构建并推送 Docker 镜像到 `mereithhh/vanblog`
   - 创建 GitHub Release，使用 RELEASE_NOTES.md 作为内容

2. **CornWorld fork 版本**：当推送 `v*-corn.*` 的标签时，触发 `corn-release.yml` 工作流
   - 构建并推送 Docker 镜像到 `cornworld/vanblog`
   - 创建 GitHub Release，使用 RELEASE_NOTES.md 作为内容，附带上游信息和安装说明

## 手动发布步骤

### 标准版本发布

1. 确保本地代码是最新的

   ```bash
   git pull
   ```

2. 执行发布脚本

   ```bash
   pnpm release:standard <version>
   ```

3. 检查并提交更改
   ```bash
   git add .
   git commit -m "chore(release): v<version>"
   # 或使用 HadTeam 格式
   git commit -m "[Release] v<version>"
   git push --follow-tags
   ```

### CornWorld fork 版本发布

1. 确保本地代码是最新的，并且已同步上游更改

   ```bash
   git pull
   git fetch upstream
   ```

2. 执行发布脚本

   ```bash
   pnpm release:fork <version>-corn.<number>
   ```

3. 检查并提交更改
   ```bash
   git add .
   git commit -m "chore(release): v<version>-corn.<number>"
   # 或使用 HadTeam 格式
   git commit -m "[Release] v<version>-corn.<number>"
   git push --follow-tags
   ```

## 环境变量

版本管理系统支持以下环境变量：

- `AUTO_PUSH_TAGS`: 设置为 'true' 以自动推送标签到远程（默认值：false）

## 文档更新

每次发布都会自动更新文档中的更新日志。文档版本会根据 `doc-version` 文件自动递增。

如果只需要更新文档而不进行正式发布，可以使用：

```bash
pnpm release:docs <current-version>
```

## 故障排除

如果发布过程中遇到问题，可以尝试以下操作：

1. 检查是否有权限问题
2. 确认上游版本是否已正确同步
3. 确认 Docker Hub 凭证是否已正确配置
4. 检查 GitHub Actions 日志以获取具体错误信息
5. 尝试使用不同的命令行选项（如 `--skipUpstream`）跳过特定步骤

## 模块化系统结构

版本管理系统由以下模块组成：

- `index.js`: 主入口点和命令行参数处理
- `updateVersions.js`: 更新所有 package.json 中的版本号
- `checkUpstream.js`: 检查 fork 版本是否基于上游版本
- `generateChangelog.js`: 生成 CHANGELOG.md
- `generateReleaseNotes.js`: 生成用于 GitHub releases 的 RELEASE_NOTES.md
- `updateDocs.js`: 更新文档
- `createTag.js`: 创建并可选推送 Git 标签
