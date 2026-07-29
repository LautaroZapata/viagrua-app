'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  sanitizeString, isValidEmail, isValidPassword,
  isValidName, isValidCompanyName, LIMITS,
} from '@/lib/validation'
import { showError } from '@/lib/swal'
import { headersConRecaptcha, ACCIONES } from '@/lib/recaptchaCliente'
import { AvisoRecaptcha } from '@/app/components/AvisoRecaptcha'
import { Building2, User, Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'motion/react'

export function SignupSection() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nombreEmpresa: '',
    nombreDuenio: '',
    email: '',
    password: '',
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

    const res = await fetch('/api/registro', {
      method: 'POST',
      headers: await headersConRecaptcha(ACCIONES.registro),
      body: JSON.stringify({
        nombre_empresa: nombreEmpresa,
        nombre_duenio: nombreDuenio,
        email,
        password,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showError(data.error || 'No se pudo completar el registro')
      setLoading(false)
      return
    }

    const { error: errorLogin } = await supabase.auth.signInWithPassword({ email, password })
    if (errorLogin) { router.push('/login'); return }
    router.push('/onboarding')
  }

  return (
    // scroll-mt deja aire para la navbar fija: sin eso el titulo queda tapado
    // cuando se llega desde un boton "Comenzar gratis".
    <section id="registro" className="py-20 sm:py-32 relative scroll-mt-20">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.03] to-background pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-3">
              Empezá ahora
            </h2>
            <p className="text-muted-foreground">
              Creá tu cuenta gratis. Sin tarjeta de crédito. Sin compromiso.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl shadow-black/5">
            <form onSubmit={handleRegistro} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="signup-empresa">Nombre de la empresa</Label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-empresa" type="text" required maxLength={LIMITS.empresa} placeholder="Ej: Transportes ABC" className="pl-10" value={formData.nombreEmpresa} onChange={(e) => setFormData({ ...formData, nombreEmpresa: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-nombre">Tu nombre</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-nombre" type="text" required maxLength={LIMITS.nombre} placeholder="Ej: Juan Perez" className="pl-10" value={formData.nombreDuenio} onChange={(e) => setFormData({ ...formData, nombreDuenio: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-email" type="email" required maxLength={LIMITS.email} placeholder="tu@empresa.com" className="pl-10" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-password" type="password" required minLength={6} maxLength={LIMITS.password} placeholder="Mínimo 6 caracteres" className="pl-10" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-2 py-3">
                {loading ? 'Creando cuenta...' : <><span>Crear cuenta gratis</span><ArrowRight className="w-4 h-4" /></>}
              </Button>

              <p className="text-center text-xs text-muted-foreground pt-2">
                ¿Ya tenés cuenta?{' '}
                <Link href="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">Iniciar sesión</Link>
              </p>

              <p className="text-center text-xs text-muted-foreground">
                Al registrarte aceptás nuestros{' '}
                <Link href="/terminos" className="underline hover:text-foreground transition-colors">Términos</Link> y{' '}
                <Link href="/privacidad" className="underline hover:text-foreground transition-colors">Privacidad</Link>
              </p>

              <AvisoRecaptcha className="text-center" />
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
