
import { NextRequest, NextResponse } from 'next/server'

/**
 * Endpoint para crear una preferencia de pago de Mercado Pago (Checkout Pro)
 * Valida datos, maneja errores y retorna el link seguro de pago.
 * Seguridad: nunca expone credenciales ni datos sensibles.
 */
export async function POST(req: NextRequest) {
  try {
    // Validación de payload
    const { user_id, email } = await req.json();
    if (!user_id || typeof user_id !== 'string' || !email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Faltan o son inválidos los datos de usuario' }, { status: 400 });
    }

    // Construcción de preferencia según documentación oficial MCP server
    const notificationUrl = process.env.NEXT_PUBLIC_URL + '/api/webhook-mercadopago';
    const preference = {
      items: [
        {
          title: 'Plan Premium ViaGrua (1 año)',
          description: 'Suscripción anual a ViaGrua con traslados ilimitados y acceso premium',
          quantity: 1,
          currency_id: 'UYU',
          unit_price: 990,
          category_id: 'services',
        },
      ],
      payer: { email },
      metadata: { user_id },
      external_reference: user_id,
      back_urls: {
        success: process.env.NEXT_PUBLIC_URL + '/dashboard',
        failure: process.env.NEXT_PUBLIC_URL + '/dashboard',
        pending: process.env.NEXT_PUBLIC_URL + '/dashboard',
      },
      auto_return: 'approved',
      notification_url: notificationUrl,
    };

    // Llamada segura a la API de Mercado Pago
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    // Validación de respuesta
    const mpText = await mpRes.text();
    let mpData;
    try {
      mpData = JSON.parse(mpText);
    } catch (e) {
      mpData = { raw: mpText };
    }
    if (!mpRes.ok || !mpData.init_point) {
      // Log seguro para debugging
      console.error('MercadoPago error:', mpData);
      return NextResponse.json({ error: 'No se pudo generar el link de pago', mpData }, { status: 502 });
    }

    // Retornar el link seguro de pago
    return NextResponse.json({ url: mpData.init_point }, { status: 200 });
  } catch (err) {
    // Manejo de error inesperado
    console.error('Error generando preferencia:', err);
    return NextResponse.json({ error: 'Error generando link de pago', details: String(err) }, { status: 500 });
  }
}
