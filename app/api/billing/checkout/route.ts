import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  let reportId: string;
  try {
    const body = await req.json();
    reportId = (body?.reportId ?? "").toString();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rows = await sql`select id, url, unlocked from reports where id = ${reportId} limit 1`;
  const report = rows[0] as any;
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  if (report.unlocked) {
    return NextResponse.json({ error: "Already unlocked." }, { status: 400 });
  }

  const priceId = process.env.STRIPE_UNLOCK_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Checkout isn't configured yet." }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://actlayer.eu";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { reportId: report.id },
      success_url: `${siteUrl}/report/${report.id}?unlocked=true`,
      cancel_url: `${siteUrl}/report/${report.id}?canceled=true`,
    });
    await sql`update reports set stripe_session_id = ${session.id} where id = ${report.id}`;
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[billing/checkout] Stripe error:", err?.message || err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
