import type { NextApiRequest, NextApiResponse } from 'next';

// MercadoPago webhook disabled - keep endpoint to avoid 404s but do nothing
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Accept POST for compatibility but respond that integration is disabled
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'OPTIONS') return res.status(405).end();
  console.log('Webhook endpoint called but MercadoPago integration is disabled.');
  return res.status(410).json({ ok: false, message: 'MercadoPago integration disabled' });
}
