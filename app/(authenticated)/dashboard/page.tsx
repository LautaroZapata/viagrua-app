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
    MapPin, Clock, Zap, CheckCircle2, Plus, UserPlus, Users,
} from 'lucide-react'

interface Chofer { id: string; nombre_completo: string; email: string }

const statMeta = [
    { key: 'total', label: 'Total Traslados', icon: MapPin, badgeClass: 'bg-primary/10 text-primary' },
    { key: 'pendiente', label: 'Pendientes', icon: Clock, badgeClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
    { key: 'en_curso', label: 'En Curso', icon: Zap, badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { key: 'completado', label: 'Completados', icon: CheckCircle2, badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
] as const

function formatDate() {
    return new Date().toLocaleDateString('es-AR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
}

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

    const firstName = perfil?.nombre_completo?.split(' ')[0] || 'Admin'

    return (
        <ErrorBoundary>
            <AppHeader breadcrumbs={[{ label: 'Dashboard' }]} />
            <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <p className="text-[13px] text-muted-foreground uppercase tracking-wide">
                            {formatDate()}
                        </p>
                        <h1 className="font-display text-[26px] font-bold text-foreground mt-1">
                            Buenos dias, {firstName}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="default" className="h-10 rounded-[10px]" onClick={() => setModalAbierto(true)}>
                            <UserPlus className="size-4 mr-1.5" />
                            Invitar chofer
                        </Button>
                        <Button size="default" className="h-10 rounded-[10px] shadow-[0_4px_14px_rgba(255,122,0,0.25)]" onClick={() => router.push('/dashboard/nuevo-traslado')}>
                            <Plus className="size-4 mr-1.5" />
                            Nuevo traslado
                        </Button>
                    </div>
                </div>

                {/* KPI Stats — unified card with dividers */}
                <Card className="overflow-hidden">
                    <CardContent className="p-0">
                        <div className="grid grid-cols-2 lg:grid-cols-4">
                            {statMeta.map((s, i) => {
                                const value = counts?.[s.key] ?? 0
                                const isLast = i === statMeta.length - 1
                                // Mobile 2-col: items 0,1 get border-bottom; items 0,2 get border-right
                                // Desktop 4-col: items 0,1,2 get border-right only
                                const borders = [
                                    i < 2 ? 'border-b lg:border-b-0' : '',
                                    i % 2 === 0 ? 'border-r' : (i < 3 ? 'lg:border-r' : ''),
                                ].filter(Boolean).join(' ')
                                return (
                                    <div
                                        key={s.key}
                                        className={`p-5 sm:p-6 ${borders} border-border ${
                                            isLast ? 'bg-gradient-to-br from-primary/5 to-primary/10' : ''
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                                            <Badge variant="secondary" className={`${s.badgeClass} rounded-full text-[10px] px-2 py-0.5`}>
                                                <s.icon className="size-3 mr-1" />
                                                {s.label.split(' ').pop()}
                                            </Badge>
                                        </div>
                                        <p className="font-display text-4xl font-bold tracking-[-0.02em] text-foreground">
                                            {value}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Charts */}
                {role === 'admin' && (
                    <DashboardCharts traslados={chartTraslados} gastos={gastos} />
                )}

                {/* Team section */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle className="font-display text-[15px] font-bold">Equipo de Choferes</CardTitle>
                        <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => router.push('/dashboard/choferes')}>
                            <Users className="size-4 mr-1.5" />
                            Gestionar equipo
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {choferes.length === 0 ? (
                            <EmptyState message="No hay choferes registrados" />
                        ) : (
                            <div className="space-y-1">
                                {choferes.map((chofer) => (
                                    <div key={chofer.id} className="flex items-center justify-between gap-3 p-3 rounded-[10px] hover:bg-accent/50 transition">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="size-9">
                                                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                                                    {chofer.nombre_completo.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-foreground truncate">{chofer.nombre_completo}</p>
                                                <p className="text-xs text-muted-foreground truncate">{chofer.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="status-dot bg-emerald-500 status-dot-pulse" />
                                                <span className="text-xs text-muted-foreground hidden sm:inline">Disponible</span>
                                            </div>
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
