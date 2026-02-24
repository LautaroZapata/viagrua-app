'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const { data, error } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password
        })

        if (error) {
            alert('Error: ' + error.message)
            setLoading(false)
            return
        }

        const { data: perfil } = await supabase
            .from('perfiles').select('rol').eq('id', data.user.id).single()

        // Guardar email en localStorage
        if (formData.email) {
            window.localStorage.setItem('email', formData.email);
        }
        if (perfil?.rol === 'admin') {
            router.push('/dashboard')
        } else {
            router.push('/chofer')
        }
        setLoading(false)
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
                        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">Inicia sesión</h2>
                        <p className="text-gray-500 text-sm mb-6">Accede a tu cuenta</p>

                        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="tu@empresa.com"
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
                                    placeholder="Tu contraseña"
                                    className="input-field"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full mt-4 sm:mt-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold">
                                {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                            </button>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="text-center border-t border-gray-100 pt-6">
                        <p className="text-gray-500 text-sm">
                            ¿No tienes cuenta?{' '}
                            <a href="/" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
                                Crear cuenta
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}