import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN as string,
});

const PLANES: Record<string, { nombre: string; precio: number; descripcion: string }> = {
  mensual: {
    nombre: "Plan Mensual",
    precio: 10,
    descripcion: "Acceso completo por 1 mes",
  },
  anual: {
    nombre: "Plan Anual",
    precio: 20,
    descripcion: "Acceso completo por 1 año (2 meses bonificados)",
  },
};

export async function POST(req: NextRequest) {
  const { plan, email, user_id } = await req.json();
  if (!plan || !email || !user_id) {
    return NextResponse.json({ ok: false, message: "Faltan datos requeridos (plan, email, user_id)" }, { status: 400 });
  }
  const planInfo = PLANES[plan];
  if (!planInfo) {
    return NextResponse.json({ ok: false, message: "Plan inválido" }, { status: 400 });
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
            currency_id: "UYU",
          },
        ],
        payer: { email },
        metadata: { user_id },
        back_urls: {
          success: process.env.NEXT_PUBLIC_MP_SUCCESS_URL || "https://viagrua-app.vercel.app/dashboard",
          failure: process.env.NEXT_PUBLIC_MP_FAILURE_URL || "https://viagrua-app.vercel.app/dashboard",
          pending: process.env.NEXT_PUBLIC_MP_PENDING_URL || "https://viagrua-app.vercel.app/dashboard",
        },
        auto_return: "approved",
        notification_url: process.env.NEXT_PUBLIC_MP_WEBHOOK_URL || "https://viagrua-app.vercel.app/api/suscripciones/webhook",
      },
    });
    return NextResponse.json({ ok: true, init_point: result.init_point });
  } catch (err: any) {
    console.error("[MercadoPago Error]", err);
    return NextResponse.json({ ok: false, message: err.message || JSON.stringify(err) || "Error creando preferencia" }, { status: 500 });
  }
}
