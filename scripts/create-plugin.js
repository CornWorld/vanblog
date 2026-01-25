#!/usr/bin/env node

/**
 * VanBlog 插件脚手架 CLI
 *
 * 用法: pnpm plugin:create [插件名称]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI 颜色
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function kebabToPascal(str) {
  const camel = kebabToCamel(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

async function createPlugin() {
  log('\n🎨 VanBlog 插件脚手架\n', 'cyan');

  // 获取插件名称
  const pluginName =
    process.argv[2] || (await question('📦 插件名称 (使用 kebab-case，例如 my-plugin): '));

  if (!pluginName) {
    log('❌ 插件名称不能为空', 'red');
    rl.close();
    process.exit(1);
  }

  // 验证插件名称格式
  if (!/^[a-z][a-z0-9-]*$/.test(pluginName)) {
    log('❌ 插件名称必须使用 kebab-case 格式（小写字母、数字和连字符）', 'red');
    rl.close();
    process.exit(1);
  }

  // 获取其他信息
  const description = (await question(`📝 插件描述: `)) || `${pluginName} plugin for VanBlog`;
  const author = (await question(`👤 作者: `)) || 'VanBlog';
  const version = (await question(`🔖 版本 (默认 1.0.0): `)) || '1.0.0';

  const pluginDir = path.join(__dirname, '..', 'packages', 'server-ng', 'plugins', pluginName);

  // 检查插件是否已存在
  try {
    await fs.access(pluginDir);
    log(`❌ 插件 "${pluginName}" 已存在！`, 'red');
    rl.close();
    process.exit(1);
  } catch {
    // 插件不存在，继续
  }

  log(`\n📁 创建插件目录: ${pluginDir}\n`, 'blue');

  // 创建插件目录
  await fs.mkdir(pluginDir, { recursive: true });

  // 生成文件
  const className = kebabToPascal(pluginName.replace(/-plugin$/, ''));

  // 1. package.json
  const packageJson = {
    name: pluginName,
    version,
    description,
    main: 'index.ts',
    type: 'module',
    private: true,
    keywords: ['vanblog', 'plugin'],
    author,
    license: 'MIT',
    vanblog: {
      displayName: `${className} Plugin`,
      config: {
        enabled: {
          type: 'boolean',
          default: true,
          title: '启用插件',
          description: '是否启用此插件',
        },
      },
    },
  };

  await fs.writeFile(path.join(pluginDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  log('✅ package.json', 'green');

  // 2. index.ts (函数式插件)
  const indexTs = `/**
 * ${description}
 */

import type { PluginAPI } from '@vanblog/shared/plugin';

export default (api: PluginAPI) => {
  // 插件初始化
  api.log.info('${className} Plugin loaded');

  // 读取配置
  const enabled = api.config.enabled as boolean;
  if (!enabled) {
    api.log.warn('Plugin is disabled in config');
    return;
  }

  // 示例：注册 Filter 钩子
  api.filter('article|beforeCreate', (article) => {
    api.log.debug('Processing article before create:', article.title);
    // 在这里修改文章数据
    return article;
  });

  // 示例：注册 Action 钩子
  api.action('article|afterCreate', (article) => {
    api.log.info('Article created:', article.title);
    // 在这里执行副作用操作
  });

  // 示例：注册 Shortcode
  api.shortcode('${pluginName.replace(/-plugin$/, '')}', (attrs, content) => {
    return \`<div class="${pluginName}">\${content || 'Hello from ${className}'}</div>\`;
  });

  // 示例：提供公共数据
  api.provide('${pluginName}', () => ({
    version: api.version,
    enabled: true,
  }));

  // 示例：响应式存储
  const counter = api.store('counter', 0);
  api.log.debug('Current counter:', counter.value);

  // 生命周期钩子
  api.onActivate(async () => {
    api.log.info('Plugin activated');
  });

  api.onDeactivate(async () => {
    api.log.info('Plugin deactivated');
  });
};
`;

  await fs.writeFile(path.join(pluginDir, 'index.ts'), indexTs);
  log('✅ index.ts', 'green');

  // 3. index.spec.ts (测试文件)
  const indexSpecTs = `import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginAPI } from '@vanblog/shared/plugin';

import plugin from './index';

describe('${className} Plugin', () => {
  let mockAPI: Partial<PluginAPI>;

  beforeEach(() => {
    mockAPI = {
      id: '${pluginName}',
      version: '${version}',
      dir: '/path/to/plugin',
      config: { enabled: true },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
      filter: vi.fn(),
      action: vi.fn(),
      shortcode: vi.fn(),
      provide: vi.fn(),
      store: vi.fn((key, defaultValue) => ({
        value: defaultValue,
      })),
      onActivate: vi.fn(),
      onDeactivate: vi.fn(),
      onConfigChange: vi.fn(),
    };
  });

  it('should load plugin successfully', () => {
    expect(() => plugin(mockAPI as PluginAPI)).not.toThrow();
  });

  it('should register hooks when enabled', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.filter).toHaveBeenCalledWith(
      'article|beforeCreate',
      expect.any(Function),
    );
    expect(mockAPI.action).toHaveBeenCalledWith(
      'article|afterCreate',
      expect.any(Function),
    );
  });

  it('should not register hooks when disabled', () => {
    mockAPI.config = { enabled: false };
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.filter).not.toHaveBeenCalled();
    expect(mockAPI.action).not.toHaveBeenCalled();
  });

  it('should register shortcode', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.shortcode).toHaveBeenCalledWith(
      '${pluginName.replace(/-plugin$/, '')}',
      expect.any(Function),
    );
  });

  it('should provide public data', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.provide).toHaveBeenCalledWith(
      '${pluginName}',
      expect.any(Function),
    );
  });
});
`;

  await fs.writeFile(path.join(pluginDir, 'index.spec.ts'), indexSpecTs);
  log('✅ index.spec.ts', 'green');

  // 4. README.md
  const readmeMd = `# ${className} Plugin

${description}

## 功能特性

- ✅ 示例 Filter 钩子
- ✅ 示例 Action 钩子
- ✅ 示例 Shortcode
- ✅ 公共数据提供
- ✅ 响应式存储
- ✅ 配置支持

## 配置选项

在管理后台的"系统设置 → 插件"中配置：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| \`enabled\` | boolean | true | 是否启用插件 |

## 使用方法

### Shortcode

在文章中使用：

\`\`\`markdown
[${pluginName.replace(/-plugin$/, '')}]自定义内容[/${pluginName.replace(/-plugin$/, '')}]
\`\`\`

### 前端获取数据

\`\`\`tsx
import { usePluginData } from '@/hooks/usePluginData';

function MyComponent() {
  const { data, loading } = usePluginData('${pluginName}');

  if (loading) return <div>加载中...</div>;

  return <div>插件版本: {data.version}</div>;
}
\`\`\`

## 开发

### 运行测试

\`\`\`bash
pnpm --filter @vanblog/server-ng test -- plugins/${pluginName}
\`\`\`

### 调试

在插件代码中使用 \`api.log\` 输出日志：

\`\`\`typescript
api.log.info('Debug message');
api.log.error('Error message');
\`\`\`

## 文档

- [插件开发指南](../../docs/PLUGIN_DEVELOPMENT.md)
- [PluginAPI 参考](../../docs/PLUGIN_API.md)

## License

MIT
`;

  await fs.writeFile(path.join(pluginDir, 'README.md'), readmeMd);
  log('✅ README.md', 'green');

  // 完成
  log('\n✨ 插件创建成功！\n', 'green');
  log('📂 插件位置:', 'cyan');
  log(`   ${pluginDir}\n`);
  log('🚀 下一步:', 'cyan');
  log(`   1. cd packages/server-ng/plugins/${pluginName}`);
  log(`   2. 编辑 index.ts 实现你的插件逻辑`);
  log(`   3. 编辑 package.json 添加更多配置选项`);
  log(`   4. 运行测试: pnpm --filter @vanblog/server-ng test -- plugins/${pluginName}`);
  log(`   5. 启动服务器测试插件: pnpm dev:server\n`);

  rl.close();
}

// 运行
createPlugin().catch((error) => {
  log(`\n❌ 错误: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});
