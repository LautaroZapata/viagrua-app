
import type { NextApiRequest, NextApiResponse } from 'next';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-8078021007464437-022608-fc0716c2c81f42cc621f1fade1d1aa95-3224513426',
});



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Recibe { plan, email } desde el frontend
  const { plan, email } = req.body;
  if (!plan || !email) {
    return res.status(400).json({ ok: false, message: 'Faltan datos requeridos (plan, email)' });
  }

  // Define los planes y precios (debería estar sincronizado con el frontend)
  const PLANES: Record<string, { nombre: string; precio: number; descripcion: string }> = {
    mensual: {
      nombre: 'Plan Mensual',
      precio: 10,
      descripcion: 'Acceso completo por 1 mes',
    },
    anual: {
      nombre: 'Plan Anual',
      precio: 20,
      descripcion: 'Acceso completo por 1 año (2 meses bonificados)',
    },
  };

  const planInfo = PLANES[plan];
  if (!planInfo) {
    return res.status(400).json({ ok: false, message: 'Plan inválido' });
  }

  const preference = new Preference(client);

  try {
    const result = await preference.create({
      body: {
        items: [
          {
            id: plan,
            title: planInfo.nombre,
            description: planInfo.descripcion,
            unit_price: planInfo.precio,
            quantity: 1,
          },
        ],
        payer: { email },
        back_urls: {
          success: process.env.NEXT_PUBLIC_MP_SUCCESS_URL || 'https://viagrua-app.vercel.app/dashboard',
          failure: process.env.NEXT_PUBLIC_MP_FAILURE_URL || 'https://viagrua-app.vercel.app/dashboard',
          pending: process.env.NEXT_PUBLIC_MP_PENDING_URL || 'https://viagrua-app.vercel.app/dashboard',
        },
        auto_return: 'approved',
        notification_url: process.env.NEXT_PUBLIC_MP_WEBHOOK_URL || 'https://viagrua-app.vercel.app/api/webhook-mercadopago',
      },
    });
    return res.status(200).json({ ok: true, id: result.id, init_point: result.init_point });
  } catch (error) {
    console.error('Error creando preferencia MP:', error);
    return res.status(500).json({ ok: false, message: 'Error creando preferencia', error });
  }
}
