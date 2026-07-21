import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaRegister from '@/components/PwaRegister'
import { Toaster } from 'sonner'

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
        <html lang="es" suppressHydrationWarning>
            <body className="antialiased">
                <script dangerouslySetInnerHTML={{ __html: `
                  (function() {
                    try {
                      var theme = localStorage.getItem('theme');
                      if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                        document.documentElement.classList.add('dark');
                      }
                    } catch(e) {}
                  })()
                `}} />
                <PwaRegister />
                <Toaster position="top-center" richColors closeButton />
                <div className="app-container">
                    {children}
                </div>
            </body>
        </html>
    )
}
