import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PwaRegister from '@/components/PwaRegister'

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
})

export const metadata: Metadata = {
    title: 'ViaGrua — Gestión de Traslados',
    description: 'Plataforma interna de gestión de traslados de vehículos',
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
        <html lang="es" className={inter.variable}>
            <body className={`${inter.className} antialiased`}>
                <PwaRegister />
                <div className="app-container">
                    {children}
                </div>
            </body>
        </html>
    )
}
