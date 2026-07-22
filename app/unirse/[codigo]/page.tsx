'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sanitizeString, isValidEmail, isValidPassword, isValidName, isValidCodigoInvitacion, LIMITS } from '@/lib/validation'
import { showError } from '@/lib/swal'
import { ArrowLeftRight, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    const rawCodigo = params?.codigo ? params.codigo as string : ""
    const codigo = sanitizeString(rawCodigo)

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
        if (!codigo || !isValidCodigoInvitacion(codigo)) {
            setError('Código de invitación inválido')
            setLoading(false)
            return
        }

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

        const nombre = sanitizeString(formData.nombre)
        const email = sanitizeString(formData.email).toLowerCase()
        const password = formData.password

        if (!isValidName(nombre)) { showError('Nombre inválido (máx. 100 caracteres)'); return }
        if (!isValidEmail(email)) { showError('Email inválido'); return }
        if (!isValidPassword(password)) { showError('La contraseña debe tener entre 6 y 128 caracteres'); return }

        setRegistrando(true)

        try {
            const res = await fetch('/api/unirse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    codigo,
                    email,
                    password,
                    nombre,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                showError(data.error || 'Error al crear la cuenta')
                setRegistrando(false)
                return
            }

            const { error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (loginError) {
                showError('Cuenta creada pero error al iniciar sesión. Ve a /login.')
                setRegistrando(false)
                return
            }

            router.push('/chofer')
        } catch {
            showError('Error de conexión')
            setRegistrando(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <div className="text-center">
                        <p className="text-foreground font-semibold">Validando</p>
                        <p className="text-muted-foreground text-sm">Verificando invitación...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm text-center max-w-sm">
                    <div className="w-14 h-14 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
                        <X className="w-7 h-7 text-destructive" />
                    </div>
                    <h1 className="text-xl font-semibold text-foreground mb-2">Invitación Inválida</h1>
                    <p className="text-sm text-muted-foreground mb-6">{error}</p>
                    <Button asChild>
                        <a href="/">Ir al Inicio</a>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-primary/80 to-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <ArrowLeftRight className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-xl font-semibold text-foreground mb-1">Únete como Chofer</h1>
                        <p className="text-sm text-muted-foreground">
                            Invitación para <span className="font-medium text-primary">{invitacion?.empresas?.nombre}</span>
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleRegistro} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="nombre">Tu Nombre</Label>
                            <Input id="nombre" type="text" required maxLength={LIMITS.nombre} placeholder="Juan Pérez"
                                value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" required maxLength={LIMITS.email} placeholder="tu@email.com"
                                value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input id="password" type="password" required minLength={6} maxLength={LIMITS.password} placeholder="Mínimo 6 caracteres"
                                value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                        </div>

                        <Button type="submit" disabled={registrando} className="w-full py-3 mt-2">
                            {registrando ? 'Creando cuenta...' : 'Unirme al equipo'}
                        </Button>
                    </form>

                    <p className="text-center text-xs text-muted-foreground mt-5">
                        Al registrarte, podrás ver y gestionar los traslados asignados
                    </p>
                </div>
            </div>
        </div>
    )
}
