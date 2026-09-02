import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { runScan } from "@/lib/checks";

export async function POST(req: NextRequest) {
  let url: string;
  try {
    const body = await req.json();
    url = (body?.url ?? "").toString().trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: "Enter a URL to scan." }, { status: 400 });
  }

  let result;
  try {
    result = await runScan(url);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Scan failed." }, { status: 422 });
  }

  const rows = await sql`
    insert into reports (url, score, findings)
    values (${result.url}, ${result.score}, ${JSON.stringify(result.findings)}::jsonb)
    returning id
  `;
  const id = (rows[0] as any).id;

  return NextResponse.json({ id });
}

export const dynamic = "force-dynamic";
