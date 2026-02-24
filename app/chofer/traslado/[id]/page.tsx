'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
    const id = params.id as string

    const [traslado, setTraslado] = useState<Traslado | null>(null)
    const [loading, setLoading] = useState(true)
    const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
    const [actualizando, setActualizando] = useState(false)

    useEffect(() => { cargarTraslado() }, [id])

    useEffect(() => {
        if (!id) return;
        // Suscripción Realtime para updates de traslado
        const channel = supabase.channel('traslado-' + id)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'traslados',
                filter: `id=eq.${id}`
            }, (payload) => {
                // Actualizar traslado en tiempo real
                setTraslado((prev) => {
                    if (!prev) return null;
                    // Asegura que payload.new tiene todas las propiedades de Traslado
                    return {
                        ...prev,
                        ...payload.new,
                        empresas: payload.new.empresas ?? prev.empresas,
                    } as Traslado;
                })
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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

        if (error || !data) {
            router.push('/chofer')
            return
        }

        setTraslado(data)
        setLoading(false)
    }

    const cambiarEstado = async (nuevoEstado: string) => {
        if (!traslado) return
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Actualización optimista - cambiar UI inmediatamente
        const estadoAnterior = traslado.estado
        setTraslado({ ...traslado, estado: nuevoEstado })

        // ✅ SEGURO: Verificamos chofer_id además del id del traslado
        const { error } = await supabase
            .from('traslados')
            .update({ estado: nuevoEstado })
            .eq('id', traslado.id)
            .eq('chofer_id', user.id)  // Doble verificación

        if (error) {
            // Revertir si hay error
            setTraslado({ ...traslado, estado: estadoAnterior })
            alert('Error: ' + error.message)
        }
    }

    const cambiarEstadoPago = async (nuevoEstadoPago: string) => {
        if (!traslado) return
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const estadoPagoAnterior = traslado.estado_pago
        setTraslado({ ...traslado, estado_pago: nuevoEstadoPago })

        const { error } = await supabase
            .from('traslados')
            .update({ estado_pago: nuevoEstadoPago })
            .eq('id', traslado.id)
            .eq('chofer_id', user.id)

        if (error) {
            setTraslado({ ...traslado, estado_pago: estadoPagoAnterior })
            alert('Error: ' + error.message)
        }
    }

    const fotos = traslado ? [
        { tipo: 'Frontal', url: traslado.foto_frontal },
        { tipo: 'Lateral', url: traslado.foto_lateral },
        { tipo: 'Trasera', url: traslado.foto_trasera },
        { tipo: 'Interior', url: traslado.foto_interior }
    ].filter(f => f.url) : []

    if (loading) {
        return (
            <div className="page-bg flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-orange-200 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full absolute top-0 left-0 animate-spin"></div>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-700 font-semibold">Cargando</p>
                        <p className="text-gray-400 text-sm">Obteniendo traslado...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!traslado) return null

    return (
        <div className="page-bg min-h-screen pb-8">
            {/* Navbar */}
            <nav className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-30">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <button onClick={() => router.push('/chofer')} className="p-2 -ml-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-base font-semibold text-gray-900">Detalle del Traslado</h1>
                </div>
            </nav>

            <div className="w-full px-4 py-4 max-w-4xl mx-auto space-y-4">
                {/* Empresa - Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wide opacity-80 mb-1">Trabajo para</p>
                    <p className="text-lg font-semibold">{traslado.empresas?.nombre || 'Empresa'}</p>
                    <p className="text-xs opacity-80 mt-1">
                        {new Date(traslado.created_at).toLocaleDateString('es-AR', { 
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                        })}
                    </p>
                </div>

                {/* Info Principal */}
                <div className="card">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {traslado.marca_modelo}
                            </h2>
                            {traslado.es_0km && (
                                <span className="inline-block mt-1.5 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                                    0 KM
                                </span>
                            )}
                        </div>
                        <span
                            className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                                traslado.estado === 'pendiente'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : traslado.estado === 'en_curso'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-green-100 text-green-700'
                            }`}
                        >
                            {traslado.estado?.toUpperCase().replace('_', ' ')}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {traslado.matricula && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">Matrícula</p>
                                <p className="text-base font-semibold text-gray-900">{traslado.matricula}</p>
                            </div>
                        )}
                        {traslado.importe_total && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">Importe</p>
                                <p className="text-base font-semibold text-green-600">${traslado.importe_total}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block ${
                                    traslado.estado_pago === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                                    traslado.estado_pago === 'efectivo' ? 'bg-green-100 text-green-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {traslado.estado_pago === 'pendiente' ? 'Pago pendiente' :
                                     traslado.estado_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Ubicación */}
                    {(traslado.departamento || traslado.direccion) && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-[10px] text-blue-600 uppercase font-medium mb-1">Ubicación</p>
                            <p className="text-sm text-gray-700">
                                {traslado.direccion && <span className="font-medium">{traslado.direccion}</span>}
                                {traslado.direccion && traslado.departamento && ' - '}
                                {traslado.departamento && <span>{traslado.departamento}</span>}
                            </p>
                        </div>
                    )}

                    {/* Desde/Hasta */}
                    {(traslado.desde || traslado.hasta) && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-100">
                            <p className="text-[10px] text-green-600 uppercase font-medium mb-1">Recorrido</p>
                            <p className="text-sm text-gray-700">
                                {traslado.desde && <span className="font-medium">Desde: {traslado.desde}</span>}
                                {traslado.desde && traslado.hasta && <span className="mx-2">→</span>}
                                {traslado.hasta && <span className="font-medium">Hasta: {traslado.hasta}</span>}
                            </p>
                        </div>
                    )}

                    {/* Observaciones */}
                    {traslado.observaciones && (
                        <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                            <p className="text-[10px] text-orange-600 uppercase font-medium mb-1">Observaciones</p>
                            <p className="text-sm text-gray-700">{traslado.observaciones}</p>
                        </div>
                    )}
                </div>

                {/* Fotos de Inspección */}
                {fotos.length > 0 && (
                    <div className="card">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Fotos de Inspección</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {fotos.map((foto) => (
                                <div key={foto.tipo} className="relative">
                                    <img
                                        src={foto.url!}
                                        alt={foto.tipo}
                                        className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                                        onClick={() => setFotoAmpliada(foto.url)}
                                    />
                                    <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                        {foto.tipo}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Acciones */}
                <div className="card">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Cambiar Estado</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => cambiarEstado('pendiente')}
                            disabled={actualizando}
                            className={`py-2 px-3 rounded-lg font-medium text-xs transition ${
                                traslado.estado === 'pendiente'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            Pendiente
                        </button>
                        <button
                            onClick={() => cambiarEstado('en_curso')}
                            disabled={actualizando}
                            className={`py-2 px-3 rounded-lg font-medium text-xs transition ${
                                traslado.estado === 'en_curso'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            En Curso
                        </button>
                        <button
                            onClick={() => cambiarEstado('completado')}
                            disabled={actualizando}
                            className={`py-2 px-3 rounded-lg font-medium text-xs transition ${
                                traslado.estado === 'completado'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            Completado
                        </button>
                    </div>
                </div>

                {/* Estado de Pago */}
                {traslado.importe_total && (
                    <div className="card">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Estado de Pago</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => cambiarEstadoPago('pendiente')}
                                disabled={actualizando}
                                className={`py-2 px-3 rounded-lg font-medium text-xs transition ${
                                    traslado.estado_pago === 'pendiente'
                                        ? 'bg-yellow-500 text-white'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                Pendiente
                            </button>
                            <button
                                onClick={() => cambiarEstadoPago('efectivo')}
                                disabled={actualizando}
                                className={`py-2 px-3 rounded-lg font-medium text-xs transition ${
                                    traslado.estado_pago === 'efectivo'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                Efectivo
                            </button>
                            <button
                                onClick={() => cambiarEstadoPago('transferencia')}
                                disabled={actualizando}
                                className={`py-2 px-3 rounded-lg font-medium text-xs transition ${
                                    traslado.estado_pago === 'transferencia'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                Transferencia
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal foto ampliada */}
            {fotoAmpliada && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setFotoAmpliada(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
                        onClick={() => setFotoAmpliada(null)}
                    >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img
                        src={fotoAmpliada}
                        alt="Foto ampliada"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                    />
                </div>
            )}
        </div>
    )
}
