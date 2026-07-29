import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { auditLog } from '@/lib/audit'
import { consumirRateLimit, ipDeRequest, respuesta429 } from '@/lib/rateLimit'
import { verificarRecaptcha, tokenDeRequest, respuestaRecaptcha403 } from '@/lib/recaptcha'
import { esEmailDuplicado } from '@/lib/validation'
import { altaEmpresaSchema, parsear } from '@/lib/schemas'

const MAX_BODY_SIZE = 2_000

/**
 * Alta de una empresa nueva con su primer admin.
 *
 * Antes esto lo hacia el navegador: insertaba la fila de empresas SIN estar
 * autenticado y despues llamaba a signUp con el empresa_id en el metadata. Eso
 * obligaba a tener policies de INSERT y SELECT sobre empresas abiertas a anon,
 * y el SELECT con USING(true) dejaba a cualquiera listar todas las empresas del
 * sistema con sus UUID usando la anon key, que viaja en el bundle.
 *
 * Ahora escribe service_role y el cliente no necesita ningun permiso sobre
 * empresas. Ver supabase/migrations/20260802_cerrar_empresas_anon.sql.
 */
export async function POST(request: Request) {
  let empresaId: string | null = null

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
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Se espera un objeto JSON' }, { status: 400 })
    }

    const parseo = parsear(altaEmpresaSchema, body)
    if (!parseo.ok || !parseo.data) {
      return NextResponse.json({ error: parseo.error }, { status: 400 })
    }
    const { nombre_empresa: nombreEmpresa, nombre_duenio: nombreDuenio, email, password } = parseo.data

    // Ruta publica que crea empresas y cuentas. Sin cupo, se puede llenar la
    // base de altas basura desde un script.
    const { permitido, reintentarEn } = await consumirRateLimit(
      `registro:${ipDeRequest(request)}`, 5, 3600
    )
    if (!permitido) return respuesta429(reintentarEn)

    // Aca si se exige token, al reves que en el login.
    //
    // Esta ruta crea una empresa y una cuenta admin por llamada, que es
    // exactamente lo que un script quiere hacer en masa, y el cupo por IP no lo
    // frena si rota proxies. El costo de equivocarse tambien es distinto: alguien
    // que se esta dando de alta por primera vez puede desactivar el bloqueador y
    // reintentar, mientras que un chofer que necesita entrar a trabajar no.
    const captcha = await verificarRecaptcha(tokenDeRequest(request), 'registro', true)
    if (!captcha.permitido) {
      console.warn('recaptcha rechazo un registro:', captcha.motivo)
      return respuestaRecaptcha403()
    }

    const { data: empresa, error: errorEmpresa } = await supabaseAdmin
      .from('empresas')
      .insert({ nombre: nombreEmpresa })
      .select('id')
      .single()

    if (errorEmpresa || !empresa) {
      console.error('Error creando empresa:', errorEmpresa)
      return NextResponse.json({ error: 'No se pudo crear la empresa' }, { status: 500 })
    }
    empresaId = empresa.id

    // handle_new_user lee este metadata y, como la empresa recien creada todavia
    // no tiene ningun perfil, deja a este usuario como admin de ella.
    const { data: authData, error: errorAuth } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre_completo: nombreDuenio, empresa_id: empresaId },
    })

    if (errorAuth || !authData?.user) {
      // Rollback: sin admin, la empresa quedaria huerfana y ademas bloquearia
      // el alta de cualquier otro que reintente con el mismo nombre.
      await supabaseAdmin.from('empresas').delete().eq('id', empresaId)
      console.error('Error creando usuario:', errorAuth)
      if (esEmailDuplicado(errorAuth)) {
        return NextResponse.json({ error: 'Este email ya esta registrado' }, { status: 409 })
      }
      return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 500 })
    }

    auditLog({
      userId: authData.user.id,
      empresaId,
      action: 'signup',
      details: { empresa: nombreEmpresa },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (empresaId) {
      await supabaseAdmin.from('empresas').delete().eq('id', empresaId).then(() => {}, () => {})
    }
    console.error('Error en registro POST:', e)
    return NextResponse.json({ error: 'Error al registrar la empresa' }, { status: 500 })
  }
}
