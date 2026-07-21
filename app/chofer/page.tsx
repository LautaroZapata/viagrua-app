'use client'
import { useState, useEffect, useRef } from 'react'
import ClientOnly from '../components/ClientOnly'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmAction, showError } from '@/lib/swal'
import ThemeToggle from '../components/ThemeToggle'
import MobileDrawer from '../components/MobileDrawer'
import Pagination from '../components/Pagination'
import { sanitizeString, isValidCodigoInvitacion, LIMITS } from '@/lib/validation'
import ErrorBoundary from '../components/ErrorBoundary'
import { PageSkeleton } from '../components/skeletons'
import {
    Truck, Menu, Receipt, LayoutDashboard, LogOut, UserCog,
    Building2, AlertTriangle, CheckCircle2, ChevronRight, X
} from 'lucide-react'

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
    const [drawerOpen, setDrawerOpen] = useState(false)
    const router = useRouter()
    const [perfil, setPerfil] = useState<Perfil | null>(null)
    const [traslados, setTraslados] = useState<Traslado[]>([])
    const [trasladosPage, setTrasladosPage] = useState(1)
    const [trasladosTotal, setTrasladosTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [nombreEmpresa, setNombreEmpresa] = useState<string | null>(null)
    const [filtroTrasladosPendientes, setFiltroTrasladosPendientes] = useState(false)
    const [filtroPagosPendientes, setFiltroPagosPendientes] = useState(false)

    const [mostrarFormCodigo, setMostrarFormCodigo] = useState(false)
    const [codigoInvitacion, setCodigoInvitacion] = useState('')
    const [uniendose, setUniendose] = useState(false)
    const [errorCodigo, setErrorCodigo] = useState('')
    const [empresaInvitacion, setEmpresaInvitacion] = useState<string | null>(null)
    const [mensajeExito, setMensajeExito] = useState<string | null>(null)

    const timersRef = useRef<NodeJS.Timeout[]>([])
    useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

    useEffect(() => { cargarDatos() }, [])

    useEffect(() => {
        if (perfil?.id) {
            cargarTraslados(perfil.id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
        }
    }, [trasladosPage, perfil?.id, filtroTrasladosPendientes, filtroPagosPendientes])

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
                        return prev.some(t => t.id === (payload.new as Traslado).id)
                            ? prev
                            : [payload.new as Traslado, ...prev]
                    } else if (payload.eventType === 'UPDATE') {
                        return prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } as Traslado : t)
                    } else if (payload.eventType === 'DELETE') {
                        return prev.filter(t => t.id !== payload.old.id)
                    }
                    return prev;
                });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [perfil?.id]);

    useEffect(() => {
        if (!perfil?.id) return

        const subscription = supabase
            .channel('mi-perfil-changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'perfiles',
                filter: `id=eq.${perfil.id}`
            }, (payload) => {
                const newData = payload.new as Perfil
                if (newData.empresa_id !== perfil.empresa_id) {
                    setPerfil(newData)
                    if (!newData.empresa_id) {
                        setNombreEmpresa(null)
                        setMensajeExito(null)
                    } else {
                        cargarDatos()
                    }
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(subscription) }
    }, [perfil?.id, perfil?.empresa_id])

    const cargarDatos = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }

            const { data: perfilData } = await supabase
                .from('perfiles').select('*').eq('id', user.id).single()
            setPerfil(perfilData)

            if (perfilData?.empresa_id) {
                const [, empresaResult] = await Promise.all([
                    cargarTraslados(user.id, 1),
                    supabase.from('empresas').select('nombre').eq('id', perfilData.empresa_id).single()
                ])
                setNombreEmpresa(empresaResult.data?.nombre || null)
            } else {
                setNombreEmpresa(null)
                await cargarTraslados(user.id, 1)
            }
            setLoading(false)
        } catch (err) {
            console.error('Error cargando datos:', err)
            setLoading(false)
        }
    }

    const ITEMS_PER_PAGE = 10

    const cargarTraslados = async (choferId: string, page: number = 1, soloTrasladosPendientes: boolean = false, soloPagosPendientes: boolean = false) => {
        const from = (page - 1) * ITEMS_PER_PAGE
        const to = page * ITEMS_PER_PAGE - 1

        let query = supabase
            .from('traslados')
            .select('id, marca_modelo, matricula, es_0km, estado, estado_pago, importe_total, observaciones, foto_frontal, foto_lateral, foto_trasera, foto_interior, created_at, departamento, direccion, empresas(nombre), desde, hasta', { count: 'exact' })
            .eq('chofer_id', choferId)

        if (soloTrasladosPendientes) query = query.eq('estado', 'pendiente')
        if (soloPagosPendientes) query = query.eq('estado_pago', 'pendiente')

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to)

        if (error) {
            console.error('Error cargando traslados chofer:', error)
            setTraslados([])
            setTrasladosTotal(0)
            return
        }

        const trasladosNorm = (data || []).map((t: Record<string, unknown>) => ({
            ...t,
            empresas: t.empresas && Array.isArray(t.empresas) ? t.empresas[0] : t.empresas
        })) as Traslado[];
        setTraslados(trasladosNorm)
        setTrasladosTotal(count || 0)
    }

    const handleCerrarSesion = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const validarCodigo = async () => {
        const codigo = sanitizeString(codigoInvitacion)
        if (!codigo) return
        setErrorCodigo('')
        setEmpresaInvitacion(null)

        if (!isValidCodigoInvitacion(codigo)) {
            setErrorCodigo('Formato de codigo invalido')
            return
        }

        const { data, error } = await supabase
            .from('invitaciones')
            .select('*, empresas(nombre)')
            .eq('codigo', codigo)
            .single()

        if (error || !data) { setErrorCodigo('Codigo de invitacion invalido'); return }
        if (data.usado) { setErrorCodigo('Este codigo ya fue utilizado'); return }
        if (new Date(data.expires_at) < new Date()) { setErrorCodigo('Este codigo ha expirado'); return }

        setEmpresaInvitacion(data.empresas?.nombre || 'Empresa')
    }

    const handleUnirseEmpresa = async () => {
        const codigo = sanitizeString(codigoInvitacion)
        if (!perfil || !codigo) return

        if (!isValidCodigoInvitacion(codigo)) {
            setErrorCodigo('Formato de codigo invalido')
            return
        }

        setUniendose(true)
        setErrorCodigo('')

        const { data: invitacion, error: invError } = await supabase
            .from('invitaciones')
            .update({ usado: true })
            .eq('codigo', codigo.trim())
            .eq('usado', false)
            .gte('expires_at', new Date().toISOString())
            .select()
            .single()

        if (!invitacion || invError) {
            setErrorCodigo('Codigo invalido, expirado o ya utilizado')
            setUniendose(false)
            return
        }

        const { error: updateError } = await supabase
            .from('perfiles')
            .update({ empresa_id: invitacion.empresa_id })
            .eq('id', perfil.id)

        if (updateError) {
            await supabase.from('invitaciones').update({ usado: false }).eq('id', invitacion.id)
            setErrorCodigo('Error al unirse a la empresa')
            setUniendose(false)
            return
        }

        const empresaNombre = empresaInvitacion
        setUniendose(false)
        setMostrarFormCodigo(false)
        setCodigoInvitacion('')
        setEmpresaInvitacion(null)
        setMensajeExito(`Te uniste a ${empresaNombre}!`)
        cargarDatos()

        const t = setTimeout(() => setMensajeExito(null), 5000); timersRef.current.push(t)
    }

    const estadoConfig: Record<string, { bg: string; text: string; label: string }> = {
        pendiente: { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pendiente' },
        en_curso: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: 'En curso' },
        completado: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Completado' },
    }

    const pagoConfig: Record<string, { bg: string; text: string; label: string }> = {
        pendiente: { bg: 'bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pendiente' },
        efectivo: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', label: 'Efectivo' },
        transferencia: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', label: 'Transfer.' },
    }

    if (loading) return <PageSkeleton />

    const drawerItems = [
        ...(perfil?.rol === 'admin' ? [
            { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Admin', onClick: () => router.push('/dashboard') },
        ] : []),
        { icon: <Receipt className="w-5 h-5" />, label: 'Gastos', isLink: true, href: '/dashboard/gastos', onClick: () => router.push('/dashboard/gastos') },
        { icon: <LogOut className="w-5 h-5" />, label: 'Salir', isDanger: true, onClick: handleCerrarSesion },
    ]

    return (
        <ErrorBoundary>
        <div className="min-h-screen bg-background pb-8">
            {/* Navbar */}
            <nav className="navbar sticky top-0 z-50">
                <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center gap-2">
                        <button className="md:hidden mr-1 p-2 rounded-lg hover:bg-white/10 focus:outline-none transition" onClick={() => setDrawerOpen(true)} aria-label="Abrir menu">
                            <Menu className="w-5 h-5 text-white" />
                        </button>
                        <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                            <Truck className="w-4 h-4 text-white" />
                        </div>
                        <h1 className="text-sm sm:text-base font-semibold text-white">ViaGrua</h1>
                        <span className="text-white/50 text-xs hidden sm:inline">Chofer</span>
                        {perfil?.nombre_completo && (
                            <span className="hidden sm:inline ml-2 text-xs text-white/80 font-semibold bg-white/10 px-2.5 py-1 rounded-lg max-w-[140px] truncate" title={perfil.nombre_completo}>
                                {perfil.nombre_completo}
                            </span>
                        )}
                    </div>
                    <div className="hidden md:flex items-center gap-1.5">
                        <button onClick={() => router.push('/dashboard/gastos')}
                            className="text-white/80 hover:text-white text-sm font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5">
                            <Receipt className="w-4 h-4" />
                            Gastos
                        </button>
                        {perfil?.rol === 'admin' && (
                            <button onClick={() => router.push('/dashboard')}
                                className="text-white/80 hover:text-white text-sm font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5">
                                <LayoutDashboard className="w-4 h-4" />
                                Admin
                            </button>
                        )}
                        <button onClick={handleCerrarSesion} className="text-white text-sm font-medium px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg transition flex items-center gap-1.5">
                            <LogOut className="w-4 h-4" />
                            Salir
                        </button>
                        <ThemeToggle />
                    </div>
                </div>
            </nav>

            <MobileDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                items={drawerItems}
                userName={perfil?.nombre_completo}
            />

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-3xl mx-auto">
                {/* Mensaje de exito */}
                {mensajeExito && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">{mensajeExito}</p>
                    </div>
                )}

                {/* Banner con empresa */}
                {perfil?.empresa_id && nombreEmpresa && !mensajeExito && (
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 mb-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-foreground font-medium text-sm">Empresa activa</p>
                                    <p className="text-muted-foreground text-xs mt-0.5">
                                        Trabajando con <span className="font-semibold">{nombreEmpresa}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    const ok = await confirmAction({
                                        title: 'Salirse de la empresa',
                                        text: '¿Seguro que quieres salirte de la empresa? Perderas acceso a los traslados activos.',
                                        icon: 'warning',
                                        confirmButtonText: 'Si, salirme',
                                    })
                                    if (!ok || !perfil) return
                                    await supabase.from('perfiles').update({ empresa_id: null }).eq('id', perfil.id)
                                    setPerfil({ ...perfil, empresa_id: null })
                                    setNombreEmpresa(null)
                                    setMensajeExito('Te has salido de la empresa.')
                                    const t = setTimeout(() => setMensajeExito(null), 5000); timersRef.current.push(t)
                                }}
                                className="bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium text-xs px-4 py-2 rounded-lg transition border border-destructive/20"
                            >
                                Salirse de la empresa
                            </button>
                        </div>
                    </div>
                )}

                {/* Banner sin empresa */}
                {!perfil?.empresa_id && (
                    <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4 mb-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <div>
                                    <p className="text-foreground font-medium text-sm">Sin empresa activa</p>
                                    <p className="text-muted-foreground text-xs mt-0.5">
                                        No perteneces a ninguna empresa. Aqui puedes ver tu historial.
                                    </p>
                                </div>
                            </div>
                            {!mostrarFormCodigo && (
                                <button onClick={() => setMostrarFormCodigo(true)} className="btn-primary text-xs px-4 py-2 whitespace-nowrap">
                                    Tengo un codigo
                                </button>
                            )}
                        </div>

                        {mostrarFormCodigo && (
                            <div className="mt-4 pt-4 border-t border-yellow-500/15">
                                {empresaInvitacion ? (
                                    <div className="bg-card rounded-xl p-5 border border-border">
                                        <div className="text-center">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                                                <Building2 className="w-6 h-6 text-primary" />
                                            </div>
                                            <p className="text-muted-foreground text-sm mb-1">¿Deseas unirte a</p>
                                            <p className="text-lg font-semibold text-foreground mb-4">{empresaInvitacion}?</p>
                                            <div className="flex justify-center gap-2">
                                                <button onClick={handleUnirseEmpresa} disabled={uniendose}
                                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm px-5 py-2 rounded-lg transition">
                                                    {uniendose ? 'Uniendose...' : 'Si, unirme'}
                                                </button>
                                                <button onClick={() => { setEmpresaInvitacion(null); setCodigoInvitacion('') }}
                                                    className="bg-muted hover:bg-accent text-muted-foreground font-medium text-sm px-5 py-2 rounded-lg transition">
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Ingresa el codigo de invitacion</p>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                placeholder="Ej: ABC123XYZ"
                                                maxLength={LIMITS.codigoInvitacion}
                                                className="input-field flex-1"
                                                value={codigoInvitacion}
                                                onChange={(e) => { setCodigoInvitacion(e.target.value.toUpperCase()); setErrorCodigo('') }}
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={validarCodigo} className="btn-primary text-xs px-4 py-2.5 min-h-[40px]">
                                                    Validar
                                                </button>
                                                <button onClick={() => { setMostrarFormCodigo(false); setCodigoInvitacion(''); setErrorCodigo('') }}
                                                    className="text-muted-foreground hover:text-foreground text-xs px-3 py-2.5 min-h-[40px]">
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                        {errorCodigo && (
                                            <p className="text-destructive text-xs mt-2 flex items-center gap-1">
                                                <X className="w-3.5 h-3.5" />
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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-0.5">
                                {perfil?.empresa_id ? 'Mis Traslados' : 'Mi Historial'}
                            </h2>
                            <p className="text-xs sm:text-sm text-muted-foreground">{perfil?.nombre_completo}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 self-start">
                            <button
                                onClick={() => { setFiltroTrasladosPendientes(!filtroTrasladosPendientes); setTrasladosPage(1) }}
                                className={`filter-btn inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition ${
                                    filtroTrasladosPendientes
                                        ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30'
                                        : 'bg-muted text-muted-foreground border-transparent hover:bg-accent'
                                }`}
                            >
                                <span className={`status-dot ${filtroTrasladosPendientes ? 'bg-yellow-500 status-dot-pulse' : 'bg-muted-foreground/40'}`}></span>
                                Traslados Pendientes
                            </button>
                            <button
                                onClick={() => { setFiltroPagosPendientes(!filtroPagosPendientes); setTrasladosPage(1) }}
                                className={`filter-btn inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition ${
                                    filtroPagosPendientes
                                        ? 'bg-primary/10 text-primary border-primary/30'
                                        : 'bg-muted text-muted-foreground border-transparent hover:bg-accent'
                                }`}
                            >
                                <span className={`status-dot ${filtroPagosPendientes ? 'bg-primary status-dot-pulse' : 'bg-muted-foreground/40'}`}></span>
                                Pagos Pendientes
                            </button>
                        </div>
                    </div>
                </div>

                {/* Traslados List */}
                {traslados.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card text-center py-12 sm:py-16">
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <Truck className="w-7 h-7 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground">No hay traslados asignados</p>
                    </div>
                ) : (
                    <div className="space-y-2 animate-stagger">
                        {traslados.map((traslado) => {
                            const estado = estadoConfig[traslado.estado] || estadoConfig.pendiente
                            const pago = pagoConfig[traslado.estado_pago] || pagoConfig.pendiente
                            return (
                            <div
                                key={traslado.id}
                                className="rounded-lg border border-border bg-card hover:border-border/80 hover:bg-accent/30 p-3 sm:p-4 transition cursor-pointer group"
                                onClick={() => router.push(`/chofer/traslado/${traslado.id}`)}
                            >
                                <div className="flex items-start sm:items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                                                {traslado.empresas?.nombre || 'Empresa'}
                                            </span>
                                            {traslado.departamento && (
                                                <span className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                                                    {traslado.departamento}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-muted-foreground/50">
                                                <ClientOnly>{traslado.created_at ? new Date(traslado.created_at).toLocaleDateString() : ''}</ClientOnly>
                                            </span>
                                        </div>
                                        <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                                            {traslado.marca_modelo}
                                            {traslado.es_0km && (
                                                <span className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">0 KM</span>
                                            )}
                                        </h3>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                            {traslado.matricula && <span># {traslado.matricula}</span>}
                                            {traslado.importe_total != null && (
                                                <span className="flex items-center gap-1">
                                                    <span className="font-medium text-foreground">${traslado.importe_total.toLocaleString('es-AR')}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${pago.bg} ${pago.text}`}>
                                                        {pago.label}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-[10px] font-medium px-2 py-1 rounded-lg border ${estado.bg} ${estado.text}`}>
                                            {estado.label}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition" />
                                    </div>
                                </div>
                            </div>
                            )
                        })}
                    </div>
                )}

                <Pagination
                    currentPage={trasladosPage}
                    totalItems={trasladosTotal}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setTrasladosPage}
                />
            </div>
        </div>
        </ErrorBoundary>
    )
}
