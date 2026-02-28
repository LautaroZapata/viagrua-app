import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getPaymentInfo(paymentId: string) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return null;
  return resp.json();
}

export async function POST(req: NextRequest) {
  try {
    const { type, data } = await req.json();
    if (type !== "payment") {
      return NextResponse.json({ ok: true, message: "Not a payment notification" });
    }
    const paymentId = data?.id || data?.payment_id;
    if (!paymentId) return NextResponse.json({ ok: false, message: "No payment id" }, { status: 400 });
    const payment = await getPaymentInfo(paymentId);
    if (!payment) {
      return NextResponse.json({ ok: false, message: "Payment not found" }, { status: 404 });
    }
    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, message: "Payment not approved" });
    }
    const userId = payment.metadata?.user_id;
    const plan = payment.additional_info?.items?.[0]?.id;
    if (!userId || !plan) {
      return NextResponse.json({ ok: false, message: "Missing user_id or plan" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("perfiles")
      .update({ plan })
      .eq("id", userId);
    if (error) {
      return NextResponse.json({ ok: false, message: "Error actualizando plan", error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, message: "Plan actualizado", userId, plan });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: "Error en webhook", error: err }, { status: 500 });
  }
}
