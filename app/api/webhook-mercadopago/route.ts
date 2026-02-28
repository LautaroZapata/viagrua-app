import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Mercado Pago envía varios tipos de notificaciones, nos interesa payment
    if (body.type !== 'payment' && body.type !== 'merchant_order') {
      return NextResponse.json({ received: true, ignored: true })
    }

    // Obtener el id del pago
    const paymentId = body.data?.id || body['data.id']
    if (!paymentId) return NextResponse.json({ error: 'No payment id' }, { status: 400 })

    // Consultar el pago a la API de Mercado Pago para obtener detalles y metadatos
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    })
    const pago = await mpRes.json()
    if (!pago || pago.status !== 'approved') {
      return NextResponse.json({ received: true, ignored: 'not approved' })
    }

    // Obtener user_id de los metadatos
    const user_id = pago.metadata?.user_id
    if (!user_id) return NextResponse.json({ error: 'No user_id in metadata' }, { status: 400 })

    // Calcular nueva fecha de expiración (1 año desde hoy)
    const hoy = new Date()
    const expiracion = new Date(hoy)
    expiracion.setFullYear(hoy.getFullYear() + 1)

    // Actualizar el perfil en Supabase
    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({ plan: 'premium', plan_renovacion: expiracion.toISOString(), fecha_compra: hoy.toISOString() })
      .eq('id', user_id)

    if (error) {
      return NextResponse.json({ error: 'No se pudo actualizar el perfil', details: error }, { status: 500 })
    }

    return NextResponse.json({ received: true, updated: true })
  } catch (err) {
    return NextResponse.json({ error: 'Error en webhook', details: err }, { status: 500 })
  }
}
