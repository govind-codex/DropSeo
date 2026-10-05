import { Checkout } from "@dodopayments/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { authConfig, getSession, validMutationOrigin } from "@/lib/auth";
import { dodoCheckoutConfig, isDodoCheckoutUrl, isDodoPlan } from "@/lib/dodo";

export const runtime = "nodejs";

function statusRedirect(status: string) {
  return NextResponse.redirect(`${authConfig().origin}/checkout?status=${encodeURIComponent(status)}`, 303);
}

export async function POST(request: NextRequest) {
  if (!validMutationOrigin(request)) return new NextResponse("Invalid request origin.", { status: 403 });

  const user = await getSession();
  if (!user) return NextResponse.redirect(`${authConfig().origin}/api/auth/google`, 303);

  let plan: FormDataEntryValue | null;
  try {
    plan = (await request.formData()).get("plan");
  } catch {
    return statusRedirect("invalid-plan");
  }
  if (!isDodoPlan(plan)) return statusRedirect("invalid-plan");

  const config = dodoCheckoutConfig(plan);
  if (!config) return statusRedirect("configuration");

  const checkoutRequest = new NextRequest(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      product_cart: [{ product_id: config.productId, quantity: 1 }],
      customer: { email: user.email, name: user.name },
      metadata: { audifox_user_id: user.id, audifox_plan: plan },
      return_url: config.returnUrl,
      cancel_url: `${authConfig().origin}/checkout?status=cancelled`,
      customization: { theme: "light", theme_config: { pay_button_text: `Subscribe to ${plan === "pro" ? "Pro" : "Studio"}` } },
      feature_flags: { allow_discount_code: true },
    }),
  });

  try {
    const response = await Checkout({
      bearerToken: config.bearerToken,
      environment: config.environment,
      returnUrl: config.returnUrl,
      type: "session",
    })(checkoutRequest);

    if (!response.ok) return statusRedirect("error");
    const data = (await response.json()) as { checkout_url?: unknown };
    if (!isDodoCheckoutUrl(data.checkout_url)) return statusRedirect("error");
    return NextResponse.redirect(data.checkout_url, 303);
  } catch {
    return statusRedirect("error");
  }
}
