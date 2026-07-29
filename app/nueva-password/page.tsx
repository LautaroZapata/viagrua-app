'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isValidPassword, LIMITS } from '@/lib/validation'
import { showSuccess } from '@/lib/swal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Truck, Loader2 } from 'lucide-react'

/**
 * Segundo paso del reset: /auth/confirm ya canjeo el link del mail por una
 * sesion, asi que aca solo hay que fijar la contraseña nueva.
 */
export default function NuevaPasswordPage() {
    const router = useRouter()
    const [verificando, setVerificando] = useState(true)
    const [haySesion, setHaySesion] = useState(false)
    const [password, setPassword] = useState('')
    const [repetir, setRepetir] = useState('')
    const [error, setError] = useState('')
    const [guardando, setGuardando] = useState(false)

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setHaySesion(!!data.user)
            setVerificando(false)
        })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isValidPassword(password)) {
            setError(`La contraseña debe tener entre 6 y ${LIMITS.password} caracteres`)
            return
        }
        if (password !== repetir) {
            setError('Las contraseñas no coinciden')
            return
        }

        setError('')
        setGuardando(true)
        const { error: errUpdate } = await supabase.auth.updateUser({ password })

        if (errUpdate) {
            setError('No se pudo actualizar la contraseña. Pedí un link nuevo.')
            setGuardando(false)
            return
        }

        showSuccess('Contraseña actualizada')
        router.push('/dashboard')
    }

    if (verificando) {
        return (
            <div className="min-h-dvh bg-background flex items-center justify-center">
                <Loader2 className="size-8 text-primary animate-spin" />
                <span className="sr-only">Verificando el link…</span>
            </div>
        )
    }

    if (!haySesion) {
        return (
            <div className="min-h-dvh bg-background flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm text-center">
                    <h1 className="text-xl font-semibold text-foreground mb-2">Link inválido o vencido</h1>
                    <p className="text-sm text-muted-foreground mb-6">
                        Los links de recuperación duran una hora y se pueden usar una sola vez.
                    </p>
                    <Button asChild className="w-full">
                        <Link href="/recuperar">Pedir uno nuevo</Link>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-dvh bg-background flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary/80 to-primary rounded-2xl shadow-lg shadow-primary/20 mb-4">
                            <Truck className="w-7 h-7 text-primary-foreground" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-1 tracking-tight">ViaGrua</h1>
                    </div>

                    <h2 className="text-lg font-semibold text-foreground mb-1">Elegí una contraseña nueva</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                        Vas a quedar con la sesión iniciada.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <div className="space-y-1.5">
                            <Label htmlFor="password">Contraseña nueva</Label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    maxLength={LIMITS.password}
                                    className="pl-10"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                                    aria-invalid={!!error}
                                    aria-describedby={error ? 'password-error' : undefined}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="repetir">Repetila</Label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="repetir"
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    maxLength={LIMITS.password}
                                    className="pl-10"
                                    value={repetir}
                                    onChange={(e) => { setRepetir(e.target.value); if (error) setError('') }}
                                    aria-invalid={!!error}
                                    aria-describedby={error ? 'password-error' : undefined}
                                />
                            </div>
                        </div>

                        {error && (
                            <p id="password-error" role="alert" className="text-sm text-destructive">{error}</p>
                        )}

                        <Button type="submit" className="w-full" disabled={guardando}>
                            {guardando ? 'Guardando…' : 'Guardar contraseña'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
