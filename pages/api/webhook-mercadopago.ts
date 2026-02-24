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

  // Log de método, body y access token para debug avanzado
  console.log('Webhook MercadoPago:', req.method, JSON.stringify(req.body));
  console.log('MP_ACCESS_TOKEN exists:', !!process.env.MP_ACCESS_TOKEN);
  console.log('MP_ACCESS_TOKEN (first 6):', process.env.MP_ACCESS_TOKEN?.slice(0, 6));


  // Permitir GET para debug rápido
  const body = req.body || {};
  const paymentId = body.data && (body.data.id || body.data.payment_id);
  console.log('paymentId:', paymentId);
  if (!paymentId) {
    console.warn('No payment_id en el body:', JSON.stringify(body));
    return res.status(200).json({ ok: true, msg: 'No payment_id', method: req.method });
  }

  try {
    // Consultar el pago a MercadoPago
    let payment;
    try {
      payment = await new Payment(mp).get({ id: paymentId });
      console.log('Payment encontrado:', JSON.stringify(payment));
    } catch (err: any) {
      console.error('Error buscando payment:', err.message, 'paymentId:', paymentId);
      return res.status(404).json({ ok: false, error: 'Payment not found', paymentId });
    }
    if (payment.status !== 'approved') {
      console.warn('Pago no aprobado:', payment.status, paymentId);
      return res.status(200).json({ ok: true, msg: 'Pago no aprobado' });
    }

    // Obtener email del pagador y plan desde payment
    const email = payment.payer?.email;
    const plan = payment.additional_info?.items?.[0]?.id;
    console.log('Datos extraídos del payment:', { email, plan });
    if (!email || !plan) {
      console.warn('Faltan datos para actualizar plan:', { email, plan });
      return res.status(200).json({ ok: true, msg: 'Faltan datos para actualizar plan' });
    }

    // Actualizar el plan del usuario en Supabase
    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({ plan, plan_renovacion: new Date(Date.now() + (plan === 'anual' ? 365 : 30) * 24 * 60 * 60 * 1000) })
      .eq('email', email);

    if (error) {
      console.error('Error actualizando plan:', error.message, { email, plan });
      return res.status(500).json({ ok: false, error: error.message });
    }

    console.log('Plan actualizado correctamente en Supabase para', email, 'nuevo plan:', plan);
    return res.status(200).json({ ok: true, updated: true });
  } catch (err: any) {
    console.error('Error en webhook:', err.message, err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
