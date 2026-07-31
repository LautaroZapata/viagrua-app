'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmDelete, confirmAction, showError } from '@/lib/swal'
import { useUser } from '@/app/components/UserContext'
import { useTrasladoAdmin, type TrasladoDetalleAdmin } from '@/lib/useSupabaseQuery'
import AppHeader from '@/app/components/AppHeader'
import ClientOnly from '@/app/components/ClientOnly'
import LoadingSpinner from '@/app/components/LoadingSpinner'
import FotosTraslado from '@/app/components/traslado/FotosTraslado'
import ToggleEstado from '@/app/components/traslado/ToggleEstado'
import { OPCIONES_ESTADO, OPCIONES_PAGO } from '@/lib/trasladoStatus'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'

export default function DetalleTrasladoAdmin() {
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string
    const { perfil } = useUser()
    const [actualizando, setActualizando] = useState(false)

    // Cacheado por traslado: volver a la lista y entrar de nuevo al mismo lo
    // dibuja al instante y revalida atras.
    const { data: traslado, error: errorCarga, isLoading, mutate } =
        useTrasladoAdmin(id, perfil?.empresa_id ?? null)

    // El traslado no existe o no es de esta empresa. El hook no reintenta, asi
    // que esto corre una sola vez.
    useEffect(() => { if (errorCarga) router.push('/dashboard/traslados') }, [errorCarga, router])

    useEffect(() => {
        if (!id) return
        const ch = supabase.channel('traslado-admin-' + id)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'traslados', filter: `id=eq.${id}` },
                (p) => mutate(prev => (prev ? { ...prev, ...p.new } : p.new) as TrasladoDetalleAdmin, { revalidate: false }))
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [id, mutate])

    const estadoBloqueado = traslado?.estado === 'completado'
    const pagoBloqueado = traslado?.estado_pago !== 'pendiente'

    const cambiarEstado = async (nuevoEstado: string) => {
        if (!traslado) return
        if (nuevoEstado === 'completado') {
            const ok = await confirmAction({ title: 'Confirmar', text: '¿Marcar como completado? Se bloqueara.', icon: 'warning', confirmButtonText: 'Si, completar' })
            if (!ok) return
        }
        const prev = traslado.estado
        setActualizando(true)
        mutate(t => t ? { ...t, estado: nuevoEstado } : t, { revalidate: false })
        const { error } = await supabase.from('traslados').update({ estado: nuevoEstado }).eq('id', traslado.id)
        if (error) { mutate(t => t ? { ...t, estado: prev } : t, { revalidate: false }); showError('Error: ' + error.message) }
        setActualizando(false)
    }

    const cambiarPago = async (nuevo: string) => {
        if (!traslado) return
        const ok = await confirmAction({ title: 'Confirmar pago', text: `¿Cambiar a "${nuevo}"?`, icon: 'question', confirmButtonText: 'Si, confirmar' })
        if (!ok) return
        const prev = traslado.estado_pago
        setActualizando(true)
        mutate(t => t ? { ...t, estado_pago: nuevo } : t, { revalidate: false })
        const { error } = await supabase.from('traslados').update({ estado_pago: nuevo }).eq('id', traslado.id)
        if (error) { mutate(t => t ? { ...t, estado_pago: prev } : t, { revalidate: false }); showError('Error: ' + error.message) }
        setActualizando(false)
    }

    const eliminar = async () => {
        if (!traslado) return
        const ok = await confirmDelete({ title: 'Eliminar traslado', text: 'No se puede deshacer.' })
        if (!ok) return
        const { data: files } = await supabase.storage.from('fotos-traslados').list(traslado.id)
        if (files?.length) await supabase.storage.from('fotos-traslados').remove(files.map(f => `${traslado.id}/${f.name}`))
        const { error } = await supabase.from('traslados').delete().eq('id', traslado.id)
        if (error) { showError('Error: ' + error.message); return }
        router.push('/dashboard/traslados')
    }

    if (isLoading) return <div className="flex h-dvh items-center justify-center"><LoadingSpinner /></div>
    if (!traslado) return null

    return (
        <>
            <AppHeader
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Traslados', href: '/dashboard/traslados' }, { label: traslado.marca_modelo }]}
                actions={<Button variant="destructive" size="sm" onClick={eliminar}><Trash2 className="size-4 mr-1.5" />Eliminar</Button>}
            />
            <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-4">
                {/* Info */}
                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-foreground">{traslado.marca_modelo}</h2>
                                <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                                    {traslado.es_0km && <Badge variant="secondary">0 KM</Badge>}
                                    <span>{traslado.perfiles?.nombre_completo || 'Sin asignar'}</span>
                                </div>
                            </div>
                            <Badge variant="outline" className={`${traslado.estado === 'pendiente' ? 'text-yellow-700 dark:text-yellow-400 border-yellow-500/30' : traslado.estado === 'en_curso' ? 'text-blue-700 dark:text-blue-400 border-blue-500/30' : 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30'}`}>
                                {traslado.estado === 'pendiente' ? 'Pendiente' : traslado.estado === 'en_curso' ? 'En Curso' : 'Completado'}
                            </Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
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
                            <div className="bg-muted/50 p-3 rounded-lg">
                                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Fecha</p>
                                <p className="text-base font-semibold text-foreground">
                                    <ClientOnly>{traslado.created_at ? new Date(traslado.created_at).toLocaleDateString() : ''}</ClientOnly>
                                </p>
                            </div>
                        </div>
                        {(traslado.desde || traslado.hasta) && (
                            <div className="mt-4 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-medium mb-1">Recorrido</p>
                                <p className="text-sm text-foreground">
                                    {traslado.desde && <span className="font-medium">Desde: {traslado.desde}</span>}
                                    {traslado.desde && traslado.hasta && <span className="mx-2 text-muted-foreground">&rarr;</span>}
                                    {traslado.hasta && <span className="font-medium">Hasta: {traslado.hasta}</span>}
                                </p>
                            </div>
                        )}
                        {(traslado.departamento || traslado.direccion) && (
                            <div className="mt-4 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium mb-1">Ubicacion</p>
                                <p className="text-sm text-foreground">
                                    {traslado.direccion && <span className="font-medium">{traslado.direccion}</span>}
                                    {traslado.direccion && traslado.departamento && ' - '}
                                    {traslado.departamento}
                                </p>
                            </div>
                        )}
                        {traslado.observaciones && (
                            <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
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
