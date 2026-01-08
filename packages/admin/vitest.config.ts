import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    root: './',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.spec.tsx', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.tsx', 'src/**/*.ts'],
      exclude: [
        'src/**/*.test.tsx',
        'src/**/*.test.ts',
        'src/**/*.spec.tsx',
        'src/**/*.spec.ts',
        'src/**/__mocks__/**',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@@': path.resolve(__dirname, '/'),
      '~antd': path.resolve(__dirname, 'node_modules/antd'),
    },
  },
});
