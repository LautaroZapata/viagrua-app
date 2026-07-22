'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmDelete, showError } from '@/lib/swal'
import { useUser } from '@/app/components/UserContext'
import { useTrasladosCounts } from '@/lib/useSupabaseQuery'
import AppHeader from '@/app/components/AppHeader'
import dynamic from 'next/dynamic'

const DashboardCharts = dynamic(() => import('@/app/components/DashboardCharts'), {
    loading: () => <div className="rounded-2xl border border-border bg-card p-6 h-64 animate-pulse" />,
    ssr: false,
})
const InviteModal = dynamic(() => import('@/app/components/InviteModal'), { ssr: false })
import EmptyState from '@/app/components/EmptyState'
import ErrorBoundary from '@/app/components/ErrorBoundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    MapPin, Clock, Zap, CheckCircle2, Plus, UserPlus,
} from 'lucide-react'

interface Chofer { id: string; nombre_completo: string; email: string }

export default function DashboardPage() {
    const { perfil, empresa, role } = useUser()
    const router = useRouter()
    const [choferes, setChoferes] = useState<Chofer[]>([])
    const [gastos, setGastos] = useState<{ importe: number; fecha: string }[]>([])
    const [chartTraslados, setChartTraslados] = useState<{ importe_total: number | null; created_at: string }[]>([])
    const [modalAbierto, setModalAbierto] = useState(false)
    const { data: counts } = useTrasladosCounts(perfil?.empresa_id ?? null)

    useEffect(() => {
        if (!perfil?.empresa_id) return
        cargarDatos(perfil.empresa_id)
    }, [perfil?.empresa_id])

    useEffect(() => {
        if (!perfil?.empresa_id) return
        const sub = supabase.channel('choferes-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, (payload) => {
                const n = payload.new as { empresa_id?: string }
                const o = payload.old as { empresa_id?: string }
                if (n?.empresa_id === perfil.empresa_id || o?.empresa_id === perfil.empresa_id) {
                    cargarChoferes(perfil.empresa_id)
                }
            }).subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [perfil?.empresa_id])

    const cargarDatos = async (empresaId: string) => {
        await Promise.all([
            cargarChoferes(empresaId),
            cargarDatosGrafico(empresaId),
        ])
    }

    const cargarChoferes = async (empresaId: string) => {
        const { data } = await supabase.from('perfiles').select('*').eq('empresa_id', empresaId).eq('rol', 'chofer')
        setChoferes(data || [])
    }

    const cargarDatosGrafico = async (empresaId: string) => {
        const [gastosRes, trasladosRes] = await Promise.all([
            supabase.from('gastos').select('importe, fecha').eq('empresa_id', empresaId).limit(1000),
            supabase.from('traslados').select('importe_total, created_at').eq('empresa_id', empresaId).eq('estado', 'completado').neq('estado_pago', 'pendiente').limit(1000),
        ])
        setGastos(gastosRes.data || [])
        setChartTraslados(trasladosRes.data || [])
    }

    const expulsarChofer = async (choferId: string, nombre: string) => {
        const ok = await confirmDelete({ title: 'Expulsar chofer', text: `¿Expulsar a ${nombre}?`, confirmButtonText: 'Si, expulsar' })
        if (!ok) return
        setChoferes(prev => prev.filter(c => c.id !== choferId))
        const { error } = await supabase.rpc('expulsar_chofer', { chofer_id: choferId })
        if (error) {
            showError('Error al expulsar: ' + error.message)
            if (perfil) await cargarChoferes(perfil.empresa_id)
        }
    }

    const statCards = [
        { label: 'Total Traslados', value: counts?.total ?? 0, icon: MapPin, iconBg: 'bg-primary/10', iconColor: 'text-primary', valueColor: 'text-foreground' },
        { label: 'Pendientes', value: counts?.pendiente ?? 0, icon: Clock, iconBg: 'bg-yellow-500/10', iconColor: 'text-yellow-600 dark:text-yellow-400', valueColor: 'text-yellow-600 dark:text-yellow-400' },
        { label: 'En Curso', value: counts?.en_curso ?? 0, icon: Zap, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-600 dark:text-blue-400', valueColor: 'text-blue-600 dark:text-blue-400' },
        { label: 'Completados', value: counts?.completado ?? 0, icon: CheckCircle2, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400', valueColor: 'text-emerald-600 dark:text-emerald-400' },
    ]

    return (
        <ErrorBoundary>
            <AppHeader breadcrumbs={[{ label: 'Dashboard' }]} />
            <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                        Hola, {perfil?.nombre_completo?.split(' ')[0] || 'Admin'}
                    </h1>
                    <p className="text-sm text-muted-foreground">{empresa?.nombre}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {statCards.map((s) => (
                        <Card key={s.label}>
                            <CardContent className="p-4 sm:p-5">
                                <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center mb-3`}>
                                    <s.icon className={`size-5 ${s.iconColor}`} />
                                </div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                                <p className={`text-xl sm:text-2xl lg:text-3xl font-bold mt-0.5 ${s.valueColor}`}>{s.value}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Charts */}
                {role === 'admin' && (
                    <DashboardCharts traslados={chartTraslados} gastos={gastos} />
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <button onClick={() => router.push('/dashboard/nuevo-traslado')}
                        className="group rounded-xl border border-border bg-card p-5 sm:p-6 text-left hover:border-primary/40 hover:shadow-md transition-all">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center mb-3 transition">
                            <Plus className="size-5 text-primary" />
                        </div>
                        <p className="font-semibold text-base text-foreground group-hover:text-primary transition">Nuevo Traslado</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Crear y asignar un nuevo servicio</p>
                    </button>
                    <button onClick={() => setModalAbierto(true)}
                        className="group rounded-xl border border-border bg-card p-5 sm:p-6 text-left hover:border-blue-500/40 hover:shadow-md transition-all">
                        <div className="w-11 h-11 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/15 flex items-center justify-center mb-3 transition">
                            <UserPlus className="size-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="font-semibold text-base text-foreground transition">Invitar Chofer</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Generar link de invitacion</p>
                    </button>
                </div>

                {/* Choferes */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle className="text-lg">Equipo de Choferes</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setModalAbierto(true)}>
                            <UserPlus className="size-4 mr-1.5" />
                            Invitar
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {choferes.length === 0 ? (
                            <EmptyState message="No hay choferes registrados" />
                        ) : (
                            <div className="space-y-2">
                                {choferes.map((chofer) => (
                                    <div key={chofer.id} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/30 transition">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="size-9 sm:size-10">
                                                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                                    {chofer.nombre_completo.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-foreground truncate">{chofer.nombre_completo}</p>
                                                <p className="text-xs text-muted-foreground truncate">{chofer.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="outline" className="hidden sm:inline-flex text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                                Activo
                                            </Badge>
                                            <Button variant="ghost" size="sm"
                                                onClick={() => expulsarChofer(chofer.id, chofer.nombre_completo)}
                                                className="text-muted-foreground hover:text-destructive text-xs">
                                                Expulsar
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <InviteModal open={modalAbierto} onOpenChange={setModalAbierto} empresaId={perfil?.empresa_id ?? null} />
        </ErrorBoundary>
    )
}
