'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Gasto {
    id: string
    tipo: string
    importe: number
    descripcion: string | null
    fecha: string
    created_at: string
    usuario_id: string
    perfiles?: { nombre_completo: string }
}

interface TrasladoCompletado {
    id: string
    marca_modelo: string
    matricula: string | null
    importe_total: number
    estado_pago: string
    created_at: string
}

// Tipo unificado para mostrar movimientos
interface Movimiento {
    id: string
    tipo: 'ingreso' | 'gasto'
    concepto: string
    importe: number
    fecha: string
    icono: string
    descripcion?: string
    esTraslado?: boolean
    tipoGasto?: string
}

interface Perfil {
    id: string
    empresa_id: string
    rol: string
    nombre_completo: string
}

const tiposGasto = [
    { value: 'combustible', label: 'Combustible', icon: '⛽' },
    { value: 'seguro', label: 'Seguro', icon: '🛡️' },
    { value: 'mantenimiento', label: 'Mantenimiento', icon: '🔧' },
    { value: 'peaje', label: 'Peaje', icon: '🛣️' },
    { value: 'patente', label: 'Patente', icon: '📋' },
    { value: 'multa', label: 'Multa', icon: '⚠️' },
    { value: 'otro', label: 'Otro', icon: '📦' },
]

export default function GastosPage() {
    const router = useRouter()
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [misTraslados, setMisTraslados] = useState<TrasladoCompletado[]>([])
    const [loading, setLoading] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [perfil, setPerfil] = useState<Perfil | null>(null)
    const [totalIngresos, setTotalIngresos] = useState(0)
    const [verTodos, setVerTodos] = useState(true) // Admin: toggle para ver todos o solo propios
    const [paginaActual, setPaginaActual] = useState(1)
    const [filtroMovimientos, setFiltroMovimientos] = useState('fecha_desc')
    const [filtroTipoGasto, setFiltroTipoGasto] = useState('todos')
    const ITEMS_POR_PAGINA = 10
    
    const [formData, setFormData] = useState({
        tipo: '',
        importe: '',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0]
    })

    const isAdmin = perfil?.rol === 'admin'

    useEffect(() => { cargarDatos() }, [])

    // Suscripción en tiempo real para cambios de pago en traslados
    useEffect(() => {
        if (!perfil) return

        const subscription = supabase
            .channel('traslados-pago-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'traslados'
                },
                (payload) => {
                    const updated = payload.new as { estado_pago?: string; chofer_id?: string; empresa_id?: string }
                    // Recargar si es relevante para este usuario
                    if (isAdmin && updated.empresa_id === perfil.empresa_id) {
                        cargarIngresos(perfil.empresa_id)
                    } else if (!isAdmin && updated.chofer_id === perfil.id) {
                        cargarMisTraslados(perfil.id)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [perfil, isAdmin])

    const cargarDatos = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data: perfilData } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', user.id)
            .single()

        if (!perfilData) {
            router.push('/login')
            return
        }

        setPerfil(perfilData)
        await cargarGastos(perfilData)
        
        // Si es admin, cargar ingresos de traslados de la empresa
        if (perfilData.rol === 'admin') {
            await cargarIngresos(perfilData.empresa_id)
        } else {
            // Si es chofer, cargar sus traslados completados
            await cargarMisTraslados(perfilData.id)
        }
        
        setLoading(false)
    }

    const cargarMisTraslados = async (userId: string) => {
        const { data } = await supabase
            .from('traslados')
            .select('id, marca_modelo, matricula, importe_total, estado_pago, created_at')
            .eq('chofer_id', userId)
            .eq('estado', 'completado')
            .neq('estado_pago', 'pendiente')
            .order('created_at', { ascending: false })
        setMisTraslados(data || [])
    }

    const cargarGastos = async (perfilActual: Perfil) => {
        let query = supabase
            .from('gastos')
            .select('*, perfiles(nombre_completo)')
            .order('fecha', { ascending: false })

        // Admin ve todos los de la empresa, chofer solo los suyos
        if (perfilActual.rol === 'admin') {
            query = query.eq('empresa_id', perfilActual.empresa_id)
        } else {
            query = query.eq('usuario_id', perfilActual.id)
        }

        const { data } = await query
        setGastos(data || [])
    }

    const cargarIngresos = async (empresaId: string) => {
        const { data } = await supabase
            .from('traslados')
            .select('importe_total')
            .eq('empresa_id', empresaId)
            .eq('estado', 'completado')
            .neq('estado_pago', 'pendiente')
        
        const total = data?.reduce((sum, t) => sum + (t.importe_total || 0), 0) || 0
        setTotalIngresos(total)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.tipo || !formData.importe || !perfil) return
        
        setGuardando(true)

        const { error } = await supabase.from('gastos').insert({
            empresa_id: perfil.empresa_id,
            usuario_id: perfil.id,
            tipo: formData.tipo,
            importe: parseFloat(formData.importe),
            descripcion: formData.descripcion || null,
            fecha: formData.fecha
        })

        if (error) {
            alert('Error: ' + error.message)
        } else {
            setFormData({ tipo: '', importe: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
            await cargarGastos(perfil)
        }
        
        setGuardando(false)
    }

    const eliminarGasto = async (gasto: Gasto) => {
        // Solo puede eliminar sus propios gastos (o admin cualquiera)
        if (!isAdmin && gasto.usuario_id !== perfil?.id) {
            alert('No puedes eliminar gastos de otros usuarios')
            return
        }
        
        if (!confirm('¿Eliminar este gasto?')) return
        
        // Optimista
        setGastos(prev => prev.filter(g => g.id !== gasto.id))
        
        const { error } = await supabase
            .from('gastos')
            .delete()
            .eq('id', gasto.id)

        if (error) {
            alert('Error: ' + error.message)
            if (perfil) await cargarGastos(perfil)
        }
    }

    const getIconForTipo = (tipo: string) => {
        return tiposGasto.find(t => t.value === tipo)?.icon || '📦'
    }

    const getLabelForTipo = (tipo: string) => {
        return tiposGasto.find(t => t.value === tipo)?.label || tipo
    }

    // Filtrar gastos según toggle (solo para admin)
    const gastosFiltrados = isAdmin && !verTodos 
        ? gastos.filter(g => g.usuario_id === perfil?.id)
        : gastos

    // Calcular totales
    const totalGastos = gastosFiltrados.reduce((sum, g) => sum + g.importe, 0)
    const misGastos = gastos.filter(g => g.usuario_id === perfil?.id).reduce((sum, g) => sum + g.importe, 0)
    const rentabilidad = totalIngresos - gastos.reduce((sum, g) => sum + g.importe, 0)

    // CHOFER: Crear lista de movimientos combinando gastos e ingresos (traslados)
    const misIngresosTotal = misTraslados.reduce((sum, t) => sum + (t.importe_total || 0), 0)
    const miBalance = misIngresosTotal - totalGastos

    // Crear movimientos base
    const movimientosBase: Movimiento[] = !isAdmin ? [
        // Traslados como ingresos
        ...misTraslados.map(t => ({
            id: t.id,
            tipo: 'ingreso' as const,
            concepto: t.marca_modelo + (t.matricula ? ` (${t.matricula})` : ''),
            importe: t.importe_total || 0,
            fecha: t.created_at,
            icono: t.estado_pago === 'efectivo' ? '$' : '→',
            descripcion: t.estado_pago === 'efectivo' ? 'Pago en efectivo' : 'Pago por transferencia',
            esTraslado: true,
            tipoGasto: 'traslado'
        })),
        // Gastos como egresos
        ...gastos.map(g => ({
            id: g.id,
            tipo: 'gasto' as const,
            concepto: getLabelForTipo(g.tipo),
            importe: g.importe,
            fecha: g.fecha,
            icono: getIconForTipo(g.tipo),
            descripcion: g.descripcion || undefined,
            esTraslado: false,
            tipoGasto: g.tipo
        }))
    ] : []

    // Aplicar filtro por tipo
    const movimientosFiltrados = filtroTipoGasto === 'todos' 
        ? movimientosBase
        : filtroTipoGasto === 'solo_ingresos'
            ? movimientosBase.filter(m => m.tipo === 'ingreso')
            : filtroTipoGasto === 'solo_gastos'
                ? movimientosBase.filter(m => m.tipo === 'gasto')
                : movimientosBase.filter(m => m.tipoGasto === filtroTipoGasto)

    // Aplicar ordenamiento
    const movimientos = [...movimientosFiltrados].sort((a, b) => {
        switch (filtroMovimientos) {
            case 'fecha_desc':
                return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
            case 'fecha_asc':
                return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
            case 'mayor_importe':
                return b.importe - a.importe
            case 'menor_importe':
                return a.importe - b.importe
            default:
                return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        }
    })

    // Paginación de movimientos
    const totalPaginas = Math.ceil(movimientos.length / ITEMS_POR_PAGINA)
    const movimientosPaginados = movimientos.slice(
        (paginaActual - 1) * ITEMS_POR_PAGINA,
        paginaActual * ITEMS_POR_PAGINA
    )

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
        <div className="page-bg min-h-screen pb-12">
            {/* Navbar */}
            <nav className="navbar sticky top-0 z-50">
                <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => router.push(isAdmin ? '/dashboard' : '/chofer')} 
                            className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h1 className="text-white font-semibold text-sm sm:text-base">
                                {isAdmin ? 'Gastos Empresa' : 'Mis Gastos'}
                            </h1>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-3xl mx-auto">
                
                {/* SOLO ADMIN: Resumen de Rentabilidad */}
                {isAdmin && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 sm:mb-6">
                        <div className="card p-4 text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wide">Ingresos</p>
                            <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">
                                ${totalIngresos.toLocaleString('es-AR')}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">Traslados cobrados</p>
                        </div>
                        <div className="card p-4 text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wide">Gastos Totales</p>
                            <p className="text-xl sm:text-2xl font-bold text-red-500 mt-1">
                                ${gastos.reduce((sum, g) => sum + g.importe, 0).toLocaleString('es-AR')}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">Toda la empresa</p>
                        </div>
                        <div className={`card p-4 text-center ${rentabilidad >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                            <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wide">Rentabilidad</p>
                            <p className={`text-xl sm:text-2xl font-bold mt-1 ${rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${rentabilidad.toLocaleString('es-AR')}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">{rentabilidad >= 0 ? 'Ganancia' : 'Pérdida'}</p>
                        </div>
                    </div>
                )}

                {/* Formulario Registrar Gasto */}
                <div className="card p-4 sm:p-6 mb-5 sm:mb-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Registrar Gasto</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Fecha</label>
                                <input
                                    type="date"
                                    required
                                    className="input-field"
                                    value={formData.fecha}
                                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Tipo</label>
                                <select
                                    required
                                    className="input-field"
                                    value={formData.tipo}
                                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                >
                                    <option value="">Seleccionar...</option>
                                    {tiposGasto.map((tipo) => (
                                        <option key={tipo.value} value={tipo.value}>
                                            {tipo.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Importe</label>
                                <div className="currency-input">
                                    <span className="currency-symbol">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        name="importe"
                                        value={formData.importe}
                                        onChange={(e) => setFormData({ ...formData, importe: e.target.value })}
                                        className="w-full border rounded px-3 py-2 input-field"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Descripción</label>
                                <input
                                    type="text"
                                    placeholder="Opcional..."
                                    className="input-field"
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={guardando} className="btn-primary w-full py-2.5 text-sm">
                            {guardando ? 'Registrando...' : 'Registrar Gasto'}
                        </button>
                    </form>
                </div>

                {/* SOLO CHOFER: Resumen con ingresos, gastos y balance */}
                {!isAdmin && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 sm:mb-6">
                        <div className="card p-4 text-center border-green-100 bg-green-50/50">
                            <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wide">Mis Ingresos</p>
                            <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">
                                ${misIngresosTotal.toLocaleString('es-AR')}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">{misTraslados.length} traslados</p>
                        </div>
                        <div className="card p-4 text-center border-red-100 bg-red-50/50">
                            <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wide">Mis Gastos</p>
                            <p className="text-xl sm:text-2xl font-bold text-red-500 mt-1">
                                ${totalGastos.toLocaleString('es-AR')}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">{gastos.length} gastos</p>
                        </div>
                        <div className={`card p-4 text-center ${miBalance >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                            <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wide">Mi Balance</p>
                            <p className={`text-xl sm:text-2xl font-bold mt-1 ${miBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${miBalance.toLocaleString('es-AR')}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">{miBalance >= 0 ? 'Positivo' : 'Negativo'}</p>
                        </div>
                    </div>
                )}

                {/* Lista de Gastos (Admin) o Movimientos (Chofer) */}
                <div className="card p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                        <div>
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                                {isAdmin ? 'Gastos de la Empresa' : 'Mis Movimientos'}
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {isAdmin ? `${gastosFiltrados.length} registros` : `${movimientos.length} movimientos`}
                            </p>
                        </div>
                        
                        {/* SOLO ADMIN: Toggle para ver todos o solo propios */}
                        {isAdmin && (
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setVerTodos(true)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                                        verTodos ? 'bg-white shadow text-orange-600' : 'text-gray-500'
                                    }`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setVerTodos(false)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                                        !verTodos ? 'bg-white shadow text-orange-600' : 'text-gray-500'
                                    }`}
                                >
                                    Solo míos
                                </button>
                            </div>
                        )}

                        {/* SOLO CHOFER: Filtros de movimientos */}
                        {!isAdmin && (
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                {/* Filtro por tipo */}
                                <select
                                    value={filtroTipoGasto}
                                    onChange={(e) => { setFiltroTipoGasto(e.target.value); setPaginaActual(1) }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition border-0 focus:ring-2 focus:ring-orange-300 focus:outline-none"
                                >
                                    <option value="todos">Todos</option>
                                    <option value="solo_ingresos">Solo Ingresos</option>
                                    <option value="solo_gastos">Solo Gastos</option>
                                    <optgroup label="Por tipo">
                                        {tiposGasto.map((tipo) => (
                                            <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                                        ))}
                                    </optgroup>
                                </select>

                                {/* Ordenar por */}
                                <select
                                    value={filtroMovimientos}
                                    onChange={(e) => { setFiltroMovimientos(e.target.value); setPaginaActual(1) }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition border-0 focus:ring-2 focus:ring-orange-300 focus:outline-none"
                                >
                                    <optgroup label="Por fecha">
                                        <option value="fecha_desc">Más recientes</option>
                                        <option value="fecha_asc">Más antiguos</option>
                                    </optgroup>
                                    <optgroup label="Por importe">
                                        <option value="mayor_importe">Mayor importe</option>
                                        <option value="menor_importe">Menor importe</option>
                                    </optgroup>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* ADMIN: Lista de gastos */}
                    {isAdmin && (
                        gastosFiltrados.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-gray-500 text-sm">No hay gastos registrados</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {gastosFiltrados.map((gasto) => (
                                    <div 
                                        key={gasto.id} 
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center text-sm">
                                                {getIconForTipo(gasto.tipo)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-sm text-gray-900">{getLabelForTipo(gasto.tipo)}</p>
                                                    {gasto.perfiles && (
                                                        <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                                                            {gasto.usuario_id === perfil?.id ? 'Yo' : gasto.perfiles.nombre_completo}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                                    <span>{new Date(gasto.fecha).toLocaleDateString('es-AR')}</span>
                                                    {gasto.descripcion && (
                                                        <span className="truncate max-w-[120px]">{gasto.descripcion}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold text-sm text-red-500">
                                                -${gasto.importe.toLocaleString('es-AR')}
                                            </span>
                                            <button
                                                onClick={() => eliminarGasto(gasto)}
                                                className="text-gray-400 hover:text-red-500 transition p-1.5 hover:bg-red-50 rounded-lg"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {/* CHOFER: Lista de movimientos (ingresos + gastos) */}
                    {!isAdmin && (
                        movimientos.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <p className="text-gray-500 text-sm">No hay movimientos registrados</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {movimientosPaginados.map((mov) => (
                                        <div 
                                            key={mov.id + mov.tipo} 
                                            className={`flex items-center justify-between p-3 rounded-lg transition ${
                                                mov.tipo === 'ingreso' 
                                                    ? 'bg-green-50 hover:bg-green-100 border border-green-100' 
                                                    : 'bg-red-50 hover:bg-red-100 border border-red-100'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-white/80 flex items-center justify-center text-sm">
                                                    {mov.icono}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm text-gray-900">{mov.concepto}</p>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                            mov.tipo === 'ingreso' 
                                                                ? 'bg-green-200 text-green-700' 
                                                                : 'bg-red-200 text-red-700'
                                                        }`}>
                                                            {mov.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                                        <span>{new Date(mov.fecha).toLocaleDateString('es-AR')}</span>
                                                        {mov.descripcion && (
                                                            <span className="truncate max-w-[120px]">{mov.descripcion}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`font-semibold text-sm ${
                                                    mov.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'
                                                }`}>
                                                    {mov.tipo === 'ingreso' ? '+' : '-'}${mov.importe.toLocaleString('es-AR')}
                                                </span>
                                                {!mov.esTraslado && (
                                                    <button
                                                        onClick={() => {
                                                            const gasto = gastos.find(g => g.id === mov.id)
                                                            if (gasto) eliminarGasto(gasto)
                                                        }}
                                                        className="text-gray-400 hover:text-red-500 transition p-1.5 hover:bg-red-100 rounded-lg"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Paginación */}
                                {totalPaginas > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-5 pt-5 border-t border-gray-100">
                                        <button
                                            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                                            disabled={paginaActual === 1}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                                paginaActual === 1
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            Anterior
                                        </button>
                                        
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => setPaginaActual(num)}
                                                    className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                                                        paginaActual === num
                                                            ? 'bg-orange-500 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                                            disabled={paginaActual === totalPaginas}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                                paginaActual === totalPaginas
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                )}
                            </>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
