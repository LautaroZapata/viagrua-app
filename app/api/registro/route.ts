import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { auditLog } from '@/lib/audit'
import {
  sanitizeString,
  sanitizeAndLimit,
  isValidEmail,
  isValidPassword,
  isValidName,
  isValidCompanyName,
  esEmailDuplicado,
  LIMITS,
} from '@/lib/validation'

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

    const nombreEmpresa = sanitizeAndLimit(body.nombre_empresa, LIMITS.empresa)
    const nombreDuenio = sanitizeAndLimit(body.nombre_duenio, LIMITS.nombre)
    const email = sanitizeString(body.email).toLowerCase()
    const password = typeof body.password === 'string' ? body.password : ''

    if (!isValidCompanyName(nombreEmpresa)) {
      return NextResponse.json({ error: 'Nombre de empresa invalido' }, { status: 400 })
    }
    if (!isValidName(nombreDuenio)) {
      return NextResponse.json({ error: 'Nombre invalido' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Email invalido' }, { status: 400 })
    }
    if (!isValidPassword(password)) {
      return NextResponse.json({ error: 'La contraseña debe tener entre 6 y 128 caracteres' }, { status: 400 })
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
