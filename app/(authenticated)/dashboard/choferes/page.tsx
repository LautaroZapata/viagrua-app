'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { confirmDelete, showError } from '@/lib/swal'
import { useUser } from '@/app/components/UserContext'
import { useChoferes } from '@/lib/useSupabaseQuery'
import AppHeader from '@/app/components/AppHeader'
import ListState from '@/app/components/ListState'
import ErrorBoundary from '@/app/components/ErrorBoundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { UserPlus } from 'lucide-react'

const InviteModal = dynamic(() => import('@/app/components/InviteModal'), { ssr: false })

export default function ChoferesPage() {
    const { perfil } = useUser()
    const [modalAbierto, setModalAbierto] = useState(false)

    // Misma clave que la lista del dashboard: venir de ahi dibuja el equipo al
    // instante y revalida en segundo plano, en vez de arrancar de cero.
    // Columnas explicitas: select('*') traia todo el perfil para mostrar solo
    // nombre y email.
    const { data: choferes = [], error: errorCarga, isLoading, mutate } =
        useChoferes(perfil?.empresa_id ?? null)

    useEffect(() => {
        const empresaId = perfil?.empresa_id
        if (!empresaId) return
        // Ver la nota del canal equivalente en dashboard/page.tsx: filtrado en
        // el servidor, y las expulsiones no llegan por aca a proposito.
        // Nombre por empresa: con uno fijo, dos pestañas abiertas comparten
        // topic y los eventos se duplican.
        const sub = supabase.channel(`choferes-page-${empresaId}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'perfiles',
                filter: `empresa_id=eq.${empresaId}`,
            }, () => { mutate() })
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [perfil?.empresa_id, mutate])

    const expulsarChofer = async (id: string, nombre: string) => {
        const ok = await confirmDelete({ title: 'Expulsar chofer', text: `¿Expulsar a ${nombre}?`, confirmButtonText: 'Si, expulsar' })
        if (!ok) return
        // Optimista y sin revalidar: la fila desaparece en el acto. Si la RPC
        // falla, el mutate() de abajo trae la lista real y el chofer vuelve.
        mutate(prev => (prev ?? []).filter(c => c.id !== id), { revalidate: false })
        const { error } = await supabase.rpc('expulsar_chofer', { chofer_id: id })
        if (error) { showError('Error: ' + error.message); mutate() }
    }

    return (
        <ErrorBoundary>
            <AppHeader
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Choferes' }]}
                actions={<Button size="sm" onClick={() => setModalAbierto(true)}><UserPlus className="size-4 mr-1.5" />Invitar</Button>}
            />
            <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>Equipo de Choferes ({choferes.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ListState
                            isLoading={isLoading}
                            error={errorCarga}
                            isEmpty={choferes.length === 0}
                            emptyMessage="No hay choferes registrados"
                            onRetry={() => mutate()}
                            skeletonRows={3}
                            emptyAction={
                                <Button size="sm" onClick={() => setModalAbierto(true)}>
                                    <UserPlus className="size-4 mr-1.5" />
                                    Invitar al primer chofer
                                </Button>
                            }
                        >
                            <div className="space-y-2">
                                {choferes.map((c) => {
                                    // nombre_completo es nullable: el trigger de alta lo deja en
                                    // null hasta que el usuario completa el perfil.
                                    const nombre = c.nombre_completo ?? 'Sin nombre'
                                    return (
                                    <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/30 transition">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="size-10">
                                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                    {nombre.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-foreground truncate">{nombre}</p>
                                                <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Activo</Badge>
                                            <Button variant="ghost" size="sm" onClick={() => expulsarChofer(c.id, nombre)}
                                                className="text-muted-foreground hover:text-destructive text-xs">Expulsar</Button>
                                        </div>
                                    </div>
                                    )
                                })}
                            </div>
                        </ListState>
                    </CardContent>
                </Card>
            </div>

            <InviteModal open={modalAbierto} onOpenChange={setModalAbierto} empresaId={perfil?.empresa_id ?? null} />
        </ErrorBoundary>
    )
}
