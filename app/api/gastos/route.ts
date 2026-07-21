import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  sanitizeString,
  sanitizeAndLimit,
  isValidUUID,
  isValidImporte,
  isValidTipoGasto,
  isValidFecha,
  LIMITS,
} from '@/lib/validation'

const MAX_BODY_SIZE = 5_000

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type debe ser application/json' },
        { status: 415 },
      )
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

    const empresaId = sanitizeString(body.empresa_id)
    const tipo = sanitizeString(body.tipo)
    const importe = body.importe
    const descripcion = body.descripcion
      ? sanitizeAndLimit(body.descripcion, LIMITS.descripcion)
      : null
    const fecha = sanitizeString(body.fecha)
    const userId = sanitizeString(body.user_id)

    if (!isValidUUID(empresaId))
      return NextResponse.json({ error: 'empresa_id inválido' }, { status: 400 })
    if (!isValidUUID(userId))
      return NextResponse.json({ error: 'user_id inválido' }, { status: 400 })
    if (!isValidTipoGasto(tipo))
      return NextResponse.json({ error: 'Tipo de gasto inválido' }, { status: 400 })
    if (!isValidImporte(importe))
      return NextResponse.json({ error: 'Importe inválido' }, { status: 400 })
    if (!fecha || !isValidFecha(fecha))
      return NextResponse.json(
        { error: 'Fecha inválida (YYYY-MM-DD)' },
        { status: 400 },
      )

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
      .select('empresa_id, rol')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json(
        { error: 'No se pudo verificar el perfil' },
        { status: 403 },
      )
    }

    if (perfil.empresa_id !== empresaId) {
      return NextResponse.json(
        { error: 'No tienes permiso para crear gastos en esta empresa' },
        { status: 403 },
      )
    }

    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Usuario no coincide con la sesión' },
        { status: 403 },
      )
    }

    const { data: gasto, error: insertError } = await supabaseAdmin
      .from('gastos')
      .insert({
        empresa_id: empresaId,
        user_id: user.id,
        tipo,
        importe: Number(importe),
        descripcion,
        fecha,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creando gasto:', insertError)
      return NextResponse.json(
        { error: 'Error al crear el gasto' },
        { status: 500 },
      )
    }

    return NextResponse.json({ gasto })
  } catch (e) {
    console.error('Error en gastos POST:', e)
    return NextResponse.json({ error: 'Error al crear el gasto' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const gastoId = searchParams.get('id')

    if (!gastoId || !isValidUUID(gastoId)) {
      return NextResponse.json(
        { error: 'id de gasto inválido' },
        { status: 400 },
      )
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
      .select('empresa_id, rol')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json(
        { error: 'No se pudo verificar el perfil' },
        { status: 403 },
      )
    }

    const { data: gasto, error: gastoError } = await supabaseAdmin
      .from('gastos')
      .select('id, empresa_id, user_id')
      .eq('id', gastoId)
      .single()

    if (gastoError || !gasto) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
    }

    if (gasto.empresa_id !== perfil.empresa_id) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar este gasto' },
        { status: 403 },
      )
    }

    if (perfil.rol !== 'admin' && gasto.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Solo el admin o el creador pueden eliminar este gasto' },
        { status: 403 },
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from('gastos')
      .delete()
      .eq('id', gastoId)

    if (deleteError) {
      console.error('Error eliminando gasto:', deleteError)
      return NextResponse.json(
        { error: 'Error al eliminar el gasto' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error en gastos DELETE:', e)
    return NextResponse.json(
      { error: 'Error al eliminar el gasto' },
      { status: 500 },
    )
  }
}
