import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@suara/core': r('./packages/core/src/index.ts'),
      '@suara/providers': r('./packages/providers/src/index.ts'),
      '@suara/curriculum': r('./packages/curriculum/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
