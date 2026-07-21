'use client'
import { useState, useEffect, useRef } from 'react'
import ClientOnly from '../components/ClientOnly'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ThemeToggle from '../components/ThemeToggle'
import MobileDrawer from '../components/MobileDrawer'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import ErrorBoundary from '../components/ErrorBoundary'
import { PageSkeleton } from '../components/skeletons'
import DashboardCharts from '../components/DashboardCharts'
import { supabase } from '@/lib/supabase'
import { confirmDelete, confirmAction, showError } from '@/lib/swal'
import {
    Truck, Menu, Home, Car, Users, Receipt, UserCog, LogOut,
    Plus, UserPlus, MapPin, Clock, Zap, CheckCircle2, ChevronRight,
    Trash2, Download, Copy, Check, Mail, X, QrCode
} from 'lucide-react'

interface Perfil {
    id: string;
    nombre_completo: string;
    rol: string;
    empresa_id: string;
    email?: string;
}
interface Chofer { id: string; nombre_completo: string; email: string }
interface Empresa { id: string; nombre: string }
interface Traslado {
    id: string;
    marca_modelo: string;
    matricula: string | null;
    es_0km: boolean;
    estado: string;
    estado_pago: string;
    importe_total: number | null;
    observaciones: string | null;
    created_at: string;
    perfiles?: { nombre_completo: string };
}


export default function Dashboard() {
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [empresa, setEmpresa] = useState<Empresa | null>(null);
    const [choferes, setChoferes] = useState<Chofer[]>([]);
    const [traslados, setTraslados] = useState<Traslado[]>([]);
    const [gastos, setGastos] = useState<{ importe: number; fecha: string }[]>([]);
    const [chartTraslados, setChartTraslados] = useState<{ importe_total: number | null; created_at: string }[]>([]);
    const [trasladosPage, setTrasladosPage] = useState(1);
    const [trasladosTotal, setTrasladosTotal] = useState(0);
    const [trasladosPendientesTotal, setTrasladosPendientesTotal] = useState(0);
    const [trasladosEnCursoTotal, setTrasladosEnCursoTotal] = useState(0);
    const [trasladosCompletadosTotal, setTrasladosCompletadosTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [activeTab, setActiveTab] = useState('inicio');
    const [codigoInvitacion, setCodigoInvitacion] = useState('');
    const [linkInvitacion, setLinkInvitacion] = useState('');
    const [generandoCodigo, setGenerandoCodigo] = useState(false);
    const [linkCopiado, setLinkCopiado] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [filtroTrasladosPendientes, setFiltroTrasladosPendientes] = useState(false);
    const [filtroPagosPendientes, setFiltroPagosPendientes] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkingSession, setCheckingSession] = useState(true);
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const timersRef = useRef<NodeJS.Timeout[]>([]);

    // Cleanup all timers on unmount
    useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

    // Validar sesion al montar el componente
    useEffect(() => {
        let isMounted = true;
        async function checkSession() {
            setCheckingSession(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (isMounted) {
                    setCheckingSession(false);
                    setError('No hay sesion activa. Redirigiendo a login...');
                    timersRef.current.push(setTimeout(() => router.replace('/login'), 1000));
                }
                return;
            }
            if (isMounted) {
                try {
                    await cargarDatos();
                } catch (err) {
                    let msg = 'Error al cargar datos';
                    if (err instanceof Error) {
                        msg = msg + ': ' + err.message;
                    }
                    setError(msg);
                } finally {
                    setCheckingSession(false);
                }
            }
        }
        checkSession();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Suscripcion en tiempo real para nuevos choferes
    useEffect(() => {
        if (!perfil?.empresa_id) return;

        const subscription = supabase
            .channel('choferes-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'perfiles'
                },
                (payload) => {
                    const newRecord = payload.new as { empresa_id?: string };
                    const oldRecord = payload.old as { empresa_id?: string };
                    if (newRecord?.empresa_id === perfil?.empresa_id ||
                        oldRecord?.empresa_id === perfil?.empresa_id) {
                        if (perfil?.empresa_id) cargarChoferes(perfil.empresa_id);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [perfil?.empresa_id]);

    // Cuando se navega a la pestana 'traslados', cambia la pagina o el filtro, recargar lista
    useEffect(() => {
        if (activeTab === 'traslados' && perfil?.empresa_id) {
            cargarTraslados(perfil.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
        }
    }, [activeTab, trasladosPage, perfil?.empresa_id, filtroTrasladosPendientes, filtroPagosPendientes])

    const cargarDatos = async () => {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw new Error(userError.message);
            if (!user) {
                setError('No se detecto usuario autenticado. Revisa si la cookie de sesion se esta guardando correctamente.');
                router.push('/login');
                return;
            }

            const { data: perfilData, error: perfilError } = await supabase
                .from('perfiles').select('id, nombre_completo, rol, empresa_id, email').eq('id', user.id).single();
            if (perfilError) throw new Error(perfilError.message);
            if (!perfilData) { router.push('/login'); return; }

            setPerfil(perfilData);

            const [empresaResult] = await Promise.all([
                supabase.from('empresas').select('*').eq('id', perfilData.empresa_id).single(),
                cargarChoferes(perfilData.empresa_id),
                cargarTraslados(perfilData.empresa_id, 1),
                cargarDatosGrafico(perfilData.empresa_id),
            ]);
            if (empresaResult.error) throw new Error(empresaResult.error.message);
            setEmpresa(empresaResult.data);
        } catch (err) {
            let msg = 'Error inesperado al cargar datos';
            if (err instanceof Error) {
                msg = err.message;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    }

    const cargarChoferes = async (empresaId: string) => {
        const { data } = await supabase
            .from('perfiles').select('*').eq('empresa_id', empresaId).eq('rol', 'chofer')
        setChoferes(data || [])
    }

    const cargarDatosGrafico = async (empresaId: string) => {
        const [gastosRes, trasladosRes] = await Promise.all([
            supabase.from('gastos').select('importe, fecha').eq('empresa_id', empresaId).limit(1000),
            supabase.from('traslados').select('importe_total, created_at').eq('empresa_id', empresaId).eq('estado', 'completado').neq('estado_pago', 'pendiente').limit(1000),
        ])
        setGastos(gastosRes.data || [])
        setChartTraslados(trasladosRes.data || [])
    }

    const expulsarChofer = async (choferId: string, nombreChofer: string) => {
        const ok = await confirmDelete({
            title: 'Expulsar chofer',
            text: `¿Estas seguro de expulsar a ${nombreChofer}? Esta accion no se puede deshacer.`,
            confirmButtonText: 'Si, expulsar',
        })
        if (!ok) return

        setChoferes(prev => prev.filter(c => c.id !== choferId))

        const { error } = await supabase.rpc('expulsar_chofer', {
            chofer_id: choferId
        })

        if (error) {
            showError('Error al expulsar: ' + error.message)
            if (perfil) await cargarChoferes(perfil.empresa_id)
        }
    }

    const ITEMS_PER_PAGE = 10

    const cargarTraslados = async (empresaId: string, page: number = 1, soloTrasladosPendientes: boolean = false, soloPagosPendientes: boolean = false) => {
        const from = (page - 1) * ITEMS_PER_PAGE
        const to = page * ITEMS_PER_PAGE - 1

        let query = supabase
            .from('traslados')
            .select('*, perfiles(nombre_completo)', { count: 'exact' })
            .eq('empresa_id', empresaId)

        if (soloTrasladosPendientes) {
            query = query.eq('estado', 'pendiente')
        }
        if (soloPagosPendientes) {
            query = query.eq('estado_pago', 'pendiente')
        }

        const [mainResult, pend, enCurso, comp] = await Promise.all([
            query.order('created_at', { ascending: false }).range(from, to),
            supabase.from('traslados').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('estado', 'pendiente'),
            supabase.from('traslados').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('estado', 'en_curso'),
            supabase.from('traslados').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('estado', 'completado'),
        ])

        if (mainResult.error) {
            console.error('Error cargando traslados:', mainResult.error)
            setTraslados([])
            setTrasladosTotal(0)
            return
        }

        setTraslados(mainResult.data || [])
        setTrasladosTotal(mainResult.count || 0)
        setTrasladosPendientesTotal(pend.count || 0)
        setTrasladosEnCursoTotal(enCurso.count || 0)
        setTrasladosCompletadosTotal(comp.count || 0)
    }

    const cargarContadoresTraslados = async (empresaId: string) => {
        try {
            const [pend, enCurso, comp] = await Promise.all([
                supabase.from('traslados').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('estado', 'pendiente'),
                supabase.from('traslados').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('estado', 'en_curso'),
                supabase.from('traslados').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('estado', 'completado'),
            ])

            setTrasladosPendientesTotal(pend.count || 0)
            setTrasladosEnCursoTotal(enCurso.count || 0)
            setTrasladosCompletadosTotal(comp.count || 0)
        } catch (e) {
            console.error('Error cargando contadores de traslados', e)
        }
    }

    const cambiarEstadoTraslado = async (trasladoId: string, nuevoEstado: string) => {
        if (!perfil) return
        if (nuevoEstado === 'completado') {
            const confirmed = await confirmAction({
                title: 'Confirmar',
                text: '¿Confirmar marcar como completado? Esta accion bloqueara el traslado.',
                icon: 'warning',
                confirmButtonText: 'Si, completar',
            })
            if (!confirmed) return
        }
        setTraslados(prev => prev.map(t =>
            t.id === trasladoId ? { ...t, estado: nuevoEstado } : t
        ))

        const { error } = await supabase
            .from('traslados')
            .update({ estado: nuevoEstado })
            .eq('id', trasladoId)
            .eq('empresa_id', perfil.empresa_id)

        if (error) {
            showError('Error al actualizar: ' + error.message)
            if (perfil) await cargarTraslados(perfil.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
        } else {
            if (perfil) await cargarContadoresTraslados(perfil.empresa_id)
        }
    }

    const eliminarTraslado = async (trasladoId: string) => {
        if (!perfil) return
        const ok = await confirmDelete({
            title: 'Eliminar traslado',
            text: '¿Estas seguro de eliminar este traslado? Esta accion no se puede deshacer.',
        })
        if (!ok) return

        setTraslados(prev => prev.filter(t => t.id !== trasladoId))

        const traslado = traslados.find(t => t.id === trasladoId)
        if (traslado) {
            const { data: storageFiles } = await supabase.storage.from('fotos-traslados').list(trasladoId)
            if (storageFiles && storageFiles.length > 0) {
                await supabase.storage.from('fotos-traslados').remove(storageFiles.map(f => `${trasladoId}/${f.name}`))
            }
        }

        const { error } = await supabase
            .from('traslados')
            .delete()
            .eq('id', trasladoId)
            .eq('empresa_id', perfil.empresa_id)

        if (error) {
            showError('Error al eliminar: ' + error.message)
            if (perfil) await cargarTraslados(perfil.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
        } else {
            if (perfil) await cargarContadoresTraslados(perfil.empresa_id)
        }
    }

    const generarCodigoInvitacion = async () => {
        if (!perfil?.empresa_id) return
        setGenerandoCodigo(true)

        let codigo = '';
        if (isClient) {
            const arr = new Uint8Array(5);
            crypto.getRandomValues(arr);
            codigo = Array.from(arr, b => b.toString(36).padStart(2, '0')).join('').substring(0, 8).toUpperCase();
        }

        const { error } = await supabase.from('invitaciones').insert({
            empresa_id: perfil.empresa_id,
            codigo: codigo
        })

        if (error) {
            showError('Error al generar codigo: ' + error.message)
            setGenerandoCodigo(false)
            return
        }
        setCodigoInvitacion(codigo)
        if (isClient) {
            setLinkInvitacion(`${window.location.origin}/unirse/${codigo}`);
        } else {
            setLinkInvitacion('');
        }
        setGenerandoCodigo(false)
    }

    const copiarLink = async () => {
        if (!linkInvitacion) return;
        try {
            if (isClient && navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(linkInvitacion);
            } else if (isClient) {
                const textArea = document.createElement('textarea');
                textArea.value = linkInvitacion;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setLinkCopiado(true);
            timersRef.current.push(setTimeout(() => setLinkCopiado(false), 2000));
        } catch {
            showError('No se pudo copiar el link. Copialo manualmente: ' + linkInvitacion);
        }
    }

    const abrirModalInvitacion = () => {
        setCodigoInvitacion('')
        setLinkInvitacion('')
        setLinkCopiado(false)
        setModalAbierto(true)
    }

    const handleCerrarSesion = async () => {
        timersRef.current.push(setTimeout(() => {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem('email');
                window.localStorage.removeItem('user_id');
            }
        }, 0));
        await supabase.auth.signOut();
        router.push('/login');
    }

    if (checkingSession || loading) {
        return <PageSkeleton />
    }
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-6 py-4 shadow-sm">
                    <b>Error:</b> {error}
                </div>
            </div>
        );
    }
    if (!perfil) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-6 py-4 shadow-sm">
                    <b>No se pudo cargar el perfil del usuario.</b>
                </div>
            </div>
        );
    }

    const drawerItems = perfil?.rol === 'admin'
        ? [
            { icon: <Home className="w-5 h-5" />, label: 'Inicio', isActive: activeTab === 'inicio', onClick: () => setActiveTab('inicio') },
            { icon: <Car className="w-5 h-5" />, label: 'Traslados', isActive: activeTab === 'traslados', onClick: () => setActiveTab('traslados') },
            { icon: <Users className="w-5 h-5" />, label: 'Choferes', isActive: activeTab === 'choferes', onClick: () => setActiveTab('choferes') },
            { icon: <Receipt className="w-5 h-5" />, label: 'Gastos', isLink: true, href: '/dashboard/gastos', onClick: () => {} },
            { icon: <UserCog className="w-5 h-5" />, label: 'Modo Chofer', isLink: true, href: '/chofer', onClick: () => router.push('/chofer') },
        ]
        : [
            { icon: <Receipt className="w-5 h-5" />, label: 'Gastos', isLink: true, href: '/dashboard/gastos', onClick: () => {} },
            { icon: <UserCog className="w-5 h-5" />, label: 'Modo Chofer', isLink: true, href: '/chofer', onClick: () => router.push('/chofer') },
        ]

    const statCards = [
        {
            label: 'Total Traslados',
            value: trasladosTotal,
            icon: <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />,
            iconBg: 'bg-primary/10',
            iconColor: 'text-primary',
            valueColor: 'text-foreground',
        },
        {
            label: 'Pendientes',
            value: trasladosPendientesTotal,
            icon: <Clock className="w-5 h-5 sm:w-6 sm:h-6" />,
            iconBg: 'bg-yellow-500/10',
            iconColor: 'text-yellow-600 dark:text-yellow-400',
            valueColor: 'text-yellow-600 dark:text-yellow-400',
        },
        {
            label: 'En Curso',
            value: trasladosEnCursoTotal,
            icon: <Zap className="w-5 h-5 sm:w-6 sm:h-6" />,
            iconBg: 'bg-blue-500/10',
            iconColor: 'text-blue-600 dark:text-blue-400',
            valueColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            label: 'Completados',
            value: trasladosCompletadosTotal,
            icon: <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />,
            iconBg: 'bg-emerald-500/10',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            valueColor: 'text-emerald-600 dark:text-emerald-400',
        },
    ]

    const estadoConfig: Record<string, { bg: string; text: string; label: string }> = {
        pendiente: { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pendiente' },
        en_curso: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: 'En Curso' },
        completado: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Completado' },
    }

    const pagoConfig: Record<string, { bg: string; text: string; label: string }> = {
        pendiente: { bg: 'bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pendiente' },
        efectivo: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', label: 'Efectivo' },
        transferencia: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', label: 'Transfer.' },
    }

    return (
        <ErrorBoundary>
        <div className="min-h-screen bg-background">
            {/* Navbar */}
            <nav className="navbar sticky top-0 z-50">
                <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
                    <div className="flex items-center gap-3">
                        <button className="md:hidden mr-1 p-2 rounded-lg hover:bg-white/10 focus:outline-none transition" onClick={() => setDrawerOpen(true)} aria-label="Abrir menu">
                            <Menu className="w-5 h-5 text-white" />
                        </button>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                            <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <h1 className="text-white font-bold text-lg sm:text-xl tracking-tight">ViaGrua</h1>
                        {perfil?.nombre_completo && (
                            <span className="hidden sm:inline ml-2 text-xs text-white/80 font-semibold bg-white/10 px-2.5 py-1 rounded-lg max-w-[140px] truncate" title={perfil.nombre_completo}>
                                {perfil.nombre_completo}
                            </span>
                        )}
                    </div>
                    <div className="hidden md:flex gap-1">
                        {['Inicio', 'Traslados', 'Choferes'].map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())}
                                className={`px-4 lg:px-5 py-2 text-sm font-medium transition rounded-lg ${
                                    activeTab === tab.toLowerCase()
                                        ? 'bg-white/20 text-white'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                }`}>
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="hidden md:flex items-center gap-1.5">
                        <Link href="/dashboard/gastos" prefetch={true}
                            className="text-white/80 hover:text-white text-sm font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5">
                            <Receipt className="w-4 h-4" />
                            Gastos
                        </Link>
                        <button onClick={() => router.push('/chofer')}
                            className="text-white/80 hover:text-white text-sm font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5">
                            <UserCog className="w-4 h-4" />
                            Modo Chofer
                        </button>
                        <button onClick={handleCerrarSesion}
                            className="text-white text-sm font-medium px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg transition flex items-center gap-1.5">
                            <LogOut className="w-4 h-4" />
                            Salir
                        </button>
                        <ThemeToggle />
                    </div>
                </div>
            </nav>

            {/* Drawer lateral para mobile */}
            <MobileDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                items={[...drawerItems, { icon: <LogOut className="w-5 h-5" />, label: 'Salir', isDanger: true, onClick: handleCerrarSesion }]}
                userName={perfil?.nombre_completo}
            />

            {/* Content */}
            <div className="page-enter w-full min-w-0 px-3 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 mx-auto max-w-4xl lg:max-w-5xl">

                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-1">
                        Hola, {perfil?.nombre_completo?.split(' ')[0] || 'Admin'}
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">{empresa?.nombre}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    {statCards.map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${stat.iconBg} flex items-center justify-center mb-3`}>
                                <span className={stat.iconColor}>{stat.icon}</span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                            <p className={`text-xl sm:text-2xl lg:text-3xl font-bold mt-0.5 ${stat.valueColor}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Tab: Inicio */}
                {activeTab === 'inicio' && (
                    <>
                    {perfil?.rol === 'admin' && (
                        <div className="mb-6 sm:mb-8">
                            <DashboardCharts traslados={chartTraslados} gastos={gastos} />
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                        <button onClick={() => router.push('/dashboard/nuevo-traslado')}
                            className="group rounded-xl border border-border bg-card p-5 sm:p-6 text-left hover:border-primary/40 hover:shadow-md transition-all">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center mb-3 transition">
                                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                            </div>
                            <p className="font-semibold text-base text-foreground group-hover:text-primary transition">Nuevo Traslado</p>
                            <p className="text-sm text-muted-foreground mt-0.5">Crear y asignar un nuevo servicio</p>
                        </button>

                        <button onClick={() => abrirModalInvitacion()}
                            className="group rounded-xl border border-border bg-card p-5 sm:p-6 text-left hover:border-blue-500/40 hover:shadow-md transition-all">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/15 flex items-center justify-center mb-3 transition">
                                <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="font-semibold text-base text-foreground transition">Invitar Chofer</p>
                            <p className="text-sm text-muted-foreground mt-0.5">Generar link de invitacion</p>
                        </button>
                    </div>
                    </>
                )}

                {/* Tab: Traslados */}
                {activeTab === 'traslados' && (
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
                            <div>
                                <h3 className="font-semibold text-lg text-foreground">Lista de Traslados</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <button
                                        onClick={() => { setFiltroTrasladosPendientes(!filtroTrasladosPendientes); setTrasladosPage(1) }}
                                        className={`filter-btn inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
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
                                        className={`filter-btn inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
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
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <a
                                    href="/api/export/empresa"
                                    className="btn-secondary px-4 py-2 text-sm text-center whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                                >
                                    <Download className="w-4 h-4" />
                                    Exportar CSV
                                </a>
                                <button
                                    onClick={() => router.push('/dashboard/nuevo-traslado')}
                                    className="btn-primary px-4 py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nuevo Traslado
                                </button>
                            </div>
                        </div>

                        {traslados.length === 0 ? (
                            <EmptyState message="No hay traslados registrados" />
                        ) : (
                            <div className="space-y-2 animate-stagger">
                                {traslados.map((traslado) => {
                                    const estado = estadoConfig[traslado.estado] || estadoConfig.pendiente
                                    const pago = pagoConfig[traslado.estado_pago] || pagoConfig.pendiente
                                    return (
                                    <div key={traslado.id} className="rounded-lg border border-border hover:border-border/80 hover:bg-accent/30 p-3 sm:p-4 transition group">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                            <div
                                                className="flex-1 cursor-pointer min-w-0"
                                                onClick={() => router.push(`/dashboard/traslado/${traslado.id}`)}
                                            >
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">{traslado.marca_modelo}</h4>
                                                    {traslado.es_0km && (
                                                        <span className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium shrink-0">0 KM</span>
                                                    )}
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition shrink-0 ml-auto lg:ml-0" />
                                                </div>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    {traslado.matricula && <span className="flex items-center gap-1"><span className="text-muted-foreground/50">#</span> {traslado.matricula}</span>}
                                                    {traslado.importe_total != null && (
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="font-medium text-foreground">${traslado.importe_total.toLocaleString('es-AR')}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pago.bg} ${pago.text}`}>
                                                                {pago.label}
                                                            </span>
                                                        </span>
                                                    )}
                                                    <span>{traslado.perfiles?.nombre_completo || 'Sin asignar'}</span>
                                                    <ClientOnly>{traslado.created_at ? new Date(traslado.created_at).toLocaleDateString() : ''}</ClientOnly>
                                                </div>
                                                {traslado.observaciones && (
                                                    <p className="text-xs text-muted-foreground/60 mt-1.5 italic line-clamp-1">&ldquo;{traslado.observaciones}&rdquo;</p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <select
                                                    value={traslado.estado}
                                                    onChange={(e) => cambiarEstadoTraslado(traslado.id, e.target.value)}
                                                    disabled={traslado.estado === 'completado'}
                                                    className={`text-xs font-medium px-3 py-2 rounded-lg border cursor-pointer transition ${estado.bg} ${estado.text} ${traslado.estado === 'completado' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    <option value="pendiente">Pendiente</option>
                                                    <option value="en_curso">En Curso</option>
                                                    <option value="completado">Completado</option>
                                                </select>
                                                <button
                                                    onClick={() => eliminarTraslado(traslado.id)}
                                                    className="p-2 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                                                    title="Eliminar traslado"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
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
                )}

                {/* Choferes */}
                {(activeTab === 'inicio' || activeTab === 'choferes') && (
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
                            <h3 className="font-semibold text-lg text-foreground">Equipo de Choferes</h3>
                            <button onClick={() => abrirModalInvitacion()}
                                className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1.5">
                                <UserPlus className="w-4 h-4" />
                                Invitar Chofer
                            </button>
                        </div>
                        {choferes.length === 0 ? (
                            <EmptyState message="No hay choferes registrados" />
                        ) : (
                            <div className="space-y-2">
                                {choferes.map((chofer) => (
                                    <div key={chofer.id} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/30 transition">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary text-white flex items-center justify-center text-sm font-semibold shrink-0">
                                                {chofer.nombre_completo.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-foreground truncate">{chofer.nombre_completo}</p>
                                                <p className="text-xs text-muted-foreground truncate">{chofer.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                                Activo
                                            </span>
                                            <button
                                                onClick={() => expulsarChofer(chofer.id, chofer.nombre_completo)}
                                                className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-lg transition text-xs font-medium"
                                                title="Expulsar chofer"
                                            >
                                                Expulsar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Invitacion */}
            {modalAbierto && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setModalAbierto(false) }} style={{ padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                    <div className="bg-card border border-border w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 shadow-xl animate-scaleIn">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-foreground">Invitar Chofer</h3>
                            <button onClick={() => setModalAbierto(false)} className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-accent rounded-lg transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {!codigoInvitacion ? (
                            <div className="text-center">
                                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                    <Mail className="w-7 h-7 text-primary" />
                                </div>
                                <p className="text-muted-foreground text-sm mb-6">
                                    Genera un codigo de invitacion para que un chofer se una a tu equipo
                                </p>
                                <button
                                    onClick={generarCodigoInvitacion}
                                    disabled={generandoCodigo}
                                    className="btn-primary w-full py-3 text-sm"
                                >
                                    {generandoCodigo ? 'Generando...' : 'Generar Invitacion'}
                                </button>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Codigo de invitacion</p>
                                <p className="text-2xl font-bold text-primary mb-5 tracking-widest font-mono">{codigoInvitacion}</p>

                                {isClient && linkInvitacion && (
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(linkInvitacion)}`}
                                        alt="QR Code"
                                        className="w-36 h-36 mx-auto mb-4 rounded-lg"
                                    />
                                )}

                                <p className="text-xs text-muted-foreground mb-3">El chofer puede escanear el QR o usar el link</p>

                                <div className="bg-muted rounded-lg p-3 mb-5">
                                    <p className="text-xs text-muted-foreground break-all font-mono">{isClient && linkInvitacion ? linkInvitacion : ''}</p>
                                </div>

                                <button
                                    onClick={copiarLink}
                                    className={`w-full py-3 text-sm font-medium rounded-xl transition inline-flex items-center justify-center gap-2 ${
                                        linkCopiado
                                            ? 'bg-emerald-500 text-white'
                                            : 'btn-primary'
                                    }`}
                                >
                                    {linkCopiado ? <><Check className="w-4 h-4" /> Link Copiado</> : <><Copy className="w-4 h-4" /> Copiar Link</>}
                                </button>

                                <p className="text-[10px] text-muted-foreground mt-4">
                                    Este codigo expira en 7 dias y solo puede usarse una vez
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
        </ErrorBoundary>
    )
}
