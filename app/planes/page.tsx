'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { confirmAction, showError } from '@/lib/swal'

interface Perfil {
    id: string
    plan: string
    mp_subscription_id: string | null
}

export default function PlanesPage() {
    return (
        <Suspense fallback={
            <div className="page-bg flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-orange-200 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full absolute top-0 left-0 animate-spin"></div>
                    </div>
                    <p className="text-gray-700 font-semibold">Cargando planes...</p>
                </div>
            </div>
        }>
            <PlanesContent />
        </Suspense>
    )
}

function PlanesContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [perfil, setPerfil] = useState<Perfil | null>(null)
    const [loading, setLoading] = useState(true)
    const [procesando, setProcesando] = useState(false)

    const statusParam = searchParams?.get('status') ?? null

    useEffect(() => {
        cargarPerfil()
    }, [])

    const cargarPerfil = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data } = await supabase
            .from('perfiles')
            .select('id, plan, mp_subscription_id')
            .eq('id', user.id)
            .single()

        if (!data) { router.push('/login'); return }
        setPerfil(data)
        setLoading(false)
    }

    const handleUpgrade = async () => {
        setProcesando(true)
        try {
            const res = await fetch('/api/mercadopago/subscribe', { method: 'POST' })
            const data = await res.json()

            if (!res.ok) {
                showError(data.error || 'Error al crear suscripción')
                setProcesando(false)
                return
            }

            // Redirigir al checkout de Mercado Pago
            window.location.href = data.init_point
        } catch {
            showError('Error de conexión')
            setProcesando(false)
        }
    }

    const handleCancel = async () => {
        const ok = await confirmAction({
            title: 'Cancelar suscripción',
            text: '¿Estás seguro? Perderás acceso a las funciones Premium y volverás al plan Free.',
            icon: 'warning',
            confirmButtonText: 'Sí, cancelar',
        })
        if (!ok) return

        setProcesando(true)
        try {
            const res = await fetch('/api/mercadopago/cancel', { method: 'POST' })
            const data = await res.json()

            if (!res.ok) {
                showError(data.error || 'Error al cancelar')
                setProcesando(false)
                return
            }

            // Recargar perfil
            await cargarPerfil()
            setProcesando(false)
        } catch {
            showError('Error de conexión')
            setProcesando(false)
        }
    }

    if (loading) {
        return (
            <div className="page-bg flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-orange-200 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full absolute top-0 left-0 animate-spin"></div>
                    </div>
                    <p className="text-gray-700 font-semibold">Cargando planes...</p>
                </div>
            </div>
        )
    }

    const isPremium = perfil?.plan === 'premium' || perfil?.plan === 'admin'

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navbar simple */}
            <nav className="navbar sticky top-0 z-50">
                <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                            </svg>
                        </div>
                        <h1 className="text-white font-bold text-lg sm:text-xl tracking-tight">ViaGrua</h1>
                    </div>
                    <button onClick={() => router.push('/dashboard')}
                        className="text-white text-sm font-medium px-3 sm:px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg transition">
                        Volver al Dashboard
                    </button>
                </div>
            </nav>

            <div className="w-full min-w-0 px-3 sm:px-6 lg:px-8 py-8 sm:py-12 mx-auto max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8 sm:mb-12">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                        Elegí tu plan
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500">
                        Potenciá tu empresa con las herramientas que necesitás
                    </p>
                </div>

                {/* Mensaje de estado pendiente */}
                {statusParam === 'pending' && (
                    <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                        <p className="text-yellow-800 font-medium">
                            Tu pago está siendo procesado. Recibirás una confirmación pronto.
                        </p>
                        <p className="text-yellow-600 text-sm mt-1">
                            Si ya aprobaste el pago, puede demorar unos minutos en activarse.
                        </p>
                    </div>
                )}

                {/* Plans Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                    {/* Plan Free */}
                    <div className={`card p-6 sm:p-8 relative ${!isPremium ? 'ring-2 ring-orange-300' : ''}`}>
                        {!isPremium && (
                            <span className="absolute -top-3 left-6 bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
                                Plan actual
                            </span>
                        )}
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Free</h2>
                        <div className="mb-6">
                            <span className="text-3xl sm:text-4xl font-bold text-gray-900">$0</span>
                            <span className="text-gray-500 text-sm">/mes</span>
                        </div>
                        <ul className="space-y-3 mb-8">
                            <li className="flex items-start gap-2 text-sm text-gray-600">
                                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Hasta 30 traslados por mes
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-600">
                                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Registro de gastos
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-600">
                                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Fotos en traslados
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-400">
                                <svg className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Agregar choferes
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-400">
                                <svg className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Traslados ilimitados
                            </li>
                        </ul>
                        {!isPremium && (
                            <div className="text-center text-sm text-gray-400 font-medium">Plan actual</div>
                        )}
                    </div>

                    {/* Plan Premium */}
                    <div className={`card p-6 sm:p-8 relative border-2 ${isPremium ? 'ring-2 ring-orange-300' : 'border-orange-200'}`}>
                        {isPremium && (
                            <span className="absolute -top-3 left-6 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                Plan actual
                            </span>
                        )}
                        {!isPremium && (
                            <span className="absolute -top-3 left-6 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                Recomendado
                            </span>
                        )}
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Premium</h2>
                        <div className="mb-6">
                            <span className="text-3xl sm:text-4xl font-bold text-orange-600">$499</span>
                            <span className="text-gray-500 text-sm"> UYU/mes</span>
                        </div>
                        <ul className="space-y-3 mb-8">
                            <li className="flex items-start gap-2 text-sm text-gray-600">
                                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <b>Traslados ilimitados</b>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-600">
                                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <b>Agregar múltiples choferes</b>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-600">
                                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Registro de gastos
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-600">
                                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Fotos en traslados
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-600">
                                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Soporte prioritario
                            </li>
                        </ul>

                        {isPremium ? (
                            <div className="space-y-3">
                                <div className="text-center text-sm text-orange-600 font-bold">Tu plan actual</div>
                                <button
                                    onClick={handleCancel}
                                    disabled={procesando}
                                    className="w-full py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                >
                                    {procesando ? 'Cancelando...' : 'Cancelar suscripción'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleUpgrade}
                                disabled={procesando}
                                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition disabled:opacity-50 text-sm sm:text-base"
                            >
                                {procesando ? 'Procesando...' : 'Upgrade a Premium'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer info */}
                <div className="mt-8 text-center text-xs text-gray-400">
                    <p>Los pagos se procesan de forma segura a través de Mercado Pago.</p>
                    <p className="mt-1">Podés cancelar tu suscripción en cualquier momento.</p>
                </div>
            </div>
        </div>
    )
}
