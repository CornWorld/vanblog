import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    setupFiles: ['./test/setup.unit.ts'],
    // Performance tests configuration
    // Include ONLY .perf.spec.ts files
    include: ['test/performance/**/*.perf.spec.ts'],
    // 启用测试报告（JUnit，用于 CI Artifact）
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './junit-report.perf.xml',
    },
    // 覆盖率配置 - 性能测试通常不计入覆盖率
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage-perf',
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.e2e-spec.ts', 'src/**/__mocks__/**', '**/*.d.ts'],
    },
    // 性能测试使用更小的并发度，避免互相干扰
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        // 2-3 个并发以获得准确的性能指标
        maxForks: 3,
        minForks: 1,
      },
    },
    // 单个测试文件内的并发控制
    maxConcurrency: 2,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
