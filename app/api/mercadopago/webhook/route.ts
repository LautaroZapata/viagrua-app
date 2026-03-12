import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSubscription } from '@/lib/mercadopago'

export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Solo procesar notificaciones de suscripciones
        if (body.type !== 'subscription_preapproval') {
            return NextResponse.json({ ok: true })
        }

        const preapprovalId = body.data?.id
        if (!preapprovalId) {
            return NextResponse.json({ ok: true })
        }

        // Verificar estado real consultando a MP directamente
        const subscription = await getSubscription(preapprovalId)

        // Buscar usuario con este mp_subscription_id
        const { data: perfil } = await supabaseAdmin
            .from('perfiles')
            .select('id, plan')
            .eq('mp_subscription_id', preapprovalId)
            .single()

        if (!perfil) {
            // No hay usuario asociado, ignorar
            return NextResponse.json({ ok: true })
        }

        // Mapear estado de MP a plan
        const status = subscription.status
        const updates: Record<string, unknown> = {}

        if (status === 'authorized') {
            updates.plan = 'premium'
            // Calcular próxima renovación (1 mes desde ahora)
            const nextRenewal = new Date()
            nextRenewal.setMonth(nextRenewal.getMonth() + 1)
            updates.plan_renovacion = nextRenewal.toISOString()
        } else if (status === 'cancelled') {
            updates.plan = 'free'
            updates.mp_subscription_id = null
            updates.plan_renovacion = null
        } else if (status === 'paused') {
            updates.plan = 'free'
            updates.plan_renovacion = null
        }

        if (Object.keys(updates).length > 0) {
            await supabaseAdmin
                .from('perfiles')
                .update(updates)
                .eq('id', perfil.id)
        }

        return NextResponse.json({ ok: true })
    } catch (e) {
        console.error('Error en webhook MP:', e)
        // Siempre retornar 200 para que MP no reintente
        return NextResponse.json({ ok: true })
    }
}
