'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { sanitizeString, isValidEmail, LIMITS } from '@/lib/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft, CheckCircle2, Truck } from 'lucide-react'

export default function RecuperarPage() {
    const [email, setEmail] = useState('')
    const [enviando, setEnviando] = useState(false)
    const [enviado, setEnviado] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const limpio = sanitizeString(email).toLowerCase()
        if (!isValidEmail(limpio)) { setError('Ingresá un email válido'); return }

        setError('')
        setEnviando(true)

        await supabase.auth.resetPasswordForEmail(limpio, {
            redirectTo: `${window.location.origin}/auth/confirm?next=/nueva-password`,
        })

        // Siempre el mismo resultado, exista o no la cuenta: si el mensaje
        // cambiara segun el caso, esta pantalla serviria para averiguar que
        // emails estan registrados.
        setEnviando(false)
        setEnviado(true)
    }

    if (enviado) {
        return (
            <div className="min-h-dvh bg-background flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-md">
                    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm text-center">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h1 className="text-xl font-semibold text-foreground mb-2">Revisá tu correo</h1>
                        <p className="text-sm text-muted-foreground mb-6">
                            Si <span className="font-medium text-foreground break-all">{sanitizeString(email).toLowerCase()}</span> tiene
                            una cuenta, te llegó un link para elegir una contraseña nueva.
                            Vence en una hora.
                        </p>
                        <p className="text-xs text-muted-foreground mb-6">
                            ¿No lo ves? Fijate en spam antes de volver a pedirlo.
                        </p>
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/login">Volver al inicio de sesión</Link>
                        </Button>
                    </div>
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

                    <h2 className="text-lg font-semibold text-foreground mb-1">Recuperar contraseña</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                        Te mandamos un link para elegir una nueva.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    maxLength={LIMITS.email}
                                    placeholder="tu@empresa.com"
                                    className="pl-10"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); if (error) setError('') }}
                                    aria-invalid={!!error}
                                    aria-describedby={error ? 'email-error' : undefined}
                                />
                            </div>
                            {error && (
                                <p id="email-error" role="alert" className="text-sm text-destructive">{error}</p>
                            )}
                        </div>

                        <Button type="submit" className="w-full" disabled={enviando}>
                            {enviando ? 'Enviando…' : 'Enviar link'}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                            <ArrowLeft className="size-4" />
                            Volver al inicio de sesión
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
