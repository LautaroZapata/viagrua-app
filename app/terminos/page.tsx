import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Términos y condiciones — ViaGrúa',
    description: 'Condiciones de uso del servicio ViaGrúa.',
}

/**
 * Igual que la política de privacidad: escrita sobre lo que el producto hace
 * hoy, no sobre una plantilla.
 *
 * IMPORTANTE: revisar con un profesional antes de apoyarse en este texto. Las
 * cláusulas de limitación de responsabilidad, la jurisdicción y las condiciones
 * de facturación tienen consecuencias legales reales y varían según el país.
 * Los datos de la empresa titular quedan pendientes de completar.
 */
const ACTUALIZADO = '29 de julio de 2026'
const CONTACTO = 'hola@viagrua.com'

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">{titulo}</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
        </section>
    )
}

export default function TerminosPage() {
    return (
        <div className="min-h-dvh bg-background">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
                >
                    <ArrowLeft className="size-4" />
                    Volver al inicio
                </Link>

                <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
                    Términos y condiciones
                </h1>
                <p className="text-sm text-muted-foreground mb-10">
                    Última actualización: {ACTUALIZADO}
                </p>

                <Seccion titulo="Qué es ViaGrúa">
                    <p>ViaGrúa es una aplicación para que empresas de grúas administren sus traslados, sus choferes y sus gastos. Al crear una cuenta aceptás estas condiciones.</p>
                </Seccion>

                <Seccion titulo="Tu cuenta">
                    <p>Sos responsable de mantener tu contraseña en reserva y de lo que se haga desde tu cuenta. Si sospechás que alguien accedió sin tu permiso, cambiá la contraseña y avisanos.</p>
                    <p>Quien crea la empresa queda como administrador y puede invitar choferes, ver todos los traslados y gastos de la empresa, y quitar a cualquier integrante.</p>
                </Seccion>

                <Seccion titulo="Tus datos son tuyos">
                    <p>Todo lo que cargás en ViaGrúa te pertenece. Podés exportarlo a CSV cuando quieras desde la aplicación, sin pedirnos autorización ni esperar aprobación.</p>
                    <p>Si dejás de usar el servicio y querés que borremos todo, escribinos y lo hacemos.</p>
                </Seccion>

                <Seccion titulo="Uso aceptable">
                    <p>No podés usar ViaGrúa para actividades ilegales, ni intentar acceder a datos de otras empresas, ni sobrecargar el servicio deliberadamente.</p>
                    <p>Si detectamos un uso de ese tipo podemos suspender la cuenta.</p>
                </Seccion>

                <Seccion titulo="Disponibilidad">
                    <p>Hacemos lo posible para que el servicio esté siempre disponible, pero no podemos garantizar que nunca se interrumpa. Puede haber cortes por mantenimiento o por fallas de los proveedores de infraestructura.</p>
                    <p>Te recomendamos exportar tus datos con cierta periodicidad. La función está en la pantalla de traslados.</p>
                </Seccion>

                <Seccion titulo="Precio">
                    <p>El plan actual es gratuito. Si en el futuro introducimos planes pagos, te avisaremos con anticipación y nunca vamos a empezar a cobrarte sin que lo aceptes expresamente.</p>
                </Seccion>

                <Seccion titulo="Responsabilidad">
                    <p>ViaGrúa es una herramienta de registro y organización. Las decisiones que tomes sobre tu operación, y la exactitud de lo que cargues, son tu responsabilidad.</p>
                </Seccion>

                <Seccion titulo="Cambios">
                    <p>Podemos actualizar estas condiciones. Si el cambio es relevante te avisamos por email antes de que entre en vigencia.</p>
                </Seccion>

                <Seccion titulo="Contacto">
                    <p>
                        Cualquier consulta:{' '}
                        <a href={`mailto:${CONTACTO}`} className="text-primary hover:text-primary/80 underline">
                            {CONTACTO}
                        </a>
                    </p>
                </Seccion>
            </div>
        </div>
    )
}
