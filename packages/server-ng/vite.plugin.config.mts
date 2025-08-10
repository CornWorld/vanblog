/** @type {import('vite').UserConfig} */
import { readdirSync, statSync } from 'fs';
import { resolve } from 'path';

import { defineConfig } from 'vite';

// 扫描插件目录
function scanPlugins(): Record<string, string> {
  const pluginsDir = resolve(__dirname, 'plugins');
  const entries: Record<string, string> = {};

  try {
    const pluginDirs = readdirSync(pluginsDir).filter((dir) => {
      const pluginPath = resolve(pluginsDir, dir);
      return statSync(pluginPath).isDirectory() && dir !== 'node_modules';
    });

    for (const dir of pluginDirs) {
      const pluginPath = resolve(pluginsDir, dir);
      const indexPath = resolve(pluginPath, 'index.ts');

      try {
        statSync(indexPath);
        entries[`${dir}/index`] = indexPath;
      } catch {
        // index.ts 不存在，跳过
      }
    }
  } catch {
    // plugins 目录不存在
  }

  return entries;
}

export default defineConfig({
  build: {
    lib: {
      entry: scanPlugins(),
      formats: ['cjs'], // 使用 CommonJS 格式
      fileName: (_format, entryName) => {
        return `${entryName}.js`;
      },
    },
    outDir: 'dist/plugins',
    rollupOptions: {
      external: [
        // NestJS 相关
        '@nestjs/common',
        '@nestjs/core',
        // 第三方库
        'dayjs',
        'zod',
        // Node.js 内置模块
        'fs',
        'path',
        'util',
      ],
      output: {
        format: 'cjs',
        exports: 'default',
      },
    },
    target: 'node18',
    minify: false, // 保持代码可读性
  },
  resolve: {
    alias: {
      '@src': resolve(__dirname, 'src'),
    },
  },
});
