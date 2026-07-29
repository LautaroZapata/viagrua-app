import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { auditLog } from '@/lib/audit'
import { isValidUUID } from '@/lib/validation'
import { nuevoGastoSchema, parsear } from '@/lib/schemas'

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

    // El esquema sanitiza y valida de una: no hay forma de usar un campo sin
    // que haya pasado por ahi.
    const parseo = parsear(nuevoGastoSchema, body)
    if (!parseo.ok || !parseo.data) {
      return NextResponse.json({ error: parseo.error }, { status: 400 })
    }
    const { empresa_id: empresaId, user_id: userId, tipo, importe, fecha, descripcion } = parseo.data

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
        usuario_id: user.id,
        tipo,
        importe,
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

    auditLog({ userId: user.id, empresaId, action: 'create_gasto', details: { tipo, importe } })

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
      .select('id, empresa_id, usuario_id')
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

    if (perfil.rol !== 'admin' && gasto.usuario_id !== user.id) {
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

    auditLog({ userId: user.id, empresaId: perfil.empresa_id, action: 'delete_gasto', details: { gastoId } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error en gastos DELETE:', e)
    return NextResponse.json(
      { error: 'Error al eliminar el gasto' },
      { status: 500 },
    )
  }
}
