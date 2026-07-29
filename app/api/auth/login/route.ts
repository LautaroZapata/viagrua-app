import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumirRateLimit, ipDeRequest, respuesta429 } from '@/lib/rateLimit'
import { verificarRecaptcha, tokenDeRequest, respuestaRecaptcha403 } from '@/lib/recaptcha'
import { loginSchema, parsear } from '@/lib/schemas'
import { auditLog } from '@/lib/audit'

const MAX_BODY_SIZE = 2_000

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type debe ser application/json' }, { status: 415 })
    }

    const rawBody = await request.text()
    if (rawBody.length > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Body demasiado grande' }, { status: 413 })
    }

    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Se espera un objeto JSON' }, { status: 400 })
    }

    const parseo = parsear(loginSchema, body)
    if (!parseo.ok || !parseo.data) {
      return NextResponse.json({ error: parseo.error }, { status: 400 })
    }
    const { email, password } = parseo.data

    // Dos cupos: por IP para frenar el barrido, y por email para que alguien
    // repartido en muchas IPs no pueda martillar una cuenta concreta.
    const ip = ipDeRequest(request)
    for (const [clave, max] of [[`login:ip:${ip}`, 10], [`login:email:${email}`, 5]] as const) {
      const { permitido, reintentarEn } = await consumirRateLimit(clave, max, 300)
      if (!permitido) return respuesta429(reintentarEn)
    }

    // El captcha va DESPUES del cupo: verificar cuesta un round trip a Google, y
    // no tiene sentido gastarlo (ni gastar cuota de la API) con quien ya se paso
    // de intentos.
    //
    // exigirToken en false, y es la unica ruta donde va asi. Si el navegador no
    // pudo cargar el script de Google —un bloqueador, una extension de
    // privacidad, la red del cliente— el pedido pasa igual. Dejar sin login a un
    // chofer a las tres de la manana por una extension del navegador es peor que
    // el ataque del que protege: aca abajo ya hay dos cupos, y el de 5 intentos
    // por email en 5 minutos es lo que realmente frena el credential stuffing.
    // Un token que SI llega y viene con score bajo se rechaza igual.
    const captcha = await verificarRecaptcha(tokenDeRequest(request), 'login', false)
    if (!captcha.permitido) {
      console.warn('recaptcha rechazo un login:', captcha.motivo)
      return respuestaRecaptcha403()
    }

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
    }

    if (!data.session) {
      return NextResponse.json({ error: 'Error al crear la sesión' }, { status: 500 })
    }

    auditLog({ userId: data.user.id, empresaId: null, action: 'login' })

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (e) {
    console.error('Error en login:', e)
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 })
  }
}
