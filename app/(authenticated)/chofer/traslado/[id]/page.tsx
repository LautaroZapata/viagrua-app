'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmAction, showError } from '@/lib/swal'
import { useUser } from '@/app/components/UserContext'
import AppHeader from '@/app/components/AppHeader'
import ClientOnly from '@/app/components/ClientOnly'
import LoadingSpinner from '@/app/components/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Camera, AlertTriangle, Info } from 'lucide-react'

interface Traslado {
    id: string; marca_modelo: string; matricula: string | null; es_0km: boolean;
    estado: string; estado_pago: string; importe_total: number | null;
    observaciones: string | null; foto_frontal: string | null; foto_lateral: string | null;
    foto_trasera: string | null; foto_interior: string | null; created_at: string;
    departamento: string | null; direccion: string | null; desde?: string | null;
    hasta?: string | null; empresas?: { nombre: string };
}

export default function DetalleTraslado() {
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string
    const { user } = useUser()
    const [traslado, setTraslado] = useState<Traslado | null>(null)
    const [loading, setLoading] = useState(true)
    const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
    const [actualizando, setActualizando] = useState(false)

    useEffect(() => { if (user?.id) cargarTraslado() }, [id, user?.id])

    useEffect(() => {
        if (!id) return
        const ch = supabase.channel('traslado-' + id)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'traslados', filter: `id=eq.${id}` },
                (p) => setTraslado(prev => prev ? { ...prev, ...p.new, empresas: (p.new as Record<string, unknown>).empresas ?? prev.empresas } as Traslado : null))
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [id])

    const cargarTraslado = async () => {
        if (!user) return
        const { data, error } = await supabase.from('traslados').select('*, empresas(nombre)')
            .eq('id', id).eq('chofer_id', user.id).single()
        if (error || !data) { router.push('/chofer'); return }
        setTraslado(data)
        setLoading(false)
    }

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
        setTraslado(t => t ? { ...t, estado: nuevoEstado } : t)
        const { error } = await supabase.from('traslados').update({ estado: nuevoEstado }).eq('id', traslado.id).eq('chofer_id', user.id)
        if (error) { setTraslado(t => t ? { ...t, estado: prev } : t); showError('Error: ' + error.message) }
        setActualizando(false)
    }

    const cambiarPago = async (nuevo: string) => {
        if (!traslado || !user) return
        const ok = await confirmAction({ title: 'Confirmar pago', text: `¿Cambiar a "${nuevo}"?`, icon: 'question', confirmButtonText: 'Si, confirmar' })
        if (!ok) return
        const prev = traslado.estado_pago
        setActualizando(true)
        setTraslado(t => t ? { ...t, estado_pago: nuevo } : t)
        const { error } = await supabase.from('traslados').update({ estado_pago: nuevo }).eq('id', traslado.id).eq('chofer_id', user.id)
        if (error) { setTraslado(t => t ? { ...t, estado_pago: prev } : t); showError('Error: ' + error.message) }
        setActualizando(false)
    }

    const fotos = traslado ? [
        { tipo: 'Frontal', url: traslado.foto_frontal }, { tipo: 'Lateral', url: traslado.foto_lateral },
        { tipo: 'Trasera', url: traslado.foto_trasera }, { tipo: 'Interior', url: traslado.foto_interior },
    ].filter(f => f.url) : []

    const estadoConfig: Record<string, { active: string; inactive: string; label: string }> = {
        pendiente: { active: 'bg-yellow-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Pendiente' },
        en_curso: { active: 'bg-blue-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'En Curso' },
        completado: { active: 'bg-emerald-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Completado' },
    }
    const pagoConfig2: Record<string, { active: string; inactive: string; label: string }> = {
        pendiente: { active: 'bg-yellow-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Pendiente' },
        efectivo: { active: 'bg-emerald-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Efectivo' },
        transferencia: { active: 'bg-blue-500 text-white', inactive: 'bg-muted text-muted-foreground hover:bg-accent', label: 'Transferencia' },
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><LoadingSpinner /></div>
    if (!traslado) return null

    return (
        <>
            <AppHeader breadcrumbs={[{ label: 'Mis Traslados', href: '/chofer' }, { label: traslado.marca_modelo }]} />
            <div className="page-enter p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
                {/* Empresa header */}
                <div className="bg-gradient-to-r from-primary/90 to-primary text-white p-4 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wide opacity-80 mb-1">Trabajo para</p>
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
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Matricula</p>
                                    <p className="text-base font-semibold text-foreground">{traslado.matricula}</p>
                                </div>
                            )}
                            {traslado.importe_total != null && (
                                <div className="bg-muted/50 p-3 rounded-lg">
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Importe</p>
                                    <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">${traslado.importe_total.toLocaleString('es-AR')}</p>
                                    <Badge variant="outline" className={`text-[10px] mt-1 ${traslado.estado_pago === 'pendiente' ? 'text-yellow-700 dark:text-yellow-400' : traslado.estado_pago === 'efectivo' ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                        {traslado.estado_pago === 'pendiente' ? 'Pago pendiente' : traslado.estado_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                                    </Badge>
                                </div>
                            )}
                        </div>
                        {(traslado.departamento || traslado.direccion) && (
                            <div className="mt-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-medium mb-1">Ubicacion</p>
                                <p className="text-sm text-foreground">{traslado.direccion}{traslado.direccion && traslado.departamento && ' - '}{traslado.departamento}</p>
                            </div>
                        )}
                        {(traslado.desde || traslado.hasta) && (
                            <div className="mt-3 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-medium mb-1">Recorrido</p>
                                <p className="text-sm text-foreground">
                                    {traslado.desde && <span className="font-medium">Desde: {traslado.desde}</span>}
                                    {traslado.desde && traslado.hasta && <span className="mx-2 text-muted-foreground">&rarr;</span>}
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
                    </CardContent>
                </Card>

                {/* Fotos */}
                {fotos.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2"><Camera className="size-4 text-muted-foreground" />Fotos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-2">
                                {fotos.map(f => (
                                    <div key={f.tipo} className="relative">
                                        <img src={f.url!} alt={f.tipo} className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition" onClick={() => setFotoAmpliada(f.url)} />
                                        <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{f.tipo}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Estado */}
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Cambiar Estado</CardTitle></CardHeader>
                    <CardContent>
                        {estadoBloqueado && (
                            <Alert variant="destructive" className="mb-3"><AlertTriangle className="size-4" /><AlertDescription>Traslado <b>completado</b>, no modificable.</AlertDescription></Alert>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {(['pendiente', 'en_curso', 'completado'] as const).map(e => {
                                const c = estadoConfig[e]
                                return <Button key={e} variant="ghost" onClick={() => cambiarEstado(e)} disabled={actualizando || estadoBloqueado}
                                    className={`min-h-[44px] ${traslado.estado === e ? c.active : c.inactive} ${estadoBloqueado ? 'opacity-50' : ''}`}>{c.label}</Button>
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Pago */}
                {traslado.importe_total != null && (
                    <Card>
                        <CardHeader className="pb-3"><CardTitle className="text-sm">Estado de Pago</CardTitle></CardHeader>
                        <CardContent>
                            {pagoBloqueado && (
                                <Alert className="mb-3"><Info className="size-4" /><AlertDescription>Pago ya definido.</AlertDescription></Alert>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {(['pendiente', 'efectivo', 'transferencia'] as const).map(p => {
                                    const c = pagoConfig2[p]
                                    return <Button key={p} variant="ghost" onClick={() => cambiarPago(p)} disabled={actualizando || pagoBloqueado}
                                        className={`min-h-[44px] ${traslado.estado_pago === p ? c.active : c.inactive} ${pagoBloqueado ? 'opacity-50' : ''}`}>{c.label}</Button>
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={!!fotoAmpliada} onOpenChange={() => setFotoAmpliada(null)}>
                <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
                    <DialogTitle className="sr-only">Foto ampliada</DialogTitle>
                    {fotoAmpliada && <img src={fotoAmpliada} alt="Foto ampliada" className="w-full max-h-[90vh] object-contain" />}
                </DialogContent>
            </Dialog>
        </>
    )
}
