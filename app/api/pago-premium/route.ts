import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { user_id, email } = await req.json()
    if (!user_id || !email) {
      return NextResponse.json({ error: 'Faltan datos de usuario' }, { status: 400 })
    }

    // Datos del plan premium
    const preference = {
      items: [
        {
          title: 'Plan Premium ViaGrua (1 año)',
          quantity: 1,
          currency_id: 'UYU',
          unit_price: 990, // Cambia el precio según tu plan
        },
      ],
      payer: {
        email,
        // Puedes agregar más datos si los tienes
      },
      metadata: {
        user_id,
      },
      back_urls: {
        success: process.env.NEXT_PUBLIC_URL + '/dashboard',
        failure: process.env.NEXT_PUBLIC_URL + '/dashboard',
        pending: process.env.NEXT_PUBLIC_URL + '/dashboard',
      },
      auto_return: 'approved',
    }

    // Llamada a la API de Mercado Pago
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    })
    const mpText = await mpRes.text();
    let mpData;
    try {
      mpData = JSON.parse(mpText);
    } catch (e) {
      mpData = { raw: mpText };
    }
    if (!mpData.init_point) {
      console.error('MercadoPago error:', mpData);
      return NextResponse.json({ error: 'No se pudo generar el link de pago', mpData }, { status: 500 })
    }
    return NextResponse.json({ url: mpData.init_point })
  } catch (err) {
    return NextResponse.json({ error: 'Error generando link de pago', details: err }, { status: 500 })
  }
}
