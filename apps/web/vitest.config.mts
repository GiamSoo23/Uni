import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws outside a React Server Components bundle; tests run in plain Node.
      'server-only': fileURLToPath(new URL('./test/empty-module.ts', import.meta.url)),
      '@/': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    environment: 'node',
  },
})
