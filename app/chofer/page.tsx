'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Traslado {
    id: string
    marca_modelo: string
    matricula: string | null
    es_0km: boolean
    estado: string
    estado_pago: string
    importe_total: number | null
    created_at: string
    departamento: string | null
    direccion: string | null
    empresas?: { nombre: string }
    observaciones?: string | null
    foto_frontal?: string | null
    foto_lateral?: string | null
    foto_trasera?: string | null
    foto_interior?: string | null
    desde?: string | null
    hasta?: string | null
}

interface Perfil {
    id: string
    nombre_completo: string
    empresa_id: string | null
    rol: string
}

export default function PanelChofer() {
    const router = useRouter()
    const [perfil, setPerfil] = useState<Perfil | null>(null)
    const [traslados, setTraslados] = useState<Traslado[]>([])
    const [loading, setLoading] = useState(true)
    const [nombreEmpresa, setNombreEmpresa] = useState<string | null>(null)
    
    // Estados para unirse a empresa
    const [mostrarFormCodigo, setMostrarFormCodigo] = useState(false)
    const [codigoInvitacion, setCodigoInvitacion] = useState('')
    const [uniendose, setUniendose] = useState(false)
    const [errorCodigo, setErrorCodigo] = useState('')
    const [empresaInvitacion, setEmpresaInvitacion] = useState<string | null>(null)
    const [mensajeExito, setMensajeExito] = useState<string | null>(null)


    useEffect(() => { cargarDatos() }, [])

    // Suscripción realtime para inserts y updates de traslados asignados al chofer
    useEffect(() => {
        if (!perfil?.id) return;
        const channel = supabase.channel('traslados-chofer-' + perfil.id)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'traslados',
                filter: `chofer_id=eq.${perfil.id}`
            }, (payload) => {
                setTraslados((prev) => {
                    if (payload.eventType === 'INSERT') {
                        // Nuevo traslado asignado
                        return [payload.new as Traslado, ...prev]
                    } else if (payload.eventType === 'UPDATE') {
                        // Actualización de traslado
                        return prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } as Traslado : t)
                    } else if (payload.eventType === 'DELETE') {
                        // Eliminación de traslado
                        return prev.filter(t => t.id !== payload.old.id)
                    }
                    return prev;
                });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [perfil?.id]);

    // Suscripción en tiempo real para detectar expulsión
    useEffect(() => {
        if (!perfil?.id) return

        const subscription = supabase
            .channel('mi-perfil-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'perfiles',
                    filter: `id=eq.${perfil.id}`
                },
                (payload) => {
                    const newData = payload.new as Perfil
                    // Si me expulsaron (empresa_id cambió a null)
                    if (newData.empresa_id !== perfil.empresa_id) {
                        setPerfil(newData)
                        if (!newData.empresa_id) {
                            setNombreEmpresa(null)
                            setMensajeExito(null)
                        } else {
                            // Me unieron a otra empresa, recargar nombre
                            cargarDatos()
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [perfil?.id, perfil?.empresa_id])

    const cargarDatos = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }

            const { data: perfilData } = await supabase
                .from('perfiles').select('*').eq('id', user.id).single()
            setPerfil(perfilData)

            // Cargar nombre de empresa si tiene
            if (perfilData?.empresa_id) {
                const { data: empresaData } = await supabase
                    .from('empresas').select('nombre').eq('id', perfilData.empresa_id).single()
                setNombreEmpresa(empresaData?.nombre || null)
            } else {
                setNombreEmpresa(null)
            }

            // Traer traslados con nombre de empresa (historial permanente)
            const { data: trasladosData } = await supabase
                .from('traslados')
                .select('id, marca_modelo, matricula, es_0km, estado, estado_pago, importe_total, observaciones, foto_frontal, foto_lateral, foto_trasera, foto_interior, created_at, departamento, direccion, empresas(nombre), desde, hasta')
                .eq('chofer_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20)
            // Normalizar empresas: tomar el primer elemento si es array
            const trasladosNorm = (trasladosData || []).map((t: any) => ({
                ...t,
                empresas: t.empresas && Array.isArray(t.empresas) ? t.empresas[0] : t.empresas
            })) as Traslado[];
            setTraslados(trasladosNorm)
            setLoading(false)
        } catch (err) {
            console.error('Error cargando datos:', err)
            setLoading(false)
        }
    }

    const handleCerrarSesion = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    // Validar código de invitación
    const validarCodigo = async () => {
        if (!codigoInvitacion.trim()) return
        setErrorCodigo('')
        setEmpresaInvitacion(null)

        const { data, error } = await supabase
            .from('invitaciones')
            .select('*, empresas(nombre)')
            .eq('codigo', codigoInvitacion.trim())
            .single()

        if (error || !data) {
            setErrorCodigo('Código de invitación inválido')
            return
        }

        if (data.usado) {
            setErrorCodigo('Este código ya fue utilizado')
            return
        }

        if (new Date(data.expires_at) < new Date()) {
            setErrorCodigo('Este código ha expirado')
            return
        }

        setEmpresaInvitacion(data.empresas?.nombre || 'Empresa')
    }

    // Unirse a la empresa
    const handleUnirseEmpresa = async () => {
        if (!perfil || !codigoInvitacion.trim()) return
        setUniendose(true)
        setErrorCodigo('')

        // 1. Obtener la invitación
        const { data: invitacion, error: invError } = await supabase
            .from('invitaciones')
            .select('*')
            .eq('codigo', codigoInvitacion.trim())
            .single()

        if (invError || !invitacion) {
            setErrorCodigo('Código inválido')
            setUniendose(false)
            return
        }

        if (invitacion.usado) {
            setErrorCodigo('Este código ya fue utilizado')
            setUniendose(false)
            return
        }

        if (new Date(invitacion.expires_at) < new Date()) {
            setErrorCodigo('Este código ha expirado')
            setUniendose(false)
            return
        }

        // 2. Actualizar el perfil del chofer con la empresa
        const { error: updateError } = await supabase
            .from('perfiles')
            .update({ empresa_id: invitacion.empresa_id })
            .eq('id', perfil.id)

        if (updateError) {
            setErrorCodigo('Error al unirse a la empresa')
            setUniendose(false)
            return
        }

        // 3. Marcar invitación como usada
        await supabase
            .from('invitaciones')
            .update({ usado: true })
            .eq('id', invitacion.id)

        // 4. Mostrar mensaje de éxito y recargar
        const empresaNombre = empresaInvitacion
        setUniendose(false)
        setMostrarFormCodigo(false)
        setCodigoInvitacion('')
        setEmpresaInvitacion(null)
        setMensajeExito(`¡Te uniste a ${empresaNombre}!`)
        cargarDatos()
        
        // Ocultar mensaje después de 5 segundos
        setTimeout(() => setMensajeExito(null), 5000)
    }

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
                        <p className="text-gray-400 text-sm">Obteniendo datos...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page-bg min-h-screen pb-8">
            {/* Navbar - Responsive */}
            <nav className="navbar sticky top-0 z-50">
                <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                                                <h1 className="text-sm sm:text-base font-semibold text-white">ViaGrua</h1>
                                                <span className="text-white/60 text-xs hidden sm:inline">Chofer</span>
                                                {perfil?.nombre_completo && (
                                                    <span className="ml-2 text-xs text-white/80 font-semibold bg-white/10 px-2 py-0.5 rounded-lg max-w-[120px] truncate" title={perfil.nombre_completo}>
                                                        {perfil.nombre_completo}
                                                    </span>
                                                )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={() => router.push('/dashboard/gastos')} 
                            className="text-white/90 hover:text-white text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="hidden sm:inline">Gastos</span>
                        </button>
                        {perfil?.rol === 'admin' && (
                            <button 
                                onClick={() => router.push('/dashboard')} 
                                className="text-white/90 hover:text-white text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span className="hidden sm:inline">Admin</span>
                            </button>
                        )}
                        <button onClick={handleCerrarSesion} className="text-white text-xs sm:text-sm font-medium px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition">
                            Salir
                        </button>
                    </div>
                </div>
            </nav>

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-3xl mx-auto">
                {/* Mensaje de éxito */}
                {mensajeExito && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-green-700 font-medium text-sm">{mensajeExito}</p>
                    </div>
                )}

                {/* Banner si TIENE empresa */}
                {perfil?.empresa_id && nombreEmpresa && !mensajeExito && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-green-800 font-medium text-sm">Empresa activa</p>
                                    <p className="text-green-600 text-xs mt-0.5">
                                        Trabajando con <span className="font-semibold">{nombreEmpresa}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (confirm('¿Seguro que quieres salirte de la empresa? Perderás acceso a los traslados activos.')) {
                                        await supabase.from('perfiles').update({ empresa_id: null }).eq('id', perfil.id)
                                        setPerfil({ ...perfil, empresa_id: null })
                                        setNombreEmpresa(null)
                                        setMensajeExito('Te has salido de la empresa.');
                                        setTimeout(() => setMensajeExito(null), 5000)
                                    }
                                }}
                                className="bg-red-100 hover:bg-red-200 text-red-700 font-medium text-xs px-4 py-2 rounded-lg transition border border-red-200"
                            >
                                Salirse de la empresa
                            </button>
                        </div>
                    </div>
                )}

                {/* Banner si NO tiene empresa */}
                {!perfil?.empresa_id && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-amber-800 font-medium text-sm">Sin empresa activa</p>
                                    <p className="text-amber-600 text-xs mt-0.5">
                                        No perteneces a ninguna empresa. Aquí puedes ver tu historial.
                                    </p>
                                </div>
                            </div>
                            {!mostrarFormCodigo && (
                                <button
                                    onClick={() => setMostrarFormCodigo(true)}
                                    className="btn-primary text-xs px-4 py-2 whitespace-nowrap"
                                >
                                    Tengo un código
                                </button>
                            )}
                        </div>
                        
                        {/* Formulario para ingresar código */}
                        {mostrarFormCodigo && (
                            <div className="mt-4 pt-4 border-t border-amber-200">
                                {/* Vista de confirmación cuando ya se validó el código */}
                                {empresaInvitacion ? (
                                    <div className="bg-white rounded-xl p-5 border border-green-100">
                                        <div className="text-center">
                                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-600 text-sm mb-1">¿Deseas unirte a</p>
                                            <p className="text-lg font-semibold text-gray-900 mb-4">{empresaInvitacion}?</p>
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={handleUnirseEmpresa}
                                                    disabled={uniendose}
                                                    className="bg-green-500 hover:bg-green-600 text-white font-medium text-sm px-5 py-2 rounded-lg transition"
                                                >
                                                    {uniendose ? 'Uniéndose...' : 'Sí, unirme'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEmpresaInvitacion(null)
                                                        setCodigoInvitacion('')
                                                    }}
                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium text-sm px-5 py-2 rounded-lg transition"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Vista para ingresar código */
                                    <>
                                        <p className="text-xs font-medium text-gray-600 mb-2">Ingresá el código de invitación</p>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                placeholder="Ej: ABC123XYZ"
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                                value={codigoInvitacion}
                                                onChange={(e) => {
                                                    setCodigoInvitacion(e.target.value.toUpperCase())
                                                    setErrorCodigo('')
                                                }}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={validarCodigo}
                                                    className="btn-primary text-xs px-4 py-2"
                                                >
                                                    Validar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setMostrarFormCodigo(false)
                                                        setCodigoInvitacion('')
                                                        setErrorCodigo('')
                                                    }}
                                                    className="text-gray-500 hover:text-gray-700 text-xs px-3 py-2"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Mensaje de error */}
                                        {errorCodigo && (
                                            <p className="text-red-600 text-xs mt-2 flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                {errorCodigo}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Header */}
                <div className="mb-5 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5">
                        {perfil?.empresa_id ? 'Mis Traslados' : 'Mi Historial'}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500">{perfil?.nombre_completo}</p>
                </div>

                {/* Traslados List - Responsive */}
                {traslados.length === 0 ? (
                    <div className="card text-center py-12 sm:py-16">
                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-500">No hay traslados asignados</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {traslados.map((traslado) => (
                            <div 
                                key={traslado.id} 
                                className="card p-4 cursor-pointer hover:shadow-md hover:border-orange-200 transition-all group"
                                onClick={() => router.push(`/chofer/traslado/${traslado.id}`)}
                            >
                                <div className="flex items-start sm:items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                                {traslado.empresas?.nombre || 'Empresa'}
                                            </span>
                                            {traslado.departamento && (
                                                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                                                    {traslado.departamento}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(traslado.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2">
                                            {traslado.marca_modelo}
                                            {traslado.es_0km && (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                                    0 KM
                                                </span>
                                            )}
                                        </h3>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                                            {traslado.matricula && <span># {traslado.matricula}</span>}
                                            {traslado.importe_total && (
                                                <span className="flex items-center gap-1">
                                                    <span className="font-medium text-gray-700">${traslado.importe_total}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                        traslado.estado_pago === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                                                        traslado.estado_pago === 'efectivo' ? 'bg-green-100 text-green-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {traslado.estado_pago === 'pendiente' ? 'Pendiente' : 
                                                         traslado.estado_pago === 'efectivo' ? 'Efectivo' : 'Transfer.'}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span
                                            className={`text-[10px] font-medium px-2 py-1 rounded ${
                                                traslado.estado === 'pendiente'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : traslado.estado === 'en_curso'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-green-100 text-green-700'
                                            }`}
                                        >
                                            {traslado.estado === 'pendiente' ? 'Pendiente' : 
                                             traslado.estado === 'en_curso' ? 'En curso' : 'Completado'}
                                        </span>
                                        <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}