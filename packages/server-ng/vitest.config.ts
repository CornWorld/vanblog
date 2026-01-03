import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@test': path.resolve(__dirname, './test'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    root: './',
    setupFiles: ['./test/setup.unit.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.fixtures.test.ts',
      '**/vitest-fixtures.test.ts',
      '**/*.e2e-spec.ts',
      '**/*.perf.spec.ts', // Exclude performance tests from default test run
    ],
    // 启用测试报告（JUnit，用于 CI Artifact）
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './junit-report.unit.xml',
    },
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.e2e-spec.ts', 'src/**/__mocks__/**', '**/*.d.ts'],
    },
    // 性能优化：针对 16GB 内存 + 10 核心 Apple Silicon 优化
    // 可用内存: 4.65 GB - 安全余量 0.5 GB = 4.15 GB 可用于测试
    // CPU: 4 性能核 + 6 能效核
    // 每个 fork 进程峰值: ~350-400 MB
    pool: 'forks',
    // Vitest 4: poolOptions 已废弃，使用顶级配置替代
    // 禁用文件级并行，由 fileParallelism 控制
    fileParallelism: true,
    // 单个测试文件内的并发控制
    // 设为 5，充分利用 CPU 核心
    maxConcurrency: 5,
    // 总并发度: ~5 (forks) × 5 (concurrency) = 25 个并发任务
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
