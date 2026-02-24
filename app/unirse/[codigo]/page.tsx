'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Invitacion {
    id: string
    empresa_id: string
    codigo: string
    usado: boolean
    expires_at: string
    empresas: { nombre: string }
}

export default function UnirseEmpresa() {
    const router = useRouter()
    const params = useParams()
    const codigo = params?.codigo ? params.codigo as string : ""

    const [invitacion, setInvitacion] = useState<Invitacion | null>(null)
    const [loading, setLoading] = useState(true)
    const [registrando, setRegistrando] = useState(false)
    const [error, setError] = useState('')
    const [formData, setFormData] = useState({
        nombre: '',
        email: '',
        password: ''
    })

    useEffect(() => {
        validarInvitacion()
    }, [codigo])

    const validarInvitacion = async () => {
        const { data, error } = await supabase
            .from('invitaciones')
            .select('*, empresas(nombre)')
            .eq('codigo', codigo)
            .single()

        if (error || !data) {
            setError('Código de invitación inválido')
            setLoading(false)
            return
        }

        if (data.usado) {
            setError('Este código ya fue utilizado')
            setLoading(false)
            return
        }

        if (new Date(data.expires_at) < new Date()) {
            setError('Este código ha expirado')
            setLoading(false)
            return
        }

        setInvitacion(data)
        setLoading(false)
    }

    const handleRegistro = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!invitacion) return
        setRegistrando(true)

        // 1. Crear usuario
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    nombre_completo: formData.nombre,
                    empresa_id: invitacion.empresa_id
                }
            }
        })

        if (authError || !authData.user) {
            alert('Error: ' + authError?.message)
            setRegistrando(false)
            return
        }

        // 2. Actualizar rol a chofer - CON MANEJO DE ERROR
        const { error: rolError } = await supabase
            .from('perfiles')
            .update({ rol: 'chofer' })
            .eq('id', authData.user.id)

        if (rolError) {
            alert('Error al configurar rol. Contacta al administrador.')
            setRegistrando(false)
            return
        }

        // 3. Marcar invitación como usada - CON MANEJO DE ERROR
        const { error: invError } = await supabase
            .from('invitaciones')
            .update({ usado: true })
            .eq('id', invitacion.id)

        if (invError) {
            console.error('Error marcando invitación:', invError)
            // Continuar aunque falle - no es crítico para el usuario
        }

        // 4. Login automático
        await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password
        })

        router.push('/chofer')
    }

    if (loading) {
        return (
            <div className="page-bg min-h-screen flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-orange-200 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full absolute top-0 left-0 animate-spin"></div>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-700 font-semibold">Validando</p>
                        <p className="text-gray-400 text-sm">Verificando invitación...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="page-bg min-h-screen flex items-center justify-center p-4">
                <div className="card text-center max-w-sm">
                    <div className="w-14 h-14 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Invitación Inválida</h1>
                    <p className="text-sm text-gray-600 mb-6">{error}</p>
                    <a href="/" className="btn-primary inline-block text-sm">
                        Ir al Inicio
                    </a>
                </div>
            </div>
        )
    }

    return (
        <div className="page-bg min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="card">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900 mb-1">Únete como Chofer</h1>
                        <p className="text-sm text-gray-600">
                            Invitación para <span className="font-medium text-orange-600">{invitacion?.empresas?.nombre}</span>
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleRegistro} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                Tu Nombre
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Juan Pérez"
                                className="input-field"
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                placeholder="tu@email.com"
                                className="input-field"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                placeholder="Mínimo 6 caracteres"
                                className="input-field"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={registrando}
                            className="btn-primary w-full py-3 text-sm mt-2"
                        >
                            {registrando ? 'Creando cuenta...' : 'Unirme al equipo'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-500 mt-5">
                        Al registrarte, podrás ver y gestionar los traslados asignados
                    </p>
                </div>
            </div>
        </div>
    )
}
