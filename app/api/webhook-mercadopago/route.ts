
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Webhook de Mercado Pago para notificaciones de pago.
 * Valida tipo de evento, consulta el pago y actualiza el usuario si corresponde.
 * Seguridad: nunca expone datos sensibles ni credenciales.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Solo procesar notificaciones relevantes
    if (body.type !== 'payment' && body.type !== 'merchant_order') {
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    // Validar y obtener el ID de pago
    const paymentId = body.data?.id || body['data.id'];
    if (!paymentId) {
      return NextResponse.json({ error: 'No payment id' }, { status: 400 });
    }

    // Consultar detalles del pago a la API oficial
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    });
    if (!mpRes.ok) {
      return NextResponse.json({ error: 'No se pudo consultar el pago', status: mpRes.status }, { status: 502 });
    }
    const pago = await mpRes.json();
    if (!pago || pago.status !== 'approved') {
      return NextResponse.json({ received: true, ignored: 'not approved' }, { status: 200 });
    }

    // Validar metadatos
    const user_id = pago.metadata?.user_id;
    if (!user_id) {
      return NextResponse.json({ error: 'No user_id in metadata' }, { status: 400 });
    }

    // Calcular nueva fecha de expiración (1 año desde hoy)
    const hoy = new Date();
    const expiracion = new Date(hoy);
    expiracion.setFullYear(hoy.getFullYear() + 1);

    // Actualizar el perfil en Supabase
    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({ plan: 'premium', plan_renovacion: expiracion.toISOString(), fecha_compra: hoy.toISOString() })
      .eq('id', user_id);

    if (error) {
      return NextResponse.json({ error: 'No se pudo actualizar el perfil', details: error }, { status: 500 });
    }

    return NextResponse.json({ received: true, updated: true }, { status: 200 });
  } catch (err) {
    // Log seguro de error
    console.error('Error en webhook:', err);
    return NextResponse.json({ error: 'Error en webhook', details: String(err) }, { status: 500 });
  }
}
