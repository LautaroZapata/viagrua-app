'use client'
import { usePathname } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { UserProvider, type SesionInicial } from './UserContext'
import AppSidebar from './AppSidebar'

/**
 * Capa cliente minima sobre el layout autenticado.
 *
 * La sesion llega ya resuelta desde el Server Component, asi que aca no hay
 * fetch ni spinner que tape la pagina: lo unico que necesita el cliente es
 * usePathname, para saber si esta en onboarding (que va sin sidebar).
 */
export default function AuthenticatedShell({
    sesion,
    children,
}: {
    sesion: SesionInicial
    children: React.ReactNode
}) {
    const pathname = usePathname()

    return (
        <UserProvider sesion={sesion}>
            {pathname === '/onboarding' ? (
                children
            ) : (
                <SidebarProvider>
                    <AppSidebar />
                    <SidebarInset className="bg-background">
                        <main id="main-content" className="flex-1">
                            {children}
                        </main>
                    </SidebarInset>
                </SidebarProvider>
            )}
        </UserProvider>
    )
}
