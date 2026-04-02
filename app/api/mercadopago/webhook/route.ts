import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSubscription } from '@/lib/mercadopago'
import { isValidPreapprovalId } from '@/lib/validation'

export async function POST(request: Request) {
    try {
        const body = await request.json()

        // --- HMAC signature verification ---
        const xSignature = request.headers.get('x-signature')
        const requestId = request.headers.get('x-request-id')
        const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET

        if (!webhookSecret) {
            console.warn('MERCADOPAGO_WEBHOOK_SECRET no configurado, omitiendo verificación de firma')
        } else {
            if (!xSignature || !requestId) {
                return new Response(JSON.stringify({ error: 'Firma ausente' }), { status: 401 })
            }

            // Parse x-signature format: "ts=...,v1=..."
            const parts: Record<string, string> = {}
            xSignature.split(',').forEach((part) => {
                const [key, value] = part.split('=', 2)
                if (key && value) parts[key.trim()] = value.trim()
            })
            const ts = parts['ts']
            const v1 = parts['v1']

            if (!ts || !v1) {
                return new Response(JSON.stringify({ error: 'Formato de firma inválido' }), { status: 401 })
            }

            const manifest = `id:${body.data?.id};request-id:${requestId};ts:${ts};`
            const computed = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex')

            if (computed !== v1) {
                return new Response(JSON.stringify({ error: 'Firma inválida' }), { status: 401 })
            }
        }

        // Solo procesar notificaciones de suscripciones
        if (body.type !== 'subscription_preapproval') {
            return NextResponse.json({ ok: true })
        }

        const preapprovalId = body.data?.id
        if (!preapprovalId || !isValidPreapprovalId(preapprovalId)) {
            return new Response(JSON.stringify({ error: 'preapprovalId inválido' }), { status: 400 })
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
