'use client'
import { useState, useEffect } from 'react'
import ClientOnly from '../../../components/ClientOnly'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmAction, showError } from '@/lib/swal'
import { ArrowLeft, Truck, Camera, X } from 'lucide-react'
import LoadingSpinner from '../../../components/LoadingSpinner'

interface Traslado {
    id: string
    marca_modelo: string
    matricula: string | null
    es_0km: boolean
    estado: string
    estado_pago: string
    importe_total: number | null
    observaciones: string | null
    foto_frontal: string | null
    foto_lateral: string | null
    foto_trasera: string | null
    foto_interior: string | null
    created_at: string
    departamento: string | null
    direccion: string | null
    desde?: string | null
    hasta?: string | null
    empresas?: { nombre: string }
}

export default function DetalleTraslado() {
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string

    const [traslado, setTraslado] = useState<Traslado | null>(null)
    const [loading, setLoading] = useState(true)
    const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
    const [actualizando, setActualizando] = useState(false)

    useEffect(() => { cargarTraslado() }, [id])

    useEffect(() => {
        if (!id) return;
        const channel = supabase.channel('traslado-' + id)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'traslados',
                filter: `id=eq.${id}`
            }, (payload) => {
                setTraslado((prev) => {
                    if (!prev) return null;
                    return { ...prev, ...payload.new, empresas: payload.new.empresas ?? prev.empresas } as Traslado;
                })
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [id]);

    const cargarTraslado = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data, error } = await supabase
            .from('traslados')
            .select('*, empresas(nombre)')
            .eq('id', id)
            .eq('chofer_id', user.id)
            .single()

        if (error || !data) { router.push('/chofer'); return }
        setTraslado(data)
        setLoading(false)
    }

    const estadoBloqueado = traslado?.estado === 'completado'
    const pagoBloqueado = traslado?.estado_pago !== 'pendiente'

    const cambiarEstado = async (nuevoEstado: string) => {
        if (!traslado) return
        if (nuevoEstado === 'completado') {
            const ok = await confirmAction({
                title: 'Confirmar',
                text: '¿Confirmar marcar como completado? Esta accion bloqueara el traslado.',
                icon: 'warning',
                confirmButtonText: 'Si, completar',
            })
            if (!ok) return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const estadoAnterior = traslado.estado
        setActualizando(true)
        setTraslado(prev => prev ? { ...prev, estado: nuevoEstado } : prev)

        try {
            const { error } = await supabase
                .from('traslados')
                .update({ estado: nuevoEstado })
                .eq('id', traslado.id)
                .eq('chofer_id', user.id)

            if (error) {
                setTraslado(prev => prev ? { ...prev, estado: estadoAnterior } : prev)
                showError('Error: ' + error.message)
            }
        } finally {
            setActualizando(false)
        }
    }

    const cambiarEstadoPago = async (nuevoEstadoPago: string) => {
        if (!traslado) return

        const ok = await confirmAction({
            title: 'Confirmar metodo de pago',
            text: `¿Confirmar cambio de metodo de pago a "${nuevoEstadoPago}"?`,
            icon: 'question',
            confirmButtonText: 'Si, confirmar',
        })
        if (!ok) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const estadoPagoAnterior = traslado.estado_pago
        setActualizando(true)
        setTraslado(prev => prev ? { ...prev, estado_pago: nuevoEstadoPago } : prev)

        try {
            const { error } = await supabase
                .from('traslados')
                .update({ estado_pago: nuevoEstadoPago })
                .eq('id', traslado.id)
                .eq('chofer_id', user.id)

            if (error) {
                setTraslado(prev => prev ? { ...prev, estado_pago: estadoPagoAnterior } : prev)
                showError('Error: ' + error.message)
            }
        } finally {
            setActualizando(false)
        }
    }

    const fotos = traslado ? [
        { tipo: 'Frontal', url: traslado.foto_frontal },
        { tipo: 'Lateral', url: traslado.foto_lateral },
        { tipo: 'Trasera', url: traslado.foto_trasera },
        { tipo: 'Interior', url: traslado.foto_interior }
    ].filter(f => f.url) : []

    const estadoButtons: Record<string, { active: string; inactive: string; label: string }> = {
        pendiente: { active: 'bg-yellow-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Pendiente' },
        en_curso: { active: 'bg-blue-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'En Curso' },
        completado: { active: 'bg-emerald-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Completado' },
    }

    const pagoButtons: Record<string, { active: string; inactive: string; label: string }> = {
        pendiente: { active: 'bg-yellow-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Pendiente' },
        efectivo: { active: 'bg-emerald-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Efectivo' },
        transferencia: { active: 'bg-blue-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Transferencia' },
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <LoadingSpinner />
            </div>
        )
    }

    if (!traslado) return null

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Navbar */}
            <nav className="navbar sticky top-0 z-30">
                <div className="flex items-center gap-3 w-full px-4 sm:px-6 lg:px-8 py-3">
                    <button aria-label="Volver a mis traslados" onClick={() => router.push('/chofer')} className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                        <Truck className="w-4 h-4 text-white" />
                    </div>
                    <h1 className="text-sm sm:text-base font-semibold text-white">Detalle del Traslado</h1>
                </div>
            </nav>

            <div className="w-full px-4 py-4 sm:py-6 max-w-3xl mx-auto space-y-4">
                {/* Empresa Header */}
                <div className="bg-gradient-to-r from-primary/90 to-primary text-white p-4 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wide opacity-80 mb-1">Trabajo para</p>
                    <p className="text-lg font-semibold">{traslado.empresas?.nombre || 'Empresa'}</p>
                    <ClientOnly>
                        <p className="text-xs opacity-80 mt-1">
                            {traslado.created_at ? new Date(traslado.created_at).toLocaleDateString('es-AR', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                            }) : ''}
                        </p>
                    </ClientOnly>
                </div>

                {/* Info Principal */}
                <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">{traslado.marca_modelo}</h2>
                            {traslado.es_0km && (
                                <span className="inline-block mt-1.5 text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded font-medium">0 KM</span>
                            )}
                        </div>
                        <span className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                            traslado.estado === 'pendiente'
                                ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                                : traslado.estado === 'en_curso'
                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        }`}>
                            {traslado.estado?.toUpperCase().replace('_', ' ')}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {traslado.matricula && (
                            <div className="bg-muted/50 p-3 rounded-lg">
                                <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Matricula</p>
                                <p className="text-base font-semibold text-foreground">{traslado.matricula}</p>
                            </div>
                        )}
                        {traslado.importe_total != null && (
                            <div className="bg-muted/50 p-3 rounded-lg">
                                <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Importe</p>
                                <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">${traslado.importe_total.toLocaleString('es-AR')}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block font-medium ${
                                    traslado.estado_pago === 'pendiente' ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' :
                                    traslado.estado_pago === 'efectivo' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                                    'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                }`}>
                                    {traslado.estado_pago === 'pendiente' ? 'Pago pendiente' :
                                     traslado.estado_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                                </span>
                            </div>
                        )}
                    </div>

                    {(traslado.departamento || traslado.direccion) && (
                        <div className="mt-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-medium mb-1">Ubicacion</p>
                            <p className="text-sm text-foreground">
                                {traslado.direccion && <span className="font-medium">{traslado.direccion}</span>}
                                {traslado.direccion && traslado.departamento && ' - '}
                                {traslado.departamento && <span>{traslado.departamento}</span>}
                            </p>
                        </div>
                    )}

                    {(traslado.desde || traslado.hasta) && (
                        <div className="mt-3 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-medium mb-1">Recorrido</p>
                            <p className="text-sm text-foreground">
                                {traslado.desde && <span className="font-medium">Desde: {traslado.desde}</span>}
                                {traslado.desde && traslado.hasta && <span className="mx-2 text-muted-foreground">→</span>}
                                {traslado.hasta && <span className="font-medium">Hasta: {traslado.hasta}</span>}
                            </p>
                        </div>
                    )}

                    {traslado.observaciones && (
                        <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <p className="text-[10px] text-primary uppercase font-medium mb-1">Observaciones</p>
                            <p className="text-sm text-foreground">{traslado.observaciones}</p>
                        </div>
                    )}
                </div>

                {/* Fotos */}
                {fotos.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Camera className="w-4 h-4 text-muted-foreground" />
                            <h3 className="text-sm font-semibold text-foreground">Fotos de Inspeccion</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {fotos.map((foto) => (
                                <div key={foto.tipo} className="relative">
                                    <img src={foto.url!} alt={foto.tipo}
                                        className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                                        onClick={() => setFotoAmpliada(foto.url)} />
                                    <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                                        {foto.tipo}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Cambiar Estado */}
                <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Cambiar Estado</h3>
                    {estadoBloqueado && (
                        <div className="mb-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                            El traslado esta <b>completado</b> y no puede ser modificado.
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(['pendiente', 'en_curso', 'completado'] as const).map((estado) => {
                            const cfg = estadoButtons[estado]
                            return (
                                <button key={estado} onClick={() => cambiarEstado(estado)}
                                    disabled={actualizando || estadoBloqueado}
                                    className={`py-3 px-3 rounded-lg font-medium text-xs transition min-h-[44px] ${
                                        traslado.estado === estado ? cfg.active : cfg.inactive
                                    } ${estadoBloqueado ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {cfg.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Estado de Pago */}
                {traslado.importe_total != null && (
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                        <h3 className="text-sm font-semibold text-foreground mb-3">Estado de Pago</h3>
                        {pagoBloqueado && (
                            <div className="mb-3 text-xs text-blue-700 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                                El estado de pago ya fue definido y no puede ser modificado.
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {(['pendiente', 'efectivo', 'transferencia'] as const).map((pago) => {
                                const cfg = pagoButtons[pago]
                                return (
                                    <button key={pago} onClick={() => cambiarEstadoPago(pago)}
                                        disabled={actualizando || pagoBloqueado}
                                        className={`py-3 px-3 rounded-lg font-medium text-xs transition min-h-[44px] ${
                                            traslado.estado_pago === pago ? cfg.active : cfg.inactive
                                        } ${pagoBloqueado ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {cfg.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal foto ampliada */}
            {fotoAmpliada && (
                <div role="dialog" aria-modal="true" aria-label="Foto ampliada" tabIndex={0}
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setFotoAmpliada(null)}
                    onKeyDown={(e) => e.key === 'Escape' && setFotoAmpliada(null)}>
                    <button aria-label="Cerrar foto"
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
                        onClick={() => setFotoAmpliada(null)}>
                        <X className="w-6 h-6 text-white" />
                    </button>
                    <img src={fotoAmpliada} alt="Foto ampliada" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
                </div>
            )}
        </div>
    )
}
