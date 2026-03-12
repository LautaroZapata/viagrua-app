import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSubscription } from '@/lib/mercadopago'

export async function POST(request: Request) {
    try {
        // Leer payer_email del body
        const body = await request.json().catch(() => ({}))
        const payerEmail = body.payer_email

        if (!payerEmail || !payerEmail.includes('@')) {
            return NextResponse.json({ error: 'Email de Mercado Pago requerido' }, { status: 400 })
        }

        // Autenticar usuario
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // Obtener perfil
        const { data: perfil, error: perfilError } = await supabase
            .from('perfiles')
            .select('id, plan, mp_subscription_id')
            .eq('id', user.id)
            .single()

        if (perfilError || !perfil) {
            return NextResponse.json({ error: 'No se pudo obtener el perfil' }, { status: 403 })
        }

        if (perfil.plan === 'premium' || perfil.plan === 'admin') {
            return NextResponse.json({ error: 'Ya tienes un plan activo' }, { status: 400 })
        }

        // Crear suscripción en Mercado Pago
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const backUrl = `${appUrl}/planes?status=pending`

        const preapproval = await createSubscription(payerEmail, backUrl)

        // Guardar mp_subscription_id en el perfil
        const { error: updateError } = await supabaseAdmin
            .from('perfiles')
            .update({ mp_subscription_id: preapproval.id })
            .eq('id', user.id)

        if (updateError) {
            console.error('Error guardando subscription_id:', updateError)
        }

        return NextResponse.json({ init_point: preapproval.init_point })
    } catch (e) {
        console.error('Error en subscribe:', e)
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Error al crear suscripción' },
            { status: 500 }
        )
    }
}
