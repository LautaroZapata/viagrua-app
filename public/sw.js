/**
 * ViaGrua Service Worker
 *
 * Estrategia de caché:
 * - /_next/static/**  → Cache-first (hashes únicos, nunca cambian)
 * - /api/**           → Network-only  (datos en tiempo real, Supabase)
 * - *.supabase.co     → Network-only  (auth + DB, siempre fresco)
 * - todo lo demás     → Network-first con fallback al caché
 *                       Si offline → página /offline
 */

const STATIC_CACHE  = 'vg-static-v1'
const RUNTIME_CACHE = 'vg-runtime-v1'
const OFFLINE_URL   = '/offline'

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.add(OFFLINE_URL))
            .catch(() => { /* La página /offline puede no existir aún */ })
    )
    // Activar inmediatamente sin esperar a que cierren las pestañas anteriores
    self.skipWaiting()
})

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
                    .map((name) => caches.delete(name))
            )
        )
    )
    // Tomar control de todas las pestañas abiertas inmediatamente
    self.clients.claim()
})

// ─── Mensajes ────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Solo interceptar GET
    if (request.method !== 'GET') return

    // Network-only: Supabase (auth + DB + storage)
    if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) return

    // Network-only: rutas API internas (datos en tiempo real)
    if (url.pathname.startsWith('/api/')) return

    // Cache-first: assets estáticos de Next.js (filenames con hash → inmutables)
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
                    }
                    return response
                })
            })
        )
        return
    }

    // Network-first: páginas y demás recursos
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Cachear respuestas exitosas de navegación
                if (response.ok && request.destination === 'document') {
                    const clone = response.clone()
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone))
                }
                return response
            })
            .catch(async () => {
                // Sin conexión: intentar desde caché, si no → página offline
                const cached = await caches.match(request)
                if (cached) return cached

                const offline = await caches.match(OFFLINE_URL)
                if (offline) return offline

                // Si ni /offline quedo cacheado, devolver algo antes que un
                // error opaco de red: respondWith(undefined) rompe la navegacion.
                return new Response(
                    '<!doctype html><meta charset="utf-8"><title>Sin conexion</title>' +
                    '<p style="font:16px system-ui;padding:2rem">Sin conexion. Reintenta cuando vuelva la señal.</p>',
                    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                )
            })
    )
})
