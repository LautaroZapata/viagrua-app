import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'ViaGrua — Gestión de Traslados',
        short_name: 'ViaGrua',
        description: 'Plataforma interna de gestión de traslados de vehículos',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F8F4F0',
        theme_color: '#FF7A00',
        categories: ['productivity', 'business'],
        icons: [
            {
                src: '/api/pwa-icon?size=192',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/api/pwa-icon?size=512',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/api/pwa-icon?size=512&maskable=1',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
        shortcuts: [
            {
                name: 'Nuevo Traslado',
                short_name: 'Nuevo',
                description: 'Crear un nuevo traslado',
                url: '/dashboard/nuevo-traslado',
                icons: [{ src: '/api/pwa-icon?size=96', sizes: '96x96' }],
            },
        ],
    }
}
