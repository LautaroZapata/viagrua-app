/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'radix-ui'],
  },
  async headers() {
    return [
      // ── Service Worker ────────────────────────────────────────────────────
      // El SW nunca debe ser cacheado por el browser (para recibir actualizaciones)
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      // ── Seguridad global ──────────────────────────────────────────────────
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // La Content-Security-Policy NO va aca: la arma proxy.ts por request.
          // El area autenticada lleva una estricta con nonce, y el nonce cambia
          // en cada request, asi que no puede vivir en un header estatico.
          // Emitirla en los dos lados mandaba dos headers CSP y el navegador
          // exige que la request pase por ambos, ademas de obligar a repetir la
          // lista de rutas en dos archivos.
        ],
      },
    ]
  },
};

// Este archivo es CommonJS y Next lo carga con require(), asi que no puede usar
// import. La regla apunta al codigo de la app, no a la config del build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require('@sentry/nextjs');

/**
 * Sentry se envuelve siempre, tenga DSN o no.
 *
 * El wrapper solo agrega el plugin de build; quien decide si Sentry arranca es
 * SENTRY_ACTIVO en sentry.opciones.ts, que mira el DSN en runtime. Envolver
 * condicionalmente haria que el build de CI y el de produccion pasen por
 * caminos distintos, que es justo lo que uno no quiere descubrir en un deploy.
 */
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Sin ruido en los builds locales; en CI si conviene ver que hizo.
  silent: !process.env.CI,

  // Saca el logger de Sentry del bundle del cliente. Son unos KB que solo
  // sirven para debuggear a Sentry mismo.
  disableLogger: true,

  /**
   * Los source maps se suben solo si hay token.
   *
   * Sin ellos, los stack traces de produccion llegan minificados y hay que
   * adivinar a que linea corresponden. Para activarlos: crear un token en
   * Sentry (Settings > Auth Tokens, scope project:releases), cargarlo como
   * SENTRY_AUTH_TOKEN junto con SENTRY_ORG y SENTRY_PROJECT en Vercel, y correr
   * `pnpm approve-builds` una vez para que pnpm deje instalar el binario de
   * @sentry/cli, que es el que hace la subida.
   */
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },

  /**
   * NO agregar aca bundleSizeOptimizations: no hace nada en este proyecto.
   *
   * Esa opcion tree-shakea el SDK (tracing, Session Replay) con un DefinePlugin
   * de webpack, y Next 16 buildea con Turbopack. Verificado en @sentry/nextjs
   * 10.68: config/getBuildPluginOptions.js solo lo consume config/webpack.js, y
   * el camino de Turbopack (config/turbopack/) ni lo mira. Se configura, el
   * build pasa sin chistar y el bundle queda igual.
   *
   * Costo medido del SDK en el cliente: +68 KB gzip (553 -> 622 KB). Se paga a
   * proposito: los errores que importan son los que le explotan al chofer en el
   * celular, y esos solo se ven desde el navegador. Cuando Sentry soporte
   * Turbopack, excludeTracing y excludeReplay* recuperan la mayor parte.
   */
});
