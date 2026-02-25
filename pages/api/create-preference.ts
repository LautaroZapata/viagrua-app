import type { NextApiRequest, NextApiResponse } from 'next';

// MercadoPago integration disabled - stub endpoint
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  return res.status(501).json({ ok: false, message: 'Integración con MercadoPago deshabilitada. Reimplementa create-preference cuando estés listo.' });
}
