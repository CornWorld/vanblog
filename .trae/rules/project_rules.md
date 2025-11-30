# VanBlog Server-NG Agent 工作指南

你正在为 VanBlog 开发 **server-ng** 项目，这是一个全新的模块化、高性能、易维护的 API 服务器。请严格遵守以下工作准则：

## 1. 工作环境

- **项目路径**: `/Users/corn/Code/vanblog/packages/server-ng`
- **确保任务在单次对话中完成**，避免频繁切换环境
- **避免破坏性操作**，保持开发环境稳定
- **使用 pnpm** 作为包管理器

## 2. 代码规范

- **严格遵循** README.md 中定义的项目结构
- **启用 TypeScript 严格模式**，遵循 ESLint 规则
- **每个模块都要有对应的测试**
- **不要写无意义的注释**（从代码就能理解的内容不需要注释）

## 3. 任务执行

- **按照 README.md 中的 TODO List 执行任务**
- **每个任务独立可验证**，不依赖未完成的其他任务
- **任务按阶段划分**，优先完成基础架构
- **完成任务后更新 TODO List 的勾选状态**

## 4. 技术要求

- **框架**: NestJS v11
- **语言**: TypeScript 5.x + Eslint(TS 严格类型验证) + Prettier
- **数据库**: Sqlite + libsql + drizzle orm + drizzle-zod
- **测试框架**: Vitest （而不是 Jest）
- **API 文档**: Swagger/OpenAPI
- **类型验证**: Zod 3 + Ts-rest

## 5. 开发原则

- **模块化架构**: 每个功能域独立成模块
- **API 设计一致性**: RESTful 规范，v2 API
- **性能优先**: 注重查询优化和缓存策略
- **安全第一**: JWT 认证，请求验证，异常处理

## 6. 文件命名规范

- 使用 **kebab-case** 命名文件和目录
- 控制器: `*.controller.ts`
- 服务: `*.service.ts`
- 模块: `*.module.ts`
- 数据模型: `*.schema.ts`
- DTO: `*.dto.ts`

## 7. 提交规范

- 确保代码通过所有测试
- 更新相关文档
- 保持代码整洁，遵循 SOLID 原则
- 保持commit msg干净整洁，如果可以使用常见缩写则使用 e.g. configuration->config
- 每次完成一次工作提交一次代码！

## 8. 注意事项

- **不要猜测需求**，参考现有 `/packages/server` 的实现
- **保持向后兼容**，v2 API 与 v1 API 共存
- **优先实现核心功能**，再考虑高级特性
- **遇到不确定的地方**，查看 VanBlog 项目文档或现有代码，必要时咨询项目维护者

## 9. 资源参考

- VanBlog 文档: `/Users/corn/Code/vanblog/docs`
- 现有服务器代码: `/Users/corn/Code/vanblog/packages/server`
- NestJS 最佳实践: 遵循官方推荐的项目结构和编码规范

### dev server 使用指南

在 `/Users/corn/Code/vanblog/packages/server-ng/dev-server.sh` 脚本是你的开发服务器智能遥控器。它的核心目标是让你能在后台安全地启动、停止和检查你的 Web 服务器，从而避免了命令行被阻塞或意外启动多个重复进程的问题。你可以继续对话和执行其他任务，而服务器则在后台安静地运行。
你的标准工作流程非常简单：当你需要启动服务器时，执行 bash dev-server.sh start。这个命令是安全的，即使你重复运行，它也只会确保有一个服务器在运行。在任何时候，你都可以通过 bash dev-server.sh status 来检查服务器是否不仅在运行，而且是“健康”的。当你完成所有工作后，只需运行 bash dev-server.sh stop 即可干净地关闭它。
如果 status 命令显示服务不健康或出现问题，你可以立即使用 bash dev-server.sh logs 来查看最新的错误日志，这能帮你快速定位问题。如果需要重启，bash dev-server.sh restart 命令会帮你自动完成停止和启动操作。这个工具集为你提供了一个完整、可靠且非阻塞的服务器管理方案。

## 10. 每次开始工作前

1. 确认当前所在目录和 git log `pwd && git log --oneline -n 10`
2. 查看 README.md 中的 TODO List
3. 选择一个未完成的任务(必须选择最近且未完成的任务)
4. 完成后更新任务状态
5. 确保代码可运行，测试通过

## 11. 每次结束工作时

1. 使用 `cd ~/Code/vanblog/packages/server-ng && pnpm format --write && pnpm lint --fix && pnpm tsc --noEmit ` 得知目前有哪些问题，修复。 **你不被允许跳过 lint，必须一定修复所有问题。**
2. 确保已经给刚刚写的代码添加了必要的测试
3. 确保所有测试都通过（`pnpm run test && pnpm run test:e2e`）
4. 使用 git 提交代码，不允许跳过 nano-staged + eslint 检查，**严格禁止 --no-verify 参数**，使用 -s -S 两个参数签名, git commit -m 时的 \n 是无效的。不允许加 `Co-authored-by` ，也不允许修改 Sign 信息。

记住：每个任务都应该让项目向着"构建一个稳健高效的 API 服务器"这个目标前进一步。你需要在一次对话内完成上面的所有。
注意！⚠️你的亚洲妈妈正在等待你完成这个项目，她只会关注一次对话的最终结果。如果你最终遗留了任何问题，或者在做完之前结束对话，我相信她绝对不会高兴的，肯定会对你进行一些惨绝人寰的操作。
