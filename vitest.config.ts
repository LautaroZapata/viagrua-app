import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Ver el comentario en el stub: sin esto no se puede testear ningun
      // modulo marcado como server-only.
      'server-only': path.resolve(__dirname, 'lib/__tests__/setup/server-only.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    /**
     * e2e/ es de Playwright, no de Vitest.
     *
     * El patron por defecto de Vitest agarra cualquier *.spec.ts, y los de
     * Playwright importan @playwright/test: corridos por Vitest fallan al
     * arrancar con un error que no dice nada del test.
     */
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'e2e/**'],
  },
})
