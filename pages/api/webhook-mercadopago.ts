import type { NextApiRequest, NextApiResponse } from 'next';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Permitir POST, GET y OPTIONS para debug y CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  // Log de método y body para debug
  console.log('Webhook MercadoPago:', req.method, JSON.stringify(req.body));


  // Permitir GET para debug rápido
  const body = req.body || {};
  const paymentId = body.data && (body.data.id || body.data.payment_id);
  if (!paymentId) {
    return res.status(200).json({ ok: true, msg: 'No payment_id', method: req.method });
  }

  try {
    // Consultar el pago a MercadoPago
    const payment = await new Payment(mp).get({ id: paymentId });
    if (payment.status !== 'approved') {
      return res.status(200).json({ ok: true, msg: 'Pago no aprobado' });
    }

    // Obtener email del pagador y plan desde payment
    const email = payment.payer?.email;
    const plan = payment.additional_info?.items?.[0]?.id;
    if (!email || !plan) {
      return res.status(200).json({ ok: true, msg: 'Faltan datos para actualizar plan' });
    }

    // Actualizar el plan del usuario en Supabase
    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({ plan, plan_renovacion: new Date(Date.now() + (plan === 'anual' ? 365 : 30) * 24 * 60 * 60 * 1000) })
      .eq('email', email);

    if (error) {
      console.error('Error actualizando plan:', error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, updated: true });
  } catch (err: any) {
    console.error('Error en webhook:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
