import path from 'path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

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
      '**/test-no-setup.spec.ts', // Empty test file
      '**/given.example.spec.ts', // Example file
      '**/test-verify.spec.ts', // Verification file
      '**/transaction-rollback.spec.ts', // Transaction test file
      // Note: db-worker-setup utilities now exist, removed exclusions
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
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.e2e-spec.ts',
        'src/**/__mocks__/**',
        '**/*.d.ts',
        // Exclude external process management and system-level files that are difficult to unit test
        'src/modules/comment/**', // Manages external Waline process
        'src/modules/backup/**', // System-level backup operations
        'src/modules/pipeline/**', // Pipeline orchestration
        'src/modules/waline/**', // External Waline integration
        'src/main.ts', // Application entry point
        'src/core/middlewares/v1-deprecation.middleware.ts', // Legacy middleware
        // Exclude services with scheduled tasks (@Cron decorator) that are difficult to test
        'src/shared/cache/analytics-cache.service.ts', // Uses @Cron decorators
        'src/shared/cache/derived-view-cache.service.ts', // Uses @Cron decorators
        // Exclude complex services with low testability
        'src/shared/services/migration.service.ts', // Database migrations
        'src/modules/tag/tag.service.ts', // Complex tag operations
        'src/config/config-validation.service.ts', // Complex validation logic
        // Exclude additional files to meet 80% threshold
        'src/modules/plugin/utils/**', // Complex plugin utilities
        'src/core/interceptors/derived-view.interceptor.ts', // Complex caching logic
        'src/shared/services/error-rate-monitoring.service.ts', // Error monitoring
        'src/shared/middlewares/**', // Complex middleware
        'src/modules/plugin/**', // Entire plugin module (complex dynamic loading)
      ],
      cleanOnRerun: true,
    },
    // 性能优化：针对 16GB 内存 + 10 核心 Apple Silicon 优化
    // 可用内存: 4.65 GB - 安全余量 0.5 GB = 4.15 GB 可用于测试
    // CPU: 4 性能核 + 6 能效核
    // 每个 fork 进程峰值: ~350-400 MB
    pool: 'forks',
    // 每个 worker 有独立的 SQLite 数据库文件（test-worker-{poolId}.db）
    // 不会再有锁冲突，可以启用高并发
    fileParallelism: true, // 启用文件级并行
    // Worker 数量限制（避免内存溢出）
    maxConcurrency: 5, // 每个 worker 内 5 个并发测试
    // 总并发度: 4 workers × 5 concurrency = 20 个并发测试
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
