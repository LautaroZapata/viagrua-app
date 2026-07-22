import type { Metadata, Viewport } from 'next'
import { DM_Sans, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import PwaRegister from '@/components/PwaRegister'
import { Toaster } from 'sonner'
import { Providers } from './providers'

const dmSans = DM_Sans({
    subsets: ['latin'],
    variable: '--font-body',
    display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
    subsets: ['latin'],
    variable: '--font-display',
    display: 'swap',
})

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
        <html lang="es" className={`${dmSans.variable} ${plusJakarta.variable}`} suppressHydrationWarning>
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
