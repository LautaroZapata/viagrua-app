import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaRegister from '@/components/PwaRegister'
import { Toaster } from 'sonner'
import { Providers } from './providers'

export const metadata: Metadata = {
    title: 'ViaGrua — Gestion de Traslados',
    description: 'Plataforma interna de gestion de traslados de vehiculos',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'ViaGrua',
    },
    other: {
        'mobile-web-app-capable': 'yes',
    },
}

export const viewport: Viewport = {
    themeColor: '#FF7A00',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    viewportFit: 'cover',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className="antialiased">
                <Providers>
                    <PwaRegister />
                    <Toaster position="top-center" richColors closeButton />
                    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg">
                        Saltar al contenido
                    </a>
                    {children}
                </Providers>
            </body>
        </html>
    )
}
