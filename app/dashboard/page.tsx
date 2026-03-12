'use client'
import { useState, useEffect } from 'react'
import ClientOnly from '../components/ClientOnly'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmDelete, confirmAction, showError } from '@/lib/swal'

interface Perfil {
    id: string;
    nombre_completo: string;
    rol: string;
    empresa_id: string;
    email?: string;
    plan?: string;
    traslados_mes_actual?: number;
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
    // --- Lógica de planes y bloqueo traslados ---
    const PLANES: Record<string, { traslados_max: number | null, puede_agregar_personas: boolean }> = {
        free: { traslados_max: 30, puede_agregar_personas: false },
        premium: { traslados_max: null, puede_agregar_personas: true },
        admin: { traslados_max: null, puede_agregar_personas: true },
    };
    const planKey = perfil?.plan || 'free';
    const planInfo = PLANES[planKey];
    const trasladosMax = planInfo.traslados_max;
    const trasladosUsados = perfil?.traslados_mes_actual || 0;
    const trasladosRestantes = trasladosMax !== null ? Math.max(trasladosMax - trasladosUsados, 0) : null;
    // Solo bloquear traslados si es free y llegó al límite
    const bloqueoTraslados = planKey === 'free' && trasladosRestantes === 0;
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

    // Validar sesión al montar el componente
    useEffect(() => {
        let isMounted = true;
        async function checkSession() {
            setCheckingSession(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (isMounted) {
                    setCheckingSession(false);
                    setError('No hay sesión activa. Redirigiendo a login...');
                    setTimeout(() => router.replace('/login'), 1000);
                }
                return;
            }
            // Si hay usuario, cargar datos normales
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

    // Suscripción en tiempo real para nuevos choferes
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
                    // Recargar cuando alguien se une o sale de nuestra empresa
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

    // Cuando se navega a la pestaña 'traslados', cambia la página o el filtro, recargar lista
    useEffect(() => {
        if (activeTab === 'traslados' && perfil?.empresa_id) {
            cargarTraslados(perfil.empresa_id, trasladosPage, filtroTrasladosPendientes, filtroPagosPendientes)
        }
    }, [activeTab, trasladosPage, perfil?.empresa_id, filtroTrasladosPendientes, filtroPagosPendientes])

    // Hooks y funciones definidos más abajo — el render principal está al final del archivo

    const cargarDatos = async () => {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw new Error(userError.message);
            if (!user) {
                setError('No se detectó usuario autenticado. Revisa si la cookie de sesión se está guardando correctamente.');
                router.push('/login');
                return;
            }

            const { data: perfilData, error: perfilError } = await supabase
                .from('perfiles').select('id, nombre_completo, rol, empresa_id, email, plan, traslados_mes_actual').eq('id', user.id).single();
            if (perfilError) throw new Error(perfilError.message);
            if (!perfilData) { router.push('/login'); return; }

            setPerfil(perfilData);
            // Guardar email y user_id en localStorage para el flujo de pago SOLO en cliente
            // Guardar email y user_id en localStorage SOLO en cliente después del render
            if (perfilData?.email && perfilData?.id) {
                setTimeout(() => {
                    if (typeof window !== 'undefined') {
                        window.localStorage.setItem('email', perfilData.email!);
                        window.localStorage.setItem('user_id', perfilData.id);
                    }
                }, 0);
            }

            // Cargar empresa, choferes y traslados en paralelo
            const [empresaResult] = await Promise.all([
                supabase.from('empresas').select('*').eq('id', perfilData.empresa_id).single(),
                cargarChoferes(perfilData.empresa_id),
                cargarTraslados(perfilData.empresa_id, 1),
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

    const expulsarChofer = async (choferId: string, nombreChofer: string) => {
        const ok = await confirmDelete({
            title: 'Expulsar chofer',
            text: `¿Estás seguro de expulsar a ${nombreChofer}? Esta acción no se puede deshacer.`,
            confirmButtonText: 'Sí, expulsar',
        })
        if (!ok) return

        // Actualización optimista
        setChoferes(prev => prev.filter(c => c.id !== choferId))

        // Usar función RPC segura
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

        // Ejecutar query principal y contadores en paralelo
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
        if (nuevoEstado === 'completado') {
            const confirmed = await confirmAction({
                title: 'Confirmar',
                text: '¿Confirmar marcar como completado? Esta acción bloqueará el traslado.',
                icon: 'warning',
                confirmButtonText: 'Sí, completar',
            })
            if (!confirmed) return
        }
        // Actualización optimista - cambiar UI inmediatamente
        setTraslados(prev => prev.map(t => 
            t.id === trasladoId ? { ...t, estado: nuevoEstado } : t
        ))

        // Luego actualizar en la base de datos
        const { error } = await supabase
            .from('traslados')
            .update({ estado: nuevoEstado })
            .eq('id', trasladoId)

        // Si hay error, revertir
        if (error) {
            showError('Error al actualizar: ' + error.message)
            if (perfil) await cargarTraslados(perfil.empresa_id, trasladosPage)
        } else {
            if (perfil) await cargarContadoresTraslados(perfil.empresa_id)
        }
    }

    const eliminarTraslado = async (trasladoId: string) => {
        const ok = await confirmDelete({
            title: 'Eliminar traslado',
            text: '¿Estás seguro de eliminar este traslado? Esta acción no se puede deshacer.',
        })
        if (!ok) return

        // Actualización optimista - quitar de la lista inmediatamente
        setTraslados(prev => prev.filter(t => t.id !== trasladoId))

        // Primero eliminar fotos del storage si existen
        const traslado = traslados.find(t => t.id === trasladoId)
        if (traslado) {
            // Intentar eliminar carpeta de fotos
            await supabase.storage.from('fotos-traslados').remove([`${trasladoId}/`])
        }

        const { error } = await supabase
            .from('traslados')
            .delete()
            .eq('id', trasladoId)

        if (error) {
            showError('Error al eliminar: ' + error.message)
            if (perfil) await cargarTraslados(perfil.empresa_id, trasladosPage)
        } else {
            if (perfil) await cargarContadoresTraslados(perfil.empresa_id)
        }
    }

    const generarCodigoInvitacion = async () => {
        if (!perfil?.empresa_id) return
        setGenerandoCodigo(true)
        
        // Generar código solo en cliente
        let codigo = '';
        if (isClient) {
            codigo = Math.random().toString(36).substring(2, 10).toUpperCase();
        }
        
        const { error } = await supabase.from('invitaciones').insert({
            empresa_id: perfil.empresa_id,
            codigo: codigo
        })

        if (error) {
            showError('Error al generar código: ' + error.message)
            setGenerandoCodigo(false)
            return
        }
        setCodigoInvitacion(codigo)
        // Generar link solo en cliente
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
                // Fallback para navegadores inseguros
                const textArea = document.createElement('textarea');
                textArea.value = linkInvitacion;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setLinkCopiado(true);
            setTimeout(() => setLinkCopiado(false), 2000);
        } catch (err) {
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
        // Limpiar email y user_id de localStorage al cerrar sesión SOLO en cliente
        setTimeout(() => {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem('email');
                window.localStorage.removeItem('user_id');
            }
        }, 0);
        await supabase.auth.signOut();
        router.push('/login');
    }

    if (checkingSession || loading) {
        return (
            <div className="page-bg flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-orange-200 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full absolute top-0 left-0 animate-spin"></div>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-700 font-semibold">Cargando</p>
                        <p className="text-gray-400 text-sm">Verificando sesión y cargando datos...</p>
                    </div>
                </div>
            </div>
        )
    }
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="bg-red-100 text-red-700 px-6 py-4 rounded shadow">
                    <b>Error:</b> {error}
                </div>
            </div>
        );
    }
    if (!perfil) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="bg-yellow-100 text-yellow-700 px-6 py-4 rounded shadow">
                    <b>No se pudo cargar el perfil del usuario.</b>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
        {/* ...resto del dashboard... */}
            {/* Navbar - Responsive */}
            {/* Navbar con menú hamburger en mobile */}
            <nav className="navbar sticky top-0 z-50">
                <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
                    <div className="flex items-center gap-3">
                        {/* Hamburger solo en mobile */}
                        <button className="md:hidden mr-2 p-2 rounded-lg hover:bg-white/10 focus:outline-none" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                            </svg>
                        </div>
                        <h1 className="text-white font-bold text-lg sm:text-xl tracking-tight">ViaGrua</h1>
                        {perfil?.nombre_completo && (
                            <span className="ml-2 text-xs text-white/80 font-semibold bg-white/10 px-2 py-0.5 rounded-lg max-w-[120px] truncate" title={perfil.nombre_completo}>
                                {perfil.nombre_completo}
                            </span>
                        )}
                    </div>
                    {/* Tabs principales: solo visibles en md+ (ocultos en mobile) */}
                    <div className="hidden md:flex gap-1.5">
                        {['Inicio', 'Traslados', 'Choferes'].map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())}
                                className={`px-4 lg:px-5 py-2 text-sm font-medium transition rounded-lg ${
                                    activeTab === tab.toLowerCase() 
                                        ? 'bg-white/20 text-white' 
                                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}>
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
                        <button onClick={() => router.push('/dashboard/gastos')} 
                            className="text-white/90 hover:text-white text-sm font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5"
                            title="Gastos de la empresa">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Gastos
                        </button>
                        <button onClick={() => router.push('/chofer')} 
                            className="text-white/90 hover:text-white text-sm font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5"
                            title="Ver mis traslados como chofer">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Modo Chofer
                        </button>
                        <button onClick={handleCerrarSesion} 
                            className="text-white text-sm font-medium px-3 sm:px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg transition">
                            Salir
                        </button>
                    </div>
                </div>
            </nav>

            {/* Drawer lateral para mobile */}
            {/* Drawer solo visible en mobile (md:hidden) */}
            {drawerOpen && (
                <div className="fixed inset-0 z-[100] flex md:hidden">
                    {/* Fondo oscuro */}
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
                    {/* Drawer */}
                    <div className="relative bg-white w-64 max-w-[80vw] h-full shadow-xl animate-slideInLeft p-6 flex flex-col">
                        <div className="flex items-center mb-8">
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-2">
                                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                                </svg>
                            </div>
                            <span className="font-bold text-lg text-orange-600">ViaGrua</span>
                        </div>
                        <nav className="flex flex-col gap-2">
                            {/* Si es admin, muestra todas las opciones; si es chofer solo Gastos y Modo Chofer */}
                            {perfil?.rol === 'admin' ? (
                                <>
                                    <button onClick={() => { setActiveTab('inicio'); setDrawerOpen(false); }} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeTab==='inicio'?'bg-orange-50 text-orange-600':'text-gray-700 hover:bg-gray-50'}`}>🏠 Inicio</button>
                                    <button onClick={() => { setActiveTab('traslados'); setDrawerOpen(false); }} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeTab==='traslados'?'bg-orange-50 text-orange-600':'text-gray-700 hover:bg-gray-50'}`}>🚗 Traslados</button>
                                    <button onClick={() => { setActiveTab('choferes'); setDrawerOpen(false); }} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeTab==='choferes'?'bg-orange-50 text-orange-600':'text-gray-700 hover:bg-gray-50'}`}>👥 Choferes</button>
                                    <button onClick={() => { router.push('/dashboard/gastos'); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition text-gray-700 hover:bg-gray-50">💸 Gastos</button>
                                    <button onClick={() => { router.push('/chofer'); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition text-gray-700 hover:bg-gray-50">🧑‍✈️ Modo Chofer</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => { router.push('/dashboard/gastos'); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition text-gray-700 hover:bg-gray-50">💸 Gastos</button>
                                    <button onClick={() => { router.push('/chofer'); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition text-gray-700 hover:bg-gray-50">🧑‍✈️ Modo Chofer</button>
                                </>
                            )}
                            <button onClick={() => { handleCerrarSesion(); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition text-red-600 hover:bg-red-50">🚪 Salir</button>
                        </nav>
                        {perfil?.nombre_completo && (
                            <div className="mt-8 text-xs text-gray-400">
                                <span className="font-semibold">{perfil.nombre_completo}</span>
                            </div>
                        )}

                        

                        
                    </div>
                </div>
            )}

            {/* Tabs Mobile eliminados: navegación solo por drawer en mobile */}

            {/* Content - Responsive */}
            <div className="w-full min-w-0 px-3 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 mx-auto max-w-4xl lg:max-w-5xl">

                {/* Header */}
                <div className="mb-8 sm:mb-10">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1">
                        Hola, {perfil?.nombre_completo?.split(' ')[0] || 'Admin'}
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500">{empresa?.nombre}</p>
                    {/* Traslados usados solo para plan free y cuando perfil cargado */}
                    {/* Solo mostrar traslados usados si es plan free y perfil cargado */}
                    {perfil && planKey === 'free' && (
                        <div className="mt-2 text-xs sm:text-sm bg-yellow-50 text-yellow-800 rounded px-2 py-1 inline-block">
                            Traslados usados este mes: <b>{trasladosUsados}</b> / {trasladosMax}
                            {bloqueoTraslados && (
                                <span className="block text-red-600 font-bold mt-1">¡Has alcanzado el límite de traslados este mes!</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Banner Upgrade Premium - Solo para plan Free */}
                {planKey === 'free' && (
                    <div className="mb-6 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                        <div className="text-white text-center sm:text-left">
                            <p className="font-bold text-sm sm:text-base">Desbloqueá traslados ilimitados y más funciones</p>
                            <p className="text-white/80 text-xs sm:text-sm mt-0.5">Agregá choferes, sin límites mensuales. Desde $15 USD/mes.</p>
                        </div>
                        <button
                            onClick={() => router.push('/planes')}
                            className="shrink-0 px-5 py-2 bg-white text-orange-600 font-bold text-sm rounded-lg hover:bg-orange-50 transition shadow"
                        >
                            Ver planes
                        </button>
                    </div>
                )}

                {/* Stats Grid - Dinámico */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-8 sm:mb-10">
                    <div className="card p-4 sm:p-5 lg:p-6">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-3">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wide">Total Traslados</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1">{trasladosTotal}</p>
                    </div>
                    <div className="card p-4 sm:p-5 lg:p-6">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-100 flex items-center justify-center mb-3">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wide">Pendientes</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-600 mt-1">
                            {trasladosPendientesTotal}
                        </p>
                    </div>
                    <div className="card p-4 sm:p-5 lg:p-6">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wide">En Curso</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600 mt-1">
                            {trasladosEnCursoTotal}
                        </p>
                    </div>
                    <div className="card p-4 sm:p-5 lg:p-6">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-100 flex items-center justify-center mb-3">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wide">Completados</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600 mt-1">
                            {trasladosCompletadosTotal}
                        </p>
                    </div>
                </div>

                {/* Botones Acción - Solo en Inicio */}
                {activeTab === 'inicio' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">
                        <button onClick={() => { if (!bloqueoTraslados) router.push('/dashboard/nuevo-traslado') }}
                            className={`card p-5 sm:p-6 lg:p-8 text-left transition-all group ${bloqueoTraslados ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg active:shadow-md cursor-pointer'}`}>
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center mb-4 transition">
                                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <p className="font-semibold text-base sm:text-lg text-gray-900 group-hover:text-orange-600 transition">Nuevo Traslado</p>
                            <p className="text-sm text-gray-500 mt-1">Crear y asignar un nuevo servicio</p>
                        </button>
                        
                        <button onClick={() => abrirModalInvitacion()}
                            className={`card p-5 sm:p-6 lg:p-8 text-left transition-all group ${planKey === 'free' ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg active:shadow-md cursor-pointer'}`}
                            disabled={planKey === 'free'}
                            title={planKey === 'free' ? 'Disponible solo en planes pagos (Premium/Admin)' : ''}>
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center mb-4 transition">
                                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                            </div>
                            <p className="font-semibold text-base sm:text-lg text-gray-900 transition">Invitar Chofer</p>
                            <p className="text-sm text-gray-500 mt-1">Generar link de invitación</p>
                        </button>
                    </div>
                )}

                {/* Vista Traslados */}
                {activeTab === 'traslados' && (
                    <div className="card p-4 sm:p-6 lg:p-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h3 className="font-semibold text-lg sm:text-xl text-gray-900">Lista de Traslados</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <button
                                        onClick={() => { setFiltroTrasladosPendientes(!filtroTrasladosPendientes); setTrasladosPage(1) }}
                                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                                            filtroTrasladosPendientes
                                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${filtroTrasladosPendientes ? 'bg-yellow-500' : 'bg-gray-400'}`}></span>
                                        Traslados Pendientes
                                    </button>
                                    <button
                                        onClick={() => { setFiltroPagosPendientes(!filtroPagosPendientes); setTrasladosPage(1) }}
                                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                                            filtroPagosPendientes
                                                ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${filtroPagosPendientes ? 'bg-orange-500' : 'bg-gray-400'}`}></span>
                                        Pagos Pendientes
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => { if (!bloqueoTraslados) router.push('/dashboard/nuevo-traslado') }}
                                className={`btn-primary px-5 py-2.5 text-sm ${bloqueoTraslados ? 'opacity-60 cursor-not-allowed' : ''}`}
                                title={bloqueoTraslados ? 'Límite de traslados alcanzado' : ''}
                            >
                                + Nuevo Traslado
                            </button>
                        </div>
                        
                        {traslados.length === 0 ? (
                            <div className="text-center py-12 sm:py-16">
                                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                </div>
                                <p className="text-gray-500 text-sm sm:text-base">No hay traslados registrados</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {traslados.map((traslado) => (
                                    <div key={traslado.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-gray-200 transition">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                            {/* Info del traslado - Clickeable */}
                                            <div 
                                                className="flex-1 cursor-pointer hover:opacity-80"
                                                onClick={() => router.push(`/dashboard/traslado/${traslado.id}`)}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h4 className="font-semibold text-base text-gray-900">{traslado.marca_modelo}</h4>
                                                    {traslado.es_0km && (
                                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">0 KM</span>
                                                    )}
                                                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500">
                                                    {traslado.matricula && <span className="flex items-center gap-1"><span className="text-gray-400">#</span> {traslado.matricula}</span>}
                                                    {traslado.importe_total && (
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="font-medium text-gray-700">${traslado.importe_total}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                                traslado.estado_pago === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                                                                traslado.estado_pago === 'efectivo' ? 'bg-green-100 text-green-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            }`}>
                                                                {traslado.estado_pago === 'pendiente' ? 'Pendiente' : 
                                                                 traslado.estado_pago === 'efectivo' ? 'Efectivo' : 'Transfer.'}
                                                            </span>
                                                        </span>
                                                    )}
                                                    <span>{traslado.perfiles?.nombre_completo || 'Sin asignar'}</span>
                                                    <ClientOnly>{traslado.created_at ? new Date(traslado.created_at).toLocaleDateString() : ''}</ClientOnly>
                                                </div>
                                                {traslado.observaciones && (
                                                    <p className="text-xs text-gray-400 mt-2 italic line-clamp-1">"{traslado.observaciones}"</p>
                                                )}
                                            </div>
                                            
                                            {/* Controles */}
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={traslado.estado}
                                                    onChange={(e) => cambiarEstadoTraslado(traslado.id, e.target.value)}
                                                    disabled={traslado.estado === 'completado'}
                                                    className={`text-xs sm:text-sm font-medium px-3 py-2 rounded-lg border cursor-pointer transition ${
                                                        traslado.estado === 'pendiente'
                                                            ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                                            : traslado.estado === 'en_curso'
                                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                            : 'bg-green-50 border-green-200 text-green-700'
                                                    } ${traslado.estado === 'completado' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <option value="pendiente">Pendiente</option>
                                                    <option value="en_curso">En Curso</option>
                                                    <option value="completado">Completado</option>
                                                </select>
                                                <button
                                                    onClick={() => eliminarTraslado(traslado.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                    title="Eliminar traslado"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Paginación — responsive */}
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="text-sm text-gray-500 order-2 sm:order-1">
                                Mostrando {traslados.length > 0 ? ((trasladosPage - 1) * ITEMS_PER_PAGE) + 1 : 0} - {Math.min(trasladosPage * ITEMS_PER_PAGE, trasladosTotal)} de {trasladosTotal}
                            </div>
                            <div className="pagination-controls flex flex-wrap items-center justify-center sm:justify-end gap-2 order-1 sm:order-2">
                                <button
                                    onClick={async () => {
                                        const newPage = Math.max(1, trasladosPage - 1)
                                        setTrasladosPage(newPage)
                                        if (perfil) await cargarTraslados(perfil.empresa_id, newPage)
                                    }}
                                    disabled={trasladosPage <= 1}
                                    className="px-3 py-1 rounded-lg border bg-white text-sm disabled:opacity-50 btn-sm"
                                >
                                    Anterior
                                </button>
                                <span className="text-sm text-gray-600">Página {trasladosPage} / {Math.max(1, Math.ceil(trasladosTotal / ITEMS_PER_PAGE))}</span>
                                <button
                                    onClick={async () => {
                                        const maxPage = Math.max(1, Math.ceil(trasladosTotal / ITEMS_PER_PAGE))
                                        const newPage = Math.min(maxPage, trasladosPage + 1)
                                        setTrasladosPage(newPage)
                                        if (perfil) await cargarTraslados(perfil.empresa_id, newPage)
                                    }}
                                    disabled={trasladosPage >= Math.max(1, Math.ceil(trasladosTotal / ITEMS_PER_PAGE))}
                                    className="px-3 py-1 rounded-lg border bg-white text-sm disabled:opacity-50 btn-sm"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabla Choferes - Solo en Inicio o Choferes */}
                {(activeTab === 'inicio' || activeTab === 'choferes') && (
                    <div className="card p-4 sm:p-6 lg:p-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                            <h3 className="font-semibold text-lg sm:text-xl text-gray-900">Equipo de Choferes</h3>
                            <button onClick={() => { if (planInfo.puede_agregar_personas) abrirModalInvitacion() }}
                                className={`btn-secondary px-5 py-2.5 text-sm ${!planInfo.puede_agregar_personas ? 'opacity-60 cursor-not-allowed' : ''}`}
                                disabled={!planInfo.puede_agregar_personas}
                                title={!planInfo.puede_agregar_personas ? 'Disponible solo en planes pagos' : ''}>
                                + Invitar Chofer
                            </button>
                        </div>
                        {choferes.length === 0 ? (
                            <div className="text-center py-12 sm:py-16">
                                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <p className="text-gray-500 text-sm sm:text-base">No hay choferes registrados</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto -mx-4 sm:mx-0">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-gray-100 bg-gray-50/50">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Nombre</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Email</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Estado</th>
                                            <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {choferes.map((chofer) => (
                                            <tr key={chofer.id} className="hover:bg-gray-50/50 transition">
                                                <td className="py-3 px-4 text-gray-900">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center text-xs sm:text-sm font-semibold">
                                                            {chofer.nombre_completo.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-medium truncate">{chofer.nombre_completo}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-gray-500 hidden sm:table-cell truncate">{chofer.email}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                                        Activo
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        onClick={() => expulsarChofer(chofer.id, chofer.nombre_completo)}
                                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition text-xs font-medium"
                                                        title="Expulsar chofer"
                                                    >
                                                        Expulsar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Invitación */}
            {modalAbierto && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="card w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 sm:p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Invitar Chofer</h3>
                            <button onClick={() => setModalAbierto(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {!codigoInvitacion ? (
                            // Paso 1: Generar código
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-5">
                                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-gray-600 text-sm mb-6">
                                    Genera un código de invitación para que un chofer se una a tu equipo
                                </p>
                                <button 
                                    onClick={generarCodigoInvitacion} 
                                    disabled={generandoCodigo}
                                    className="btn-primary w-full py-3 text-sm"
                                >
                                    {generandoCodigo ? 'Generando...' : 'Generar Invitación'}
                                </button>
                            </div>
                        ) : (
                            // Paso 2: Mostrar QR y Link
                            <div className="text-center">
                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Código de invitación</p>
                                <p className="text-2xl font-bold text-orange-600 mb-5 tracking-widest font-mono">{codigoInvitacion}</p>
                                
                                {/* QR Code */}
                                {isClient && linkInvitacion && (
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(linkInvitacion)}`}
                                        alt="QR Code"
                                        className="w-40 h-40 mx-auto mb-4"
                                    />
                                )}

                                <p className="text-xs text-gray-400 mb-4">El chofer puede escanear el QR o usar el link</p>

                                {/* Link */}
                                <div className="bg-gray-50 rounded-lg p-3 mb-5">
                                    <p className="text-xs text-gray-600 break-all font-mono">{isClient && linkInvitacion ? linkInvitacion : ''}</p>
                                </div>

                                <button 
                                    onClick={copiarLink}
                                    className={`w-full py-3 text-sm font-medium rounded-xl transition ${
                                        linkCopiado 
                                            ? 'bg-green-500 text-white' 
                                            : 'btn-primary'
                                    }`}
                                >
                                    {linkCopiado ? 'Link Copiado' : 'Copiar Link'}
                                </button>

                                <p className="text-[10px] text-gray-400 mt-5">
                                    Este código expira en 7 días y solo puede usarse una vez
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}