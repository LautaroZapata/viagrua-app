'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmAction, showError } from '@/lib/swal'
import { useUser } from '@/app/components/UserContext'
import { useTrasladoChofer, type TrasladoDetalleChofer } from '@/lib/useSupabaseQuery'
import AppHeader from '@/app/components/AppHeader'
import ClientOnly from '@/app/components/ClientOnly'
import LoadingSpinner from '@/app/components/LoadingSpinner'
import FotosTraslado from '@/app/components/traslado/FotosTraslado'
import ToggleEstado from '@/app/components/traslado/ToggleEstado'
import { OPCIONES_ESTADO, OPCIONES_PAGO } from '@/lib/trasladoStatus'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function DetalleTraslado() {
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string
    const { user } = useUser()
    const [actualizando, setActualizando] = useState(false)

    // Cacheado por traslado: el chofer que entra, vuelve y entra de nuevo no
    // espera de nuevo. Importa mas aca que en el admin, que es donde la
    // conexion suele ser peor.
    const { data: traslado, error: errorCarga, isLoading, mutate } =
        useTrasladoChofer(id, user?.id ?? null)

    // No existe o no esta asignado a este chofer. El hook no reintenta.
    useEffect(() => { if (errorCarga) router.push('/chofer') }, [errorCarga, router])

    useEffect(() => {
        if (!id) return
        // Nombre distinto al de la vista admin: un admin que abre el mismo
        // traslado en ambas vistas tendria dos canales con el mismo topic.
        const ch = supabase.channel('traslado-chofer-' + id)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'traslados', filter: `id=eq.${id}` },
                (p) => mutate(prev => prev ? { ...prev, ...p.new, empresas: (p.new as Record<string, unknown>).empresas ?? prev.empresas } as TrasladoDetalleChofer : prev, { revalidate: false }))
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [id, mutate])

    const estadoBloqueado = traslado?.estado === 'completado'
    const pagoBloqueado = traslado?.estado_pago !== 'pendiente'

    const cambiarEstado = async (nuevoEstado: string) => {
        if (!traslado || !user) return
        if (nuevoEstado === 'completado') {
            const ok = await confirmAction({ title: 'Confirmar', text: '¿Marcar como completado? Se bloqueara.', icon: 'warning', confirmButtonText: 'Si, completar' })
            if (!ok) return
        }
        const prev = traslado.estado
        setActualizando(true)
        mutate(t => t ? { ...t, estado: nuevoEstado } : t, { revalidate: false })
        const { error } = await supabase.from('traslados').update({ estado: nuevoEstado }).eq('id', traslado.id).eq('chofer_id', user.id)
        if (error) { mutate(t => t ? { ...t, estado: prev } : t, { revalidate: false }); showError('Error: ' + error.message) }
        setActualizando(false)
    }

    const cambiarPago = async (nuevo: string) => {
        if (!traslado || !user) return
        const ok = await confirmAction({ title: 'Confirmar pago', text: `¿Cambiar a "${nuevo}"?`, icon: 'question', confirmButtonText: 'Si, confirmar' })
        if (!ok) return
        const prev = traslado.estado_pago
        setActualizando(true)
        mutate(t => t ? { ...t, estado_pago: nuevo } : t, { revalidate: false })
        const { error } = await supabase.from('traslados').update({ estado_pago: nuevo }).eq('id', traslado.id).eq('chofer_id', user.id)
        if (error) { mutate(t => t ? { ...t, estado_pago: prev } : t, { revalidate: false }); showError('Error: ' + error.message) }
        setActualizando(false)
    }

    if (isLoading) return <div className="flex h-dvh items-center justify-center"><LoadingSpinner /></div>
    if (!traslado) return null

    return (
        <>
            <AppHeader breadcrumbs={[{ label: 'Mis Traslados', href: '/chofer' }, { label: traslado.marca_modelo }]} />
            <div className="page-enter p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
                {/* Empresa header */}
                <div className="bg-gradient-to-r from-primary/90 to-primary text-white p-4 rounded-xl">
                    <p className="text-xs uppercase tracking-wide opacity-80 mb-1">Trabajo para</p>
                    <p className="text-lg font-semibold">{traslado.empresas?.nombre || 'Empresa'}</p>
                    <ClientOnly>
                        <p className="text-xs opacity-80 mt-1">{traslado.created_at ? new Date(traslado.created_at).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}</p>
                    </ClientOnly>
                </div>

                {/* Info */}
                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-xl font-semibold text-foreground">{traslado.marca_modelo}</h2>
                                {traslado.es_0km && <Badge variant="secondary" className="mt-1.5">0 KM</Badge>}
                            </div>
                            <Badge variant="outline" className={`${traslado.estado === 'pendiente' ? 'text-yellow-700 dark:text-yellow-400 border-yellow-500/30' : traslado.estado === 'en_curso' ? 'text-blue-700 dark:text-blue-400 border-blue-500/30' : 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30'}`}>
                                {traslado.estado?.toUpperCase().replace('_', ' ')}
                            </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {traslado.matricula && (
                                <div className="bg-muted/50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Matricula</p>
                                    <p className="text-base font-semibold text-foreground">{traslado.matricula}</p>
                                </div>
                            )}
                            {traslado.importe_total != null && (
                                <div className="bg-muted/50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Importe</p>
                                    <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">${traslado.importe_total.toLocaleString('es-AR')}</p>
                                    <Badge variant="outline" className={`text-xs mt-1 ${traslado.estado_pago === 'pendiente' ? 'text-yellow-700 dark:text-yellow-400' : traslado.estado_pago === 'efectivo' ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                        {traslado.estado_pago === 'pendiente' ? 'Pago pendiente' : traslado.estado_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                                    </Badge>
                                </div>
                            )}
                        </div>
                        {(traslado.departamento || traslado.direccion) && (
                            <div className="mt-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium mb-1">Ubicacion</p>
                                <p className="text-sm text-foreground">{traslado.direccion}{traslado.direccion && traslado.departamento && ' - '}{traslado.departamento}</p>
                            </div>
                        )}
                        {(traslado.desde || traslado.hasta) && (
                            <div className="mt-3 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-medium mb-1">Recorrido</p>
                                <p className="text-sm text-foreground">
                                    {traslado.desde && <span className="font-medium">Desde: {traslado.desde}</span>}
                                    {traslado.desde && traslado.hasta && <span className="mx-2 text-muted-foreground">&rarr;</span>}
                                    {traslado.hasta && <span className="font-medium">Hasta: {traslado.hasta}</span>}
                                </p>
                            </div>
                        )}
                        {traslado.observaciones && (
                            <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                <p className="text-xs text-primary uppercase font-medium mb-1">Observaciones</p>
                                <p className="text-sm text-foreground">{traslado.observaciones}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <FotosTraslado traslado={traslado} />

                <ToggleEstado
                    titulo="Cambiar estado"
                    opciones={OPCIONES_ESTADO}
                    valorActual={traslado.estado}
                    onCambiar={cambiarEstado}
                    actualizando={actualizando}
                    bloqueado={estadoBloqueado ? {
                        tono: 'destructive',
                        mensaje: <>El traslado esta <b>completado</b> y no puede modificarse.</>,
                    } : undefined}
                />

                {traslado.importe_total != null && (
                    <ToggleEstado
                        titulo="Estado de pago"
                        opciones={OPCIONES_PAGO}
                        valorActual={traslado.estado_pago}
                        onCambiar={cambiarPago}
                        actualizando={actualizando}
                        bloqueado={pagoBloqueado ? {
                            tono: 'info',
                            mensaje: 'El estado de pago ya fue definido.',
                        } : undefined}
                    />
                )}
            </div>
        </>
    )
}
