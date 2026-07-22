'use client'
import { useState, useEffect, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useGastos } from '@/lib/useSupabaseQuery'
import ClientOnly from '@/app/components/ClientOnly'
import { supabase } from '@/lib/supabase'
import { confirmDelete, showError } from '@/lib/swal'
import { sanitizeString, isValidImporte, isValidTipoGasto, isValidFecha, LIMITS } from '@/lib/validation'
import ErrorBoundary from '@/app/components/ErrorBoundary'
import { useUser } from '@/app/components/UserContext'
import AppHeader from '@/app/components/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Fuel, ShieldCheck, Wrench, Milestone, FileText, AlertTriangle,
    Package, Trash2, ChevronDown,
} from 'lucide-react'

interface Gasto {
    id: string; tipo: string; importe: number; descripcion: string | null;
    fecha: string; created_at: string; usuario_id: string;
    perfiles?: { nombre_completo: string } | { nombre_completo: string }[];
}
interface TrasladoCompletado {
    id: string; marca_modelo: string; matricula: string | null;
    importe_total: number; estado_pago: string; created_at: string;
}
interface Movimiento {
    id: string; tipo: 'ingreso' | 'gasto'; concepto: string; importe: number;
    fecha: string; icon: LucideIcon; descripcion?: string; esTraslado?: boolean; tipoGasto?: string;
}

const tiposGasto: { value: string; label: string; icon: LucideIcon }[] = [
    { value: 'combustible', label: 'Combustible', icon: Fuel },
    { value: 'seguro', label: 'Seguro', icon: ShieldCheck },
    { value: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
    { value: 'peaje', label: 'Peaje', icon: Milestone },
    { value: 'patente', label: 'Patente', icon: FileText },
    { value: 'multa', label: 'Multa', icon: AlertTriangle },
    { value: 'otro', label: 'Otro', icon: Package },
]

const getIconForTipo = (tipo: string) => tiposGasto.find(t => t.value === tipo)?.icon || Package
const getLabelForTipo = (tipo: string) => tiposGasto.find(t => t.value === tipo)?.label || tipo

export default function GastosPage() {
    const { user, perfil, role } = useUser()
    const isAdmin = role === 'admin'
    const [misTraslados, setMisTraslados] = useState<TrasladoCompletado[]>([])
    const [guardando, setGuardando] = useState(false)
    const [totalIngresos, setTotalIngresos] = useState(0)
    const [verTodos, setVerTodos] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [paginaActual, setPaginaActual] = useState(1)
    const [paginaGastosAdmin, setPaginaGastosAdmin] = useState(1)
    const [filtroMovimientos, setFiltroMovimientos] = useState('fecha_desc')
    const [filtroTipoGasto, setFiltroTipoGasto] = useState('todos')
    const [filtroTipoGastoAdmin, setFiltroTipoGastoAdmin] = useState('todos')
    const [filtroOrdenAdmin, setFiltroOrdenAdmin] = useState('fecha_desc')
    const ITEMS_POR_PAGINA = 10
    const [formData, setFormData] = useState({ tipo: '', importe: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })

    const { data: gastosData, mutate: mutateGastos } = useGastos(perfil?.empresa_id ?? null, perfil?.id ?? null, isAdmin)
    const gastos: Gasto[] = gastosData || []

    useEffect(() => {
        if (!perfil) return
        if (isAdmin) cargarIngresos(perfil.empresa_id)
        else if (user) cargarMisTraslados(user.id)
    }, [perfil, user, isAdmin])

    useEffect(() => {
        if (!perfil) return
        const sub = supabase.channel('traslados-pago-changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'traslados' }, (payload) => {
                const u = payload.new as { id?: string; estado_pago?: string; chofer_id?: string; empresa_id?: string }
                if (!isAdmin && u.chofer_id === perfil.id && u.id)
                    setMisTraslados(prev => prev.map(t => t.id === u.id ? { ...t, estado_pago: u.estado_pago || t.estado_pago } : t))
                else if (isAdmin && u.empresa_id === perfil.empresa_id) cargarIngresos(perfil.empresa_id)
            }).subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [perfil, isAdmin])

    const cargarMisTraslados = async (userId: string) => {
        const { data } = await supabase.from('traslados').select('id, marca_modelo, matricula, importe_total, estado_pago, created_at')
            .eq('chofer_id', userId).eq('estado', 'completado').neq('estado_pago', 'pendiente').order('created_at', { ascending: false }).limit(500)
        setMisTraslados(data || [])
    }

    const cargarIngresos = async (empresaId: string) => {
        const { data } = await supabase.from('traslados').select('importe_total')
            .eq('empresa_id', empresaId).eq('estado', 'completado').neq('estado_pago', 'pendiente').limit(1000)
        setTotalIngresos(data?.reduce((s, t) => s + (t.importe_total || 0), 0) || 0)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!perfil || !user) return
        const tipo = formData.tipo, importe = formData.importe
        const descripcion = sanitizeString(formData.descripcion), fecha = formData.fecha
        if (!tipo || !isValidTipoGasto(tipo)) { showError('Tipo invalido'); return }
        if (!importe || !isValidImporte(importe)) { showError('Importe invalido'); return }
        if (descripcion.length > LIMITS.descripcion) { showError('Descripcion muy larga'); return }
        if (!fecha || !isValidFecha(fecha)) { showError('Fecha invalida'); return }
        setGuardando(true)
        try {
            const res = await fetch('/api/gastos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empresa_id: perfil.empresa_id, user_id: perfil.id, tipo, importe: parseFloat(importe), descripcion: descripcion || null, fecha }) })
            const data = await res.json()
            if (!res.ok) showError(data.error || 'Error')
            else { setFormData({ tipo: '', importe: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] }); mutateGastos() }
        } catch { showError('Error de conexion') }
        setGuardando(false)
    }

    const eliminarGasto = async (gasto: Gasto) => {
        const ok = await confirmDelete({ title: 'Eliminar gasto', text: '¿Eliminar?', confirmButtonText: 'Si, eliminar' })
        if (!ok) return
        mutateGastos((prev: Gasto[] | undefined) => (prev || []).filter(g => g.id !== gasto.id), { revalidate: false })
        try {
            const res = await fetch(`/api/gastos?id=${gasto.id}`, { method: 'DELETE' })
            if (!res.ok) { showError('Error al eliminar'); mutateGastos() }
        } catch { showError('Error de conexion'); mutateGastos() }
    }

    const gastosFiltrados = useMemo(() => isAdmin && !verTodos ? gastos.filter(g => g.usuario_id === perfil?.id) : gastos, [gastos, isAdmin, verTodos, perfil?.id])
    const gastosOrdenadosAdmin = useMemo(() => {
        const f = filtroTipoGastoAdmin === 'todos' ? gastosFiltrados : gastosFiltrados.filter(g => g.tipo === filtroTipoGastoAdmin)
        return [...f].sort((a, b) => {
            switch (filtroOrdenAdmin) {
                case 'fecha_asc': return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
                case 'mayor_importe': return b.importe - a.importe
                case 'menor_importe': return a.importe - b.importe
                default: return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
            }
        })
    }, [gastosFiltrados, filtroTipoGastoAdmin, filtroOrdenAdmin])

    const { totalGastos, rentabilidad } = useMemo(() => ({
        totalGastos: gastosFiltrados.reduce((s, g) => s + g.importe, 0),
        rentabilidad: totalIngresos - gastos.reduce((s, g) => s + g.importe, 0),
    }), [gastosFiltrados, gastos, totalIngresos])

    const misIngresosTotal = useMemo(() => misTraslados.reduce((s, t) => s + (t.importe_total || 0), 0), [misTraslados])
    const miBalance = misIngresosTotal - totalGastos

    const movimientos = useMemo(() => {
        if (isAdmin) return []
        const DollarIcon = Package // placeholder for $ icon
        const ArrowIcon = Package
        const base: Movimiento[] = [
            ...misTraslados.map(t => ({
                id: t.id, tipo: 'ingreso' as const, concepto: t.marca_modelo + (t.matricula ? ` (${t.matricula})` : ''),
                importe: t.importe_total || 0, fecha: t.created_at,
                icon: t.estado_pago === 'efectivo' ? DollarIcon : ArrowIcon,
                descripcion: t.estado_pago === 'efectivo' ? 'Pago en efectivo' : 'Pago por transferencia',
                esTraslado: true, tipoGasto: 'traslado'
            })),
            ...gastos.map(g => ({
                id: g.id, tipo: 'gasto' as const, concepto: getLabelForTipo(g.tipo),
                importe: g.importe, fecha: g.fecha, icon: getIconForTipo(g.tipo),
                descripcion: g.descripcion || undefined, esTraslado: false, tipoGasto: g.tipo
            }))
        ]
        const filtered = filtroTipoGasto === 'todos' ? base
            : filtroTipoGasto === 'solo_ingresos' ? base.filter(m => m.tipo === 'ingreso')
            : filtroTipoGasto === 'solo_gastos' ? base.filter(m => m.tipo === 'gasto')
            : base.filter(m => m.tipoGasto === filtroTipoGasto)
        return [...filtered].sort((a, b) => {
            switch (filtroMovimientos) {
                case 'fecha_asc': return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
                case 'mayor_importe': return b.importe - a.importe
                case 'menor_importe': return a.importe - b.importe
                default: return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
            }
        })
    }, [isAdmin, misTraslados, gastos, filtroTipoGasto, filtroMovimientos])

    const totalPaginas = Math.ceil(movimientos.length / ITEMS_POR_PAGINA)
    const movimientosPaginados = useMemo(() => movimientos.slice((paginaActual - 1) * ITEMS_POR_PAGINA, paginaActual * ITEMS_POR_PAGINA), [movimientos, paginaActual])
    const totalPaginasGastos = Math.ceil(gastosOrdenadosAdmin.length / ITEMS_POR_PAGINA)
    const gastosPaginados = useMemo(() => gastosOrdenadosAdmin.slice((paginaGastosAdmin - 1) * ITEMS_POR_PAGINA, paginaGastosAdmin * ITEMS_POR_PAGINA), [gastosOrdenadosAdmin, paginaGastosAdmin])

    return (
        <ErrorBoundary>
            <AppHeader breadcrumbs={[{ label: isAdmin ? 'Dashboard' : 'Mis Traslados', href: isAdmin ? '/dashboard' : '/chofer' }, { label: 'Gastos' }]} />
            <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
                {/* Stats */}
                {isAdmin && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Card><CardContent className="p-4 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">Ingresos</p>
                            <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${totalIngresos.toLocaleString('es-AR')}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Traslados cobrados</p>
                        </CardContent></Card>
                        <Card><CardContent className="p-4 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">Gastos Totales</p>
                            <p className="text-xl sm:text-2xl font-bold text-red-500 mt-1">${gastos.reduce((s, g) => s + g.importe, 0).toLocaleString('es-AR')}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Toda la empresa</p>
                        </CardContent></Card>
                        <Card className={rentabilidad >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}><CardContent className="p-4 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">Rentabilidad</p>
                            <p className={`text-xl sm:text-2xl font-bold mt-1 ${rentabilidad >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>${rentabilidad.toLocaleString('es-AR')}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{rentabilidad >= 0 ? 'Ganancia' : 'Perdida'}</p>
                        </CardContent></Card>
                    </div>
                )}
                {!isAdmin && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Card className="bg-emerald-500/5 border-emerald-500/20"><CardContent className="p-4 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Mis Ingresos</p>
                            <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${misIngresosTotal.toLocaleString('es-AR')}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{misTraslados.length} traslados</p>
                        </CardContent></Card>
                        <Card className="bg-red-500/5 border-red-500/20"><CardContent className="p-4 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Mis Gastos</p>
                            <p className="text-xl sm:text-2xl font-bold text-red-500 mt-1">${totalGastos.toLocaleString('es-AR')}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{gastos.length} gastos</p>
                        </CardContent></Card>
                        <Card className={miBalance >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}><CardContent className="p-4 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Mi Balance</p>
                            <p className={`text-xl sm:text-2xl font-bold mt-1 ${miBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>${miBalance.toLocaleString('es-AR')}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{miBalance >= 0 ? 'Positivo' : 'Negativo'}</p>
                        </CardContent></Card>
                    </div>
                )}

                {/* Form */}
                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Registrar Gasto</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="fecha-gasto">Fecha</Label>
                                    <Input id="fecha-gasto" type="date" required value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tipo-gasto">Tipo</Label>
                                    <select id="tipo-gasto" required value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                        <option value="">Seleccionar...</option>
                                        {tiposGasto.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="importe-gasto">Importe</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                        <Input id="importe-gasto" type="number" step="0.01" min="0" required className="pl-7"
                                            value={formData.importe} onChange={e => setFormData({ ...formData, importe: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="desc-gasto">Descripcion</Label>
                                    <Input id="desc-gasto" maxLength={LIMITS.descripcion} placeholder="Opcional..."
                                        value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} />
                                </div>
                            </div>
                            <Button type="submit" disabled={guardando} className="w-full">{guardando ? 'Registrando...' : 'Registrar Gasto'}</Button>
                        </form>
                    </CardContent>
                </Card>

                {/* List */}
                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col gap-4 mb-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">{isAdmin ? 'Gastos de la Empresa' : 'Mis Movimientos'}</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">{isAdmin ? `${gastosOrdenadosAdmin.length} registros` : `${movimientos.length} movimientos`}</p>
                                </div>
                                {isAdmin && (
                                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
                                            <button onClick={() => { setVerTodos(true); setPaginaGastosAdmin(1) }}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${verTodos ? 'bg-card shadow text-primary' : 'text-muted-foreground'}`}>Todos</button>
                                            <button onClick={() => { setVerTodos(false); setPaginaGastosAdmin(1) }}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${!verTodos ? 'bg-card shadow text-primary' : 'text-muted-foreground'}`}>Solo mios</button>
                                        </div>
                                        <select value={filtroTipoGastoAdmin} onChange={e => { setFiltroTipoGastoAdmin(e.target.value); setPaginaGastosAdmin(1) }}
                                            className="bg-muted hover:bg-accent text-foreground text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition border-0 focus:ring-1 focus:ring-ring focus:outline-none w-full sm:w-auto">
                                            <option value="todos">Todos los tipos</option>
                                            {tiposGasto.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        <select value={filtroOrdenAdmin} onChange={e => { setFiltroOrdenAdmin(e.target.value); setPaginaGastosAdmin(1) }}
                                            className="bg-muted hover:bg-accent text-foreground text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition border-0 focus:ring-1 focus:ring-ring focus:outline-none w-full sm:w-auto">
                                            <optgroup label="Por fecha"><option value="fecha_desc">Mas recientes</option><option value="fecha_asc">Mas antiguos</option></optgroup>
                                            <optgroup label="Por importe"><option value="mayor_importe">Mayor importe</option><option value="menor_importe">Menor importe</option></optgroup>
                                        </select>
                                    </div>
                                )}
                                {!isAdmin && (
                                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                        <select value={filtroTipoGasto} onChange={e => { setFiltroTipoGasto(e.target.value); setPaginaActual(1) }}
                                            className="bg-muted hover:bg-accent text-foreground text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition border-0 focus:ring-1 focus:ring-ring focus:outline-none w-full sm:w-auto">
                                            <option value="todos">Todos</option><option value="solo_ingresos">Solo Ingresos</option><option value="solo_gastos">Solo Gastos</option>
                                            <optgroup label="Por tipo">{tiposGasto.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</optgroup>
                                        </select>
                                        <select value={filtroMovimientos} onChange={e => { setFiltroMovimientos(e.target.value); setPaginaActual(1) }}
                                            className="bg-muted hover:bg-accent text-foreground text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition border-0 focus:ring-1 focus:ring-ring focus:outline-none w-full sm:w-auto">
                                            <optgroup label="Por fecha"><option value="fecha_desc">Mas recientes</option><option value="fecha_asc">Mas antiguos</option></optgroup>
                                            <optgroup label="Por importe"><option value="mayor_importe">Mayor importe</option><option value="menor_importe">Menor importe</option></optgroup>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Admin list */}
                        {isAdmin && (gastosOrdenadosAdmin.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"><FileText className="size-7 text-muted-foreground" /></div>
                                <p className="text-muted-foreground text-sm">No hay gastos registrados</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {gastosPaginados.map(gasto => {
                                        const Icon = getIconForTipo(gasto.tipo)
                                        return (
                                            <div key={gasto.id} className="p-3 bg-muted/50 rounded-lg hover:bg-accent/50 transition cursor-pointer"
                                                onClick={() => setExpandedId(expandedId === gasto.id ? null : gasto.id)}>
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-9 h-9 shrink-0 rounded-lg bg-muted flex items-center justify-center"><Icon className="size-4 text-muted-foreground" /></div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="font-medium text-sm text-foreground">{getLabelForTipo(gasto.tipo)}</p>
                                                                {gasto.perfiles && <span className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded shrink-0">
                                                                    {gasto.usuario_id === perfil?.id ? 'Yo' : (Array.isArray(gasto.perfiles) ? gasto.perfiles[0]?.nombre_completo : gasto.perfiles.nombre_completo)}
                                                                </span>}
                                                                {gasto.descripcion && expandedId !== gasto.id && <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                                <ClientOnly>{gasto.fecha ? new Date(gasto.fecha).toLocaleDateString('es-AR') : ''}</ClientOnly>
                                                                {gasto.descripcion && expandedId !== gasto.id && <span className="truncate max-w-[180px] sm:max-w-[240px]">{gasto.descripcion}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                                        <span className="font-semibold text-sm text-red-500">-${gasto.importe.toLocaleString('es-AR')}</span>
                                                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"
                                                            onClick={e => { e.stopPropagation(); eliminarGasto(gasto) }} aria-label="Eliminar"><Trash2 className="size-4" /></Button>
                                                    </div>
                                                </div>
                                                {expandedId === gasto.id && gasto.descripcion && (
                                                    <div className="mt-2 pt-2 border-t border-border"><p className="text-xs text-muted-foreground leading-relaxed">{gasto.descripcion}</p></div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                {totalPaginasGastos > 1 && (
                                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                                        <p className="text-sm text-muted-foreground">
                                            {((paginaGastosAdmin - 1) * ITEMS_POR_PAGINA) + 1} - {Math.min(paginaGastosAdmin * ITEMS_POR_PAGINA, gastosOrdenadosAdmin.length)} de {gastosOrdenadosAdmin.length}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setPaginaGastosAdmin(p => Math.max(1, p - 1))} disabled={paginaGastosAdmin === 1}>Anterior</Button>
                                            <span className="text-sm text-muted-foreground">{paginaGastosAdmin} / {totalPaginasGastos}</span>
                                            <Button variant="outline" size="sm" onClick={() => setPaginaGastosAdmin(p => Math.min(totalPaginasGastos, p + 1))} disabled={paginaGastosAdmin === totalPaginasGastos}>Siguiente</Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ))}

                        {/* Chofer list */}
                        {!isAdmin && (movimientos.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"><FileText className="size-7 text-muted-foreground" /></div>
                                <p className="text-muted-foreground text-sm">No hay movimientos</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {movimientosPaginados.map(mov => {
                                        const Icon = mov.icon
                                        const key = mov.id + mov.tipo
                                        return (
                                            <div key={key} className={`p-3 rounded-lg transition cursor-pointer border ${mov.tipo === 'ingreso' ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/5 hover:bg-red-500/10 border-red-500/20'}`}
                                                onClick={() => setExpandedId(expandedId === key ? null : key)}>
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-9 h-9 shrink-0 rounded-lg bg-card flex items-center justify-center"><Icon className="size-4 text-muted-foreground" /></div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="font-medium text-sm text-foreground truncate">{mov.concepto}</p>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${mov.tipo === 'ingreso' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/20 text-red-700 dark:text-red-400'}`}>
                                                                    {mov.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                                                                </span>
                                                                {mov.descripcion && expandedId !== key && <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                                <ClientOnly>{mov.fecha ? new Date(mov.fecha).toLocaleDateString('es-AR') : ''}</ClientOnly>
                                                                {mov.descripcion && expandedId !== key && <span className="truncate max-w-[180px] sm:max-w-[240px]">{mov.descripcion}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                                        <span className={`font-semibold text-sm ${mov.tipo === 'ingreso' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                                            {mov.tipo === 'ingreso' ? '+' : '-'}${mov.importe.toLocaleString('es-AR')}
                                                        </span>
                                                        {!mov.esTraslado && (
                                                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"
                                                                onClick={e => { e.stopPropagation(); const g = gastos.find(g => g.id === mov.id); if (g) eliminarGasto(g) }} aria-label="Eliminar">
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                {expandedId === key && mov.descripcion && (
                                                    <div className={`mt-2 pt-2 border-t ${mov.tipo === 'ingreso' ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                                                        <p className="text-xs text-muted-foreground leading-relaxed">{mov.descripcion}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                {totalPaginas > 1 && (
                                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                                        <p className="text-sm text-muted-foreground">{((paginaActual - 1) * ITEMS_POR_PAGINA) + 1} - {Math.min(paginaActual * ITEMS_POR_PAGINA, movimientos.length)} de {movimientos.length}</p>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaActual === 1}>Anterior</Button>
                                            <span className="text-sm text-muted-foreground">{paginaActual} / {totalPaginas}</span>
                                            <Button variant="outline" size="sm" onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas}>Siguiente</Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </ErrorBoundary>
    )
}
