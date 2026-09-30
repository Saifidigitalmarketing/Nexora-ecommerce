import { NextResponse } from "next/server";

/**
 * Placeholder for online payment gateway callbacks. No gateway is enabled
 * yet, so every call is rejected. See src/lib/payments/index.ts for the
 * integration steps (verify signature → update payments with a server-side
 * service-role client).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return NextResponse.json({ error: `Payment provider "${provider}" is not configured` }, { status: 501 });
}
