'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarGroup,
    SidebarGroupContent,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    LayoutDashboard, Car, Plus, Users, Receipt, LogOut,
    Sun, Moon, ChevronsUpDown, UserCog,
} from 'lucide-react'
import { useUser } from './UserContext'

const adminNav = [
    { label: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Traslados', href: '/dashboard/traslados', icon: Car },
    { label: 'Nuevo Traslado', href: '/dashboard/nuevo-traslado', icon: Plus },
    { label: 'Choferes', href: '/dashboard/choferes', icon: Users },
    { label: 'Gastos', href: '/dashboard/gastos', icon: Receipt },
]

const choferNav = [
    { label: 'Mis Traslados', href: '/chofer', icon: Car },
    { label: 'Gastos', href: '/dashboard/gastos', icon: Receipt },
]

export default function AppSidebar() {
    const { perfil, empresa, role, logout } = useUser()
    const pathname = usePathname() ?? ''
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    const navItems = role === 'admin' ? adminNav : choferNav
    const initials = perfil?.nombre_completo
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || '?'

    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader className="px-3 py-4">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild className="hover:bg-[hsl(231,18%,15%)]">
                            <Link href={role === 'admin' ? '/dashboard' : '/chofer'}>
                                <div className="flex items-center justify-center rounded-[8px] bg-primary text-primary-foreground size-[34px] shrink-0">
                                    <span className="font-display text-[17px] font-bold leading-none">G</span>
                                </div>
                                <div className="flex flex-col gap-0 leading-none min-w-0">
                                    <span className="font-display text-[17px] font-bold text-[hsl(var(--sidebar-foreground))]">ViaGrua</span>
                                    {empresa && (
                                        <span className="text-[11px] text-[#8A91A3] truncate max-w-[140px]">
                                            {empresa.nombre}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="px-3">
                <SidebarGroup className="p-0">
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-1">
                            {navItems.map((item) => {
                                const isActive = item.href === '/dashboard'
                                    ? pathname === '/dashboard'
                                    : pathname.startsWith(item.href)
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            tooltip={item.label}
                                            className={`h-9 rounded-[10px] px-3 gap-2.5 font-medium transition-colors ${
                                                isActive
                                                    ? 'bg-[rgba(255,122,0,0.14)] text-[#FFA149] font-semibold hover:bg-[rgba(255,122,0,0.18)]'
                                                    : 'text-[#8A91A3] hover:bg-[hsl(231,18%,15%)] hover:text-[hsl(var(--sidebar-foreground))]'
                                            }`}
                                        >
                                            <Link href={item.href}>
                                                <item.icon className="size-4" strokeWidth={2} />
                                                <span className="text-[13px]">{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {role === 'admin' && (
                    <SidebarGroup className="p-0 mt-4">
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        tooltip="Modo Chofer"
                                        className="h-9 rounded-[10px] px-3 gap-2.5 text-[#8A91A3] font-medium hover:bg-[hsl(231,18%,15%)] hover:text-[hsl(var(--sidebar-foreground))]"
                                    >
                                        <Link href="/chofer">
                                            <UserCog className="size-4" strokeWidth={2} />
                                            <span className="text-[13px]">Modo Chofer</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter className="px-3 pb-4">
                <div className="border-t border-[#262A35] pt-3">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton size="lg" className="hover:bg-[hsl(231,18%,15%)] rounded-[10px]">
                                        <div className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground shrink-0">
                                            <span className="text-xs font-semibold">{initials}</span>
                                        </div>
                                        <div className="flex flex-col gap-0 leading-none min-w-0">
                                            <span className="font-medium text-[13px] text-[hsl(var(--sidebar-foreground))] truncate">
                                                {perfil?.nombre_completo}
                                            </span>
                                            <span className="text-[11px] text-[#8A91A3] capitalize">{role}</span>
                                        </div>
                                        <ChevronsUpDown className="ml-auto size-4 text-[#8A91A3]" />
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="top" align="start" className="w-56">
                                    {mounted && (
                                        <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                                            {theme === 'dark' ? <Sun className="size-4 mr-2" /> : <Moon className="size-4 mr-2" />}
                                            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                                        <LogOut className="size-4 mr-2" />
                                        Cerrar sesion
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
