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
    SidebarGroupLabel,
    SidebarGroupContent,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Truck, LayoutDashboard, Car, Plus, Users, Receipt, LogOut,
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
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={role === 'admin' ? '/dashboard' : '/chofer'}>
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    <Truck className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold">ViaGrua</span>
                                    {empresa && (
                                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                            {empresa.nombre}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navegacion</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => {
                                const isActive = item.href === '/dashboard'
                                    ? pathname === '/dashboard'
                                    : pathname.startsWith(item.href)
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                                            <Link href={item.href}>
                                                <item.icon className="size-4" />
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {role === 'admin' && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Vista</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild tooltip="Modo Chofer">
                                        <Link href="/chofer">
                                            <UserCog className="size-4" />
                                            <span>Modo Chofer</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton size="lg">
                                    <Avatar className="size-8">
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col gap-0.5 leading-none min-w-0">
                                        <span className="font-medium text-sm truncate">{perfil?.nombre_completo}</span>
                                        <span className="text-xs text-muted-foreground capitalize">{role}</span>
                                    </div>
                                    <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
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
            </SidebarFooter>
        </Sidebar>
    )
}
