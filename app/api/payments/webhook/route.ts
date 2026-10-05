import { Webhooks } from "@dodopayments/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { syncDodoSubscription } from "@/lib/plan-entitlements";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  if (!webhookKey || webhookKey.startsWith("replace_with")) {
    return new NextResponse("Dodo Payments webhook is not configured.", { status: 503 });
  }

  return Webhooks({
    webhookKey,
    // The adapter verifies every webhook signature before this callback runs.
    onPayload: syncDodoSubscription,
  })(request);
}
