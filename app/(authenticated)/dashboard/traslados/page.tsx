'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmDelete, confirmAction, showError } from '@/lib/swal'
import { useUser } from '@/app/components/UserContext'
import AppHeader from '@/app/components/AppHeader'
import Pagination from '@/app/components/Pagination'
import EmptyState from '@/app/components/EmptyState'
import ErrorBoundary from '@/app/components/ErrorBoundary'
import ClientOnly from '@/app/components/ClientOnly'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Download, Trash2, ChevronRight } from 'lucide-react'

interface Traslado {
    id: string; marca_modelo: string; matricula: string | null; es_0km: boolean;
    estado: string; estado_pago: string; importe_total: number | null;
    observaciones: string | null; created_at: string; perfiles?: { nombre_completo: string };
}

const ITEMS_PER_PAGE = 10

const estadoConfig: Record<string, { bg: string; text: string; label: string }> = {
    pendiente: { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pendiente' },
    en_curso: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: 'En Curso' },
    completado: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Completado' },
}

const pagoConfig: Record<string, { bg: string; text: string; label: string }> = {
    pendiente: { bg: 'bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pendiente' },
    efectivo: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', label: 'Efectivo' },
    transferencia: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', label: 'Transfer.' },
}

export default function TrasladosPage() {
    const { perfil } = useUser()
    const router = useRouter()
    const [traslados, setTraslados] = useState<Traslado[]>([])
    const [trasladosPage, setTrasladosPage] = useState(1)
    const [trasladosTotal, setTrasladosTotal] = useState(0)
    const [filtroTrasladosPendientes, setFiltroTrasladosPendientes] = useState(false)
    const [filtroPagosPendientes, setFiltroPagosPendientes] = useState(false)

    useEffect(() => {
        if (perfil?.empresa_id) cargarTraslados(perfil.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
    }, [perfil?.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes])

    useEffect(() => {
        if (!perfil?.empresa_id) return
        const sub = supabase.channel('traslados-list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'traslados' }, () => {
                if (perfil?.empresa_id) cargarTraslados(perfil.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
            }).subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [perfil?.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes])

    const cargarTraslados = async (empresaId: string, page: number, soloTP: boolean, soloPP: boolean) => {
        const from = (page - 1) * ITEMS_PER_PAGE
        const to = page * ITEMS_PER_PAGE - 1
        let query = supabase.from('traslados').select('*, perfiles(nombre_completo)', { count: 'exact' }).eq('empresa_id', empresaId)
        if (soloTP) query = query.eq('estado', 'pendiente')
        if (soloPP) query = query.eq('estado_pago', 'pendiente')
        const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)
        if (error) { setTraslados([]); setTrasladosTotal(0); return }
        setTraslados(data || [])
        setTrasladosTotal(count || 0)
    }

    const cambiarEstado = async (trasladoId: string, nuevoEstado: string) => {
        if (!perfil) return
        if (nuevoEstado === 'completado') {
            const ok = await confirmAction({ title: 'Confirmar', text: '¿Marcar como completado? Esta accion bloqueara el traslado.', icon: 'warning', confirmButtonText: 'Si, completar' })
            if (!ok) return
        }
        setTraslados(prev => prev.map(t => t.id === trasladoId ? { ...t, estado: nuevoEstado } : t))
        const { error } = await supabase.from('traslados').update({ estado: nuevoEstado }).eq('id', trasladoId).eq('empresa_id', perfil.empresa_id)
        if (error) {
            showError('Error: ' + error.message)
            cargarTraslados(perfil.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
        }
    }

    const eliminarTraslado = async (trasladoId: string) => {
        if (!perfil) return
        const ok = await confirmDelete({ title: 'Eliminar traslado', text: '¿Eliminar este traslado? No se puede deshacer.' })
        if (!ok) return
        setTraslados(prev => prev.filter(t => t.id !== trasladoId))
        const { data: files } = await supabase.storage.from('fotos-traslados').list(trasladoId)
        if (files?.length) await supabase.storage.from('fotos-traslados').remove(files.map(f => `${trasladoId}/${f.name}`))
        const { error } = await supabase.from('traslados').delete().eq('id', trasladoId).eq('empresa_id', perfil.empresa_id)
        if (error) {
            showError('Error: ' + error.message)
            cargarTraslados(perfil.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
        }
    }

    return (
        <ErrorBoundary>
            <AppHeader
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Traslados' }]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <a href="/api/export/empresa"><Download className="size-4 mr-1.5" />CSV</a>
                        </Button>
                        <Button size="sm" onClick={() => router.push('/dashboard/nuevo-traslado')}>
                            <Plus className="size-4 mr-1.5" />Nuevo
                        </Button>
                    </div>
                }
            />
            <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
                            <div>
                                <h3 className="font-semibold text-lg text-foreground">Lista de Traslados</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <button onClick={() => { setFiltroTrasladosPendientes(!filtroTrasladosPendientes); setTrasladosPage(1) }}
                                        className={`filter-btn inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${filtroTrasladosPendientes ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' : 'bg-muted text-muted-foreground border-transparent hover:bg-accent'}`}>
                                        <span className={`status-dot ${filtroTrasladosPendientes ? 'bg-yellow-500 status-dot-pulse' : 'bg-muted-foreground/40'}`} />
                                        Pendientes
                                    </button>
                                    <button onClick={() => { setFiltroPagosPendientes(!filtroPagosPendientes); setTrasladosPage(1) }}
                                        className={`filter-btn inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${filtroPagosPendientes ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-transparent hover:bg-accent'}`}>
                                        <span className={`status-dot ${filtroPagosPendientes ? 'bg-primary status-dot-pulse' : 'bg-muted-foreground/40'}`} />
                                        Pagos Pend.
                                    </button>
                                </div>
                            </div>
                        </div>

                        {traslados.length === 0 ? (
                            <EmptyState message="No hay traslados registrados" />
                        ) : (
                            <div className="space-y-2 animate-stagger">
                                {traslados.map((t) => {
                                    const estado = estadoConfig[t.estado] || estadoConfig.pendiente
                                    const pago = pagoConfig[t.estado_pago] || pagoConfig.pendiente
                                    return (
                                        <div key={t.id} className="rounded-lg border border-border hover:border-border/80 hover:bg-accent/30 p-3 sm:p-4 transition group">
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                                <div className="flex-1 cursor-pointer min-w-0" onClick={() => router.push(`/dashboard/traslado/${t.id}`)}>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">{t.marca_modelo}</h4>
                                                        {t.es_0km && <Badge variant="secondary" className="text-[10px]">0 KM</Badge>}
                                                        <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-primary transition shrink-0 ml-auto lg:ml-0" />
                                                    </div>
                                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                        {t.matricula && <span># {t.matricula}</span>}
                                                        {t.importe_total != null && (
                                                            <span className="flex items-center gap-1.5">
                                                                <span className="font-medium text-foreground">${t.importe_total.toLocaleString('es-AR')}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pago.bg} ${pago.text}`}>{pago.label}</span>
                                                            </span>
                                                        )}
                                                        <span>{t.perfiles?.nombre_completo || 'Sin asignar'}</span>
                                                        <ClientOnly>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</ClientOnly>
                                                    </div>
                                                    {t.observaciones && <p className="text-xs text-muted-foreground/60 mt-1.5 italic line-clamp-1">&ldquo;{t.observaciones}&rdquo;</p>}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <select value={t.estado} onChange={(e) => cambiarEstado(t.id, e.target.value)}
                                                        disabled={t.estado === 'completado'}
                                                        className={`text-xs font-medium px-3 py-2 rounded-lg border cursor-pointer transition ${estado.bg} ${estado.text} ${t.estado === 'completado' ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                                        <option value="pendiente">Pendiente</option>
                                                        <option value="en_curso">En Curso</option>
                                                        <option value="completado">Completado</option>
                                                    </select>
                                                    <Button variant="ghost" size="icon" onClick={() => eliminarTraslado(t.id)}
                                                        className="text-muted-foreground/50 hover:text-destructive" aria-label="Eliminar traslado">
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        <Pagination currentPage={trasladosPage} totalItems={trasladosTotal} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setTrasladosPage} />
                    </CardContent>
                </Card>
            </div>
        </ErrorBoundary>
    )
}
