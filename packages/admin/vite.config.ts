import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

const { resolve } = path;

// Package version - read synchronously from package.json
const VANBLOG_VERSION = JSON.parse(fs.readFileSync('./package.json', 'utf8')).version;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const isProd = mode === 'production';

  return {
    plugins: [
      react(),
      visualizer({
        open: false,
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 3002,
    },
    base: '/admin/',
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@@': resolve(__dirname, '/'),
        '~antd': resolve(__dirname, 'node_modules/antd'),
      },
      extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json', '.less'],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV),
      'process.env.VANBLOG_VERSION': JSON.stringify(VANBLOG_VERSION),
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          additionalData: '@root-entry-name: default;',
          modifyVars: {
            'primary-color': '#1DA57A',
            'link-color': '#1DA57A',
            'root-entry-name': 'default',
          },
        },
      },
    },
    build: {
      minify: isProd,
      outDir: './dist',
      sourcemap: isDev,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'css/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
          manualChunks: (id) => {
            // Ensure React is bundled properly to prevent context errors
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }

            if (id.includes('node_modules/@emoji-mart') || id.includes('node_modules/emoji-mart')) {
              return 'emoji-mart-vendor';
            }

            if (
              id.includes('node_modules/@antv') ||
              id.includes('node_modules/d3') ||
              id.includes('node_modules/d3-')
            ) {
              return 'antv-d3-vendor';
            }

            if (id.includes('node_modules/bytemd') || id.includes('node_modules/@bytemd')) {
              return 'bytemd-vendor';
            }

            if (id.includes('node_modules/@toast-ui') || id.includes('node_modules/toast-ui')) {
              return 'toast-ui-vendor';
            }
          },
        },
        external: [],
      },
      emptyOutDir: true,
      terserOptions: {
        compress: {
          drop_console: false,
          pure_funcs: [],
        },
        mangle: {
          keep_fnames: true,
          keep_classnames: true,
          reserved: ['__BYTEMD_INTERNALS__', 'version'],
        },
        keep_classnames: true,
        keep_fnames: true,
      },
    },
    optimizeDeps: {
      include: [
        'antd/es/theme/internal',
        '@toast-ui/react-editor',
        '@toast-ui/editor-plugin-color-syntax',
        '@toast-ui/editor-plugin-chart',
        'katex',
        'bytemd',
        '@bytemd/react',
        '@bytemd/plugin-gfm',
        '@bytemd/plugin-highlight-ssr',
        '@bytemd/plugin-math-ssr',
        '@bytemd/plugin-medium-zoom',
        '@bytemd/plugin-mermaid',
        '@bytemd/plugin-frontmatter',
        '@emoji-mart/react',
        '@emoji-mart/data',
        'react-dom',
        'react-dom/client',
      ],
    },
    assetsInclude: ['**/*.svg'],
  };
});
