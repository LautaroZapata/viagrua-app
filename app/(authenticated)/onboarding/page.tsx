'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/app/components/UserContext'
import { sanitizeString } from '@/lib/validation'
import { showError } from '@/lib/swal'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
    Truck, Users, Receipt, MapPin,
    ArrowLeft, ArrowRight, Check, Copy, Mail,
} from 'lucide-react'

// --- Step Components ---

function WelcomeStep({ role }: { role: string }) {
    const isAdmin = role === 'admin'
    return (
        <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Truck className="size-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display mb-3">
                Bienvenido a ViaGrua
            </CardTitle>
            <CardDescription className="text-base mb-8">
                {isAdmin
                    ? 'Tu plataforma para gestionar traslados, choferes y gastos de tu empresa de gruas.'
                    : 'Tu herramienta para registrar traslados y gastos de forma rapida y sencilla.'}
            </CardDescription>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                {isAdmin ? (
                    <>
                        <FeatureCard icon={MapPin} title="Traslados" desc="Registra y sigue cada servicio" />
                        <FeatureCard icon={Users} title="Equipo" desc="Invita choferes a tu empresa" />
                        <FeatureCard icon={Receipt} title="Gastos" desc="Controla costos por vehiculo" />
                    </>
                ) : (
                    <>
                        <FeatureCard icon={MapPin} title="Traslados" desc="Registra cada servicio rapido" />
                        <FeatureCard icon={Receipt} title="Gastos" desc="Carga combustible y peajes" />
                        <FeatureCard icon={Truck} title="Vehiculos" desc="Gestiona tus gruas asignadas" />
                    </>
                )}
            </div>
        </div>
    )
}

function FeatureCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
    return (
        <div className="rounded-xl border bg-muted/50 p-4">
            <Icon className="size-5 text-primary mb-2" />
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
    )
}

function ProfileStep({ telefono, setTelefono }: { telefono: string; setTelefono: (v: string) => void }) {
    return (
        <div>
            <CardTitle className="text-xl font-display mb-2">Tu perfil</CardTitle>
            <CardDescription className="mb-6">
                Agrega tu telefono para que tu equipo pueda contactarte (opcional).
            </CardDescription>
            <div className="space-y-2">
                <Label htmlFor="telefono">Telefono</Label>
                <Input
                    id="telefono"
                    type="tel"
                    placeholder="+54 11 1234-5678"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="max-w-xs"
                />
            </div>
        </div>
    )
}

function InviteStep({ empresaId }: { empresaId: string | null }) {
    const [codigo, setCodigo] = useState('')
    const [link, setLink] = useState('')
    const [generando, setGenerando] = useState(false)
    const [copiado, setCopiado] = useState(false)
    const timersRef = useRef<NodeJS.Timeout[]>([])

    useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

    const generarCodigo = async () => {
        if (!empresaId) return
        setGenerando(true)
        const arr = new Uint8Array(5)
        crypto.getRandomValues(arr)
        const cod = Array.from(arr, b => b.toString(36).padStart(2, '0')).join('').substring(0, 8).toUpperCase()
        const { error } = await supabase.from('invitaciones').insert({ empresa_id: empresaId, codigo: cod })
        if (error) { showError('Error al generar codigo: ' + error.message); setGenerando(false); return }
        setCodigo(cod)
        setLink(`${window.location.origin}/unirse/${cod}`)
        setGenerando(false)
    }

    const copiarLink = async () => {
        if (!link) return
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link)
            } else {
                const ta = document.createElement('textarea')
                ta.value = link
                document.body.appendChild(ta)
                ta.select()
                document.execCommand('copy')
                document.body.removeChild(ta)
            }
            setCopiado(true)
            timersRef.current.push(setTimeout(() => setCopiado(false), 2000))
        } catch { showError('No se pudo copiar. Copialo manualmente: ' + link) }
    }

    return (
        <div>
            <CardTitle className="text-xl font-display mb-2">Invita a tu primer chofer</CardTitle>
            <CardDescription className="mb-6">
                Genera un codigo de invitacion para que un chofer se una a tu equipo.
            </CardDescription>

            {!codigo ? (
                <div className="text-center py-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Mail className="size-7 text-primary" />
                    </div>
                    <p className="text-muted-foreground text-sm mb-6">
                        Compartile el link o codigo al chofer para que se registre
                    </p>
                    <Button onClick={generarCodigo} disabled={generando} className="w-full max-w-xs mx-auto">
                        {generando ? 'Generando...' : 'Generar Invitacion'}
                    </Button>
                </div>
            ) : (
                <div className="text-center py-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Codigo de invitacion</p>
                    <p className="text-2xl font-bold text-primary mb-4 tracking-widest font-mono">{codigo}</p>
                    {link && (
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link)}`}
                            alt="QR Code"
                            className="w-36 h-36 mx-auto mb-4 rounded-lg"
                        />
                    )}
                    <p className="text-xs text-muted-foreground mb-3">El chofer puede escanear el QR o usar el link</p>
                    <div className="bg-muted rounded-lg p-3 mb-4">
                        <p className="text-xs text-muted-foreground break-all font-mono">{link}</p>
                    </div>
                    <Button onClick={copiarLink} className="w-full max-w-xs mx-auto" variant={copiado ? 'outline' : 'default'}>
                        {copiado ? <><Check className="size-4 mr-1.5" /> Link Copiado</> : <><Copy className="size-4 mr-1.5" /> Copiar Link</>}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">Este codigo expira en 7 dias y solo puede usarse una vez</p>
                </div>
            )}
        </div>
    )
}

function HowItWorksStep() {
    const steps = [
        { icon: Truck, title: '1. Recibis un traslado', desc: 'Tu admin te asigna un servicio con origen, destino y vehiculo.' },
        { icon: MapPin, title: '2. Registras el viaje', desc: 'Cargas los datos del traslado: KMs, fotos y observaciones.' },
        { icon: Receipt, title: '3. Cargas los gastos', desc: 'Registras combustible, peajes y otros gastos del viaje.' },
    ]

    return (
        <div>
            <CardTitle className="text-xl font-display mb-2">Como funciona</CardTitle>
            <CardDescription className="mb-6">
                Asi de simple es usar ViaGrua como chofer.
            </CardDescription>
            <div className="space-y-4">
                {steps.map((s) => (
                    <div key={s.title} className="flex gap-4 items-start rounded-xl border bg-muted/50 p-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <s.icon className="size-5 text-primary" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">{s.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function ReadyStep({ role }: { role: string }) {
    return (
        <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                <Check className="size-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-display mb-3">
                Todo listo
            </CardTitle>
            <CardDescription className="text-base">
                {role === 'admin'
                    ? 'Tu empresa esta configurada. Empeza a gestionar traslados y tu equipo.'
                    : 'Ya estas listo para registrar traslados y gastos.'}
            </CardDescription>
        </div>
    )
}

// --- Main Page ---

type StepDef = { id: string; label: string }

const ADMIN_STEPS: StepDef[] = [
    { id: 'welcome', label: 'Bienvenida' },
    { id: 'profile', label: 'Perfil' },
    { id: 'invite', label: 'Invitar' },
    { id: 'ready', label: 'Listo' },
]

const CHOFER_STEPS: StepDef[] = [
    { id: 'welcome', label: 'Bienvenida' },
    { id: 'profile', label: 'Perfil' },
    { id: 'how', label: 'Como funciona' },
    { id: 'ready', label: 'Listo' },
]

export default function OnboardingPage() {
    const { perfil, role, empresa, reload } = useUser()
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [telefono, setTelefono] = useState('')
    const [completing, setCompleting] = useState(false)

    const steps = role === 'admin' ? ADMIN_STEPS : CHOFER_STEPS
    const current = steps[step]
    const isLast = step === steps.length - 1
    const progress = ((step + 1) / steps.length) * 100

    const completeOnboarding = async () => {
        if (!perfil) return
        setCompleting(true)
        const { error } = await supabase
            .from('perfiles')
            .update({ onboarding_completed: true })
            .eq('id', perfil.id)
        if (error) {
            showError('Error al completar: ' + error.message)
            setCompleting(false)
            return
        }
        await reload()
        router.push(role === 'chofer' ? '/chofer' : '/dashboard')
    }

    const saveProfileAndNext = async () => {
        if (!perfil) return
        const cleaned = sanitizeString(telefono)
        if (cleaned) {
            await supabase
                .from('perfiles')
                .update({ telefono: cleaned })
                .eq('id', perfil.id)
        }
        setStep(s => s + 1)
    }

    const handleNext = () => {
        if (isLast) {
            completeOnboarding()
            return
        }
        if (current.id === 'profile') {
            saveProfileAndNext()
            return
        }
        setStep(s => s + 1)
    }

    const handleSkip = () => {
        completeOnboarding()
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-lg page-enter">
                {/* Logo */}
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold font-display text-primary">ViaGrua</h1>
                </div>

                {/* Progress */}
                <div className="mb-6">
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>Paso {step + 1} de {steps.length}</span>
                        <span>{current.label}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>

                {/* Card */}
                <Card key={current.id} className="animate-fadeInUp">
                    <CardHeader className="pb-2" />
                    <CardContent>
                        {current.id === 'welcome' && <WelcomeStep role={role ?? 'admin'} />}
                        {current.id === 'profile' && <ProfileStep telefono={telefono} setTelefono={setTelefono} />}
                        {current.id === 'invite' && <InviteStep empresaId={empresa?.id ?? null} />}
                        {current.id === 'how' && <HowItWorksStep />}
                        {current.id === 'ready' && <ReadyStep role={role ?? 'admin'} />}
                    </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6">
                    <div>
                        {step > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)}>
                                <ArrowLeft className="size-4 mr-1" />
                                Atras
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {!isLast && (
                            <Button variant="ghost" size="sm" onClick={handleSkip}>
                                Omitir
                            </Button>
                        )}
                        <Button onClick={handleNext} disabled={completing} size="sm">
                            {isLast
                                ? (completing ? 'Completando...' : 'Comenzar')
                                : <>Siguiente <ArrowRight className="size-4 ml-1" /></>
                            }
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
