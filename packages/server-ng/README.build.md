# VanBlog Server-NG - Production Build

这是 VanBlog Server-NG 的生产环境构建包，包含了主体应用和内置插件的 CommonJS 构建物。

## 运行方式

1. 安装依赖：

```bash
  pnpm install --prod
```

2. 启动应用：

```bash
  pnpm start
  # 或者
  node main.js
```

## 目录结构

- `main.js` - 主应用入口文件
- `plugins/` - 插件构建物目录
- `package.json`
- `pnpm-lock.yaml` - 依赖锁定文件

## 环境变量

请参考项目根目录的 `.env.example` 文件配置环境变量到 `.env` 文件中。

建议这样开始：

```bash
  cp .env.example .env
```

## 插件

当前包含的插件：

- cat-plugin: 🐱插件，在文章保存时在内容/标题/标签的结尾添加"喵"

插件会在应用启动时自动加载。
