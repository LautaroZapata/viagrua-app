'use client'
import { useState, useEffect } from 'react'
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
    chofer_id: string
    departamento: string | null
    direccion: string | null
    perfiles?: { nombre_completo: string }
}

export default function DetalleTrasladoAdmin() {
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
                setTraslado((prev) => prev ? { ...prev, ...payload.new } as Traslado : payload.new as Traslado)
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    const cargarTraslado = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        // Verificar que es admin/dueño
        const { data: perfil } = await supabase
            .from('perfiles')
            .select('empresa_id, rol')
            .eq('id', user.id)
            .single()

        if (!perfil || perfil.rol === 'chofer') {
            router.push('/chofer')
            return
        }

        const { data, error } = await supabase
            .from('traslados')
            .select('*, perfiles(nombre_completo)')
            .eq('id', id)
            .eq('empresa_id', perfil.empresa_id)
            .single()

        if (error || !data) {
            router.push('/dashboard')
            return
        }

        setTraslado(data)
        setLoading(false)
    }

    const cambiarEstado = async (nuevoEstado: string) => {
        if (!traslado) return
        
        // Actualización optimista - cambiar UI inmediatamente
        const estadoAnterior = traslado.estado
        setTraslado({ ...traslado, estado: nuevoEstado })

        const { error } = await supabase
            .from('traslados')
            .update({ estado: nuevoEstado })
            .eq('id', traslado.id)

        if (error) {
            // Revertir si hay error
            setTraslado({ ...traslado, estado: estadoAnterior })
            alert('Error: ' + error.message)
        }
    }

    const cambiarEstadoPago = async (nuevoEstadoPago: string) => {
        if (!traslado) return
        
        const estadoPagoAnterior = traslado.estado_pago
        setTraslado({ ...traslado, estado_pago: nuevoEstadoPago })

        const { error } = await supabase
            .from('traslados')
            .update({ estado_pago: nuevoEstadoPago })
            .eq('id', traslado.id)

        if (error) {
            setTraslado({ ...traslado, estado_pago: estadoPagoAnterior })
            alert('Error: ' + error.message)
        }
    }

    const eliminarTraslado = async () => {
        if (!traslado) return
        if (!confirm('¿Estás seguro de eliminar este traslado? Esta acción no se puede deshacer.')) {
            return
        }

        // Eliminar fotos del storage
        await supabase.storage.from('fotos-traslados').remove([`${traslado.id}/`])

        const { error } = await supabase
            .from('traslados')
            .delete()
            .eq('id', traslado.id)

        if (error) {
            alert('Error al eliminar: ' + error.message)
            return
        }

        router.push('/dashboard')
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
            <nav className="navbar sticky top-0 z-50">
                <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/dashboard')} className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-sm sm:text-base font-semibold text-white">Detalle del Traslado</h1>
                        {/* Mostrar nombre del usuario si está disponible */}
                        {traslado?.perfiles?.nombre_completo && (
                          <span className="ml-2 text-xs text-white/80 font-semibold bg-white/10 px-2 py-0.5 rounded-lg max-w-[120px] truncate" title={traslado.perfiles.nombre_completo}>
                            {traslado.perfiles.nombre_completo}
                          </span>
                        )}
                    </div>
                    <button
                        onClick={eliminarTraslado}
                        className="bg-red-500/20 hover:bg-red-500 text-red-100 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Eliminar
                    </button>
                </div>
            </nav>

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-3xl mx-auto">
                {/* Info Principal */}
                <div className="card p-4 sm:p-6 mb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                                {traslado.marca_modelo}
                            </h2>
                            <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500">
                                {traslado.es_0km && (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                        0 KM
                                    </span>
                                )}
                                <span>{traslado.perfiles?.nombre_completo || 'Sin asignar'}</span>
                            </div>
                        </div>
                        <span
                            className={`text-xs font-medium px-3 py-1.5 rounded ${
                                traslado.estado === 'pendiente'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : traslado.estado === 'en_curso'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-green-100 text-green-700'
                            }`}
                        >
                            {traslado.estado === 'pendiente' ? 'Pendiente' : 
                             traslado.estado === 'en_curso' ? 'En Curso' : 'Completado'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
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
                                <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block font-medium ${
                                    traslado.estado_pago === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                                    traslado.estado_pago === 'efectivo' ? 'bg-green-100 text-green-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {traslado.estado_pago === 'pendiente' ? 'Pago pendiente' :
                                     traslado.estado_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                                </span>
                            </div>
                        )}
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">Fecha</p>
                            <p className="text-base font-semibold text-gray-900">
                                {new Date(traslado.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    {/* Ubicación */}
                    {(traslado.departamento || traslado.direccion) && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-[10px] text-blue-600 uppercase font-medium mb-1">Ubicación</p>
                            <p className="text-sm text-gray-700">
                                {traslado.direccion && <span className="font-medium">{traslado.direccion}</span>}
                                {traslado.direccion && traslado.departamento && ' - '}
                                {traslado.departamento && <span>{traslado.departamento}</span>}
                            </p>
                        </div>
                    )}

                    {/* Observaciones */}
                    {traslado.observaciones && (
                        <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-100">
                            <p className="text-[10px] text-orange-600 uppercase font-medium mb-1">Observaciones</p>
                            <p className="text-sm text-gray-700">{traslado.observaciones}</p>
                        </div>
                    )}
                </div>

                {/* Fotos de Inspección */}
                {fotos.length > 0 && (
                    <div className="card p-4 sm:p-6 mb-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Fotos de Inspección</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {fotos.map((foto) => (
                                <div key={foto.tipo} className="relative">
                                    <img
                                        src={foto.url!}
                                        alt={foto.tipo}
                                        className="w-full h-28 sm:h-36 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                                        onClick={() => setFotoAmpliada(foto.url)}
                                    />
                                    <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                                        {foto.tipo}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Acciones */}
                <div className="card p-4 sm:p-6 mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Cambiar Estado</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => cambiarEstado('pendiente')}
                            disabled={actualizando}
                            className={`py-2.5 px-3 rounded-lg font-medium text-xs transition ${
                                traslado.estado === 'pendiente'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                        >
                            Pendiente
                        </button>
                        <button
                            onClick={() => cambiarEstado('en_curso')}
                            disabled={actualizando}
                            className={`py-2.5 px-3 rounded-lg font-medium text-xs transition ${
                                traslado.estado === 'en_curso'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                        >
                            En Curso
                        </button>
                        <button
                            onClick={() => cambiarEstado('completado')}
                            disabled={actualizando}
                            className={`py-2.5 px-3 rounded-lg font-medium text-xs transition ${
                                traslado.estado === 'completado'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                        >
                            Completado
                        </button>
                    </div>
                </div>

                {/* Estado de Pago */}
                {traslado.importe_total && (
                    <div className="card p-4 sm:p-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Estado de Pago</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => cambiarEstadoPago('pendiente')}
                                disabled={actualizando}
                                className={`py-2.5 px-3 rounded-lg font-medium text-xs transition ${
                                    traslado.estado_pago === 'pendiente'
                                        ? 'bg-yellow-500 text-white'
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                            >
                                Pendiente
                            </button>
                            <button
                                onClick={() => cambiarEstadoPago('efectivo')}
                                disabled={actualizando}
                                className={`py-2.5 px-3 rounded-lg font-medium text-xs transition ${
                                    traslado.estado_pago === 'efectivo'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                            >
                                Efectivo
                            </button>
                            <button
                                onClick={() => cambiarEstadoPago('transferencia')}
                                disabled={actualizando}
                                className={`py-2.5 px-3 rounded-lg font-medium text-xs transition ${
                                    traslado.estado_pago === 'transferencia'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
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
                        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition"
                        onClick={() => setFotoAmpliada(null)}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
