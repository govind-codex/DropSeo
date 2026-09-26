import { Webhooks } from "@dodopayments/nextjs";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  if (!webhookKey || webhookKey.startsWith("replace_with")) {
    return new NextResponse("Dodo Payments webhook is not configured.", { status: 503 });
  }

  return Webhooks({
    webhookKey,
    // The adapter verifies every webhook signature before this callback runs.
    // Persist subscription events here when AudiFox adds its entitlement store.
    onPayload: async () => undefined,
  })(request);
}
