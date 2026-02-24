import type { NextApiRequest, NextApiResponse } from 'next';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, email } = req.body;

  const precios: Record<string, number> = {
    mensual: 10,
    anual: 20,
  };

  if (!precios[plan]) return res.status(400).json({ error: 'Plan inválido' });

  try {
    const preference = await new Preference(client).create({
      body: {
        items: [
          {
            id: plan,
            title: `Suscripción ViaGrua (${plan})`,
            quantity: 1,
            currency_id: 'UYU',
            unit_price: precios[plan],
          },
        ],
        payer: { email },
        back_urls: {
          success: 'https://tu-app.com/pago-exitoso',
          failure: 'https://tu-app.com/pago-fallido',
          pending: 'https://tu-app.com/pago-pendiente',
        },
        auto_return: 'approved',
      },
    });

    res.status(200).json({ init_point: preference.init_point });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
