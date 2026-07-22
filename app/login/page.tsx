'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { sanitizeString, isValidEmail, LIMITS } from '@/lib/validation'
import { showError } from '@/lib/swal'
import { Truck, Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()

        const email = sanitizeString(formData.email).toLowerCase()
        const password = formData.password

        if (!isValidEmail(email)) { showError('Email invalido'); return }
        if (!password || password.length > LIMITS.password) { showError('Contrase&ntilde;a invalida'); return }

        setLoading(true)

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })

        const data = await res.json()

        if (!res.ok) {
            showError(data.error || 'Error al iniciar sesion')
            setLoading(false)
            return
        }

        const { data: perfil } = await supabase
            .from('perfiles').select('rol, onboarding_completed').eq('id', data.user.id).single()

        setTimeout(() => {
            if (typeof window !== 'undefined') {
                if (!perfil?.onboarding_completed) {
                    router.push('/onboarding');
                } else if (perfil?.rol === 'admin') {
                    router.push('/dashboard');
                } else {
                    router.push('/chofer');
                }
            }
        }, 0);
        setLoading(false)
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
                        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-1">Inicia sesion</h2>
                        <p className="text-muted-foreground text-sm mb-6">Accede a tu cuenta</p>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <Input id="email" type="email" required maxLength={LIMITS.email} placeholder="tu@empresa.com" className="pl-10"
                                        value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password">Contrase&ntilde;a</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <Input id="password" type="password" required maxLength={LIMITS.password} placeholder="Tu contrase&ntilde;a" className="pl-10"
                                        value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                                </div>
                            </div>

                            <Button type="submit" disabled={loading} className="w-full mt-2 py-3">
                                {loading ? 'Iniciando...' : <><span>Iniciar Sesion</span><ArrowRight className="w-4 h-4" /></>}
                            </Button>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="text-center border-t border-border pt-5">
                        <p className="text-muted-foreground text-sm">
                            ¿No tienes cuenta?{' '}
                            <Link href="/" className="text-primary font-medium hover:text-primary/80 transition-colors">
                                Crear cuenta
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
