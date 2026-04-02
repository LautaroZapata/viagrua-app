'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sanitizeString, isValidEmail, isValidPassword, isValidName, isValidCompanyName, LIMITS } from '@/lib/validation'
import { showError } from '@/lib/swal'

export default function RegistroEmpresa() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        nombreEmpresa: '',
        nombreDuenio: '',
        email: '',
        password: ''
    })

    const handleRegistro = async (e: React.FormEvent) => {
        e.preventDefault()

        const nombreEmpresa = sanitizeString(formData.nombreEmpresa)
        const nombreDuenio = sanitizeString(formData.nombreDuenio)
        const email = sanitizeString(formData.email).toLowerCase()
        const password = formData.password

        if (!isValidCompanyName(nombreEmpresa)) { showError('Nombre de empresa inválido (máx. 150 caracteres)'); return }
        if (!isValidName(nombreDuenio)) { showError('Nombre inválido (máx. 100 caracteres)'); return }
        if (!isValidEmail(email)) { showError('Email inválido'); return }
        if (!isValidPassword(password)) { showError('La contraseña debe tener entre 6 y 128 caracteres'); return }

        setLoading(true)

        const { data: empresa, error: errorEmpresa } = await supabase
            .from('empresas')
            .insert([{ nombre: nombreEmpresa }])
            .select()
            .single()

        if (errorEmpresa || !empresa) {
            showError('Error al crear empresa: ' + errorEmpresa?.message)
            setLoading(false)
            return
        }

        let empresaCreada = true
        try {
            const { error: errorAuth } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre_completo: nombreDuenio,
                        empresa_id: empresa.id
                    }
                }
            })

            if (errorAuth) {
                showError('Error en el registro: ' + errorAuth.message)
                setLoading(false)
                // Cleanup empresa
                await supabase.from('empresas').delete().eq('id', empresa.id)
                empresaCreada = false
                return
            }
        } catch {
            if (empresaCreada) {
                await supabase.from('empresas').delete().eq('id', empresa.id)
            }
            showError('Error inesperado al registrar')
            setLoading(false)
            return
        }

        const { error: errorLogin } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (errorLogin) { router.push('/login'); return }
        router.push('/dashboard')
    }

    return (
        <div className="page-bg min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-md lg:max-w-lg">
                <div className="card p-6 sm:p-8 lg:p-10">
                    {/* Header */}
                    <div className="text-center mb-8 sm:mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg mb-4 sm:mb-5">
                            <svg className="w-9 h-9 sm:w-11 sm:h-11 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                            </svg>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1 tracking-tight">ViaGrua</h1>
                        <p className="text-gray-500 text-sm sm:text-base">Gestión inteligente de traslados</p>
                    </div>

                    {/* Form Section */}
                    <div className="mb-8">
                        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">Registra tu empresa</h2>
                        <p className="text-gray-500 text-sm mb-6">Crea tu cuenta y accede al panel de control</p>

                        <form onSubmit={handleRegistro} className="space-y-4 sm:space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Nombre Empresa</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={LIMITS.empresa}
                                    placeholder="Ej: Transportes ABC"
                                    className="input-field"
                                    value={formData.nombreEmpresa}
                                    onChange={(e) => setFormData({ ...formData, nombreEmpresa: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Tu Nombre</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={LIMITS.nombre}
                                    placeholder="Ej: Juan Pérez"
                                    className="input-field"
                                    value={formData.nombreDuenio}
                                    onChange={(e) => setFormData({ ...formData, nombreDuenio: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    required
                                    maxLength={LIMITS.email}
                                    placeholder="Ej: juan@empresa.com"
                                    className="input-field"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    maxLength={LIMITS.password}
                                    placeholder="Mínimo 6 caracteres"
                                    className="input-field"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full mt-4 sm:mt-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold">
                                {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                            </button>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="text-center border-t border-gray-100 pt-6">
                        <p className="text-gray-500 text-sm">
                            ¿Ya tienes cuenta?{' '}
                            <a href="/login" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
                                Iniciar sesión
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
