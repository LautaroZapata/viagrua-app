import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      user_id: userId,
      empresa_id: empresaId,
      chofer_id: choferId,
      marca_modelo: marcaModelo,
      matricula,
      es_0km: es0km,
      importe_total: importeTotal,
      observaciones,
      desde,
      hasta,
    } = body

    if (!userId || !empresaId || !choferId || !marcaModelo) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: user_id, empresa_id, chofer_id, marca_modelo' },
        { status: 400 }
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

    if (user.id !== userId) {
      return NextResponse.json({ error: 'Usuario no coincide con la sesión' }, { status: 403 })
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('empresa_id, rol')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json({ error: 'No se pudo verificar el perfil' }, { status: 403 })
    }

    if (perfil.empresa_id !== empresaId) {
      return NextResponse.json({ error: 'No tienes permiso para crear traslados en esta empresa' }, { status: 403 })
    }

    const { data: traslado, error: insertError } = await supabaseAdmin
      .from('traslados')
      .insert({
        empresa_id: empresaId,
        chofer_id: choferId,
        marca_modelo: marcaModelo,
        matricula: es0km ? null : matricula || null,
        es_0km: !!es0km,
        importe_total: importeTotal ? Number(importeTotal) : null,
        observaciones: observaciones || null,
        desde: desde || null,
        hasta: hasta || null,
        estado: 'pendiente',
        estado_pago: 'pendiente',
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
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
