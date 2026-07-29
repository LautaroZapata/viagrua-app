'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { confirmDelete, showError } from '@/lib/swal'
import { useUser } from '@/app/components/UserContext'
import type { Tables } from '@/lib/db'
import AppHeader from '@/app/components/AppHeader'
import ListState from '@/app/components/ListState'
import ErrorBoundary from '@/app/components/ErrorBoundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { UserPlus } from 'lucide-react'

const InviteModal = dynamic(() => import('@/app/components/InviteModal'), { ssr: false })

type Chofer = Pick<Tables<'perfiles'>, 'id' | 'nombre_completo' | 'email'>

export default function ChoferesPage() {
    const { perfil } = useUser()
    const [choferes, setChoferes] = useState<Chofer[]>([])
    const [modalAbierto, setModalAbierto] = useState(false)
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<unknown>(null)

    const cargarChoferes = useCallback(async (empresaId: string) => {
        setCargando(true)
        setErrorCarga(null)
        // Columnas explicitas: select('*') traia todo el perfil para mostrar
        // solo nombre y email.
        const { data, error } = await supabase.from('perfiles').select('id, nombre_completo, email').eq('empresa_id', empresaId).eq('rol', 'chofer')
        // El error se descartaba: una query fallida se veia igual que un equipo vacio.
        if (error) setErrorCarga(error)
        setChoferes(data || [])
        setCargando(false)
    }, [])

    useEffect(() => {
        if (perfil?.empresa_id) cargarChoferes(perfil.empresa_id)
    }, [perfil?.empresa_id, cargarChoferes])

    useEffect(() => {
        if (!perfil?.empresa_id) return
        const sub = supabase.channel('choferes-page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, (payload) => {
                const n = payload.new as { empresa_id?: string }
                const o = payload.old as { empresa_id?: string }
                if (n?.empresa_id === perfil.empresa_id || o?.empresa_id === perfil.empresa_id)
                    cargarChoferes(perfil.empresa_id)
            }).subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [perfil?.empresa_id, cargarChoferes])

    const expulsarChofer = async (id: string, nombre: string) => {
        const ok = await confirmDelete({ title: 'Expulsar chofer', text: `¿Expulsar a ${nombre}?`, confirmButtonText: 'Si, expulsar' })
        if (!ok) return
        setChoferes(prev => prev.filter(c => c.id !== id))
        const { error } = await supabase.rpc('expulsar_chofer', { chofer_id: id })
        if (error) { showError('Error: ' + error.message); if (perfil?.empresa_id) cargarChoferes(perfil.empresa_id) }
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
                            isLoading={cargando}
                            error={errorCarga}
                            isEmpty={choferes.length === 0}
                            emptyMessage="No hay choferes registrados"
                            onRetry={() => { if (perfil?.empresa_id) cargarChoferes(perfil.empresa_id) }}
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
