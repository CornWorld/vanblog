## Vanblog

Vanblog 原作者 Mereithhh 因个人原因已经不再维护 Vanblog, 但 Vanblog 的用户群体和社区仍然存在. 据我观察, 用户的主要需求是开箱即用 / 高性能 / 耐看的UI / 数据自我控制, 所以用三方框架也是不错的选择. 

> 开发快速启动 优先迁移前端能力 缓慢补充上后端能力(可能会裁剪部分)

基于 PocketBase + Astro 重构的 Vanblog, 旨在通过三方积极维护的框架替代 Vanblog 的基础组件, 提供接近的用户体验(All in One, 数据私密性, 个人用途高性能, 有限的扩展性)

> 下称呼 PocketBase 为 pb

### 目标目录结构

预想的源码目录结构:

- vault # 引入 pb
  - pb_hooks # 系统自带的 pb hooks
  - main.go
  - go.mod
  ...
- app
  - src
    - components
      - public
      - admin
    - layouts
      - PublicLayout.astro
      - AdminLayout.astro
    - lib
      - pb.ts # pb 相关的封装 / pb sdk client
    - pages
    - styles
    - middleware.ts # Astro 中间件, 主要用于 pb 的鉴权等
  - astro.config.mjs
  - package.json
  ...
- Dockerfile
- Dockerfile.dev

预想的运营目录结构:
/opt/vanblog/
- vanblog # 编译后 go 二进制文件
- data # pb data
- hooks # 用户自定义的 pb hooks
  - themes # 用户自定义的主题
- md_output # (可选) markdown 输出目录, 主要用于备份和迁移, 单向同步


### 目标核心功能
#### 高客制化 / AI 集成能力
提供 dev 和 prod 两种 Docker image, 并且支持外挂 Astro 前端.
- prod: 不包括 golang / node runtime, 只包含编译后的二进制文件和前端静态资源. 开箱即用, 适合不折腾的用户/新手用户, 提供 CMS 所有功能, 但不提供二次开发能力.
- dev: 不包含 golang runtime, 但有 node runtime, 包含前端源码和编译脚本. Astro 部分一直以 Dev Server 模式运行, 并且提供 MCP(提供 db 连接信息 / 特定 secret 来访问 pb api 等等) / Skill.
- 前端外挂: 通过 dev 容器内的构建脚本, 输出如 prod 版一样的静态资源, 并且允许用户重新切换为 prod 模式并挂载自定义的资源(相当于保存操作?)

问题: 如何平衡 docker compose file 的修改能力? 外置脚本还是其他更明智的办法? MCP 具体要提供哪些 tool, 如何平衡安全性? 是否要提供能力方便用户进行 docker image 的构建和分发? 



