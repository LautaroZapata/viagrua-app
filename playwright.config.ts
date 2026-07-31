import { defineConfig, devices } from '@playwright/test'

/**
 * E2E del flujo critico, contra Supabase local.
 *
 * Antes de correr: `pnpm e2e:preparar` levanta el stack y escribe .env.e2e,
 * y `pnpm e2e:build` compila la app apuntando ahi. Los dos pasos estan en el
 * script `test:e2e`.
 *
 * Se sirve el build de produccion (`next start`) y no `next dev` a proposito:
 * dev con Turbopack levanta un watcher y varios procesos hijos, y si una corrida
 * se corta a la mitad quedan huerfanos. `next start` es un proceso y Playwright
 * lo mata al terminar.
 */
export default defineConfig({
  testDir: './e2e',

  /** Vacia el cupo de rate limit antes de correr. Ver el archivo. */
  globalSetup: './e2e/preparar-base.ts',

  /**
   * En serie y con un solo worker.
   *
   * Los tests comparten una base: dos que siembren empresas a la vez se pisan
   * los contadores del dashboard y las listas. Con un flujo critico de un par
   * de minutos no vale la pena la complejidad de aislarlos.
   */
  fullyParallel: false,
  workers: 1,

  /** Un `.only` olvidado no puede hacer que CI pase de verde sin correr nada. */
  forbidOnly: !!process.env.CI,

  /**
   * Un reintento en CI, ninguno en local.
   *
   * En CI un fallo aislado suele ser una espera corta en una maquina cargada;
   * en local conviene ver el fallo en el momento y no que se lo trague un
   * reintento.
   */
  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100',

    /** Solo del intento que fallo: un trace por corrida verde no lo mira nadie. */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // El wrapper inyecta .env.e2e en el env del proceso, que le gana a
    // .env.local —el que apunta a PRODUCCION—. Ver scripts/e2e-con-env.mjs.
    command: 'node scripts/e2e-con-env.mjs next start -p 3100',
    url: 'http://127.0.0.1:3100',

    /**
     * Puerto 3100 y nunca reusar lo que ya este escuchando.
     *
     * Con reuseExistingServer y el 3000, Playwright agarro otra app que estaba
     * corriendo en esa maquina y corrio el flujo entero contra ella. No fallo
     * por eso: fallo porque no encontro un selector, que es un sintoma que
     * despista. Levantar siempre el server propio, en un puerto que no usa
     * ningun dev server por defecto, hace que ese error no pueda repetirse.
     */
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
