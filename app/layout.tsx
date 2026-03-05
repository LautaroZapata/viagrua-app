import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
})

export const metadata: Metadata = {
    title: 'ViaGrua — Gestion de Traslados',
    description: 'Plataforma interna de gestion de traslados de vehiculos',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" className={inter.variable}>
            <body className={`${inter.className} antialiased`}>
                <div className="app-container">
                    {children}
                </div>
            </body>
        </html>
    )
}