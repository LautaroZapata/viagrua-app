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

module.exports = nextConfig;
