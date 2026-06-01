import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary', 'lcov'],
        all: true,
        include: [
          'src/api/axiosInstance.js',
          'src/context/AuthContext.jsx',
          'src/routes/ProtectedRoute.jsx',
        ],
        thresholds: {
          statements: 60,
          branches: 55,
          functions: 60,
          lines: 60,
        },
      },
    },
  })
);
