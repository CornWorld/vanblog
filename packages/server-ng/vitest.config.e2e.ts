import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.e2e-spec.ts'],
    globals: true,
    root: './',
    // Run E2E tests sequentially to avoid database conflicts
    pool: 'forks',
    // Vitest 4: 配置已提升到顶级，替代已废弃的 poolOptions
    // 禁用文件级并行 & 测试并发，彻底串行化执行
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    // Set up test environment
    setupFiles: ['./test/setup.ts'],
    // Increase timeout for E2E tests
    testTimeout: 30000,
    hookTimeout: 30000,
    // 启用 JUnit 报告（CI Artifact）
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './junit-report.e2e.xml',
    },
  },
  resolve: {
    alias: {
      '@src': './src',
      '@test': './test',
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
