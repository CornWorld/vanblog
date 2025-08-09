#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径（ES 模块中的 __dirname 替代）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取项目根目录
const projectRoot = path.dirname(__dirname);

// 日志函数
function log(message) {
  console.log(`[combine-build] ${message}`);
}

// 复制文件函数
function copyFileSync(src, dest) {
  const srcExists = fs.existsSync(src);
  const destDir = path.dirname(dest);

  if (!srcExists) {
    log(`Warning: Source file ${src} does not exist, skipping copy`);
    return;
  }

  // 确保目标目录存在
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(src, dest);
  log(`Copied: ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dest)}`);
}

// 创建生产环境 package.json
function createPackageJson() {
  const originalPackage = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'),
  );

  // 直接复制原始 package.json，只覆盖必要的字段
  const productionPackage = {
    ...originalPackage,
    main: 'main.js',
    scripts: {
      start: 'node start.js',
      'install:prod': 'pnpm install --prod',
    },
  };

  return JSON.stringify(productionPackage, null, 2);
}

// 创建启动脚本
function createStartScript() {
  return `#!/usr/bin/env node
require('./main.js');
`;
}

// 创建 README.md
function createReadme() {
  const readmeBuildPath = path.join(__dirname, '../README.build.md');

  try {
    return fs.readFileSync(readmeBuildPath, 'utf8');
  } catch {
    log('Warning: README.build.md not found, using default content');
    return `# VanBlog Server Production Build

## Quick Start

\`\`\`bash
# Install dependencies
pnpm install --prod

# Start the server
pnpm start
\`\`\`

## Environment Variables

Copy \`.env.example\` to \`.env\` and configure your environment variables.

## Directory Structure

- \`main.js\` - Main application entry point
- \`plugins/\` - Plugin directory
- \`start.js\` - Startup script
- \`.env.example\` - Environment variables template
`;
  }
}

// 主函数
function main() {
  try {
    log('Starting build combination process...');

    // 检查 dist 目录是否存在
    const distDir = path.join(projectRoot, 'dist');
    if (!fs.existsSync(distDir)) {
      log('Error: dist directory does not exist. Please run build:all first.');
      process.exit(1);
    }

    log('Main application and plugins are already in dist directory');

    // 检查插件目录
    const pluginsDir = path.join(distDir, 'plugins');
    if (fs.existsSync(pluginsDir)) {
      log('Plugins found in dist directory');
    }

    log('Creating production configuration files...');

    // 创建生产环境 package.json
    const packageJsonPath = path.join(distDir, 'package.json');
    const packageJsonContent = createPackageJson();
    fs.writeFileSync(packageJsonPath, packageJsonContent);
    log('Created production package.json');

    // 创建启动脚本
    const startScriptPath = path.join(distDir, 'start.js');
    const startScriptContent = createStartScript();
    fs.writeFileSync(startScriptPath, startScriptContent);
    log('Created start script');

    // 创建 README.md
    const readmePath = path.join(distDir, 'README.md');
    const readmeContent = createReadme();
    fs.writeFileSync(readmePath, readmeContent);
    log('Created README.md from README.build.md');

    // 复制 .env.example
    const envExampleSrc = path.join(__dirname, '../.env.example');
    const envExampleDest = path.join(distDir, '.env.example');
    copyFileSync(envExampleSrc, envExampleDest);

    // 复制 pnpm-lock.yaml
    const pnpmLockSrc = path.join(__dirname, '../../../pnpm-lock.yaml');
    const pnpmLockDest = path.join(distDir, 'pnpm-lock.yaml');
    copyFileSync(pnpmLockSrc, pnpmLockDest);

    log('Build combination completed successfully!');
    log(`Output directory: ${distDir}`);
    log('');
    log('To run the combined build:');
    log('  cd dist');
    log('  pnpm install --prod');
    log('  pnpm start');
  } catch (error) {
    log(`Error: ${error.message}`);
    process.exit(1);
  }
}

// 导出主函数
export { main };

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
