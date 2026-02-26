import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Utilidad para obtener datos de pago desde MercadoPago si es necesario
async function getPaymentInfo(paymentId: string) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return null;
  return resp.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    console.log('--- Webhook MercadoPago recibido ---');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    const { type, data } = req.body;
    // Solo procesar notificaciones de pagos
    if (type !== 'payment') {
      console.log('No es notificación de pago, type:', type);
      return res.status(200).json({ ok: true, message: 'Not a payment notification' });
    }

    // Obtener info del pago desde MercadoPago
    const paymentId = data?.id || data?.payment_id;
    console.log('paymentId:', paymentId);
    if (!paymentId) return res.status(400).json({ ok: false, message: 'No payment id' });
    const payment = await getPaymentInfo(paymentId);
    if (!payment) {
      console.log('No se encontró el pago en MercadoPago');
      return res.status(404).json({ ok: false, message: 'Payment not found' });
    }

    console.log('Payment status:', payment.status);
    if (payment.status !== 'approved') {
      console.log('El pago no está aprobado, status:', payment.status);
      return res.status(200).json({ ok: true, message: 'Payment not approved' });
    }

    // Recuperar user_id y plan desde la preferencia
    console.log('Metadata:', payment.metadata);
    const userId = payment.metadata?.user_id;
    const plan = payment.additional_info?.items?.[0]?.id;
    if (!userId || !plan) {
      console.log('Falta user_id o plan en metadata:', payment.metadata, 'plan:', plan);
      return res.status(400).json({ ok: false, message: 'Missing user_id or plan' });
    }

    // Actualizar el plan del usuario en Supabase usando el id
    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({ plan })
      .eq('id', userId);

    if (error) {
      console.error('Error actualizando plan:', error);
      return res.status(500).json({ ok: false, message: 'Error actualizando plan', error });
    }

    console.log('Plan actualizado correctamente para userId:', userId, 'nuevo plan:', plan);
    return res.status(200).json({ ok: true, message: 'Plan actualizado', userId, plan });
  } catch (err) {
    console.error('Error en webhook MP:', err);
    return res.status(500).json({ ok: false, message: 'Error en webhook', error: err });
  }
}
