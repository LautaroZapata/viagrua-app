import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Endpoint server-side: intenta incrementar el contador de traslados (optimistic locking)
// y luego crea el traslado. Retorna el traslado creado.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Require service role key for admin operations to avoid anonymous requests
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set — aborting admin operation')
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set on server. Set this env var and restart the dev server.' })
  }

  try {
    const {
      user_id,
      empresa_id,
      chofer_id,
      marca_modelo,
      matricula,
      es_0km,
      importe_total,
      observaciones,
      desde,
      hasta
    } = req.body

    if (!user_id || !empresa_id || !chofer_id || !marca_modelo) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Obtener perfil y plan
    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('id, plan, traslados_mes_actual')
      .eq('id', user_id)
      .single()

    if (!perfil) return res.status(404).json({ error: 'Perfil not found' })

    const PLANES: Record<string, { traslados_max: number | null }> = {
      free: { traslados_max: 30 },
      mensual: { traslados_max: null },
      anual: { traslados_max: null }
    }

    const planKey = perfil.plan || 'free'
    const trasladosMax = PLANES[planKey].traslados_max

    // Si es free, verificar y actualizar contador con optimistic locking
    if (planKey === 'free') {
      const current = perfil.traslados_mes_actual || 0
      if (trasladosMax !== null && current >= trasladosMax) {
        return res.status(403).json({ error: 'Límite de traslados alcanzado' })
      }

      // Intentar incrementar condicionando por el valor actual (evita algunos races)
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('perfiles')
        .update({ traslados_mes_actual: current + 1 })
        .eq('id', user_id)
        .eq('traslados_mes_actual', current)
        .select()

      if (updateError) {
        console.error('Error incrementando contador:', updateError)
        return res.status(500).json({ error: 'Error incrementando contador' })
      }

      if (!updated || (Array.isArray(updated) && updated.length === 0)) {
        // Conflicto concurrente
        return res.status(409).json({ error: 'Conflicto al intentar reservar traslado. Reintentar.' })
      }
    }

    // Crear traslado (con rol admin)
    const { data: traslado, error: insertError } = await supabaseAdmin
      .from('traslados')
      .insert([{
        empresa_id,
        chofer_id,
        marca_modelo,
        matricula: es_0km ? null : matricula,
        es_0km: es_0km || false,
        importe_total: importe_total ? parseFloat(importe_total) : null,
        observaciones: observaciones || null,
        desde: desde || null,
        hasta: hasta || null,
        estado: 'pendiente',
        estado_pago: 'pendiente'
      }])
      .select()
      .single()

    if (insertError || !traslado) {
      // Si falló la inserción y ya incrementamos el contador, intentar decrementar
      if (planKey === 'free') {
        await supabaseAdmin.from('perfiles').update({ traslados_mes_actual: perfil.traslados_mes_actual || 0 }).eq('id', user_id)
      }
      console.error('Error creando traslado:', insertError)
      return res.status(500).json({ error: 'Error creando traslado' })
    }

    return res.status(201).json({ traslado })
  } catch (err) {
    console.error('create-traslado-safe error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
