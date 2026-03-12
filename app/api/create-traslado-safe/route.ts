import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateTrasladoInput } from '@/lib/validation'

const MAX_BODY_SIZE = 10_000 // 10KB máximo para el body JSON

export async function POST(request: Request) {
  try {
    // Verificar Content-Type
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type debe ser application/json' }, { status: 415 })
    }

    // Leer body con límite de tamaño
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

    // Validar y sanitizar todos los campos
    const validation = validateTrasladoInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { data: input } = validation

    // Autenticación
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.id !== input.user_id) {
      return NextResponse.json({ error: 'Usuario no coincide con la sesión' }, { status: 403 })
    }

    // Verificar perfil y permisos
    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('empresa_id, rol')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json({ error: 'No se pudo verificar el perfil' }, { status: 403 })
    }

    if (perfil.empresa_id !== input.empresa_id) {
      return NextResponse.json({ error: 'No tienes permiso para crear traslados en esta empresa' }, { status: 403 })
    }

    // Verificar que el chofer pertenece a la misma empresa
    const { data: choferPerfil, error: choferError } = await supabase
      .from('perfiles')
      .select('empresa_id')
      .eq('id', input.chofer_id)
      .single()

    if (choferError || !choferPerfil || choferPerfil.empresa_id !== input.empresa_id) {
      return NextResponse.json({ error: 'El chofer no pertenece a esta empresa' }, { status: 403 })
    }

    // Insertar con datos ya sanitizados
    const { data: traslado, error: insertError } = await supabaseAdmin
      .from('traslados')
      .insert({
        empresa_id: input.empresa_id,
        chofer_id: input.chofer_id,
        marca_modelo: input.marca_modelo,
        matricula: input.matricula,
        es_0km: !!input.es_0km,
        importe_total: input.importe_total ? Number(input.importe_total) : null,
        observaciones: input.observaciones,
        desde: input.desde,
        hasta: input.hasta,
        estado: 'pendiente',
        estado_pago: 'pendiente',
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Error al crear el traslado' },
        { status: 500 }
      )
    }

    return NextResponse.json({ traslado })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al crear el traslado' },
      { status: 500 }
    )
  }
}
