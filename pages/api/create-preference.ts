import type { NextApiRequest, NextApiResponse } from 'next';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, email } = req.body;
  // Validar email simple
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email inválido o faltante' });
  }

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
          success: 'https://via-grua.vercel.app/dashboard',
          failure: 'https://via-grua.vercel.app/planes',
          pending: 'https://via-grua.vercel.app/planes',
        },
        auto_return: 'approved',
      },
    });

    res.status(200).json({ init_point: preference.init_point });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
