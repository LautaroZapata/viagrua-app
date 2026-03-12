import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cancelSubscription } from '@/lib/mercadopago'

export async function POST() {
    try {
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

        if (!perfil.mp_subscription_id) {
            return NextResponse.json({ error: 'No tienes una suscripción activa' }, { status: 400 })
        }

        // Cancelar en Mercado Pago
        await cancelSubscription(perfil.mp_subscription_id)

        // Actualizar perfil
        await supabaseAdmin
            .from('perfiles')
            .update({
                plan: 'free',
                mp_subscription_id: null,
                plan_renovacion: null,
            })
            .eq('id', user.id)

        return NextResponse.json({ ok: true })
    } catch (e) {
        console.error('Error en cancel:', e)
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Error al cancelar suscripción' },
            { status: 500 }
        )
    }
}
