'use client'
import { usePathname } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { UserProvider, useUser } from '../components/UserContext'
import AppSidebar from '../components/AppSidebar'

function AuthGate({ children }: { children: React.ReactNode }) {
    const { loading } = useUser()
    const pathname = usePathname()

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="spinner-orange spinner" />
            </div>
        )
    }

    if (pathname === '/onboarding') {
        return <>{children}</>
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="bg-background">
                <main id="main-content" className="flex-1">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    return (
        <UserProvider>
            <AuthGate>{children}</AuthGate>
        </UserProvider>
    )
}
