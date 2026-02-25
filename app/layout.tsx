import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({
    subsets: ['latin'],
    variable: '--font-geist',
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
        <html lang="es" className={geist.variable}>
            <body className={`${geist.className} antialiased`}>
                <div className="app-container">
                    {children}
                </div>
            </body>
        </html>
    )
}