import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.e2e-spec.ts', 'src/**/__mocks__/**', '**/*.d.ts'],
    },
    // 性能优化：针对 16GB 内存 + 10 核心 Apple Silicon 优化
    // 可用内存: 4.65 GB - 安全余量 0.5 GB = 4.15 GB 可用于测试
    // CPU: 4 性能核 + 6 能效核
    // 每个 fork 进程峰值: ~350-400 MB
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        // 6 个并发测试文件（充分利用内存和 CPU）
        // 预期内存占用: 6 × 400MB = 2.4GB（远低于 4.15GB 可用）
        maxForks: 6,
        minForks: 1,
      },
    },
    // 单个测试文件内的并发控制
    // 设为 5，充分利用 CPU 核心
    maxConcurrency: 5,
    // 总并发度: 6 (forks) × 5 (concurrency) = 30 个并发任务
    // 从之前的 32 降到 30，略有降低但保持高性能
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
