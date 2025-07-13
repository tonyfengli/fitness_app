import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ]
    }
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@acme/auth': path.resolve(__dirname, '../auth/src'),
      '@acme/db': path.resolve(__dirname, '../db/src'),
      '@acme/db/client': path.resolve(__dirname, '../db/src/client.ts'),
      '@acme/db/schema': path.resolve(__dirname, '../db/src/schema.ts'),
      '@acme/ai': path.resolve(__dirname, '../ai/src'),
    }
  }
});