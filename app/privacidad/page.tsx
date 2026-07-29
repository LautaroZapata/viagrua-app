import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Política de privacidad — ViaGrúa',
    description: 'Qué datos recopila ViaGrúa, para qué los usa y con quién los comparte.',
}

/**
 * Redactada a partir de lo que la aplicación efectivamente hace, no de una
 * plantilla: cada dato listado se corresponde con una columna o un bucket real.
 *
 * IMPORTANTE: revisar con un profesional antes de apoyarse en este texto. Hay
 * afirmaciones con consecuencias legales (base legal del tratamiento, plazos de
 * conservación, transferencias internacionales) que exceden lo que se puede
 * deducir del código.
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

export default function PrivacidadPage() {
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
                    Política de privacidad
                </h1>
                <p className="text-sm text-muted-foreground mb-10">
                    Última actualización: {ACTUALIZADO}
                </p>

                <Seccion titulo="Qué datos recopilamos">
                    <p>Cuando creás una cuenta guardamos el nombre de tu empresa, tu nombre, tu email y tu contraseña. La contraseña no se guarda en texto plano: la administra nuestro proveedor de autenticación, que almacena solo un hash.</p>
                    <p>Al usar la aplicación se guardan los datos que vos cargás: traslados (marca y modelo del vehículo, matrícula, origen, destino, importes, observaciones, fotos y fechas), gastos (tipo, importe, descripción y fecha), y los perfiles de los choferes que invites, con su nombre, email y teléfono si lo completan.</p>
                    <p>Registramos además tu dirección IP en dos casos: en el registro de auditoría, que anota quién hizo qué y cuándo, y en el control de intentos de acceso, que limita cuántas veces por minuto se puede probar una contraseña.</p>
                </Seccion>

                <Seccion titulo="Para qué los usamos">
                    <p>Para que la aplicación funcione: mostrarte tus traslados, calcular tus totales, permitir que tus choferes vean lo que les corresponde y nada más.</p>
                    <p>No vendemos tus datos ni los usamos para publicidad. No los compartimos con terceros salvo los proveedores de infraestructura que se listan abajo.</p>
                </Seccion>

                <Seccion titulo="Separación entre empresas">
                    <p>Cada empresa ve únicamente sus propios datos. Esa separación se aplica en la base de datos, no solo en la pantalla: aunque alguien manipulara la aplicación desde su navegador, la base rechaza las consultas que salgan de su empresa.</p>
                </Seccion>

                <Seccion titulo="Las fotos de los traslados">
                    <p>Las fotos que suben los choferes están protegidas: para verlas hay que tener sesión iniciada y pertenecer a la empresa dueña del traslado. No existe una dirección permanente que permita abrirlas desde afuera; cada vez que se muestran se genera un enlace temporal que vence en una hora.</p>
                    <p>Las fotos cargadas antes de agosto de 2026 están alojadas en un servicio externo de imágenes y todavía tienen direcciones públicas: quien tenga el enlace exacto puede verlas sin iniciar sesión. Estamos migrándolas al almacenamiento protegido.</p>
                </Seccion>

                <Seccion titulo="Con quién compartimos los datos">
                    <p><strong className="text-foreground">Supabase</strong> aloja la base de datos, la autenticación y las fotos.</p>
                    <p><strong className="text-foreground">Vercel</strong> aloja la aplicación y procesa las solicitudes que le hace tu navegador.</p>
                    <p>Ambos proveedores pueden almacenar la información en servidores fuera de tu país.</p>
                </Seccion>

                <Seccion titulo="Cuánto tiempo los conservamos">
                    <p>Mientras tu cuenta esté activa. Si querés que borremos tu empresa y todo lo asociado, escribinos y lo hacemos.</p>
                    <p>Los códigos de invitación vencen a los siete días. Los registros de control de acceso se descartan al día.</p>
                </Seccion>

                <Seccion titulo="Tus derechos">
                    <p>Podés pedirnos una copia de tus datos, corregirlos o borrarlos. Desde la aplicación podés exportar tus traslados y gastos a un archivo CSV en cualquier momento, sin pedirnos nada.</p>
                </Seccion>

                <Seccion titulo="Cambios">
                    <p>Si modificamos esta política, actualizamos la fecha de arriba. Si el cambio es importante, te avisamos por email.</p>
                </Seccion>

                <Seccion titulo="Contacto">
                    <p>
                        Cualquier duda sobre tus datos:{' '}
                        <a href={`mailto:${CONTACTO}`} className="text-primary hover:text-primary/80 underline">
                            {CONTACTO}
                        </a>
                    </p>
                </Seccion>
            </div>
        </div>
    )
}
