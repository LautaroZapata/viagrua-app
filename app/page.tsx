'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { sanitizeString, isValidEmail, isValidPassword, isValidName, isValidCompanyName, LIMITS } from '@/lib/validation'
import { showError } from '@/lib/swal'
import { Truck, Building2, User, Mail, Lock, ArrowRight } from 'lucide-react'

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

        if (!isValidCompanyName(nombreEmpresa)) { showError('Nombre de empresa invalido (max. 150 caracteres)'); return }
        if (!isValidName(nombreDuenio)) { showError('Nombre invalido (max. 100 caracteres)'); return }
        if (!isValidEmail(email)) { showError('Email invalido'); return }
        if (!isValidPassword(password)) { showError('La contrasena debe tener entre 6 y 128 caracteres'); return }

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
        <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary/80 to-primary rounded-2xl shadow-lg shadow-primary/20 mb-4">
                            <Truck className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 tracking-tight">ViaGrua</h1>
                        <p className="text-muted-foreground text-sm">Gestion inteligente de traslados</p>
                    </div>

                    {/* Form */}
                    <div className="mb-6">
                        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-1">Registra tu empresa</h2>
                        <p className="text-muted-foreground text-sm mb-6">Crea tu cuenta y accede al panel de control</p>

                        <form onSubmit={handleRegistro} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Nombre Empresa</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <input
                                        type="text"
                                        required
                                        maxLength={LIMITS.empresa}
                                        placeholder="Ej: Transportes ABC"
                                        className="input-field pl-10"
                                        value={formData.nombreEmpresa}
                                        onChange={(e) => setFormData({ ...formData, nombreEmpresa: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Tu Nombre</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <input
                                        type="text"
                                        required
                                        maxLength={LIMITS.nombre}
                                        placeholder="Ej: Juan Perez"
                                        className="input-field pl-10"
                                        value={formData.nombreDuenio}
                                        onChange={(e) => setFormData({ ...formData, nombreDuenio: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <input
                                        type="email"
                                        required
                                        maxLength={LIMITS.email}
                                        placeholder="Ej: juan@empresa.com"
                                        className="input-field pl-10"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Contrasena</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        maxLength={LIMITS.password}
                                        placeholder="Minimo 6 caracteres"
                                        className="input-field pl-10"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2">
                                {loading ? 'Creando cuenta...' : <><span>Crear Cuenta</span><ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="text-center border-t border-border pt-5">
                        <p className="text-muted-foreground text-sm">
                            ¿Ya tienes cuenta?{' '}
                            <Link href="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
                                Iniciar sesion
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
