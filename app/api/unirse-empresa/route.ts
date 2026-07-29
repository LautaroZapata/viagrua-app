import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { auditLog } from '@/lib/audit'
import { sanitizeString, isValidCodigoInvitacion } from '@/lib/validation'

const MAX_BODY_SIZE = 1_000

/**
 * Un usuario ya registrado se une a una empresa con un codigo de invitacion.
 *
 * Antes esto se hacia desde el browser con la anon key: se marcaba la
 * invitacion como usada y se escribia perfiles.empresa_id directo. Eso exigia
 * que el cliente pudiera modificar empresa_id, que es la clave de tenancy
 * (el mismo permiso que permitia saltar de empresa a voluntad).
 *
 * Ahora la escritura la hace service_role despues de validar del lado del
 * servidor. Ver supabase/migrations/20260729_seguridad_critica.sql.
 */
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
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Se espera un objeto JSON' }, { status: 400 })
    }

    const codigo = sanitizeString(body.codigo)
    if (!isValidCodigoInvitacion(codigo)) {
      return NextResponse.json({ error: 'Codigo invalido' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('id, empresa_id')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json({ error: 'No se pudo verificar el perfil' }, { status: 403 })
    }

    if (perfil.empresa_id) {
      return NextResponse.json({ error: 'Ya perteneces a una empresa' }, { status: 409 })
    }

    // Consumo atomico: el UPDATE condicional es el que gana la carrera.
    // Si dos requests entran con el mismo codigo, solo uno recibe fila.
    const { data: invitacion, error: invError } = await supabaseAdmin
      .from('invitaciones')
      .update({ usado: true })
      .eq('codigo', codigo)
      .eq('usado', false)
      .not('expires_at', 'is', null)
      .gte('expires_at', new Date().toISOString())
      .select('id, empresa_id')
      .single()

    if (invError || !invitacion?.empresa_id) {
      return NextResponse.json({ error: 'Codigo invalido, usado o expirado' }, { status: 400 })
    }
    const empresaId = invitacion.empresa_id

    const { error: updateError } = await supabaseAdmin
      .from('perfiles')
      .update({ empresa_id: empresaId })
      .eq('id', user.id)

    if (updateError) {
      // Devolver la invitacion al pool para no quemarla por un fallo nuestro.
      await supabaseAdmin.from('invitaciones').update({ usado: false }).eq('id', invitacion.id)
      console.error('Error uniendo perfil a empresa:', updateError)
      return NextResponse.json({ error: 'Error al unirse a la empresa' }, { status: 500 })
    }

    const { data: empresa } = await supabaseAdmin
      .from('empresas')
      .select('nombre')
      .eq('id', empresaId)
      .single()

    auditLog({
      userId: user.id,
      empresaId: empresaId,
      action: 'join_company',
      details: { codigo },
    })

    return NextResponse.json({
      ok: true,
      empresa_id: empresaId,
      empresa_nombre: empresa?.nombre ?? 'Empresa',
    })
  } catch (e) {
    console.error('Error en unirse-empresa POST:', e)
    return NextResponse.json({ error: 'Error al unirse a la empresa' }, { status: 500 })
  }
}
