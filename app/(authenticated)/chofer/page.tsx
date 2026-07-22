'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmAction, showError } from '@/lib/swal'
import { sanitizeString, isValidCodigoInvitacion, LIMITS } from '@/lib/validation'
import { useUser } from '@/app/components/UserContext'
import AppHeader from '@/app/components/AppHeader'
import Pagination from '@/app/components/Pagination'
import ErrorBoundary from '@/app/components/ErrorBoundary'
import ClientOnly from '@/app/components/ClientOnly'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Truck, Building2, AlertTriangle, CheckCircle2, ChevronRight, X
} from 'lucide-react'

interface Traslado {
    id: string; marca_modelo: string; matricula: string | null; es_0km: boolean;
    estado: string; estado_pago: string; importe_total: number | null; created_at: string;
    departamento: string | null; direccion: string | null; empresas?: { nombre: string };
    observaciones?: string | null; desde?: string | null; hasta?: string | null;
}

const ITEMS_PER_PAGE = 10

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

export default function PanelChofer() {
    const { user, perfil, reload } = useUser()
    const router = useRouter()
    const [traslados, setTraslados] = useState<Traslado[]>([])
    const [trasladosPage, setTrasladosPage] = useState(1)
    const [trasladosTotal, setTrasladosTotal] = useState(0)
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

    useEffect(() => {
        if (!perfil) return
        if (perfil.empresa_id) {
            supabase.from('empresas').select('nombre').eq('id', perfil.empresa_id).single()
                .then(({ data }) => setNombreEmpresa(data?.nombre || null))
        } else { setNombreEmpresa(null) }
    }, [perfil?.empresa_id])

    useEffect(() => {
        if (user?.id) cargarTraslados(user.id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
    }, [user?.id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes])

    useEffect(() => {
        if (!user?.id) return
        const ch = supabase.channel('traslados-chofer-' + user.id)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'traslados', filter: `chofer_id=eq.${user.id}` }, (payload) => {
                setTraslados(prev => {
                    if (payload.eventType === 'INSERT') return prev.some(t => t.id === (payload.new as Traslado).id) ? prev : [payload.new as Traslado, ...prev]
                    if (payload.eventType === 'UPDATE') return prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } as Traslado : t)
                    if (payload.eventType === 'DELETE') return prev.filter(t => t.id !== payload.old.id)
                    return prev
                })
            }).subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [user?.id])

    useEffect(() => {
        if (!user?.id) return
        const sub = supabase.channel('mi-perfil-changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'perfiles', filter: `id=eq.${user.id}` }, () => {
                reload()
            }).subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [user?.id, reload])

    const cargarTraslados = async (choferId: string, page: number, soloTP: boolean, soloPP: boolean) => {
        const from = (page - 1) * ITEMS_PER_PAGE
        const to = page * ITEMS_PER_PAGE - 1
        let query = supabase.from('traslados')
            .select('id, marca_modelo, matricula, es_0km, estado, estado_pago, importe_total, observaciones, created_at, departamento, direccion, empresas(nombre), desde, hasta', { count: 'exact' })
            .eq('chofer_id', choferId)
        if (soloTP) query = query.eq('estado', 'pendiente')
        if (soloPP) query = query.eq('estado_pago', 'pendiente')
        const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)
        if (error) { setTraslados([]); setTrasladosTotal(0); return }
        const norm = (data || []).map((t: Record<string, unknown>) => ({
            ...t, empresas: t.empresas && Array.isArray(t.empresas) ? t.empresas[0] : t.empresas
        })) as Traslado[]
        setTraslados(norm)
        setTrasladosTotal(count || 0)
    }

    const validarCodigo = async () => {
        const codigo = sanitizeString(codigoInvitacion)
        if (!codigo) return
        setErrorCodigo(''); setEmpresaInvitacion(null)
        if (!isValidCodigoInvitacion(codigo)) { setErrorCodigo('Formato invalido'); return }
        const { data, error } = await supabase.from('invitaciones').select('*, empresas(nombre)').eq('codigo', codigo).single()
        if (error || !data) { setErrorCodigo('Codigo invalido'); return }
        if (data.usado) { setErrorCodigo('Codigo ya utilizado'); return }
        if (new Date(data.expires_at) < new Date()) { setErrorCodigo('Codigo expirado'); return }
        setEmpresaInvitacion(data.empresas?.nombre || 'Empresa')
    }

    const handleUnirse = async () => {
        const codigo = sanitizeString(codigoInvitacion)
        if (!perfil || !codigo || !isValidCodigoInvitacion(codigo)) return
        setUniendose(true); setErrorCodigo('')
        const { data: inv, error: invErr } = await supabase.from('invitaciones')
            .update({ usado: true }).eq('codigo', codigo.trim()).eq('usado', false)
            .gte('expires_at', new Date().toISOString()).select().single()
        if (!inv || invErr) { setErrorCodigo('Codigo invalido o expirado'); setUniendose(false); return }
        const { error: upErr } = await supabase.from('perfiles').update({ empresa_id: inv.empresa_id }).eq('id', perfil.id)
        if (upErr) { await supabase.from('invitaciones').update({ usado: false }).eq('id', inv.id); setErrorCodigo('Error al unirse'); setUniendose(false); return }
        const nombre = empresaInvitacion
        setUniendose(false); setMostrarFormCodigo(false); setCodigoInvitacion(''); setEmpresaInvitacion(null)
        setMensajeExito(`Te uniste a ${nombre}!`)
        reload()
        timersRef.current.push(setTimeout(() => setMensajeExito(null), 5000))
    }

    return (
        <ErrorBoundary>
            <AppHeader breadcrumbs={[{ label: 'Mis Traslados' }]} />
            <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
                {/* Success message */}
                {mensajeExito && (
                    <Alert className="mb-5 border-emerald-500/20 bg-emerald-500/10">
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <AlertDescription className="text-emerald-700 dark:text-emerald-400 font-medium">{mensajeExito}</AlertDescription>
                    </Alert>
                )}

                {/* Company banner */}
                {perfil?.empresa_id && nombreEmpresa && !mensajeExito && (
                    <Alert className="mb-5 border-emerald-500/15 bg-emerald-500/5">
                        <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <AlertDescription>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <p className="text-foreground font-medium text-sm">Empresa activa</p>
                                    <p className="text-muted-foreground text-xs">Trabajando con <span className="font-semibold">{nombreEmpresa}</span></p>
                                </div>
                                <Button variant="destructive" size="sm" onClick={async () => {
                                    const ok = await confirmAction({ title: 'Salirse de la empresa', text: '¿Seguro? Perderas acceso a los traslados.', icon: 'warning', confirmButtonText: 'Si, salirme' })
                                    if (!ok || !perfil) return
                                    await supabase.from('perfiles').update({ empresa_id: null }).eq('id', perfil.id)
                                    setNombreEmpresa(null)
                                    setMensajeExito('Te has salido de la empresa.')
                                    reload()
                                    timersRef.current.push(setTimeout(() => setMensajeExito(null), 5000))
                                }}>Salirse</Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {/* No company */}
                {!perfil?.empresa_id && (
                    <Alert className="mb-5 border-yellow-500/15 bg-yellow-500/5">
                        <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400" />
                        <AlertDescription>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <p className="text-foreground font-medium text-sm">Sin empresa activa</p>
                                    <p className="text-muted-foreground text-xs">No perteneces a ninguna empresa.</p>
                                </div>
                                {!mostrarFormCodigo && <Button size="sm" onClick={() => setMostrarFormCodigo(true)}>Tengo un codigo</Button>}
                            </div>
                            {mostrarFormCodigo && (
                                <div className="mt-4 pt-4 border-t border-yellow-500/15">
                                    {empresaInvitacion ? (
                                        <Card>
                                            <CardContent className="p-5 text-center">
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                                                    <Building2 className="size-6 text-primary" />
                                                </div>
                                                <p className="text-muted-foreground text-sm mb-1">¿Unirte a</p>
                                                <p className="text-lg font-semibold text-foreground mb-4">{empresaInvitacion}?</p>
                                                <div className="flex justify-center gap-2">
                                                    <Button onClick={handleUnirse} disabled={uniendose}>{uniendose ? 'Uniendose...' : 'Si, unirme'}</Button>
                                                    <Button variant="outline" onClick={() => { setEmpresaInvitacion(null); setCodigoInvitacion('') }}>Cancelar</Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Ingresa el codigo de invitacion</p>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <Input placeholder="Ej: ABC123XYZ" maxLength={LIMITS.codigoInvitacion} value={codigoInvitacion}
                                                    onChange={e => { setCodigoInvitacion(e.target.value.toUpperCase()); setErrorCodigo('') }} className="flex-1" />
                                                <div className="flex gap-2">
                                                    <Button size="sm" onClick={validarCodigo}>Validar</Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { setMostrarFormCodigo(false); setCodigoInvitacion(''); setErrorCodigo('') }}>Cancelar</Button>
                                                </div>
                                            </div>
                                            {errorCodigo && <p className="text-destructive text-xs mt-2 flex items-center gap-1"><X className="size-3.5" />{errorCodigo}</p>}
                                        </>
                                    )}
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Header */}
                <div className="mb-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{perfil?.empresa_id ? 'Mis Traslados' : 'Mi Historial'}</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground">{perfil?.nombre_completo}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 self-start">
                            <button onClick={() => { setFiltroTrasladosPendientes(!filtroTrasladosPendientes); setTrasladosPage(1) }}
                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition ${filtroTrasladosPendientes ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' : 'bg-muted text-muted-foreground border-transparent hover:bg-accent'}`}>
                                <span className={`status-dot ${filtroTrasladosPendientes ? 'bg-yellow-500 status-dot-pulse' : 'bg-muted-foreground/40'}`} />
                                Traslados Pendientes
                            </button>
                            <button onClick={() => { setFiltroPagosPendientes(!filtroPagosPendientes); setTrasladosPage(1) }}
                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition ${filtroPagosPendientes ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-transparent hover:bg-accent'}`}>
                                <span className={`status-dot ${filtroPagosPendientes ? 'bg-primary status-dot-pulse' : 'bg-muted-foreground/40'}`} />
                                Pagos Pendientes
                            </button>
                        </div>
                    </div>
                </div>

                {/* Transfer list */}
                {traslados.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-12 sm:py-16">
                            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                                <Truck className="size-7 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm text-muted-foreground">No hay traslados asignados</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2 animate-stagger">
                        {traslados.map(t => {
                            const estado = estadoConfig[t.estado] || estadoConfig.pendiente
                            const pago = pagoConfig[t.estado_pago] || pagoConfig.pendiente
                            return (
                                <div key={t.id} className="rounded-lg border border-border bg-card hover:border-border/80 hover:bg-accent/30 p-3 sm:p-4 transition cursor-pointer group"
                                    onClick={() => router.push(`/chofer/traslado/${t.id}`)}>
                                    <div className="flex items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">{t.empresas?.nombre || 'Empresa'}</span>
                                                {t.departamento && <span className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">{t.departamento}</span>}
                                                <span className="text-xs text-muted-foreground/50"><ClientOnly>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</ClientOnly></span>
                                            </div>
                                            <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                                                {t.marca_modelo}
                                                {t.es_0km && <span className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">0 KM</span>}
                                            </h3>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                                {t.matricula && <span># {t.matricula}</span>}
                                                {t.importe_total != null && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-medium text-foreground">${t.importe_total.toLocaleString('es-AR')}</span>
                                                        <span className={`text-xs px-1.5 py-0.5 rounded ${pago.bg} ${pago.text}`}>{pago.label}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${estado.bg} ${estado.text}`}>{estado.label}</span>
                                            <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-primary transition" />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
                <Pagination currentPage={trasladosPage} totalItems={trasladosTotal} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setTrasladosPage} />
            </div>
        </ErrorBoundary>
    )
}
