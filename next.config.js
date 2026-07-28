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
          {
            // Notas:
            // - 'unsafe-evaluate' no es una keyword valida de CSP (la real es
            //   'unsafe-eval'); el browser la descartaba. Se elimina: no
            //   necesitamos eval.
            // - img-src estaba en https://*, o sea cualquier host HTTPS. Ya no
            //   quedan imagenes de terceros (el QR se genera local), asi que se
            //   acota a Supabase Storage.
            // - 'unsafe-inline' en script-src sigue porque Next inyecta scripts
            //   inline; sacarlo requiere pasar a nonce desde proxy.ts.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://*.supabase.co",
              "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'none'",
              "form-action 'self'",
              "object-src 'none'",
              "worker-src 'self' blob:",
              "manifest-src 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
