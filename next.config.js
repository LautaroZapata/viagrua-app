/** @type {import('next').NextConfig} */
const nextConfig = {
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
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-evaluate' 'unsafe-inline' https://js.mercadopago.com.br https://www.mercadopago.com.br; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://www.mercadopago.com.br; frame-src https://www.mercadopago.com.br https://sandbox.mercadopago.com.br; worker-src 'self' blob:; manifest-src 'self'",
          },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
